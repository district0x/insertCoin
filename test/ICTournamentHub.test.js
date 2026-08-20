const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

/**
 * ICTournamentHub — standalone tournament satellite contract.
 *
 * User-created tournaments with entry-fee pots, optional creator seed,
 * whole-tournament donations, admin-only fund allocation, payout split with
 * no platform cut, money-less bracket matches gated to participants, and
 * EIP-2771 gasless support. Roles are delegated to the IC proxy.
 */
describe("ICTournamentHub", function () {
    let ic, hub, token;
    let owner, moderator, admin, creator, outsider, players;

    const ENTRY = ethers.parseUnits("10", 18);
    const SEED = ethers.parseUnits("50", 18);
    const TOKEN_FLOAT = ethers.parseUnits("100000", 18);
    const SF6 = 1;

    const OPEN = 1n, LIVE = 2n, COMPLETED = 3n, CANCELLED = 4n;

    async function createTournament(overrides = {}) {
        const args = {
            gameId: SF6,
            token: token.target,
            entryFee: ENTRY,
            maxEntrants: 0,
            payoutSplit: [60, 30, 10],
            seedAmount: 0,
            name: "Test Cup",
            description: "A test tournament",
            from: creator,
            ...overrides,
        };
        await hub.connect(args.from).createTournament(
            args.gameId,
            args.token,
            args.entryFee,
            args.maxEntrants,
            args.payoutSplit,
            args.seedAmount,
            args.name,
            args.description
        );
        return Number(await hub.nextTournamentId()) - 1;
    }

    beforeEach(async function () {
        const signers = await ethers.getSigners();
        [owner, moderator, admin, creator, outsider] = signers;
        players = signers.slice(5, 20);

        const MockERC20 = await ethers.getContractFactory("MockERC20");
        token = await MockERC20.deploy();
        await token.waitForDeployment();

        // IC proxy provides roles/blacklist/approved tokens/min donation
        const IC = await ethers.getContractFactory("IC");
        ic = await upgrades.deployProxy(IC, [], { initializer: "initialize", kind: "transparent" });
        await ic.waitForDeployment();

        await ic.connect(owner).addAdmin(owner.address);
        await ic.connect(owner).addAdmin(admin.address);
        await ic.connect(owner).addModerator(moderator.address);
        await ic.connect(owner).approveToken(token.target, true);

        const Hub = await ethers.getContractFactory("ICTournamentHub");
        hub = await upgrades.deployProxy(Hub, [ic.target], { initializer: "initialize", kind: "transparent" });
        await hub.waitForDeployment();

        for (const w of [creator, admin, outsider, ...players]) {
            await token.mint(w.address, TOKEN_FLOAT);
            await token.connect(w).approve(hub.target, TOKEN_FLOAT);
        }
    });

    describe("createTournament", function () {
        it("creates an OPEN tournament and emits full metadata", async function () {
            await expect(
                hub.connect(creator).createTournament(
                    SF6, token.target, ENTRY, 8, [60, 30, 10], 0, "Test Cup", "A test tournament"
                )
            )
                .to.emit(hub, "TournamentCreated")
                .withArgs(1, creator.address, token.target, SF6, ENTRY, 8, [60, 30, 10], 0, "Test Cup", "A test tournament");

            const t = await hub.tournaments(1);
            expect(t.creator).to.equal(creator.address);
            expect(t.status).to.equal(OPEN);
            expect(t.entrantCount).to.equal(0n);
            expect(await hub.getPayoutSplit(1)).to.deep.equal([60n, 30n, 10n]);
        });

        it("pulls the optional pot seed in the same transaction", async function () {
            const before = await token.balanceOf(creator.address);
            const id = await createTournament({ seedAmount: SEED });

            expect(before - (await token.balanceOf(creator.address))).to.equal(SEED);
            expect(await hub.getPotBalance(id)).to.equal(SEED);
            expect(await hub.contributions(id, creator.address)).to.equal(SEED);
        });

        it("supports free tournaments (entryFee 0)", async function () {
            const id = await createTournament({ entryFee: 0 });
            await hub.connect(players[0]).joinTournament(id);
            expect(await hub.getPotBalance(id)).to.equal(0n);
            expect(await hub.isParticipant(id, players[0].address)).to.equal(true);
        });

        it("rejects payout splits that do not sum to 100", async function () {
            await expect(createTournament({ payoutSplit: [60, 30] }))
                .to.be.revertedWithCustomError(hub, "InvalidPayoutSplit");
            await expect(createTournament({ payoutSplit: [] }))
                .to.be.revertedWithCustomError(hub, "InvalidPayoutSplit");
            await expect(createTournament({ payoutSplit: [100, 0] }))
                .to.be.revertedWithCustomError(hub, "InvalidPayoutSplit");
        });

        it("rejects unapproved tokens and maxEntrants of 1", async function () {
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const other = await MockERC20.deploy();
            await expect(createTournament({ token: other.target }))
                .to.be.revertedWithCustomError(hub, "TokenNotApproved");
            await expect(createTournament({ maxEntrants: 1 }))
                .to.be.revertedWithCustomError(hub, "InvalidMaxEntrants");
        });

        it("rejects blacklisted creators", async function () {
            await ic.connect(owner).addBlacklisted(creator.address);
            await expect(createTournament()).to.be.revertedWithCustomError(hub, "IsBlacklisted");
        });
    });

    describe("joinTournament / leaveTournament", function () {
        let id;
        beforeEach(async function () {
            id = await createTournament({ maxEntrants: 3 });
        });

        it("pulls the entry fee into the pot and marks participation", async function () {
            await expect(hub.connect(players[0]).joinTournament(id))
                .to.emit(hub, "TournamentJoined")
                .withArgs(id, players[0].address);

            expect(await hub.isParticipant(id, players[0].address)).to.equal(true);
            expect(await hub.getPotBalance(id)).to.equal(ENTRY);
        });

        it("lets the creator join their own tournament, paying the entry fee", async function () {
            const before = await token.balanceOf(creator.address);
            await expect(hub.connect(creator).joinTournament(id))
                .to.emit(hub, "TournamentJoined")
                .withArgs(id, creator.address);

            expect(await hub.isParticipant(id, creator.address)).to.equal(true);
            expect(before - (await token.balanceOf(creator.address))).to.equal(ENTRY);
        });

        it("rejects double joins and enforces the max entrant limit", async function () {
            await hub.connect(players[0]).joinTournament(id);
            await expect(hub.connect(players[0]).joinTournament(id))
                .to.be.revertedWithCustomError(hub, "AlreadyJoined");

            await hub.connect(players[1]).joinTournament(id);
            await hub.connect(players[2]).joinTournament(id);
            await expect(hub.connect(players[3]).joinTournament(id))
                .to.be.revertedWithCustomError(hub, "TournamentFull");
        });

        it("refunds the entry fee when leaving while OPEN and frees the slot", async function () {
            await hub.connect(players[0]).joinTournament(id);
            const before = await token.balanceOf(players[0].address);

            await expect(hub.connect(players[0]).leaveTournament(id))
                .to.emit(hub, "TournamentLeft")
                .withArgs(id, players[0].address, ENTRY);

            expect((await token.balanceOf(players[0].address)) - before).to.equal(ENTRY);
            expect(await hub.isParticipant(id, players[0].address)).to.equal(false);
            expect(await hub.getPotBalance(id)).to.equal(0n);

            // slot freed — can rejoin
            await hub.connect(players[0]).joinTournament(id);
        });

        it("blocks leaving once the tournament is LIVE", async function () {
            await hub.connect(players[0]).joinTournament(id);
            await hub.connect(players[1]).joinTournament(id);
            await hub.connect(players[2]).joinTournament(id);
            await hub.connect(creator).startTournament(id);

            await expect(hub.connect(players[0]).leaveTournament(id))
                .to.be.revertedWithCustomError(hub, "NotOpen");
        });
    });

    describe("startTournament", function () {
        let id;
        beforeEach(async function () {
            id = await createTournament();
        });

        it("creator or admin can start once enough players joined", async function () {
            for (let i = 0; i < 3; i++) await hub.connect(players[i]).joinTournament(id);

            await expect(hub.connect(creator).startTournament(id))
                .to.emit(hub, "TournamentStarted")
                .withArgs(id, creator.address);
            expect((await hub.tournaments(id)).status).to.equal(LIVE);
        });

        it("requires at least one participant per payout slot", async function () {
            // 3-way split but only 2 players — completing would be impossible
            await hub.connect(players[0]).joinTournament(id);
            await hub.connect(players[1]).joinTournament(id);
            await expect(hub.connect(creator).startTournament(id))
                .to.be.revertedWithCustomError(hub, "NotEnoughParticipants");
        });

        it("rejects random callers", async function () {
            for (let i = 0; i < 3; i++) await hub.connect(players[i]).joinTournament(id);
            await expect(hub.connect(outsider).startTournament(id))
                .to.be.revertedWithCustomError(hub, "NotAuthorized");
        });
    });

    describe("donations & admin funding", function () {
        let id;
        beforeEach(async function () {
            id = await createTournament();
        });

        it("accepts whole-tournament donations and tracks donor totals", async function () {
            const amount = ethers.parseUnits("25", 18);
            await expect(hub.connect(outsider).donateToTournament(id, amount))
                .to.emit(hub, "TournamentDonation")
                .withArgs(id, outsider.address, amount);

            expect(await hub.getPotBalance(id)).to.equal(amount);
            expect(await hub.tournamentDonations(id, outsider.address)).to.equal(amount);
        });

        it("enforces the IC minimum donation", async function () {
            const min = await ic.minDonationAmount();
            await expect(hub.connect(outsider).donateToTournament(id, min - 1n))
                .to.be.revertedWithCustomError(hub, "BelowMinDonation");
        });

        it("lets only admins allocate funds to a tournament", async function () {
            const amount = ethers.parseUnits("100", 18);
            await expect(hub.connect(admin).fundTournament(id, amount))
                .to.emit(hub, "TournamentFundedByAdmin")
                .withArgs(id, admin.address, amount);
            expect(await hub.getPotBalance(id)).to.equal(amount);

            await expect(hub.connect(outsider).fundTournament(id, amount))
                .to.be.revertedWithCustomError(hub, "NotAuthorized");
        });
    });

    describe("completeTournament", function () {
        let id;
        beforeEach(async function () {
            id = await createTournament({ seedAmount: SEED });
            for (let i = 0; i < 4; i++) await hub.connect(players[i]).joinTournament(id);
            await hub.connect(creator).startTournament(id);
        });

        it("pays the split with no platform cut; dust goes to first place", async function () {
            const pot = await hub.getPotBalance(id); // 50 seed + 4 * 10 entry = 90
            const winners = [players[0], players[1], players[2]];
            const balancesBefore = await Promise.all(winners.map((w) => token.balanceOf(w.address)));

            const p1 = (pot * 60n) / 100n;
            const p2 = (pot * 30n) / 100n;
            const p3 = (pot * 10n) / 100n;
            const dust = pot - (p1 + p2 + p3);

            await expect(
                hub.connect(moderator).completeTournament(id, winners.map((w) => w.address))
            )
                .to.emit(hub, "TournamentCompleted")
                .withArgs(id, winners.map((w) => w.address), [p1 + dust, p2, p3]);

            const gains = await Promise.all(
                winners.map(async (w, i) => (await token.balanceOf(w.address)) - balancesBefore[i])
            );
            expect(gains[0]).to.equal(p1 + dust);
            expect(gains[1]).to.equal(p2);
            expect(gains[2]).to.equal(p3);
            expect(gains[0] + gains[1] + gains[2]).to.equal(pot); // full pot, no cut

            expect(await hub.getPotBalance(id)).to.equal(0n);
            expect((await hub.tournaments(id)).status).to.equal(COMPLETED);
        });

        it("rejects winners that are not participants (creator included)", async function () {
            await expect(
                hub.connect(moderator).completeTournament(id, [players[0].address, players[1].address, creator.address])
            ).to.be.revertedWithCustomError(hub, "InvalidWinner");
        });

        it("rejects duplicate winners and wrong winner counts", async function () {
            await expect(
                hub.connect(moderator).completeTournament(id, [players[0].address, players[0].address, players[1].address])
            ).to.be.revertedWithCustomError(hub, "DuplicateWinner");

            await expect(
                hub.connect(moderator).completeTournament(id, [players[0].address, players[1].address])
            ).to.be.revertedWithCustomError(hub, "WinnersMismatch");
        });

        it("only moderators/admins can complete — tournaments are not disputable", async function () {
            await expect(
                hub.connect(creator).completeTournament(id, [players[0].address, players[1].address, players[2].address])
            ).to.be.revertedWithCustomError(hub, "NotAuthorized");
        });
    });

    describe("cancelTournament & refund claims", function () {
        let id;
        beforeEach(async function () {
            id = await createTournament({ seedAmount: SEED });
            await hub.connect(players[0]).joinTournament(id);
            await hub.connect(players[1]).joinTournament(id);
            await hub.connect(outsider).donateToTournament(id, ethers.parseUnits("20", 18));
        });

        it("creator can cancel while OPEN; participants and contributors claim back", async function () {
            await expect(hub.connect(creator).cancelTournament(id))
                .to.emit(hub, "TournamentCancelled")
                .withArgs(id, creator.address);

            // participant entry fee claim
            const pBefore = await token.balanceOf(players[0].address);
            await expect(hub.connect(players[0]).claimEntryRefund(id))
                .to.emit(hub, "EntryRefundClaimed")
                .withArgs(id, players[0].address, ENTRY);
            expect((await token.balanceOf(players[0].address)) - pBefore).to.equal(ENTRY);

            await expect(hub.connect(players[0]).claimEntryRefund(id))
                .to.be.revertedWithCustomError(hub, "NothingToClaim");

            // seeder claim
            const cBefore = await token.balanceOf(creator.address);
            await hub.connect(creator).claimContributionRefund(id);
            expect((await token.balanceOf(creator.address)) - cBefore).to.equal(SEED);

            // donor claim
            const dBefore = await token.balanceOf(outsider.address);
            await hub.connect(outsider).claimContributionRefund(id);
            expect((await token.balanceOf(outsider.address)) - dBefore).to.equal(ethers.parseUnits("20", 18));

            // everything accounted for
            await hub.connect(players[1]).claimEntryRefund(id);
            expect(await hub.getPotBalance(id)).to.equal(0n);
        });

        it("creator cannot cancel once LIVE, admin can", async function () {
            await hub.connect(players[2]).joinTournament(id);
            await hub.connect(creator).startTournament(id);

            await expect(hub.connect(creator).cancelTournament(id))
                .to.be.revertedWithCustomError(hub, "NotOpen");

            await hub.connect(admin).cancelTournament(id);
            expect((await hub.tournaments(id)).status).to.equal(CANCELLED);
        });

        it("rejects claims from non-participants and while not cancelled", async function () {
            await expect(hub.connect(players[0]).claimEntryRefund(id))
                .to.be.revertedWithCustomError(hub, "NotCancelled");

            await hub.connect(creator).cancelTournament(id);
            await expect(hub.connect(outsider).claimEntryRefund(id))
                .to.be.revertedWithCustomError(hub, "NotParticipant");
            await expect(hub.connect(players[5]).claimContributionRefund(id))
                .to.be.revertedWithCustomError(hub, "NothingToClaim");
        });
    });

    describe("banParticipant / unbanParticipant", function () {
        let id;
        beforeEach(async function () {
            id = await createTournament({ payoutSplit: [100] });
            await hub.connect(players[0]).joinTournament(id);
            await hub.connect(players[1]).joinTournament(id);
        });

        it("kicks and refunds a participant while OPEN; they cannot rejoin", async function () {
            const before = await token.balanceOf(players[0].address);

            await expect(hub.connect(admin).banParticipant(id, players[0].address))
                .to.emit(hub, "ParticipantBanned")
                .withArgs(id, players[0].address, admin.address, true, ENTRY);

            expect((await token.balanceOf(players[0].address)) - before).to.equal(ENTRY);
            expect(await hub.isParticipant(id, players[0].address)).to.equal(false);
            expect(await hub.getPotBalance(id)).to.equal(ENTRY); // only players[1]'s fee left

            await expect(hub.connect(players[0]).joinTournament(id))
                .to.be.revertedWithCustomError(hub, "BannedFromTournament");
        });

        it("LIVE ban forfeits the entry fee to the pot and locks the wallet out", async function () {
            await hub.connect(players[2]).joinTournament(id);
            await hub.connect(creator).startTournament(id);

            const potBefore = await hub.getPotBalance(id);
            const balBefore = await token.balanceOf(players[0].address);

            await expect(hub.connect(admin).banParticipant(id, players[0].address))
                .to.emit(hub, "EntryFeeForfeited")
                .withArgs(id, players[0].address, ENTRY)
                .and.to.emit(hub, "ParticipantBanned")
                .withArgs(id, players[0].address, admin.address, true, 0); // refund = 0

            // no refund; pot keeps the fee
            expect(await token.balanceOf(players[0].address)).to.equal(balBefore);
            expect(await hub.getPotBalance(id)).to.equal(potBefore);
            expect(await hub.forfeitedFees(id)).to.equal(ENTRY);

            await expect(hub.connect(players[0]).startBracketMatch(id))
                .to.be.revertedWithCustomError(hub, "NotParticipant");

            // banned wallet can no longer be named tournament winner
            await expect(hub.connect(moderator).completeTournament(id, [players[0].address]))
                .to.be.revertedWithCustomError(hub, "InvalidWinner");
        });

        it("forfeited fee goes to the winners when the tournament completes", async function () {
            await hub.connect(players[2]).joinTournament(id);
            await hub.connect(creator).startTournament(id);
            await hub.connect(admin).banParticipant(id, players[0].address);

            const pot = await hub.getPotBalance(id); // 3 entry fees, incl. forfeited one
            expect(pot).to.equal(ENTRY * 3n);

            const before = await token.balanceOf(players[1].address);
            await hub.connect(moderator).completeTournament(id, [players[1].address]);
            expect((await token.balanceOf(players[1].address)) - before).to.equal(pot);
        });

        it("admin can recover forfeited fees only after a cancellation", async function () {
            await hub.connect(players[2]).joinTournament(id);
            await hub.connect(creator).startTournament(id);
            await hub.connect(admin).banParticipant(id, players[0].address);

            // not while LIVE
            await expect(hub.connect(admin).withdrawForfeitedFees(id, admin.address))
                .to.be.revertedWithCustomError(hub, "NotCancelled");

            await hub.connect(admin).cancelTournament(id);

            // remaining participants reclaim their fees; banned player cannot
            await hub.connect(players[1]).claimEntryRefund(id);
            await hub.connect(players[2]).claimEntryRefund(id);
            await expect(hub.connect(players[0]).claimEntryRefund(id))
                .to.be.revertedWithCustomError(hub, "NotParticipant");

            // admin sweeps the forfeit; pot fully drains
            await expect(hub.connect(admin).withdrawForfeitedFees(id, admin.address))
                .to.emit(hub, "ForfeitedFeesWithdrawn")
                .withArgs(id, admin.address, ENTRY);
            expect(await hub.getPotBalance(id)).to.equal(0n);

            await expect(hub.connect(admin).withdrawForfeitedFees(id, admin.address))
                .to.be.revertedWithCustomError(hub, "NothingToClaim");
            await expect(hub.connect(outsider).withdrawForfeitedFees(id, outsider.address))
                .to.be.revertedWithCustomError(hub, "NotAuthorized");
        });

        it("can pre-ban a wallet that never joined (no refund)", async function () {
            await expect(hub.connect(admin).banParticipant(id, outsider.address))
                .to.emit(hub, "ParticipantBanned")
                .withArgs(id, outsider.address, admin.address, false, 0);

            await expect(hub.connect(outsider).joinTournament(id))
                .to.be.revertedWithCustomError(hub, "BannedFromTournament");
        });

        it("banned + kicked wallets cannot double-dip via cancel claims", async function () {
            await hub.connect(admin).banParticipant(id, players[0].address); // refunded here
            await hub.connect(admin).cancelTournament(id);

            await expect(hub.connect(players[0]).claimEntryRefund(id))
                .to.be.revertedWithCustomError(hub, "NotParticipant");
            // untouched participant still claims normally
            await hub.connect(players[1]).claimEntryRefund(id);
            expect(await hub.getPotBalance(id)).to.equal(0n);
        });

        it("unban allows rejoining while OPEN", async function () {
            await hub.connect(admin).banParticipant(id, players[0].address);
            await expect(hub.connect(admin).unbanParticipant(id, players[0].address))
                .to.emit(hub, "ParticipantUnbanned")
                .withArgs(id, players[0].address, admin.address);

            await hub.connect(players[0]).joinTournament(id);
            expect(await hub.isParticipant(id, players[0].address)).to.equal(true);
        });

        it("is admin-only (moderators and creators cannot ban)", async function () {
            await expect(hub.connect(moderator).banParticipant(id, players[0].address))
                .to.be.revertedWithCustomError(hub, "NotAuthorized");
            await expect(hub.connect(creator).banParticipant(id, players[0].address))
                .to.be.revertedWithCustomError(hub, "NotAuthorized");
            await expect(hub.connect(admin).unbanParticipant(id, players[0].address))
                .to.be.revertedWithCustomError(hub, "NotBanned");
        });

        it("rejects double bans and bans on finished tournaments", async function () {
            await hub.connect(admin).banParticipant(id, players[0].address);
            await expect(hub.connect(admin).banParticipant(id, players[0].address))
                .to.be.revertedWithCustomError(hub, "AlreadyBanned");

            await hub.connect(admin).cancelTournament(id);
            await expect(hub.connect(admin).banParticipant(id, players[1].address))
                .to.be.revertedWithCustomError(hub, "NotOpen");
        });
    });

    describe("bracket matches", function () {
        let id;
        beforeEach(async function () {
            id = await createTournament({ payoutSplit: [100] });
            await hub.connect(players[0]).joinTournament(id);
            await hub.connect(players[1]).joinTournament(id);
            await hub.connect(creator).startTournament(id);
        });

        it("participants can start and join; no money moves", async function () {
            const hubBefore = await token.balanceOf(hub.target);

            await expect(hub.connect(players[0]).startBracketMatch(id))
                .to.emit(hub, "BracketMatchStarted")
                .withArgs(id, 1, players[0].address);
            await expect(hub.connect(players[1]).joinBracketMatch(1))
                .to.emit(hub, "BracketMatchJoined")
                .withArgs(id, 1, players[1].address);

            expect(await token.balanceOf(hub.target)).to.equal(hubBefore);
        });

        it("gates matches to tournament participants (whitelist)", async function () {
            await expect(hub.connect(outsider).startBracketMatch(id))
                .to.be.revertedWithCustomError(hub, "NotParticipant");
            await expect(hub.connect(creator).startBracketMatch(id))
                .to.be.revertedWithCustomError(hub, "NotParticipant");

            await hub.connect(players[0]).startBracketMatch(id);
            await expect(hub.connect(outsider).joinBracketMatch(1))
                .to.be.revertedWithCustomError(hub, "NotParticipant");
        });

        it("cannot start matches before the tournament is LIVE", async function () {
            const id2 = await createTournament({ payoutSplit: [100] });
            await hub.connect(players[0]).joinTournament(id2);
            await expect(hub.connect(players[0]).startBracketMatch(id2))
                .to.be.revertedWithCustomError(hub, "NotLive");
        });

        it("moderator closes with winner/loser event for player records", async function () {
            await hub.connect(players[0]).startBracketMatch(id);
            await hub.connect(players[1]).joinBracketMatch(1);

            await expect(hub.connect(moderator).closeBracketMatch(1, players[1].address))
                .to.emit(hub, "BracketMatchClosed")
                .withArgs(id, 1, players[1].address, players[0].address);

            expect((await hub.bracketMatches(1)).winner).to.equal(players[1].address);

            await expect(hub.connect(moderator).closeBracketMatch(1, players[0].address))
                .to.be.revertedWithCustomError(hub, "MatchAlreadyClosed");
        });

        it("rejects invalid winners and non-moderator closes", async function () {
            await hub.connect(players[0]).startBracketMatch(id);
            await hub.connect(players[1]).joinBracketMatch(1);

            await expect(hub.connect(moderator).closeBracketMatch(1, outsider.address))
                .to.be.revertedWithCustomError(hub, "InvalidWinner");
            await expect(hub.connect(players[0]).closeBracketMatch(1, players[0].address))
                .to.be.revertedWithCustomError(hub, "NotAuthorized");
        });

        it("moderator can void a match that will not be played", async function () {
            await hub.connect(players[0]).startBracketMatch(id);
            await expect(hub.connect(moderator).cancelBracketMatch(1))
                .to.emit(hub, "BracketMatchCancelled")
                .withArgs(id, 1, moderator.address);
        });

        it("players can cancel their own unclosed match (wrong opponent joined)", async function () {
            await hub.connect(players[0]).startBracketMatch(id);
            await hub.connect(players[1]).joinBracketMatch(1);

            // p2 backs out — no result was recorded, no funds at stake
            await expect(hub.connect(players[1]).cancelBracketMatch(1))
                .to.emit(hub, "BracketMatchCancelled")
                .withArgs(id, 1, players[1].address);

            // a cancelled match can no longer be closed
            await expect(hub.connect(moderator).closeBracketMatch(1, players[0].address))
                .to.be.revertedWithCustomError(hub, "MatchAlreadyClosed");
        });

        it("strangers cannot cancel someone else's match", async function () {
            await hub.connect(players[0]).startBracketMatch(id);
            await expect(hub.connect(outsider).cancelBracketMatch(1))
                .to.be.revertedWithCustomError(hub, "NotAuthorized");
        });

        it("admin pairs two participants directly (adminCreateBracketMatch)", async function () {
            await expect(
                hub.connect(moderator).adminCreateBracketMatch(id, players[0].address, players[1].address)
            )
                .to.emit(hub, "BracketMatchStarted")
                .withArgs(id, 1, players[0].address)
                .and.to.emit(hub, "BracketMatchJoined")
                .withArgs(id, 1, players[1].address);

            const m = await hub.bracketMatches(1);
            expect(m.player1).to.equal(players[0].address);
            expect(m.player2).to.equal(players[1].address);
            expect(m.isOpen).to.equal(false);

            // Seat is taken — nobody can join over the pairing
            await expect(hub.connect(players[1]).joinBracketMatch(1))
                .to.be.revertedWithCustomError(hub, "MatchNotOpen");

            // Result flows through the normal close path
            await expect(hub.connect(moderator).closeBracketMatch(1, players[1].address))
                .to.emit(hub, "BracketMatchClosed")
                .withArgs(id, 1, players[1].address, players[0].address);
        });

        it("adminCreateBracketMatch rejects non-participants, dupes, and non-moderators", async function () {
            await expect(
                hub.connect(moderator).adminCreateBracketMatch(id, players[0].address, outsider.address)
            ).to.be.revertedWithCustomError(hub, "NotParticipant");
            await expect(
                hub.connect(moderator).adminCreateBracketMatch(id, players[0].address, players[0].address)
            ).to.be.revertedWithCustomError(hub, "DuplicateWinner");
            await expect(
                hub.connect(players[0]).adminCreateBracketMatch(id, players[0].address, players[1].address)
            ).to.be.revertedWithCustomError(hub, "NotAuthorized");
        });
    });

    describe("gasless (EIP-2771 via InsertCoinForwarder)", function () {
        let forwarder, id;

        async function relay(signer, callData) {
            const request = {
                from: signer.address,
                to: hub.target,
                value: 0n,
                gas: 1_000_000n,
                nonce: await forwarder.getNonce(signer.address),
                data: callData,
            };
            const domain = {
                name: "MinimalForwarder",
                version: "0.0.1", // OZ 4.9 MinimalForwarder domain version
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: forwarder.target,
            };
            const types = {
                ForwardRequest: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "gas", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "data", type: "bytes" },
                ],
            };
            const signature = await signer.signTypedData(domain, types, request);
            // outsider acts as the gas-paying relayer
            return forwarder.connect(outsider).execute(request, signature);
        }

        beforeEach(async function () {
            const Forwarder = await ethers.getContractFactory("InsertCoinForwarder");
            forwarder = await Forwarder.deploy();
            await forwarder.waitForDeployment();
            await hub.connect(owner).setTrustedForwarder(forwarder.target);

            id = await createTournament({ payoutSplit: [100] });
        });

        it("joins a tournament through the relayer with the signer as participant", async function () {
            const callData = hub.interface.encodeFunctionData("joinTournament", [id]);
            await relay(players[0], callData);

            expect(await hub.isParticipant(id, players[0].address)).to.equal(true);
            expect(await hub.getPotBalance(id)).to.equal(ENTRY);
            // entry fee came from the signer, not the relayer
            expect(await token.balanceOf(players[0].address)).to.equal(TOKEN_FLOAT - ENTRY);
        });

        it("runs the whole participant flow gaslessly (join, match, leave)", async function () {
            await relay(players[0], hub.interface.encodeFunctionData("joinTournament", [id]));
            await relay(players[1], hub.interface.encodeFunctionData("joinTournament", [id]));
            await hub.connect(creator).startTournament(id);

            await relay(players[0], hub.interface.encodeFunctionData("startBracketMatch", [id]));
            await relay(players[1], hub.interface.encodeFunctionData("joinBracketMatch", [1]));

            const m = await hub.bracketMatches(1);
            expect(m.player1).to.equal(players[0].address);
            expect(m.player2).to.equal(players[1].address);
        });

        it("lets the creator join via the relayer, paying the entry fee", async function () {
            const callData = hub.interface.encodeFunctionData("joinTournament", [id]);
            const request = {
                from: creator.address,
                to: hub.target,
                value: 0n,
                gas: 1_000_000n,
                nonce: await forwarder.getNonce(creator.address),
                data: callData,
            };
            const domain = {
                name: "MinimalForwarder",
                version: "0.0.1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: forwarder.target,
            };
            const types = {
                ForwardRequest: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "gas", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "data", type: "bytes" },
                ],
            };
            const signature = await creator.signTypedData(domain, types, request);

            const [success] = await forwarder.connect(outsider).execute.staticCall(request, signature);
            expect(success).to.equal(true);

            await forwarder.connect(outsider).execute(request, signature);
            expect(await hub.isParticipant(id, creator.address)).to.equal(true);
        });
    });

    describe("pause & blacklist delegation", function () {
        it("respects hub pause and IC pause", async function () {
            const id = await createTournament();

            await hub.connect(owner).pause();
            await expect(hub.connect(players[0]).joinTournament(id))
                .to.be.revertedWithCustomError(hub, "IsPaused");
            await hub.connect(owner).unpause();

            await ic.connect(owner).pause();
            await expect(hub.connect(players[0]).joinTournament(id))
                .to.be.revertedWithCustomError(hub, "IsPaused");
            await ic.connect(owner).unpause();

            await hub.connect(players[0]).joinTournament(id);
        });

        it("blocks blacklisted wallets from joining or donating", async function () {
            const id = await createTournament();
            await ic.connect(owner).addBlacklisted(players[0].address);

            await expect(hub.connect(players[0]).joinTournament(id))
                .to.be.revertedWithCustomError(hub, "IsBlacklisted");
            await expect(hub.connect(players[0]).donateToTournament(id, ENTRY))
                .to.be.revertedWithCustomError(hub, "IsBlacklisted");
        });
    });
});

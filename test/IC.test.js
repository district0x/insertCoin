const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("IC Contract", function () {
    let ic;
    let owner;
    let testWallet;
    let player2;

    beforeEach(async function () {
        [owner, testWallet, player2] = await ethers.getSigners();

        const IC = await ethers.getContractFactory("IC", owner);
        ic = await upgrades.deployProxy(IC, [], {
            initializer: 'initialize',
            kind: 'transparent'
        });
        await ic.waitForDeployment();
    });

    it("Should perform complete setup and match creation", async function () {
        // Step 1: Initial state check
        console.log("\nStep 1: Initial State");
        console.log("Initial multisig:", await ic.multisigAddress());
        expect(await ic.multisigAddress()).to.equal(owner.address);

        // Step 2: Update multisig
        console.log("\nStep 2: Updating Multisig");
        await ic.connect(owner).setMultisigAddress(testWallet.address);
        console.log("New multisig:", await ic.multisigAddress());
        expect(await ic.multisigAddress()).to.equal(testWallet.address);

        // Step 3: Add admin
        console.log("\nStep 3: Adding Admin");
        await ic.connect(owner).addAdmin(testWallet.address);
        console.log("Is testWallet admin?", await ic.isAdmin(testWallet.address));
        expect(await ic.isAdmin(testWallet.address)).to.be.true;

        // Step 4: Fill matching pool
        console.log("\nStep 4: Filling Matching Pool");
        const matchingPoolAmount = ethers.parseEther("0.02");
        await ic.connect(testWallet).fillUpMatchingPool({ value: matchingPoolAmount });
        console.log("Matching pool amount:", await ic.matchingPool());
        expect(await ic.matchingPool()).to.equal(matchingPoolAmount);

        // Step 5: Starting Match
        console.log("\nStep 5: Starting Match");
        const matchAmount = ethers.parseEther("0.025");

        // Log pre-match state
        console.log("Pre-match count:", await ic.nextMatchId());

        try {
            await ic.connect(testWallet).startMatch(
                matchAmount,    // _matchAmount
                ethers.ZeroAddress,    // _token
                { value: matchAmount } // transaction options
            );
        } catch (error) {
            console.error("startMatch failed:", error.message);
            throw error;
        }

        // Log post-match state
        const matchCount = await ic.nextMatchId();
        console.log("Post-match count:", matchCount);

        // Convert BigInt to Number for array indexing
        const matchIndex = Number(matchCount) - 1;
        const match = await ic.matches(matchIndex);
        console.log("Match details:", {
            player1: match.player1,
            amount: match.player1Amount,
            isOpen: match.isOpen,
            matchIndex: matchIndex
        });

        expect(match.player1).to.equal(testWallet.address);
        expect(match.player1Amount).to.equal(matchAmount);
        expect(match.isOpen).to.be.true;
    });

    it("Should complete a full match cycle with two players", async function () {
        // Step 1: Initial setup
        await ic.connect(owner).setMultisigAddress(testWallet.address);
        await ic.connect(owner).addAdmin(testWallet.address);

        const startingMatchingPool = ethers.parseEther("0.02");
        await ic.connect(testWallet).fillUpMatchingPool({ value: startingMatchingPool });
        console.log("Initial matching pool:", await ic.matchingPool());

        // Step 2: Player 1 starts match
        const matchAmount = ethers.parseEther("0.025");
        await ic.connect(testWallet).startMatch(
            matchAmount,
            ethers.ZeroAddress,
            { value: matchAmount }
        );

        const matchId = Number(await ic.nextMatchId()) - 1;
        const matchAfterStart = await ic.matches(matchId);
        console.log("Match after start:", {
            player1: matchAfterStart.player1,
            amount: matchAfterStart.player1Amount,
            isOpen: matchAfterStart.isOpen
        });

        // Step 3: Player 2 joins match
        console.log("\nStep 3: Player 2 Joining Match");

        // Get initial balances
        const initialBalances = {
            player1: await ethers.provider.getBalance(testWallet.address),
            player2: await ethers.provider.getBalance(player2.address),
            pool: await ic.matchingPool()
        };

        // Player 2 joins the match
        const joinTx = await ic.connect(player2).joinMatch(matchId, { value: matchAmount });
        const joinReceipt = await joinTx.wait();

        const matchAfterJoin = await ic.matches(matchId);
        console.log("Match after join:", {
            player1: matchAfterJoin.player1,
            player2: matchAfterJoin.player2,
            totalAmount: matchAfterJoin.totalAmount,
            isOpen: matchAfterJoin.isOpen
        });

        // Step 4: Close match and verify distributions
        console.log("\nStep 4: Closing Match");
        const totalMatchAmount = matchAmount * 2n;
        const expectedWinnerAmount = (totalMatchAmount * 90n) / 100n;
        const expectedMultisigAmount = (totalMatchAmount * 5n) / 100n;
        const expectedPoolAmount = (totalMatchAmount * 5n) / 100n;

        console.log("Expected distributions:", {
            totalAmount: ethers.formatEther(totalMatchAmount),
            winnerAmount: ethers.formatEther(expectedWinnerAmount),
            multisigAmount: ethers.formatEther(expectedMultisigAmount),
            poolAmount: ethers.formatEther(expectedPoolAmount)
        });

        // Add debug logging to verify match participants
        const matchBeforeClose = await ic.matches(matchId);
        console.log("Match participants before close:", {
            player1: matchBeforeClose.player1,
            player2: matchBeforeClose.player2
        });

        // Close match with player1 (testWallet) as winner
        const closeTx = await ic.connect(testWallet).closeMatch(matchId, testWallet.address);
        await closeTx.wait();

        // Step 5: Verify final balances
        console.log("\nStep 5: Verifying Final Balances");
        const finalBalances = {
            player1: await ethers.provider.getBalance(testWallet.address),
            player2: await ethers.provider.getBalance(player2.address),
            pool: await ic.matchingPool()
        };

        // Calculate gains
        const poolGain = finalBalances.pool - initialBalances.pool;
        const player1Gain = finalBalances.player1 - initialBalances.player1;

        console.log("Initial balances:", {
            player1: ethers.formatEther(initialBalances.player1),
            player2: ethers.formatEther(initialBalances.player2),
            pool: ethers.formatEther(initialBalances.pool)
        });

        console.log("Final balances:", {
            player1: ethers.formatEther(finalBalances.player1),
            player2: ethers.formatEther(finalBalances.player2),
            pool: ethers.formatEther(finalBalances.pool)
        });

        console.log("Actual distributions:", {
            winnerGain: ethers.formatEther(player1Gain),
            poolGain: ethers.formatEther(poolGain)
        });

        // Verify distributions with margin for gas costs
        const marginOfError = ethers.parseEther("0.005"); // 0.005 ETH margin
        expect(player1Gain).to.be.closeTo(expectedWinnerAmount, marginOfError);
        expect(poolGain).to.equal(expectedPoolAmount);
    });
});
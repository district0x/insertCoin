const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("IC 5v5 ERC20 Contract", function () {
    let ic;
    let mockToken;
    let owner;
    let player2, player3, player4, player5;  // Team A
    let player6, player7, player8, player9, player10; // Team B
    let multisig;

    const TOKEN_AMOUNT = ethers.parseEther("1");

    beforeEach(async function () {
        [owner, player2, player3, player4, player5, player6, player7, player8, player9, player10, multisig] =
            await ethers.getSigners();

        const MockToken = await ethers.getContractFactory("MockERC20");
        mockToken = await MockToken.deploy();
        await mockToken.waitForDeployment();

        const IC = await ethers.getContractFactory("IC");
        ic = await upgrades.deployProxy(IC, [], {
            initializer: 'initialize',
            kind: 'transparent'
        });
        await ic.waitForDeployment();

        // Mint tokens to all players
        for (const player of [owner, player2, player3, player4, player5, player6, player7, player8, player9, player10]) {
            await mockToken.mint(player.address, TOKEN_AMOUNT);
        }

        // Setup contract
        await ic.connect(owner).setMultisigAddress(multisig.address);
        await ic.connect(owner).addAdmin(owner.address);
        await ic.connect(owner).approveToken(mockToken.target, true);
    });

    it("Should complete a full 5v5 match cycle", async function () {
        // Record initial balances
        const initialBalances = {
            teamA: await Promise.all(
                [owner, player2, player3, player4, player5].map(p =>
                    mockToken.balanceOf(p.address)
                )
            ),
            teamB: await Promise.all(
                [player6, player7, player8, player9, player10].map(p =>
                    mockToken.balanceOf(p.address)
                )
            ),
            pool: await ic.matchingPool(),
            multisig: await mockToken.balanceOf(multisig.address),
            contract: await mockToken.balanceOf(ic.target)
        };

        // Start match with Team A first player (owner)
        await mockToken.connect(owner).approve(ic.target, TOKEN_AMOUNT);
        await ic.connect(owner).start5v5Match(TOKEN_AMOUNT, mockToken.target);
        const matchId = Number(await ic.nextMatchId()) - 1;

        // Add Team A players
        for (const player of [player2, player3, player4, player5]) {
            await mockToken.connect(player).approve(ic.target, TOKEN_AMOUNT);
            await ic.connect(player).join5v5Team(matchId, true);
        }

        // Add Team B players
        for (const player of [player6, player7, player8, player9, player10]) {
            await mockToken.connect(player).approve(ic.target, TOKEN_AMOUNT);
            await ic.connect(player).join5v5Team(matchId, false);
        }

        // Verify match is closed
        const matchAfterJoins = await ic.matches5v5(matchId);
        expect(matchAfterJoins.isOpen).to.be.false;

        // Calculate expected amounts
        const totalMatchAmount = TOKEN_AMOUNT * 10n;  // 10 players * 1 TOKEN each
        const expectedWinnerAmount = (totalMatchAmount * 90n) / 100n;  // 90% to winners
        const expectedPerWinnerAmount = expectedWinnerAmount / 5n;  // Split between 5 winners
        const expectedPoolAmount = (totalMatchAmount * 5n) / 100n;  // 5% to pool
        const expectedMultisigAmount = (totalMatchAmount * 5n) / 100n;  // 5% to multisig

        // Close match (Team A wins)
        await ic.connect(owner).close5v5Match(matchId, owner.address);

        // Get final balances
        const finalBalances = {
            teamA: await Promise.all(
                [owner, player2, player3, player4, player5].map(p =>
                    mockToken.balanceOf(p.address)
                )
            ),
            pool: await ic.matchingPool(),
            multisig: await mockToken.balanceOf(multisig.address),
            contract: await mockToken.balanceOf(ic.target)
        };

        // Debug Information
        console.log('\nMatch Economics:');
        console.log('Total match amount:', ethers.formatEther(totalMatchAmount), 'ETH');
        console.log('Expected winner amount:', ethers.formatEther(expectedWinnerAmount), 'ETH');
        console.log('Expected per winner:', ethers.formatEther(expectedPerWinnerAmount), 'ETH');
        console.log('Expected multisig:', ethers.formatEther(expectedMultisigAmount), 'ETH');
        console.log('Expected pool:', ethers.formatEther(expectedPoolAmount), 'ETH');

        // Verify Team A (winners) balances
        console.log('\nTeam A (Winners) Balance Changes:');
        for (let i = 0; i < 5; i++) {
            const initialBalance = initialBalances.teamA[i];
            const finalBalance = finalBalances.teamA[i];
            const gain = finalBalance - initialBalance;

            console.log(`Player ${i + 1}:`);
            console.log('  Initial:', ethers.formatEther(initialBalance), 'ETH');
            console.log('  Final:', ethers.formatEther(finalBalance), 'ETH');
            console.log('  Gain:', ethers.formatEther(gain), 'ETH');

            // Each winner should receive their share minus their initial stake
            expect(finalBalance).to.equal(initialBalance - TOKEN_AMOUNT + expectedPerWinnerAmount);
        }

        // Verify multisig and pool amounts
        const multisigGain = finalBalances.multisig - initialBalances.multisig;
        const poolGain = finalBalances.pool - initialBalances.pool;

        console.log('\nSystem Balance Changes:');
        console.log('Multisig gain:', ethers.formatEther(multisigGain), 'ETH');
        console.log('Pool gain:', ethers.formatEther(poolGain), 'ETH');

        expect(multisigGain).to.equal(expectedMultisigAmount);
        expect(poolGain).to.equal(expectedPoolAmount);
    });

    it("Should prevent invalid team joins in 5v5", async function () {
        await mockToken.connect(owner).approve(ic.target, TOKEN_AMOUNT);
        await ic.connect(owner).start5v5Match(TOKEN_AMOUNT, mockToken.target);
        const matchId = Number(await ic.nextMatchId()) - 1;

        // Try to join same team multiple times
        await mockToken.connect(player2).approve(ic.target, TOKEN_AMOUNT);
        await ic.connect(player2).join5v5Team(matchId, true);
        await expect(
            ic.connect(player2).join5v5Team(matchId, true)
        ).to.be.revertedWith("Already in match");

        // Try joining opposite team
        await expect(
            ic.connect(player2).join5v5Team(matchId, false)
        ).to.be.revertedWith("Already in match");

        // Fill team A
        for (const p of [player3, player4, player5]) {
            await mockToken.connect(p).approve(ic.target, TOKEN_AMOUNT);
            await ic.connect(p).join5v5Team(matchId, true);
        }

        // Try joining full team
        await mockToken.connect(player6).approve(ic.target, TOKEN_AMOUNT);
        await expect(
            ic.connect(player6).join5v5Team(matchId, true)
        ).to.be.revertedWith("Team A is full");
    });
});

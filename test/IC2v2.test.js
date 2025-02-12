const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("IC 2v2 Contract", function () {
    let ic;
    let owner;
    let testWallet;
    let teamAPlayer2;
    let teamBPlayer1;
    let teamBPlayer2;

    beforeEach(async function () {
        [owner, testWallet, teamAPlayer2, teamBPlayer1, teamBPlayer2] = await ethers.getSigners();

        const IC = await ethers.getContractFactory("IC", owner);
        ic = await upgrades.deployProxy(IC, [], {
            initializer: 'initialize',
            kind: 'transparent'
        });
        await ic.waitForDeployment();
    });

    it("Should complete a full 2v2 match cycle", async function () {
        // Initial setup
        await ic.connect(owner).setMultisigAddress(testWallet.address);
        await ic.connect(owner).addAdmin(testWallet.address);

        const matchAmount = ethers.parseEther("0.025");

        // Start match with Team A Captain (owner)
        await ic.connect(owner).start2v2Match(
            matchAmount,
            ethers.ZeroAddress,
            { value: matchAmount }
        );

        const matchId = Number(await ic.nextMatchId()) - 1;

        // Record initial balances
        const initialBalances = {
            teamACaptain: await ethers.provider.getBalance(owner.address),
            teamAPlayer2: await ethers.provider.getBalance(teamAPlayer2.address),
            teamBPlayer1: await ethers.provider.getBalance(teamBPlayer1.address),
            teamBPlayer2: await ethers.provider.getBalance(teamBPlayer2.address),
            pool: await ic.matchingPool(),
            multisig: await ethers.provider.getBalance(testWallet.address),
            contract: await ethers.provider.getBalance(await ic.getAddress())
        };

        // Team A Player 2 joins
        const joinTeamATx = await ic.connect(teamAPlayer2).join2v2Team(
            matchId,
            true,
            { value: matchAmount }
        );
        await joinTeamATx.wait();

        // Attempt invalid joins
        await expect(
            ic.connect(owner).join2v2Team(
                matchId,
                false,
                { value: matchAmount }
            )
        ).to.be.revertedWith("Team B invalid");

        await expect(
            ic.connect(teamAPlayer2).join2v2Team(
                matchId,
                false,
                { value: matchAmount }
            )
        ).to.be.revertedWith("Team B invalid");

        // Complete Team B joins correctly
        await ic.connect(teamBPlayer1).join2v2Team(
            matchId,
            false,
            { value: matchAmount }
        );
        await ic.connect(teamBPlayer2).join2v2Team(
            matchId,
            false,
            { value: matchAmount }
        );

        // Verify match is closed
        const matchAfterJoins = await ic.matches2v2(matchId);
        expect(matchAfterJoins.isOpen).to.be.false;

        // Calculate expected amounts
        const totalMatchAmount = matchAmount * 4n;
        const expectedWinnerAmount = (totalMatchAmount * 90n) / 100n;
        const expectedPerWinnerAmount = expectedWinnerAmount / 2n;
        const expectedPoolAmount = (totalMatchAmount * 5n) / 100n;

        // Close match with Team A as winners
        const closeTx = await ic.connect(testWallet).close2v2Match(matchId, owner.address);
        await closeTx.wait();

        // Get final balances
        const finalBalances = {
            teamACaptain: await ethers.provider.getBalance(owner.address),
            teamAPlayer2: await ethers.provider.getBalance(teamAPlayer2.address),
            pool: await ic.matchingPool(),
            multisig: await ethers.provider.getBalance(testWallet.address),
            contract: await ethers.provider.getBalance(await ic.getAddress())
        };

        // Calculate gains
        const poolGain = finalBalances.pool - initialBalances.pool;
        const captainGain = finalBalances.teamACaptain - initialBalances.teamACaptain;
        const player2Gain = finalBalances.teamAPlayer2 - initialBalances.teamAPlayer2;
        const multisigGain = finalBalances.multisig - initialBalances.multisig;
        const contractBalanceChange = finalBalances.contract - initialBalances.contract;

        // Calculate expected amounts for all parties
        const expectedMultisigAmount = (totalMatchAmount * 5n) / 100n; // 5% to multisig

        // Add more detailed debug logging
        console.log('Total match amount:', ethers.formatEther(totalMatchAmount));
        console.log('Expected winner amount:', ethers.formatEther(expectedWinnerAmount));
        console.log('Expected per winner:', ethers.formatEther(expectedPerWinnerAmount));
        console.log('Expected multisig:', ethers.formatEther(expectedMultisigAmount));
        console.log('Initial balances:');
        console.log('  Captain:', ethers.formatEther(initialBalances.teamACaptain));
        console.log('  Player2:', ethers.formatEther(initialBalances.teamAPlayer2));
        console.log('  Multisig:', ethers.formatEther(initialBalances.multisig));
        console.log('  Contract:', ethers.formatEther(initialBalances.contract));
        console.log('Final balances:');
        console.log('  Captain:', ethers.formatEther(finalBalances.teamACaptain));
        console.log('  Player2:', ethers.formatEther(finalBalances.teamAPlayer2));
        console.log('  Multisig:', ethers.formatEther(finalBalances.multisig));
        console.log('  Contract:', ethers.formatEther(finalBalances.contract));
        console.log('Gains/Changes:');
        console.log('  Captain:', ethers.formatEther(captainGain));
        console.log('  Player2:', ethers.formatEther(player2Gain));
        console.log('  Pool:', ethers.formatEther(poolGain));
        console.log('  Multisig:', ethers.formatEther(multisigGain));
        console.log('  Contract:', ethers.formatEther(contractBalanceChange));

        // Add these checks after getting final balances
        console.log('Balance checks:');
        console.log('Initial contract balance:', ethers.formatEther(initialBalances.contract));
        console.log('Expected final contract balance:', ethers.formatEther(expectedPoolAmount));
        console.log('Actual final contract balance:', ethers.formatEther(finalBalances.contract));

        // Verify the contract balance change
        const expectedContractBalanceChange = expectedPoolAmount - initialBalances.contract;
        console.log('Expected contract balance change:', ethers.formatEther(expectedContractBalanceChange));
        console.log('Actual contract balance change:', ethers.formatEther(contractBalanceChange));

        // Consider gas costs in the verification
        const gasBuffer = ethers.parseEther("0.03"); // Add buffer for gas costs
        const minimumExpectedGain = (expectedPerWinnerAmount * 90n) / 100n;
        expect(captainGain).to.be.greaterThan(minimumExpectedGain - gasBuffer);
        expect(player2Gain).to.be.greaterThan(minimumExpectedGain - gasBuffer);
        expect(poolGain).to.equal(expectedPoolAmount);
        expect(multisigGain).to.be.closeTo(expectedMultisigAmount, ethers.parseEther("0.001")); // Allow 0.001 ETH deviation
        expect(finalBalances.contract).to.equal(expectedPoolAmount);
        expect(contractBalanceChange).to.equal(expectedContractBalanceChange);
    });

    it("Should prevent invalid team joins", async function () {
        const matchAmount = ethers.parseEther("0.025");

        // Start match
        await ic.connect(owner).start2v2Match(
            matchAmount,
            ethers.ZeroAddress,
            { value: matchAmount }
        );
        const matchId = Number(await ic.nextMatchId()) - 1;

        // Team A Player 2 joins correctly
        await ic.connect(teamAPlayer2).join2v2Team(
            matchId,
            true,
            { value: matchAmount }
        );

        // Attempt invalid joins
        await expect(
            ic.connect(owner).join2v2Team(
                matchId,
                false,
                { value: matchAmount }
            )
        ).to.be.revertedWith("Team B invalid");

        await expect(
            ic.connect(teamAPlayer2).join2v2Team(
                matchId,
                false,
                { value: matchAmount }
            )
        ).to.be.revertedWith("Team B invalid");

        // Complete Team B joins correctly
        await ic.connect(teamBPlayer1).join2v2Team(
            matchId,
            false,
            { value: matchAmount }
        );
        await ic.connect(teamBPlayer2).join2v2Team(
            matchId,
            false,
            { value: matchAmount }
        );

        // Verify final match state
        const finalMatch = await ic.matches2v2(matchId);
        expect(finalMatch.isOpen).to.be.false;
        expect(finalMatch.player1).to.equal(owner.address);
        expect(finalMatch.teamAPlayer2).to.equal(teamAPlayer2.address);
        expect(finalMatch.player2).to.equal(teamBPlayer1.address);
        expect(finalMatch.teamBPlayer2).to.equal(teamBPlayer2.address);
    });
}); 
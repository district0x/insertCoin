const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("IC ERC20 Contract", function () {
    let ic;
    let mockToken;
    let owner;
    let testWallet;
    let initialBalance;
    const TOKEN_AMOUNT = ethers.parseUnits("100", 18); // 100 tokens

    beforeEach(async function () {
        [owner, testWallet] = await ethers.getSigners();

        // Deploy Mock ERC20
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockToken = await MockERC20.deploy();
        await mockToken.waitForDeployment();

        // Deploy IC Contract
        const IC = await ethers.getContractFactory("IC");
        ic = await upgrades.deployProxy(IC, [], {
            initializer: 'initialize',
            kind: 'transparent'
        });
        await ic.waitForDeployment();

        // Mint tokens to players
        await mockToken.mint(owner.address, TOKEN_AMOUNT * 2n);
        await mockToken.mint(testWallet.address, TOKEN_AMOUNT * 2n);

        // Record initial balance
        initialBalance = await mockToken.balanceOf(owner.address);
    });

    it("Should complete a full ERC20 match cycle", async function () {
        // Get additional signer for multisig
        const [owner, player2, multisigWallet] = await ethers.getSigners();

        // Step 1: Initial Setup
        console.log("\nStep 1: Initial Setup");

        // Set multisig to a different address than player2
        await ic.connect(owner).setMultisigAddress(multisigWallet.address);
        await ic.connect(owner).addAdmin(owner.address);

        // Mint tokens to all participants
        await mockToken.mint(owner.address, TOKEN_AMOUNT * 2n);
        await mockToken.mint(player2.address, TOKEN_AMOUNT * 2n);

        console.log("Initial token balances:");
        console.log("Owner:", await mockToken.balanceOf(owner.address));
        console.log("Player2:", await mockToken.balanceOf(player2.address));
        console.log("Multisig:", await mockToken.balanceOf(multisigWallet.address));

        // Step 2: Admin approves token for contract use
        console.log("\nStep 2: Admin approving token for contract use");
        await ic.connect(owner).approveToken(mockToken.target, true);

        // Step 3: Players approve token spending
        console.log("\nStep 3: Players approving token spending");
        await mockToken.connect(owner).approve(ic.target, TOKEN_AMOUNT);
        await mockToken.connect(player2).approve(ic.target, TOKEN_AMOUNT);

        // Step 4: Start match with ERC20
        console.log("\nStep 4: Starting match with ERC20");
        await ic.connect(owner).startMatch(
            TOKEN_AMOUNT,
            mockToken.target
        );

        const matchId = Number(await ic.nextMatchId()) - 1;
        const matchAfterStart = await ic.matches(matchId);
        console.log("Match after start:", {
            player1: matchAfterStart.player1,
            amount: matchAfterStart.player1Amount,
            token: matchAfterStart.token,
            isERC20: matchAfterStart.isERC20
        });

        // Step 5: Player 2 joins
        console.log("\nStep 5: Player 2 joining");
        await mockToken.connect(player2).approve(ic.target, TOKEN_AMOUNT);
        await ic.connect(player2).joinMatch(matchId);

        const matchAfterJoin = await ic.matches(matchId);
        console.log("Match after join:", {
            player1: matchAfterJoin.player1,
            player2: matchAfterJoin.player2,
            totalAmount: matchAfterJoin.totalAmount,
            isOpen: matchAfterJoin.isOpen
        });

        // Step 6: Close match
        console.log("\nStep 6: Closing match");
        const totalMatchAmount = TOKEN_AMOUNT * 2n;
        const expectedWinnerAmount = (totalMatchAmount * 90n) / 100n;
        const expectedMultisigAmount = (totalMatchAmount * 5n) / 100n;
        const expectedPoolAmount = totalMatchAmount - expectedWinnerAmount - expectedMultisigAmount;

        console.log("Expected distributions:", {
            totalAmount: totalMatchAmount,
            winnerAmount: expectedWinnerAmount,
            multisigAmount: expectedMultisigAmount,
            poolAmount: expectedPoolAmount
        });

        // Record balances before closing
        const player2BalanceBefore = await mockToken.balanceOf(player2.address);
        const multisigBalanceBefore = await mockToken.balanceOf(multisigWallet.address);

        // Close match with player 2 as winner
        await ic.connect(owner).closeMatch(matchId, player2.address);

        // Step 7: Verify final balances
        console.log("\nStep 7: Verifying final balances");
        const player2BalanceAfter = await mockToken.balanceOf(player2.address);
        const multisigBalanceAfter = await mockToken.balanceOf(multisigWallet.address);

        const player2Gain = player2BalanceAfter - player2BalanceBefore;
        const multisigGain = multisigBalanceAfter - multisigBalanceBefore;

        console.log("Actual distributions:", {
            winner: player2Gain,
            multisigGain: multisigGain,
            poolBalance: await ic.matchingPool()
        });

        // Verify the amounts
        expect(player2Gain).to.equal(expectedWinnerAmount);
        expect(multisigGain).to.equal(expectedMultisigAmount);
        expect(await ic.matchingPool()).to.equal(expectedPoolAmount);
    });
}); 
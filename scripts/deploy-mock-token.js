const hre = require("hardhat");

async function main() {
    try {
        // Get the deployer's address
        const [deployer] = await hre.ethers.getSigners();
        console.log("Deploying MockERC20 with account:", deployer.address);

        // Deploy MockERC20
        console.log("\nDeploying MockERC20...");
        const MockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
        const mockToken = await MockERC20Factory.deploy();
        await mockToken.waitForDeployment();
        const mockTokenAddress = await mockToken.getAddress();
        console.log("MockERC20 deployed to:", mockTokenAddress);

        // The specified address
        const RECIPIENT_ADDRESS = "0x944C8e0C05aa90C3C03C16b0703fF66e2ecaa2fa";
        console.log(`\nMinting tokens to ${RECIPIENT_ADDRESS}...`);
        const mintAmount = hre.ethers.parseEther("10000"); // 10000 tokens
        const mintTx = await mockToken.mint(RECIPIENT_ADDRESS, mintAmount);
        await mintTx.wait();
        console.log(`Minted ${hre.ethers.formatEther(mintAmount)} tokens to ${RECIPIENT_ADDRESS}`);

        // Log final balance
        const balance = await mockToken.balanceOf(RECIPIENT_ADDRESS);
        console.log(`\nFinal balance of ${RECIPIENT_ADDRESS}:`, hre.ethers.formatEther(balance), "tokens");

        console.log("\nMockERC20 Address:", mockTokenAddress);
        console.log("\nDeployment completed!");

        // Wait a bit before verification
        console.log("\nWaiting 30 seconds before verification...");
        await new Promise(resolve => setTimeout(resolve, 30000));

        // Verify the contract
        console.log("\nVerifying contract...");
        await hre.run("verify:verify", {
            address: mockTokenAddress,
            constructorArguments: []
        });

    } catch (error) {
        console.error("Deployment failed:", error);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 
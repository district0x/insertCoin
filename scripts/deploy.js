const hre = require("hardhat");
const { upgrades } = require("hardhat");

async function main() {
    try {
        // Get the deployer's address and balance
        const [deployer] = await hre.ethers.getSigners();
        const balance = await deployer.provider.getBalance(deployer.address);
        console.log("Deploying contracts with the account:", deployer.address);
        console.log("Account balance:", hre.ethers.formatEther(balance));

        // Deploy the contract
        const ICFactory = await hre.ethers.getContractFactory("IC");
        console.log("Deploying proxy and implementation...");

        // Add more gas for Base Sepolia
        const tx = await upgrades.deployProxy(ICFactory, [], {
            gasLimit: 5000000,  // Increase gas limit
            gasPrice: await hre.ethers.provider.getFeeData().then(data => data.gasPrice) // Updated gas price method
        });

        console.log("Waiting for deployment transaction...");
        await tx.waitForDeployment();
        const address = await tx.getAddress();
        console.log("Proxy deployed to:", address);

        // Wait a few blocks before verification
        console.log("Waiting for a few blocks before verification...");
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds delay

        // Verify implementation contract
        console.log("Verifying implementation contract...");
        const implementationAddress = await upgrades.erc1967.getImplementationAddress(address);
        console.log("Implementation address:", implementationAddress);

        await hre.run("verify:verify", {
            address: implementationAddress,
            constructorArguments: [],
        });

        console.log("Deployment and verification completed successfully!");
    } catch (error) {
        console.error("Deployment failed with error:", error);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

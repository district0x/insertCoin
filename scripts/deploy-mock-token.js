const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying Mock Token to Base Sepolia...");

    // Get the contract factory
    const MockToken = await ethers.getContractFactory("MockToken");

    // Deploy the token with initial parameters
    const mockToken = await MockToken.deploy(
        "MATCH Token",           // Name
        "MATCH",                 // Symbol
        1000000                  // Initial supply (1 million tokens)
    );

    await mockToken.deployed();

    console.log("Mock Token deployed to:", mockToken.address);
    console.log("Token Name:", await mockToken.name());
    console.log("Token Symbol:", await mockToken.symbol());
    console.log("Total Supply:", ethers.utils.formatEther(await mockToken.totalSupply()));

    // Mint some tokens to the deployer for testing
    const deployer = await ethers.getSigner(0);
    console.log("Deployer address:", deployer.address);

    // You can mint additional tokens if needed
    // await mockToken.mint(deployer.address, ethers.utils.parseEther("1000"));

    console.log("\n=== DEPLOYMENT SUMMARY ===");
    console.log("Contract Address:", mockToken.address);
    console.log("Network: Base Sepolia");
    console.log("Deployer:", deployer.address);
    console.log("\nAdd this address to your .env file:");
    console.log(`NEXT_PUBLIC_MOCK_TOKEN_ADDRESS=${mockToken.address}`);
    console.log("\nBase Sepolia Explorer:");
    console.log(`https://sepolia.basescan.org/address/${mockToken.address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 
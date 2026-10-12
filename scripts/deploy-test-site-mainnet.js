/**
 * TEST-ONLY IC + ICTournamentHub pair for insert-coin-ule3.vercel.app.
 * These are dedicated test match/tournament contracts, not the live
 * production pair. Base mainnet tokens/gas only. Does NOT overwrite
 * production deployment-info.json.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-test-site-mainnet.js --network baseMainnet
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const FORWARDER = "0x1DF42D7090B6C42dD24C6C47Ed9493dde3d8538b";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const MATCH = "0x608DB20033fe825ef97f83Cb0D95E8903f3dCeEB";

async function wait(seconds) {
  console.log(`Waiting ${seconds}s...`);
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function retryTx(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if ((error.message || "").includes("rate limit")) {
        await wait((i + 1) * 10);
      } else {
        throw error;
      }
    }
  }
  throw new Error("Max retries exceeded");
}

async function verifyImpl(address) {
  if (!process.env.BASESCAN_API_KEY) return;
  try {
    await hre.run("verify:verify", { address, constructorArguments: [] });
    console.log("   Verified:", address);
  } catch (err) {
    console.warn("   Verify skipped/failed:", err.message || err);
  }
}

async function main() {
  if (hre.network.name !== "baseMainnet") {
    throw new Error("This script is for --network baseMainnet only");
  }

  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("=".repeat(60));
  console.log("TEST SITE STACK — Base mainnet");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address);
  console.log("Balance: ", hre.ethers.formatEther(balance), "ETH");
  console.log("Forwarder:", FORWARDER);
  console.log("USDC:     ", USDC);
  console.log("MATCH:    ", MATCH);

  // --- IC ---
  console.log("\n[1/6] Deploying IC proxy...");
  const ICFactory = await hre.ethers.getContractFactory("IC", deployer);
  const icProxy = await hre.upgrades.deployProxy(ICFactory, [], {
    initializer: "initialize",
    kind: "transparent",
  });
  await icProxy.waitForDeployment();
  const icAddress = await icProxy.getAddress();
  const icImpl = await hre.upgrades.erc1967.getImplementationAddress(icAddress);
  const icAdmin = await hre.upgrades.erc1967.getAdminAddress(icAddress);
  console.log("   IC proxy:         ", icAddress);
  console.log("   IC implementation:", icImpl);
  console.log("   IC proxy admin:   ", icAdmin);

  const ic = await hre.ethers.getContractAt("IC", icAddress, deployer);

  console.log("\n[2/6] Wiring IC (forwarder, admin, tokens)...");
  await retryTx(async () => (await ic.setTrustedForwarder(FORWARDER)).wait());
  await retryTx(async () => (await ic.addAdmin(deployer.address)).wait());
  await retryTx(async () => (await ic.approveToken(USDC, true)).wait());
  await retryTx(async () => (await ic.approveToken(MATCH, true)).wait());
  console.log("   trustedForwarder:", await ic.isTrustedForwarder(FORWARDER));
  console.log("   isAdmin(deployer):", await ic.isAdmin(deployer.address));
  console.log("   approved USDC:   ", await ic.approvedTokens(USDC));
  console.log("   approved MATCH:  ", await ic.approvedTokens(MATCH));

  // --- Tournament Hub ---
  console.log("\n[3/6] Deploying ICTournamentHub proxy (linked to this IC)...");
  const HubFactory = await hre.ethers.getContractFactory("ICTournamentHub", deployer);
  const hubProxy = await hre.upgrades.deployProxy(HubFactory, [icAddress], {
    initializer: "initialize",
    kind: "transparent",
  });
  await hubProxy.waitForDeployment();
  const hubAddress = await hubProxy.getAddress();
  const hubImpl = await hre.upgrades.erc1967.getImplementationAddress(hubAddress);
  const hubAdmin = await hre.upgrades.erc1967.getAdminAddress(hubAddress);
  console.log("   Hub proxy:         ", hubAddress);
  console.log("   Hub implementation:", hubImpl);
  console.log("   Hub proxy admin:   ", hubAdmin);

  const hub = await hre.ethers.getContractAt("ICTournamentHub", hubAddress, deployer);
  console.log("\n[4/6] Wiring hub forwarder...");
  await retryTx(async () => (await hub.setTrustedForwarder(FORWARDER)).wait());
  const linkedIc = await hub.icContract();
  if (linkedIc.toLowerCase() !== icAddress.toLowerCase()) {
    throw new Error("Hub is not linked to the new IC proxy");
  }
  console.log("   hub.icContract():", linkedIc);
  console.log("   isTrustedForwarder:", await hub.isTrustedForwarder(FORWARDER));

  // --- Verify ---
  console.log("\n[5/6] Verifying implementations on Basescan...");
  await wait(30);
  await verifyImpl(icImpl);
  await verifyImpl(hubImpl);

  const info = {
    purpose: "TEST ONLY for insert-coin-ule3.vercel.app. Dedicated test match and test tournament contracts. NOT the live production IC or tournament hub.",
    network: "baseMainnet",
    chainId: "8453",
    deployer: deployer.address,
    trustedForwarder: FORWARDER,
    tokens: { usdc: USDC, match: MATCH },
    ic: {
      proxyAddress: icAddress,
      implementationAddress: icImpl,
      adminAddress: icAdmin,
      ownerAddress: deployer.address,
      multisigAddress: deployer.address,
    },
    tournamentHub: {
      proxyAddress: hubAddress,
      implementationAddress: hubImpl,
      adminAddress: hubAdmin,
      ownerAddress: deployer.address,
      icProxyAddress: icAddress,
    },
    vercelEnv: {
      NEXT_PUBLIC_CONTRACT_ADDRESS: icAddress,
      NEXT_PUBLIC_TOURNAMENT_HUB_ADDRESS: hubAddress,
      NEXT_PUBLIC_FORWARDER_ADDRESS: FORWARDER,
      NEXT_PUBLIC_CHAIN_ID: "8453",
      NEXT_PUBLIC_USDC_TOKEN_ADDRESS: USDC,
      NEXT_PUBLIC_MATCH_TOKEN_ADDRESS: MATCH,
    },
    basescanLinks: {
      icProxy: `https://basescan.org/address/${icAddress}`,
      icImpl: `https://basescan.org/address/${icImpl}`,
      hubProxy: `https://basescan.org/address/${hubAddress}`,
      hubImpl: `https://basescan.org/address/${hubImpl}`,
    },
    timestamp: new Date().toISOString(),
  };

  const infoPath = path.join(__dirname, "..", "test-site-mainnet-deployment-info.json");
  fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
  console.log("\n[6/6] Saved test-site-mainnet-deployment-info.json");

  console.log("\n" + "=".repeat(60));
  console.log("TEST SITE DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("Match / IC proxy:     ", icAddress);
  console.log("Tournament hub proxy: ", hubAddress);
  console.log("-".repeat(60));
  console.log("Vercel env for insert-coin-ule3.vercel.app:");
  console.log("NEXT_PUBLIC_CONTRACT_ADDRESS=" + icAddress);
  console.log("NEXT_PUBLIC_TOURNAMENT_HUB_ADDRESS=" + hubAddress);
  console.log("NEXT_PUBLIC_FORWARDER_ADDRESS=" + FORWARDER);
  console.log("NEXT_PUBLIC_CHAIN_ID=8453");
  console.log("RELAY_ALLOWED_TARGETS=" + icAddress + "," + hubAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });

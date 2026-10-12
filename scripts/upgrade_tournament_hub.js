/**
 * Upgrade ICTournamentHub implementation (proxy address stays the same).
 *
 * Upgrade the implementation behind an existing hub proxy.
 *
 * Usage:
 *   npx hardhat run scripts/upgrade_tournament_hub.js --network baseMainnet
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const proxy =
    process.env.TOURNAMENT_HUB_PROXY_ADDRESS ||
    "0x63c6BDa9cfb31290Ea8a273308bcE1d7419F4C04"; // Base mainnet hub proxy

  console.log("Network:", hre.network.name);
  console.log("Proxy:", proxy);

  const [signer] = await hre.ethers.getSigners();
  console.log("Upgrader (must own the proxy admin):", signer.address);

  const implBefore = await hre.upgrades.erc1967.getImplementationAddress(proxy);
  console.log("Implementation before:", implBefore);

  const Hub = await hre.ethers.getContractFactory("ICTournamentHub");
  const upgraded = await hre.upgrades.upgradeProxy(proxy, Hub);
  await upgraded.waitForDeployment();

  // RPC/indexers can lag; re-read after a short pause so logged impl matches EIP-1967 slot.
  await new Promise((r) => setTimeout(r, 5000));
  const implAfter = await hre.upgrades.erc1967.getImplementationAddress(proxy);
  console.log("Implementation after: ", implAfter);

  if (implAfter.toLowerCase() === implBefore.toLowerCase()) {
    console.warn("⚠️  Implementation unchanged — plugin may have reused identical bytecode.");
  }

  // --- Verify new implementation on Basescan ---
  if (process.env.BASESCAN_API_KEY && !["hardhat", "localhost"].includes(hre.network.name)) {
    console.log("Verifying new implementation on Basescan...");
    await new Promise((r) => setTimeout(r, 30000));
    try {
      await hre.run("verify:verify", { address: implAfter, constructorArguments: [] });
      console.log("✅ Implementation verified");
    } catch (err) {
      console.warn("⚠️  Verification skipped/failed:", err.message || err);
    }
  }

  // --- Update deployment info ---
  const infoPath = path.join(__dirname, "..", "tournament-hub-deployment-info.json");
  if (fs.existsSync(infoPath) && !process.env.SKIP_DEPLOYMENT_INFO) {
    const info = JSON.parse(fs.readFileSync(infoPath, "utf8"));
    if (info.proxyAddress && info.proxyAddress.toLowerCase() === proxy.toLowerCase()) {
      info.implementationAddress = implAfter;
      info.basescanLinks.implementation = `https://basescan.org/address/${implAfter}`;
      info.lastUpgrade = {
        timestamp: new Date().toISOString(),
        change: process.env.UPGRADE_NOTE || "Hub implementation upgrade",
        previousImplementation: implBefore,
      };
      fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
      console.log("✅ tournament-hub-deployment-info.json updated");
    } else {
      console.log("Skipping production deployment-info (proxy mismatch)");
    }
  }

  console.log("\nUpgrade complete. Proxy unchanged:", proxy);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

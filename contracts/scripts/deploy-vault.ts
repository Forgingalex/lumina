import pkg from "hardhat";
const { ethers, run, network } = pkg;

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log("────────────────────────────────────────────────");
  console.log("  LUMINA UNIVERSAL VAULT DEPLOYMENT");
  console.log("────────────────────────────────────────────────");
  console.log(`  Network:    ${networkName} (${chainId})`);
  console.log(`  Deployer:   ${deployer.address}`);
  console.log(`  Balance:    ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} CELO`);
  console.log("────────────────────────────────────────────────\n");

  // ── Deploy ──────────────────────────────────────────────────────────
  console.log(`▸ Deploying Universal LuminaVault (No Constructor Args)...`);
  const VaultFactory = await ethers.getContractFactory("LuminaVault");
  
  // No arguments passed here to match the new Solidity code
  const vault = await VaultFactory.deploy();
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log(`✓ LuminaVault deployed at: ${vaultAddress}\n`);

  // ── Verification ───────────────────────────────────────────────────
  if (process.env.CELOSCAN_API_KEY) {
    console.log("▸ Waiting 30s before verification...");
    await new Promise((resolve) => setTimeout(resolve, 30_000));

    try {
      await run("verify:verify", {
        address: vaultAddress,
        constructorArguments: [], // Empty array for universal vault
      });
      console.log("✓ Contract verified on Celoscan.\n");
    } catch (error: any) {
      console.warn(`⚠ Verification failed: ${error.message}\n`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────
  console.log("════════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("════════════════════════════════════════════════");
  console.log(`  Contract:   ${vaultAddress}`);
  console.log(`  Explorer:   https://celoscan.io/address/${vaultAddress}`);
  console.log(`\n  → Add to constants.ts:`);
  console.log(`    LUMINA_VAULT: '${vaultAddress}'`);
  console.log("════════════════════════════════════════════════");
}

main().catch((error) => {
  console.error("✗ Deployment failed:", error);
  process.exitCode = 1;
});

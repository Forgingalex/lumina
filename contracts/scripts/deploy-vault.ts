import pkg from "hardhat";
const { ethers, run, network } = pkg;

/**
 * Lumina Vault Deployment Script
 *
 * Deploys LuminaVault.sol to the target Celo network and optionally:
 *   1. Transfers ownership to a production multisig/EOA.
 *   2. Verifies the contract source on Celoscan.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-vault.ts --network celo
 *   npx hardhat run scripts/deploy-vault.ts --network celo-sepolia
 *
 * Environment Variables:
 *   DEPLOYER_PRIVATE_KEY   – Required. The deployer's private key.
 *   OWNER_ADDRESS          – Optional. If set, ownership is transferred post-deploy.
 *   CELOSCAN_API_KEY       – Optional. Required for automatic contract verification.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log("────────────────────────────────────────────────");
  console.log("  LUMINA VAULT DEPLOYMENT");
  console.log("────────────────────────────────────────────────");
  console.log(`  Network:    ${networkName} (${chainId})`);
  console.log(`  Deployer:   ${deployer.address}`);
  console.log(
    `  Balance:    ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} CELO`
  );
  console.log("────────────────────────────────────────────────\n");

  // USDC address for Celo Sepolia
  const usdmAddress = "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B";

  // ── Deploy ──────────────────────────────────────────────────────────
  console.log(`▸ Deploying LuminaVault with USDC: ${usdmAddress}...`);
  const VaultFactory = await ethers.getContractFactory("LuminaVault");
  const vault = await VaultFactory.deploy(usdmAddress);
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log(`✓ LuminaVault deployed at: ${vaultAddress}\n`);

  // ── Ownership Transfer ─────────────────────────────────────────────
  const ownerAddress = process.env.OWNER_ADDRESS;
  if (ownerAddress && ownerAddress !== deployer.address) {
    console.log(`▸ Transferring ownership to ${ownerAddress}...`);
    const tx = await vault.transferOwnership(ownerAddress);
    await tx.wait();
    console.log(`✓ Ownership transferred.\n`);
  } else {
    console.log(`▹ Ownership remains with deployer: ${deployer.address}\n`);
  }

  // ── Verification ───────────────────────────────────────────────────
  if (process.env.CELOSCAN_API_KEY) {
    console.log("▸ Waiting 30s before verification (block propagation)...");
    await new Promise((resolve) => setTimeout(resolve, 30_000));

    try {
      await run("verify:verify", {
        address: vaultAddress,
        constructorArguments: [usdmAddress],
      });
      console.log("✓ Contract verified on Celoscan.\n");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      if (message.includes("Already Verified")) {
        console.log("✓ Contract already verified.\n");
      } else {
        console.warn(`⚠ Verification failed: ${message}\n`);
      }
    }
  } else {
    console.log(
      "▹ Skipping verification (CELOSCAN_API_KEY not set).\n"
    );
  }

  // ── Summary ────────────────────────────────────────────────────────
  console.log("════════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("════════════════════════════════════════════════");
  console.log(`  Contract:   ${vaultAddress}`);
  console.log(`  Network:    ${networkName} (${chainId})`);
  console.log(`  Explorer:   https://celoscan.io/address/${vaultAddress}`);
  console.log(`\n  → Add to constants.ts:`);
  console.log(`    LUMINA_VAULT: '${vaultAddress}'`);
  console.log("════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("✗ Deployment failed:", error);
    process.exit(1);
  });

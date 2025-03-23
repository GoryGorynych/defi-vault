const fs = require("fs");
const { ethers, upgrades } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();

  const coinName = "TacoCoin";
  const relayerName = "Relayer";
  const vaultName = "Vault";
  const initAmount = ethers.parseUnits("100", 18);
  const rewardRatePerDay = 1;

  // Deploy TacoCoin
  const TacoCoin = await ethers.getContractFactory(coinName);
  const tacoCoin = await TacoCoin.deploy(initAmount);
  await tacoCoin.waitForDeployment();
  const tacoCoinAddress = await tacoCoin.getAddress();
  console.log(`TacoCoin deployed at ${tacoCoinAddress}`);

  // Deploy Relayer
  const Relayer = await ethers.getContractFactory(relayerName);
  const relayer = await Relayer.deploy("Taco-Vault");
  await relayer.waitForDeployment();
  const relayerAddress = await relayer.getAddress();
  console.log(`Relayer deployed at ${relayerAddress}`);

  // Deploy Vault (UUPS proxy)
  const Vault = await ethers.getContractFactory(vaultName);
  const vault = await upgrades.deployProxy(Vault, [
    tacoCoinAddress,
    owner.address,
    rewardRatePerDay,
    relayerAddress,
  ], {
    initializer: "initialize",
    kind: "uups",
  });

  await vault.waitForDeployment();
  const vaultProxyAddress = await vault.getAddress();
  const vaultImplAddress = await upgrades.erc1967.getImplementationAddress(vaultProxyAddress);
  console.log(`Vault Proxy deployed at ${vaultProxyAddress}`);
  console.log(`ℹ️ Vault Implementation at ${vaultImplAddress}`);

  // Save data for verification
  const deployedData = {
    TacoCoin: {
      name: coinName,
      address: tacoCoinAddress,
      constructorArgs: [initAmount.toString()],
    },
    Relayer: {
      name: relayerName,
      address: relayerAddress,
      constructorArgs: ["Taco-Vault"],
      contractPath: "contracts/Relayer.sol:Relayer",
    },
    VaultImpl: {
      name: vaultName,
      address: vaultImplAddress,
      constructorArgs: [],
    },
    VaultProxy: {
      address: vaultProxyAddress
    }
  };

  fs.writeFileSync("deployedAddresses.json", JSON.stringify(deployedData, null, 2));
  console.log("Saved deployed addresses to deployedAddresses.json");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});

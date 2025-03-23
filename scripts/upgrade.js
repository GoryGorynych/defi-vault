const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  const deployedPath = "deployedAddresses.json";
  if (!fs.existsSync(deployedPath)) {
    throw new Error("deployedAddresses.json not found. Run deploy script first.");
  }

  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf-8"));

  const proxyAddress = deployed.VaultProxy?.address;
  if (!proxyAddress) {
    throw new Error("VaultProxy address not found in deployedAddresses.json");
  }

  console.log("Upgrading Vault implementation...");

  const VaultV3 = await ethers.getContractFactory("VaultV3");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, VaultV3);

  console.log("Vault upgraded at proxy:", await upgraded.getAddress());

  const newImplAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("ℹ️ New implementation address:", newImplAddress);

  // Save new implementation info for verification
  deployed.VaultImpl = {
    name: "VaultV3",
    address: newImplAddress,
    constructorArgs: [],
    contractPath: "contracts/VaultV3.sol:VaultV3",
  };

  fs.writeFileSync(deployedPath, JSON.stringify(deployed, null, 2));
  console.log("Updated deployedAddresses.json with new implementation.");
}

main().catch((error) => {
  console.error("Upgrade failed:", error);
  process.exit(1);
});

const { run } = require("hardhat");
const fs = require("fs");

async function main() {
  const filePath = "deployedAddresses.json";
  if (!fs.existsSync(filePath)) {
    throw new Error("deployedAddresses.json not found. Run deploy script first.");
  }

  const deployed = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  const verifyContract = async (name, { address, constructorArgs, contractPath }) => {
    console.log(`Verifying ${name} at ${address}...`);
    const verifyParams = {
      address,
      constructorArguments: constructorArgs || [],
    };

    if (contractPath) {
      verifyParams.contract = contractPath;
    }

    try {
      await run("verify:verify", verifyParams);
      console.log(`Verified: ${name}\n`);
    } catch (err) {
      if (err.message.toLowerCase().includes("already verified")) {
        console.log(`Already verified: ${name}\n`);
      } else {
        console.error(`Failed to verify ${name}:`, err.message);
      }
    }
  };

  for (const [name, data] of Object.entries(deployed)) {
    if (name === "VaultProxy") continue; // skip proxy
    await verifyContract(name, data);
  }
}

main().catch((error) => {
  console.error("Verification script failed:", error);
  process.exit(1);
});

const fs = require("fs");
const { ethers, network } = require("hardhat");

// ************ Сonfiguration block ************ //

//Contract for deploying
const deployContract = "MailVerifier";

//Arguments for contract constructor
const name = "My token";
const symbol = "MTK";
const decimals = 4;
//Require fill the args with arguments if any
const args = [];

//Deployer index for signers
const deployerIdx = 1;

// ******************************************* //

// async function deployVault() {
//     [owner, user1, user2] = await ethers.getSigners();
//     chainId = (await ethers.provider.getNetwork()).chainId;

//     // Deploy TacoCoin (ERC20 with permit)
//     TacoCoin = await ethers.getContractFactory("TacoCoin");
//     tacoCoin = await TacoCoin.deploy(initAmout);
//     await tacoCoin.waitForDeployment();

//     // Deploy Relayer
//     Relayer = await ethers.getContractFactory("Relayer");
//     relayer = await Relayer.deploy("Taco-Vault");
//     await relayer.waitForDeployment();

//     // Deploy Vault (UUPS Upgradeable)
//     Vault = await ethers.getContractFactory("Vault");
//     vault = await upgrades.deployProxy(Vault,
//         [await tacoCoin.getAddress(), owner.address, rewardRatePerDay, await relayer.getAddress()], {
//         initializer: "initialize",
//         kind: "uups"
//     });
//     await vault.waitForDeployment();

// }

/**
 * Функция универсальная, не требуется изменять данные для деплоя.
 */
async function deploy() {
    console.log(`Deploying to network: ${network.name}`);

    const signers = await ethers.getSigners();

    const EOA = signers[deployerIdx];
    const deployer = await EOA.getAddress();
    console.log("EOA is:", deployer);

    console.log(`1. Deploying contract... arguments: ${args.join(", ")}`);

    const factory = await ethers.getContractFactory(deployContract);
    const contractInstance = await factory.connect(EOA).deploy(...args);
    const result = await contractInstance.waitForDeployment();

    const contractAddress = await contractInstance.getAddress();
    console.log("Contract deployed:", deployContract);
    console.log("Contract address:", contractAddress);
    console.log("Transaction:", result.deploymentTransaction()?.hash);

    // Сохранение данных для верификации
    const deploymentData = {
        contractAddress,
        ...Object.fromEntries(args.map((value, index) => [`arg${index + 1}`, value]))
    };

    fs.writeFileSync("scripts/deployment.json", JSON.stringify(deploymentData, null, 2));
    console.log("Deployment data saved to deployment.json");

    console.log("Run `npm run verify` to verify the contract.");
}

deploy()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

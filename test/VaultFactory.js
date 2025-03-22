const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("VaultFactory Contract", function () {
    let Vault, vaultImplementation, VaultFactory, vaultFactory;
    let TacoCoin, tacoCoin;
    let owner, user1, user2;
    let initAmout = 100n * 10n ** 18n;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        // Деплоим TacoCoin (ERC20 с permit)
        TacoCoin = await ethers.getContractFactory("TacoCoin");
        tacoCoin = await TacoCoin.deploy(initAmout);
        await tacoCoin.waitForDeployment();

        // Деплоим Vault
        Vault = await ethers.getContractFactory("Vault");
        vaultImplementation = await Vault.deploy();
        await vaultImplementation.waitForDeployment();

         // Деплоим Relayer
         Relayer = await ethers.getContractFactory("Relayer");
         relayer = await Relayer.deploy("Taco-Vault");
         await relayer.waitForDeployment();       

        // Деплоим VaultFactory
        VaultFactory = await ethers.getContractFactory("VaultFactory");
        vaultFactory = await VaultFactory.deploy(vaultImplementation, relayer);
        await vaultFactory.waitForDeployment();
    });

    it("Должен развернуть фабрику с правильным адресом реализации Vault", async function () {
        expect(await vaultFactory.vaultImplementation()).to.equal(vaultImplementation);
    });


    it("Должен позволять пользователям создавать несколько Vault", async function () {
        const rewardRate1 = 3;
        const rewardRate2 = 7;
    
        // Создание двух Vault для разных пользователей
        const tx1 = await vaultFactory.connect(user1).createVault(await tacoCoin.getAddress(), rewardRate1);
        const receipt1 = await tx1.wait();
        const newVaultAddress1 = receipt1.logs.find(log => log.eventName === "VaultCreated").args.newVault;
    
        const tx2 = await vaultFactory.connect(user2).createVault(await tacoCoin.getAddress(), rewardRate2);
        const receipt2 = await tx2.wait();
        const newVaultAddress2 = receipt2.logs.find(log => log.eventName === "VaultCreated").args.newVault;
    
        const vaults = await vaultFactory.getVaults();
        expect(vaults.length).to.equal(2);
    
        // Получаем контракты Vault и проверяем rewardRatePerDay
        const vault1 = await ethers.getContractAt("Vault", newVaultAddress1);
        const vault2 = await ethers.getContractAt("Vault", newVaultAddress2);
    
        expect(await vault1.rewardRatePerDay()).to.equal(rewardRate1);
        expect(await vault2.rewardRatePerDay()).to.equal(rewardRate2);
    });
});

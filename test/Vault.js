const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Vault Contract", function () {
    let Vault, vault, TacoCoin, tacoCoin, owner, user1, user2, rewardDistributor;
    let initAmout = 100n * 10n ** 18n;
    let rewardRatePerDay = 1n;

    beforeEach(async function () {
        [owner, user1, user2, rewardDistributor] = await ethers.getSigners();

        // Деплоим TacoCoin (ERC20 с permit)
        TacoCoin = await ethers.getContractFactory("TacoCoin");
        tacoCoin = await TacoCoin.deploy(initAmout);
        await tacoCoin.waitForDeployment();

        // Деплоим Vault (UUPS Upgradeable)
        Vault = await ethers.getContractFactory("Vault");
        vault = await upgrades.deployProxy(Vault, [await tacoCoin.getAddress(), owner.address, rewardRatePerDay], {
            initializer: "initialize",
        });
        await vault.waitForDeployment();
    });

    it("Проверка начальной инициализации", async function () {
        expect(await vault.tacoCoin()).to.equal(await tacoCoin.getAddress());
        expect(await vault.owner()).to.equal(owner.address);
    });

    it("Депозит токенов через permit()", async function () {
        vaultAddress = await vault.getAddress();
        const depositAmount = ethers.parseEther("10");

        // Mint токены пользователю
        await tacoCoin.mint(user1.address, depositAmount);
        // await tacoCoin.connect(user1).approve(await vault.getAddress(), depositAmount);

        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 час в будущем

        // Подписываем транзакцию
        const { v, r, s } = await preparePermitSignature(tacoCoin, user1, user1.address, vaultAddress, depositAmount, deadline);

        // Делаем депозит
        await vault.connect(user1).deposit(depositAmount, deadline, v, r, s);

        // Проверяем баланс в контракте
        expect(await tacoCoin.balanceOf(vaultAddress)).to.equal(depositAmount);
        const deposit = await vault.deposits(user1.address);
        expect(deposit.amount).to.equal(depositAmount);
    });

    it("Вывод токенов", async function () {
        vaultAddress = await vault.getAddress();
        const depositAmount = ethers.parseEther("5");

        // Mint токены пользователю
        await tacoCoin.mint(user1.address, depositAmount);
        // await tacoCoin.connect(user1).approve(await vault.getAddress(), depositAmount);

        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 час в будущем

        // Подписываем транзакцию
        const { v, r, s } = await preparePermitSignature(tacoCoin, user1, user1.address, vaultAddress, depositAmount, deadline);

        // Делаем депозит
        await vault.connect(user1).deposit(depositAmount, deadline, v, r, s);

        // Вывод токенов
        await vault.connect(user1).withdraw(depositAmount);
        expect(await tacoCoin.balanceOf(user1.address)).to.equal(depositAmount);
    });

    it("Расчёт наград", async function () {
        const vaultAddress = await vault.getAddress();
        const depositAmount = ethers.parseEther("10");

        // Mint токены пользователю
        await tacoCoin.mint(user1.address, depositAmount);

        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 час в будущем
        // Подписываем транзакцию
        const { v, r, s } = await preparePermitSignature(tacoCoin, user1, user1.address, vaultAddress, depositAmount, deadline);

        // Делаем депозит
        await vault.connect(user1).deposit(depositAmount, deadline, v, r, s);

        // Пропускаем время (10 дней)
        await ethers.provider.send("evm_increaseTime", [86400 * 10]);
        await ethers.provider.send("evm_mine");

        const rewards = await vault.calculateRewards(user1.address);
        expect(rewards).to.equal(depositAmount / 10n); // 1% в день * 10 дней
    });

    it("Только владелец может обновлять контракт", async function () {
        const NewVault = await ethers.getContractFactory("Vault");
        await expect(
            upgrades.upgradeProxy(await vault.getAddress(), NewVault.connect(user1))
        ).to.be.revertedWithCustomError(NewVault, "OwnableUnauthorizedAccount");
    });

    it("Должен обновить имплементацию Vault", async function () {
        const NewVault = await ethers.getContractFactory("VaultV2");
        const upgradedVault = await upgrades.upgradeProxy(await vault.getAddress(), NewVault);
        
        expect(await upgradedVault.getVersion()).to.equal("V2");
    });
});


async function preparePermitSignature(coinContract, owner, ownerAddress, spenderAddress, amount, deadline) {
    const nonce = await coinContract.nonces(ownerAddress);

    const name = await coinContract.name();
    const version = await coinContract.version();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const contractAddress = await coinContract.getAddress();

    // console.log(`Token Name: ${name}`);
    // console.log(`Token Version: ${version}`);
    // console.log(`Chain ID: ${chainId}`);

    // Данные для подписи
    const domain = {
        name: name,
        version: version,
        chainId: chainId,
        verifyingContract: contractAddress
    };

    const types = {
        Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" }
        ]
    };

    const message = { owner: ownerAddress, spender: spenderAddress, value: amount, nonce, deadline };

    const signature = await owner.signTypedData(domain, types, message);
    return ethers.Signature.from(signature);
}
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Vault Contract", function () {
    let Vault, vault, TacoCoin, tacoCoin, owner, user1, user2, chainId;
    let initAmout = 100n * 10n ** 18n;
    let rewardRatePerDay = 1n;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        chainId = (await ethers.provider.getNetwork()).chainId;

        // Деплоим TacoCoin (ERC20 с permit)
        TacoCoin = await ethers.getContractFactory("TacoCoin");
        tacoCoin = await TacoCoin.deploy(initAmout);
        await tacoCoin.waitForDeployment();

        // Деплоим Relayer
        Relayer = await ethers.getContractFactory("Relayer");
        relayer = await Relayer.deploy("Taco-Vault");
        await relayer.waitForDeployment();

        // Деплоим Vault (UUPS Upgradeable)
        Vault = await ethers.getContractFactory("Vault");
        vault = await upgrades.deployProxy(Vault, 
            [await tacoCoin.getAddress(), owner.address, rewardRatePerDay, await relayer.getAddress()], {
            initializer: "initialize",
            kind: "uups"
        });
        await vault.waitForDeployment();
    });

    it("Проверка начальной инициализации", async function () {
        expect(await vault.tacoCoin()).to.equal(await tacoCoin.getAddress());
    });

    it("Депозит токенов через permit()", async function () {
        vaultAddress = await vault.getAddress();
        const depositAmount = ethers.parseEther("10");

        await depositTransaction(vault, vaultAddress, depositAmount, user1, tacoCoin);

        // Проверяем баланс в контракте
        expect(await tacoCoin.balanceOf(vaultAddress)).to.equal(depositAmount);
        const deposit = await vault.deposits(user1.address);
        expect(deposit.amount).to.equal(depositAmount);
    });

    it("Вывод токенов", async function () {
        vaultAddress = await vault.getAddress();
        const depositAmount = ethers.parseEther("5");

        await depositTransaction(vault, vaultAddress, depositAmount, user1, tacoCoin);

        // Вывод токенов
        await vault.connect(user1).withdraw(depositAmount);
        expect(await tacoCoin.balanceOf(user1.address)).to.equal(depositAmount);
    });

    it("Расчёт наград", async function () {
        const vaultAddress = await vault.getAddress();
        const depositAmount = ethers.parseEther("10");

        await depositTransaction(vault, vaultAddress, depositAmount, user1, tacoCoin);

        // Сохраняем снапшот текущего состояния EVM
        const snapshotId = await ethers.provider.send("evm_snapshot");

        // Пропускаем время (10 дней)
        await ethers.provider.send("evm_increaseTime", [86400 * 10]);
        await ethers.provider.send("evm_mine");

        const rewards = await vault.calculateRewards(user1.address);
        expect(rewards).to.equal(depositAmount / 10n); // 1% в день * 10 дней

         // Возвращаемся к состоянию до увеличения времени
         await ethers.provider.send("evm_revert", [snapshotId]);       
    });

    it ("Должен обновить имплементацию Vault", async function () {
        const NewVault = await ethers.getContractFactory("VaultV2");
        const upgradedVault = await upgrades.upgradeProxy(await vault.getAddress(), NewVault);

        expect(await upgradedVault.getVersion()).to.equal("V2");
    });

    context("Meta transactions", function () {
        it("Депозит токенов через мета транзакцию и Relayer", async function () {
            vaultAddress = await vault.getAddress();
            const relayerAddress = await relayer.getAddress();
            const depositAmount = ethers.parseEther("10");
    
            // ==== 1. Генерируем permit-подпись ====
    
            // Mint токены пользователю
            await tacoCoin.mint(user1.address, depositAmount);
    
            const deadline = Math.floor(Date.now() / 1000) + 3600; // плюс час
    
            // Подписываем транзакцию
            const { v, r, s } = await preparePermitSignature(tacoCoin, user1, user1.address, vaultAddress, depositAmount, deadline);
    
            // ==== 2. Кодируем вызов deposit ====
    
            const data = vault.interface.encodeFunctionData("deposit", [depositAmount, deadline, v, r, s]);
    
            // ==== 3. Генерируем подпись под ForwardRequest (EIP-712) ====
    
            const forwarderDomain = {
                name: "Taco-Vault",
                version: "1",
                chainId,
                verifyingContract: relayerAddress
            };
    
            const request = {
                from: user1.address,
                to: vaultAddress,
                value: 0,
                gas: 1_000_000,
                nonce: await relayer.nonces(user1.address),
                deadline: deadline,
                data
            };
    
    
            const forwarderTypes = {
                ForwardRequest: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "gas", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint48" },
                    { name: "data", type: "bytes" },
                ],
            };
    
            const signature = await user1.signTypedData(forwarderDomain, forwarderTypes, request);
    
            // ==== 4. Выполняем мета транзакцию через Relayer ====
    
            request.signature = signature;
            await expect(
                relayer.connect(user2).execute(request)
            ).to.emit(vault, "Deposited").withArgs(user1.address, depositAmount); // проверяем эвент
    
            // ==== 5. Проверяем, что депозит записался на юзера ====
    
            const deposit = await vault.deposits(user1.address);
            expect(deposit.amount).to.equal(depositAmount);
    
        });
    })

    context("AccessControl", function () {
        it("should assign DEFAULT_ADMIN_ROLE, REWARD_MANAGER_ROLE, and UPGRADER_ROLE to deployer", async () => {
            const DEFAULT_ADMIN_ROLE = await vault.DEFAULT_ADMIN_ROLE();
            const REWARD_MANAGER_ROLE = await vault.REWARD_MANAGER_ROLE();
            const UPGRADER_ROLE = await vault.UPGRADER_ROLE();
    
            expect(await vault.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
            expect(await vault.hasRole(REWARD_MANAGER_ROLE, owner.address)).to.be.true;
            expect(await vault.hasRole(UPGRADER_ROLE, owner.address)).to.be.true;
        });
    
        it("should allow REWARD_MANAGER_ROLE to set reward rate", async () => {
            await expect(vault.setRewardRate(5))
                .to.not.be.reverted;
        });
    
        it("should not allow non-REWARD_MANAGER_ROLE to set reward rate", async () => {
            await expect(
                vault.connect(user1).setRewardRate(5)
            ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount")
                .withArgs(user1.address, await vault.REWARD_MANAGER_ROLE());
        });
    
        it("should allow UPGRADER_ROLE to upgrade", async () => {
            const NewVault = await ethers.getContractFactory("VaultV2");
            await expect(upgrades.upgradeProxy(await vault.getAddress(), NewVault.connect(owner)))
                .to.not.be.reverted;
        });
    
        it("should not allow upgrade from non-UPGRADER_ROLE", async () => {
            const NewVault = await ethers.getContractFactory("VaultV2");
    
            await expect(
                upgrades.upgradeProxy(await vault.getAddress(), NewVault.connect(user1))
            ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount")
                .withArgs(user1.address, await vault.UPGRADER_ROLE());
        });
    });
    
});


async function depositTransaction(vault, vaultAddress, depositAmount, owner, tacoCoin) {

    // Mint токены пользователю
    await tacoCoin.mint(owner.address, depositAmount);

    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 час в будущем

    // Подписываем транзакцию
    const { v, r, s } = await preparePermitSignature(tacoCoin, owner, owner.address, vaultAddress, depositAmount, deadline);

    // Делаем депозит
    await vault.connect(owner).deposit(depositAmount, deadline, v, r, s);
}

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
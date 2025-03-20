const { expect } = require("chai");

const contractName = "TacoCoin";

describe(contractName, function () {
    let owner, spender, spender2;
    const symbol = "TACO";
    let initAmout = 100n * 10n ** 18n;
    let deadline;
    let coinContract;

    beforeEach(async function () {
        [owner, spender, spender2] = await ethers.getSigners();
        const CoinContractFactory = await ethers.getContractFactory(contractName);
        coinContract = await CoinContractFactory.deploy(initAmout);
        await coinContract.waitForDeployment();

        deadline = Math.floor(Date.now() / 1000) + 3600; // 1 час
    });

    context("Initialization", async function () {
        it("Should correctly constructs", async () => {
            expect(await coinContract.name()).to.equal(contractName);
            expect(await coinContract.symbol()).to.equal(symbol);
            expect(await coinContract.totalSupply()).to.equal(initAmout);
        });

        it("Should assign the total supply of tokens to the owner", async function () {
            const ownerBalance = await coinContract.balanceOf(owner.address);
            expect(await coinContract.totalSupply()).to.equal(ownerBalance);
        });
    });

    context("Permit", async function () {
        it("Should allow permit to approve token spending via signature", async () => {

            const amount = ethers.parseUnits("1", 4); // 1 токен
            const { v, r, s } = await preparePermitSignature(coinContract, owner, spender, amount, deadline)

            const tx = await coinContract.connect(spender)
                .permit(owner.address, spender.address, amount, deadline, v, r, s);
            await tx.wait();

            const allowance = await coinContract.allowance(owner, spender);
            expect(allowance).to.equal(amount);

            const transferTx = await coinContract.connect(spender)
                .transferFrom(owner.address, spender.address, amount);
            await transferTx.wait();

            const spenderBalance = await coinContract.balanceOf(spender.address);
            expect(spenderBalance).to.equal(amount);

        });

        it("Should revert if permit signature is invalid", async () => {

            const amount = ethers.parseUnits("1", 4); // 1 токен
            const { v, r, s } = await preparePermitSignature(coinContract, spender2, spender, amount, deadline)

            await expect(coinContract.connect(spender)
                .permit(owner.address, spender.address, amount, deadline, v, r, s))
                .to.be.revertedWithCustomError(coinContract, "EIP2612InvalidSignature");
        });

        it("Should revert if deadline is expired", async () => {

            const amount = ethers.parseUnits("1", 4); // 1 токен
            const expiredDeadline = Math.floor(Date.now() / 1000) - 100;
            const { v, r, s } = await preparePermitSignature(coinContract, owner, spender, amount, expiredDeadline)

            await expect(coinContract.connect(spender)
                .permit(owner.address, spender.address, amount, expiredDeadline, v, r, s))
                .to.be.revertedWithCustomError(coinContract, "EIP2612PermisssionExpired");
        });
    })
});

async function preparePermitSignature(coinContract, owner, spender, amount, deadline) {
    const nonce = await coinContract.nonces(owner.address);

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

    const message = { owner: owner.address, spender: spender.address, value: amount, nonce, deadline };

    const signature = await owner.signTypedData(domain, types, message);
    return ethers.Signature.from(signature);
}
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

        // Deploy the TacoCoin contract with initial supply
        const CoinContractFactory = await ethers.getContractFactory(contractName);
        coinContract = await CoinContractFactory.deploy(initAmout);
        await coinContract.waitForDeployment();

        // Set deadline for EIP-2612 permit (1 hour from now)
        deadline = Math.floor(Date.now() / 1000) + 3600;
    });

    context("Initialization", async function () {
        it("Should correctly constructs", async () => {
            // Validate name, symbol, and total supply
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
            const amount = ethers.parseUnits("1", 4); // 1 token with 4 decimals

            // Generate a valid EIP-2612 permit signature
            const { v, r, s } = await preparePermitSignature(coinContract, owner, spender, amount, deadline)

            // Spender submits permit to gain approval
            const tx = await coinContract.connect(spender)
                .permit(owner.address, spender.address, amount, deadline, v, r, s);
            await tx.wait();

            // Verify that allowance was set
            const allowance = await coinContract.allowance(owner, spender);
            expect(allowance).to.equal(amount);

            // Use approved allowance to transfer tokens
            const transferTx = await coinContract.connect(spender)
                .transferFrom(owner.address, spender.address, amount);
            await transferTx.wait();

            // Confirm that tokens were received
            const spenderBalance = await coinContract.balanceOf(spender.address);
            expect(spenderBalance).to.equal(amount);
        });

        it("Should revert if permit signature is invalid", async () => {
            const amount = ethers.parseUnits("1", 4);

            // Signature signed by a wrong account (spender2 instead of owner)
            const { v, r, s } = await preparePermitSignature(coinContract, spender2, spender, amount, deadline)

            await expect(
                coinContract.connect(spender)
                    .permit(owner.address, spender.address, amount, deadline, v, r, s)
            ).to.be.revertedWithCustomError(coinContract, "EIP2612InvalidSignature");
        });

        it("Should revert if deadline is expired", async () => {
            const amount = ethers.parseUnits("1", 4);

            // Deadline is in the past
            const expiredDeadline = Math.floor(Date.now() / 1000) - 100;
            const { v, r, s } = await preparePermitSignature(coinContract, owner, spender, amount, expiredDeadline)

            await expect(
                coinContract.connect(spender)
                    .permit(owner.address, spender.address, amount, expiredDeadline, v, r, s)
            ).to.be.revertedWithCustomError(coinContract, "EIP2612PermisssionExpired");
        });
    });

    context("AccessControl", function () {
        it("Should grant DEFAULT_ADMIN_ROLE, MINTER_ROLE to deployer", async () => {
            const DEFAULT_ADMIN_ROLE = await coinContract.DEFAULT_ADMIN_ROLE();
            const MINTER_ROLE = await coinContract.MINTER_ROLE();

            // Owner should have both roles upon deployment
            expect(await coinContract.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
            expect(await coinContract.hasRole(MINTER_ROLE, owner.address)).to.be.true;
        });

        it("Should allow MINTER_ROLE to mint tokens", async () => {
            const amountToMint = ethers.parseUnits("10", 18);
            const initialBalance = await coinContract.balanceOf(spender.address);

            // Mint tokens to spender
            await coinContract.mint(spender.address, amountToMint);

            const newBalance = await coinContract.balanceOf(spender.address);
            expect(newBalance - initialBalance).to.equal(amountToMint);
        });

        it("Should not allow minting without MINTER_ROLE", async () => {
            const amountToMint = ethers.parseUnits("10", 18);
            const MINTER_ROLE = await coinContract.MINTER_ROLE();

            // Spender does NOT have MINTER_ROLE
            await expect(
                coinContract.connect(spender).mint(spender.address, amountToMint)
            ).to.be.revertedWithCustomError(coinContract, "AccessControlUnauthorizedAccount")
             .withArgs(spender.address, MINTER_ROLE);
        });

        it("Should allow BURNER_ROLE to burn tokens", async () => {
            const amountToBurn = ethers.parseUnits("5", 18);

            // Grant BURNER_ROLE to spender
            const BURNER_ROLE = await coinContract.BURNER_ROLE();
            await coinContract.grantRole(BURNER_ROLE, spender.address);

            // Transfer tokens to spender so they have a balance to burn
            await coinContract.transfer(spender.address, amountToBurn);

            const initialBalance = await coinContract.balanceOf(spender.address);

            // Burn tokens from own balance
            await coinContract.connect(spender).burn(spender.address, amountToBurn);
            const finalBalance = await coinContract.balanceOf(spender.address);

            expect(initialBalance - finalBalance).to.equal(amountToBurn);
        });

        it("Should not allow burning without BURNER_ROLE", async () => {
            const amountToBurn = ethers.parseUnits("5", 18);
            const BURNER_ROLE = await coinContract.BURNER_ROLE();

            // Transfer tokens to spender, but don’t grant BURNER_ROLE
            await coinContract.transfer(spender.address, amountToBurn);

            await expect(
                coinContract.connect(spender).burn(spender.address, amountToBurn)
            ).to.be.revertedWithCustomError(coinContract, "AccessControlUnauthorizedAccount")
             .withArgs(spender.address, BURNER_ROLE);
        });

        it("Should allow DEFAULT_ADMIN_ROLE to grant and revoke roles", async () => {
            const BURNER_ROLE = await coinContract.BURNER_ROLE();

            // Grant BURNER_ROLE to spender
            await coinContract.grantRole(BURNER_ROLE, spender.address);
            expect(await coinContract.hasRole(BURNER_ROLE, spender.address)).to.be.true;

            // Revoke BURNER_ROLE
            await coinContract.revokeRole(BURNER_ROLE, spender.address);
            expect(await coinContract.hasRole(BURNER_ROLE, spender.address)).to.be.false;
        });
    });

});

// Helper function to prepare EIP-2612 signature using signTypedData
async function preparePermitSignature(coinContract, owner, spender, amount, deadline) {
    const nonce = await coinContract.nonces(owner.address);

    const name = await coinContract.name();
    const version = await coinContract.version();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const contractAddress = await coinContract.getAddress();

    // Build the domain per EIP-712
    const domain = {
        name: name,
        version: version,
        chainId: chainId,
        verifyingContract: contractAddress
    };

    // Define types for Permit
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

    // Sign using EIP-712 typed data
    const signature = await owner.signTypedData(domain, types, message);
    return ethers.Signature.from(signature);
}

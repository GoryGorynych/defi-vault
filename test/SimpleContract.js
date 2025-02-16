const { expect } = require("chai");

describe("SimpleContract", function () {
  let SimpleContract;
  let simpleContract;
  let owner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const SimpleContractFactory = await ethers.getContractFactory("SimpleContract");
    simpleContract = await SimpleContractFactory.deploy("Hello, Blockchain!");
    await simpleContract.waitForDeployment();
  });

  it("Should return the initial message", async function () {
    expect(await simpleContract.getMessage()).to.equal("Hello, Blockchain!");
  });

  it("Should update the message", async function () {
    const tx = await simpleContract.setMessage("Hello, Solidity!");
    await tx.wait();
    expect(await simpleContract.getMessage()).to.equal("Hello, Solidity!");
  });

  it("Should have the correct deployer address", async function () {
    expect(await simpleContract.owner).to.be.undefined; // Нет метода owner
    expect(await simpleContract.getMessage()).to.equal("Hello, Blockchain!");
  });
});

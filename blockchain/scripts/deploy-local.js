const hre = require("hardhat");

async function main() {
  console.log("Starting deployment...");

  // Get signers
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy LinkToken
  const LinkToken = await ethers.getContractFactory("LinkToken");
  const linkToken = await LinkToken.deploy();
  await linkToken.waitForDeployment();
  console.log("LinkToken deployed to:", await linkToken.getAddress());

  // Deploy MockOracle
  const MockOracle = await ethers.getContractFactory("MockOracle");
  const mockOracle = await MockOracle.deploy(await linkToken.getAddress());
  await mockOracle.waitForDeployment();
  console.log("MockOracle deployed to:", await mockOracle.getAddress());

  // Constants for Inheritance contract
  const MOCK_JOB_ID = ethers.zeroPadValue("0x29fa9aa13bf1468788b7cc4a500a45b8", 32);
  const INACTIVITY_THRESHOLD = 30 * 24 * 60 * 60; // 30 days in seconds
  const RECOVERY_ADDRESS = deployer.address; // Using deployer as recovery address for simplicity

  // Deploy Inheritance contract
  const Inheritance = await ethers.getContractFactory("Inheritance");
  const inheritance = await Inheritance.deploy(
    await linkToken.getAddress(),
    await mockOracle.getAddress(),
    MOCK_JOB_ID,
    INACTIVITY_THRESHOLD,
    RECOVERY_ADDRESS
  );
  await inheritance.waitForDeployment();
  console.log("Inheritance deployed to:", await inheritance.getAddress());

  // Print deployment summary
  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log("LinkToken:", await linkToken.getAddress());
  console.log("MockOracle:", await mockOracle.getAddress());
  console.log("Inheritance:", await inheritance.getAddress());
  console.log("Recovery Address:", RECOVERY_ADDRESS);
  console.log("Inactivity Threshold:", INACTIVITY_THRESHOLD, "seconds");
}

// Handle errors
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
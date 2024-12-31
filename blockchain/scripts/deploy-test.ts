import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await deployer.provider!.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

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

  // Replace 'YourContractName' with the actual contract name
  const ContractFactory = await ethers.getContractFactory("Inheritance");
  
  // Deploy the contract (add constructor arguments if required)
  const contract = await ContractFactory.deploy(
    await linkToken.getAddress(),
    await mockOracle.getAddress(),
    MOCK_JOB_ID,
    INACTIVITY_THRESHOLD,
    RECOVERY_ADDRESS
  ); // Example constructor argument

  console.log("Transaction sent. Waiting for deployment...");

  // Wait for the deployment transaction to be mined
  const receipt = await contract.deploymentTransaction()?.wait();
  console.log("Contract deployed at:", await contract.getAddress());
  console.log("Deployment transaction hash:", receipt?.hash); // Correct property for transaction hash
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
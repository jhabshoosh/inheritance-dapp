import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);

  // Deploy Factory
  const InheritanceFactory = await ethers.getContractFactory("InheritanceFactory");
  const factory = await InheritanceFactory.deploy();
  await factory.waitForDeployment();
  
  console.log("Factory deployed to:", await factory.getAddress());

  // Constants
  const INACTIVITY_THRESHOLD = 30 * 24 * 60 * 60; // 30 days in seconds
  const RECOVERY_ADDRESS = deployer.address; // Using deployer as recovery address for testing

  // Deploy full system using factory
  const tx = await factory.deployFullSystem(
    RECOVERY_ADDRESS,
    INACTIVITY_THRESHOLD
  );

  // Wait for deployment and get event
  const receipt = await tx.wait();
  const deploymentEvent = receipt?.logs.find(
    log => log.topics[0] === factory.interface.getEventTopic('DeploymentCompleted')
  );

  if (deploymentEvent) {
    const { coordinator, assetManager, beneficiaryManager, emergencyHandler, automation } = 
      factory.interface.parseLog({
        topics: deploymentEvent.topics,
        data: deploymentEvent.data
      })?.args;

    console.log("System deployed successfully:");
    console.log("Coordinator:", coordinator);
    console.log("Asset Manager:", assetManager);
    console.log("Beneficiary Manager:", beneficiaryManager);
    console.log("Emergency Handler:", emergencyHandler);
    console.log("Automation:", automation);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
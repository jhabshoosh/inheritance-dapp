const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Inheritance System", function () {
  let owner;
  let addr1;
  let addr2;
  let addr3;
  let recoveryAddress;

  let factory;
  let coordinator;
  let assetManager;
  let beneficiaryManager;
  let emergencyHandler;
  let automation;

  const INACTIVITY_THRESHOLD = 30 * 24 * 60 * 60; // 30 days in seconds

  beforeEach(async function () {
    [owner, addr1, addr2, addr3, recoveryAddress] = await ethers.getSigners();

    // Deploy factory
    const InheritanceFactory = await ethers.getContractFactory("InheritanceFactory");
    factory = await InheritanceFactory.deploy();
    await factory.waitForDeployment();

    // Deploy full system
    const tx = await factory.connect(owner).deployFullSystem(
      recoveryAddress.address,
      INACTIVITY_THRESHOLD
    );
    const receipt = await tx.wait();

    // Get deployed contract addresses from event
    const deploymentEvent = receipt?.logs.find(
      log => log.fragment?.name === 'DeploymentCompleted'
    );

    if (!deploymentEvent) throw new Error("Deployment event not found");

    const { coordinator: coordinatorAddr, 
           assetManager: assetManagerAddr,
           beneficiaryManager: beneficiaryManagerAddr,
           emergencyHandler: emergencyHandlerAddr,
           automation: automationAddr } = deploymentEvent.args;

    // Get contract instances
    coordinator = await ethers.getContractAt("InheritanceCoordinator", coordinatorAddr);
    assetManager = await ethers.getContractAt("AssetManager", assetManagerAddr);
    beneficiaryManager = await ethers.getContractAt("BeneficiaryManager", beneficiaryManagerAddr);
    emergencyHandler = await ethers.getContractAt("EmergencyHandler", emergencyHandlerAddr);
    automation = await ethers.getContractAt("InheritanceAutomation", automationAddr);
  });

  describe("Basic Functionality", function () {
    it("Should allow adding beneficiaries", async function () {
      await beneficiaryManager.connect(addr1).addBeneficiary(addr2.address, 60);
      await beneficiaryManager.connect(addr1).addBeneficiary(addr3.address, 40);

      const totalShares = await beneficiaryManager.getTotalShares(addr1.address);
      expect(Number(totalShares)).to.equal(100);
    });

    it("Should prevent total shares exceeding 100%", async function () {
      await beneficiaryManager.connect(addr1).addBeneficiary(addr2.address, 60);
      await expect(
        beneficiaryManager.connect(addr1).addBeneficiary(addr3.address, 50)
      ).to.be.revertedWith("Total shares cannot exceed 100%");
    });

    it("Should allow adding digital assets with beneficiaries", async function () {
      // First add a beneficiary
      await beneficiaryManager.connect(addr1).addBeneficiary(addr2.address, 50);

      const encryptedData = "encrypted_data_hash";
      const assetType = "passwords";
      await assetManager.connect(addr1).addDigitalAsset(
        encryptedData,
        assetType,
        [addr2.address]
      );

      const assetCount = await assetManager.getAssetCount(addr1.address);
      expect(Number(assetCount)).to.equal(1);
    });
  });

  describe("Emergency Functionality", function () {
    it("Should allow recovery address to activate emergency mode", async function () {
      await emergencyHandler.connect(recoveryAddress).initiateEmergencyMode();
      expect(await emergencyHandler.emergencyMode()).to.be.true;
    });

    it("Should prevent operations during emergency mode", async function () {
      const tx = await emergencyHandler.connect(recoveryAddress).initiateEmergencyMode();
      await tx.wait(); // Wait for the emergency mode to be activated
      
      await expect(
        beneficiaryManager.connect(addr1).addBeneficiary(addr2.address, 50)
      ).to.be.revertedWith("Emergency mode active");
    });

    it("Should allow deactivating emergency mode", async function () {
      await emergencyHandler.connect(recoveryAddress).initiateEmergencyMode();
      await emergencyHandler.connect(recoveryAddress).deactivateEmergencyMode();
      expect(await emergencyHandler.emergencyMode()).to.be.false;
    });
  });

  describe("Rate Limiting", function () {
    it("Should enforce beneficiary change rate limits", async function () {
      // Add maximum allowed beneficiaries for the period
      for (let i = 0; i < 3; i++) {
        const beneficiary = ethers.Wallet.createRandom().address;
        await beneficiaryManager.connect(addr1).addBeneficiary(beneficiary, 20);
      }

      // Try to add one more - should fail
      const extraBeneficiary = ethers.Wallet.createRandom().address;
      await expect(
        beneficiaryManager.connect(addr1).addBeneficiary(extraBeneficiary, 20)
      ).to.be.revertedWith("Beneficiary rate limit exceeded");
    });
  });

  describe("Access Control", function () {
    it("Should maintain proper ownership hierarchy", async function () {
      const coordinatorAddr = await coordinator.getAddress();
      expect(await assetManager.owner()).to.equal(coordinatorAddr);
      expect(await beneficiaryManager.owner()).to.equal(coordinatorAddr);
      expect(await emergencyHandler.owner()).to.equal(coordinatorAddr);
    });

    it("Should allow coordinator to pause the system", async function () {
      await coordinator.connect(owner).pause();
      expect(await coordinator.paused()).to.be.true;
    });
  });
});
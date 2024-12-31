const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Inheritance Contract", function () {
    let Inheritance;
    let inheritance;
    let owner;
    let addr1;
    let addr2;
    let addr3;
    let recoveryAddress;
    let mockLink;
    let mockOracle;
    
    const INACTIVITY_THRESHOLD = 30 * 24 * 60 * 60; // 30 days in seconds
    const MOCK_JOB_ID = ethers.zeroPadValue("0x29fa9aa13bf1468788b7cc4a500a45b8", 32);

    beforeEach(async function () {
        // Get signers
        [owner, addr1, addr2, addr3, recoveryAddress] = await ethers.getSigners();

        // Deploy mock LINK token
        const LinkToken = await ethers.getContractFactory("LinkToken");
        mockLink = await LinkToken.deploy();
        await mockLink.waitForDeployment();

        // Deploy mock Oracle
        const MockOracle = await ethers.getContractFactory("MockOracle");
        mockOracle = await MockOracle.deploy(await mockLink.getAddress());
        await mockOracle.waitForDeployment();

        // Deploy Inheritance contract
        Inheritance = await ethers.getContractFactory("Inheritance");
        inheritance = await Inheritance.deploy(
            await mockLink.getAddress(),
            await mockOracle.getAddress(),
            MOCK_JOB_ID,
            INACTIVITY_THRESHOLD,
            recoveryAddress.address
        );
        await inheritance.waitForDeployment();
    });

    describe("Basic Functionality", function () {
        it("Should allow deposits", async function () {
            const depositAmount = ethers.parseEther("1.0");
            await inheritance.connect(addr1).deposit({ value: depositAmount });

            const balance = await inheritance.userBalances(addr1.address);
            expect(balance).to.equal(depositAmount);
        });

        it("Should allow adding beneficiaries", async function () {
            await inheritance.connect(addr1).addBeneficiary(addr2.address, 60);
            await inheritance.connect(addr1).addBeneficiary(addr3.address, 40);

            const totalShares = await inheritance.getTotalShares(addr1.address);
            expect(totalShares).to.equal(100);
        });

        it("Should prevent total shares exceeding 100%", async function () {
            await inheritance.connect(addr1).addBeneficiary(addr2.address, 60);
            await expect(
                inheritance.connect(addr1).addBeneficiary(addr3.address, 50)
            ).to.be.revertedWith("Total shares cannot exceed 100%");
        });

        it("Should allow adding digital assets with beneficiaries", async function () {
            // First add a beneficiary
            await inheritance.connect(addr1).addBeneficiary(addr2.address, 50);

            // Then add an asset assigned to that beneficiary
            const encryptedData = "encrypted_data_hash";
            const assetType = "passwords";
            await inheritance.connect(addr1).addDigitalAsset(
                encryptedData,
                assetType,
                [addr2.address]
            );

            // Verify the asset was added
            const [encData, type, isActive] = await inheritance.userAssets(addr1.address, 0);
            expect(encData).to.equal(encryptedData);
            expect(type).to.equal(assetType);
            expect(isActive).to.be.true;
        });

        it("Should allow modifying assets", async function () {
            // Add beneficiary and initial asset
            await inheritance.connect(addr1).addBeneficiary(addr2.address, 50);
            await inheritance.connect(addr1).addDigitalAsset(
                "old_data",
                "old_type",
                [addr2.address]
            );

            // Modify the asset
            const newData = "new_data";
            const newType = "new_type";
            await inheritance.connect(addr1).modifyAsset(
                0,
                newData,
                newType,
                [addr2.address]
            );

            // Verify modifications
            const [encData, type] = await inheritance.userAssets(addr1.address, 0);
            expect(encData).to.equal(newData);
            expect(type).to.equal(newType);
        });

        it("Should allow removing assets", async function () {
            // Add beneficiary and asset
            await inheritance.connect(addr1).addBeneficiary(addr2.address, 50);
            await inheritance.connect(addr1).addDigitalAsset(
                "data",
                "type",
                [addr2.address]
            );

            // Remove the asset
            await inheritance.connect(addr1).removeAsset(0);

            // Verify asset is inactive
            const [, , isActive] = await inheritance.userAssets(addr1.address, 0);
            expect(isActive).to.be.false;
        });
    });

    describe("Inheritance Triggering", function () {
        beforeEach(async function () {
            // Setup: Add beneficiaries and assets
            await inheritance.connect(addr1).addBeneficiary(addr2.address, 60);
            await inheritance.connect(addr1).addBeneficiary(addr3.address, 40);
            
            await inheritance.connect(addr1).deposit({ value: ethers.parseEther("2.0") });
            
            await inheritance.connect(addr1).addDigitalAsset(
                "secret_data",
                "passwords",
                [addr2.address, addr3.address]
            );
        });

        it("Should trigger inheritance after inactivity threshold", async function () {
            // Fast forward time beyond inactivity threshold
            await time.increase(INACTIVITY_THRESHOLD + 1);

            // Check upkeep should return true
            const [upkeepNeeded, performData] = await inheritance.checkUpkeep("0x");
            expect(upkeepNeeded).to.be.true;

            // Perform upkeep
            const tx = await inheritance.performUpkeep(performData);
            await expect(tx).to.emit(inheritance, "InheritanceTriggered")
                .withArgs(addr1.address);

            // Verify inheritance was triggered
            const inheritanceTriggered = await inheritance.inheritanceTriggered(addr1.address);
            expect(inheritanceTriggered).to.be.true;
        });

        it("Should distribute ETH correctly to beneficiaries", async function () {
            await time.increase(INACTIVITY_THRESHOLD + 1);

            // Get initial balances
            const initialBalance2 = await ethers.provider.getBalance(addr2.address);
            const initialBalance3 = await ethers.provider.getBalance(addr3.address);

            // Trigger inheritance
            const [, performData] = await inheritance.checkUpkeep("0x");
            await inheritance.performUpkeep(performData);

            // Calculate expected distributions (2 ETH total)
            const expected2 = ethers.parseEther("1.2"); // 60%
            const expected3 = ethers.parseEther("0.8"); // 40%

            // Get final balances
            const finalBalance2 = await ethers.provider.getBalance(addr2.address);
            const finalBalance3 = await ethers.provider.getBalance(addr3.address);

            // Verify correct distribution
            expect(finalBalance2 - initialBalance2).to.equal(expected2);
            expect(finalBalance3 - initialBalance3).to.equal(expected3);
        });
    });

    describe("Security Features", function () {
        describe("Emergency Mode", function () {
            it("Should allow recovery address to activate emergency mode", async function () {
                await inheritance.connect(recoveryAddress).initiateEmergencyMode();
                expect(await inheritance.emergencyMode()).to.be.true;
            });

            it("Should allow owner to activate emergency mode", async function () {
                await inheritance.connect(owner).initiateEmergencyMode();
                expect(await inheritance.emergencyMode()).to.be.true;
            });

            it("Should prevent non-authorized addresses from activating emergency mode", async function () {
                await expect(
                    inheritance.connect(addr1).initiateEmergencyMode()
                ).to.be.revertedWith("Not authorized");
            });

            it("Should allow emergency withdrawals after delay", async function () {
                // Setup: Add funds and activate emergency mode
                await inheritance.connect(addr1).deposit({ value: ethers.parseEther("1.0") });
                await inheritance.connect(recoveryAddress).initiateEmergencyMode();
                
                // Move time forward past emergency delay
                await time.increase(3 * 24 * 60 * 60 + 1); // 3 days + 1 second
                
                // Withdraw funds
                const balanceBefore = await ethers.provider.getBalance(addr1.address);
                await inheritance.connect(addr1).emergencyWithdraw();
                const balanceAfter = await ethers.provider.getBalance(addr1.address);
                
                // Check balance increased (approximately, accounting for gas)
                expect(balanceAfter).to.be.gt(balanceBefore);
            });

            it("Should prevent emergency withdrawals before delay period", async function () {
                await inheritance.connect(addr1).deposit({ value: ethers.parseEther("1.0") });
                await inheritance.connect(recoveryAddress).initiateEmergencyMode();
                
                await expect(
                    inheritance.connect(addr1).emergencyWithdraw()
                ).to.be.revertedWith("Emergency delay not met");
            });
        });

        describe("Rate Limiting", function () {
            it("Should enforce beneficiary change rate limits", async function () {
                // Add maximum allowed beneficiaries for the period
                for (let i = 0; i < 3; i++) {
                    const beneficiary = ethers.Wallet.createRandom().address;
                    await inheritance.connect(addr1).addBeneficiary(beneficiary, 20);
                }

                // Try to add one more - should fail
                const extraBeneficiary = ethers.Wallet.createRandom().address;
                await expect(
                    inheritance.connect(addr1).addBeneficiary(extraBeneficiary, 20)
                ).to.be.revertedWith("Beneficiary rate limit exceeded");
            });

            it("Should reset rate limits after period expires", async function () {
                // Add maximum beneficiaries
                for (let i = 0; i < 3; i++) {
                    const beneficiary = ethers.Wallet.createRandom().address;
                    await inheritance.connect(addr1).addBeneficiary(beneficiary, 20);
                }

                // Move time forward past rate limit period
                await time.increase(24 * 60 * 60 + 1); // 1 day + 1 second

                // Should allow adding more beneficiaries
                const newBeneficiary = ethers.Wallet.createRandom().address;
                await expect(
                    inheritance.connect(addr1).addBeneficiary(newBeneficiary, 20)
                ).to.not.be.reverted;
            });

            it("Should enforce asset change rate limits", async function () {
                // First add a beneficiary to satisfy the requirement
                await inheritance.connect(addr1).addBeneficiary(addr2.address, 50);

                // Add maximum allowed assets for the period
                for (let i = 0; i < 5; i++) {
                    await inheritance.connect(addr1).addDigitalAsset(
                        `data${i}`,
                        `type${i}`,
                        [addr2.address]
                    );
                }

                // Try to add one more - should fail
                await expect(
                    inheritance.connect(addr1).addDigitalAsset(
                        "extraData",
                        "extraType",
                        [addr2.address]
                    )
                ).to.be.revertedWith("Asset rate limit exceeded");
            });
        });

        describe("Recovery Address Management", function () {
            it("Should allow owner to change recovery address", async function () {
                const newRecoveryAddr = await ethers.Wallet.createRandom().address;
                await inheritance.connect(owner).setRecoveryAddress(newRecoveryAddr);
                expect(await inheritance.recoveryAddress()).to.equal(newRecoveryAddr);
            });

            it("Should prevent non-owners from changing recovery address", async function () {
                const newRecoveryAddr = await ethers.Wallet.createRandom().address;
                await expect(
                    inheritance.connect(addr1).setRecoveryAddress(newRecoveryAddr)
                ).to.be.revertedWithCustomError(inheritance, "OwnableUnauthorizedAccount");
            });

            it("Should prevent setting zero address as recovery address", async function () {
                await expect(
                    inheritance.connect(owner).setRecoveryAddress(ethers.ZeroAddress)
                ).to.be.revertedWith("Invalid address");
            });
        });
    });
});
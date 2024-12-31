const { time } = require("@nomicfoundation/hardhat-network-helpers");

async function main() {
    console.log("Starting inheritance trigger simulation...");

    // Get signers
    const [owner, user1, beneficiary1, beneficiary2] = await ethers.getSigners();
    
    // Get the deployed contract address (replace with your deployed address)
    const INHERITANCE_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
    
    // Get contract instance
    const inheritance = await ethers.getContractAt("Inheritance", INHERITANCE_ADDRESS);
    
    try {
        // 1. Initial setup - deposit and add beneficiaries
        console.log("\nSetting up initial state...");
        const depositAmount = ethers.parseEther("2.0");
        await inheritance.connect(user1).deposit({ value: depositAmount });
        console.log(`Deposited ${ethers.formatEther(depositAmount)} ETH`);

        await inheritance.connect(user1).addBeneficiary(beneficiary1.address, 60);
        await inheritance.connect(user1).addBeneficiary(beneficiary2.address, 40);
        console.log("Added beneficiaries (60/40 split)");

        // Add a digital asset
        await inheritance.connect(user1).addDigitalAsset(
            "encrypted_credentials_xyz",
            "crypto_wallet",
            [beneficiary1.address, beneficiary2.address]
        );
        console.log("Added digital asset");

        // 2. Record initial balances
        const initialBalance1 = await ethers.provider.getBalance(beneficiary1.address);
        const initialBalance2 = await ethers.provider.getBalance(beneficiary2.address);
        console.log("\nInitial balances:");
        console.log(`Beneficiary 1: ${ethers.formatEther(initialBalance1)} ETH`);
        console.log(`Beneficiary 2: ${ethers.formatEther(initialBalance2)} ETH`);

        // 3. Fast forward time past the inactivity threshold
        console.log("\nAdvancing time...");
        const INACTIVITY_THRESHOLD = 30 * 24 * 60 * 60; // 30 days
        await time.increase(INACTIVITY_THRESHOLD + 1);
        console.log("Time advanced past inactivity threshold");

        // 4. Check if upkeep is needed
        console.log("\nChecking upkeep...");
        const [upkeepNeeded, performData] = await inheritance.checkUpkeep("0x");
        console.log(`Upkeep needed: ${upkeepNeeded}`);

        if (upkeepNeeded) {
            // 5. Perform upkeep to trigger inheritance
            console.log("\nPerforming upkeep to trigger inheritance...");
            const triggerTx = await inheritance.performUpkeep(performData);
            await triggerTx.wait();
            console.log("Inheritance triggered");

            // 6. Verify inheritance was triggered
            const isTriggered = await inheritance.inheritanceTriggered(user1.address);
            console.log(`Inheritance triggered status: ${isTriggered}`);

            // 7. Check final balances
            const finalBalance1 = await ethers.provider.getBalance(beneficiary1.address);
            const finalBalance2 = await ethers.provider.getBalance(beneficiary2.address);
            
            console.log("\nFinal balances and changes:");
            console.log(`Beneficiary 1: ${ethers.formatEther(finalBalance1)} ETH`);
            console.log(`Change: ${ethers.formatEther(finalBalance1 - initialBalance1)} ETH`);
            console.log(`Beneficiary 2: ${ethers.formatEther(finalBalance2)} ETH`);
            console.log(`Change: ${ethers.formatEther(finalBalance2 - initialBalance2)} ETH`);

            // 8. Verify user is no longer active
            const isActive = await inheritance.isActiveUser(user1.address);
            console.log(`\nUser still active: ${isActive}`);
        } else {
            console.log("Inheritance conditions not met!");
        }

    } catch (error) {
        console.error("\nError during simulation:", error);
        throw error;
    }

    console.log("\nInheritance simulation completed!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
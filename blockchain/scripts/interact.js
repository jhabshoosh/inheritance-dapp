const hre = require("hardhat");

async function main() {
    console.log("Starting interaction script...");

    // Get signers
    const [owner, user1, beneficiary1, beneficiary2] = await ethers.getSigners();
    
    // Get the deployed contract addresses (replace with your deployed addresses)
    const INHERITANCE_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
    const LINK_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    
    // Get contract instances
    const inheritance = await ethers.getContractAt("Inheritance", INHERITANCE_ADDRESS);
    const linkToken = await ethers.getContractAt("LinkToken", LINK_ADDRESS);
    
    console.log("\nSetting up test scenario...");
    
    try {
        // 1. Deposit some ETH
        const depositAmount = ethers.parseEther("1.0");
        console.log(`\nDepositing ${ethers.formatEther(depositAmount)} ETH from user1...`);
        const depositTx = await inheritance.connect(user1).deposit({ value: depositAmount });
        await depositTx.wait();
        
        const balance = await inheritance.userBalances(user1.address);
        console.log(`User1 balance: ${ethers.formatEther(balance)} ETH`);

        // 2. Add beneficiaries
        console.log("\nAdding beneficiaries...");
        await inheritance.connect(user1).addBeneficiary(
            beneficiary1.address,
            60  // 60% share
        );
        await inheritance.connect(user1).addBeneficiary(
            beneficiary2.address,
            40  // 40% share
        );
        
        const totalShares = await inheritance.getTotalShares(user1.address);
        console.log(`Total shares allocated: ${totalShares}%`);

        // 3. Add a digital asset
        console.log("\nAdding a digital asset...");
        await inheritance.connect(user1).addDigitalAsset(
            "encrypted_data_hash_123",
            "passwords",
            [beneficiary1.address, beneficiary2.address]
        );

        // 4. Verify user is active
        const isActive = await inheritance.isActiveUser(user1.address);
        console.log(`\nUser1 active status: ${isActive}`);

        // 5. Check last activity time
        const lastActivity = await inheritance.lastActivityTime(user1.address);
        console.log(`Last activity time: ${new Date(Number(lastActivity) * 1000)}`);

        // 6. Get all active users
        const activeUsers = await inheritance.getActiveUsers();
        console.log(`\nActive users: ${activeUsers.length}`);
        console.log(activeUsers);

    } catch (error) {
        console.error("\nError during interaction:", error);
        throw error;
    }

    console.log("\nInteraction script completed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
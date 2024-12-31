// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Inheritance is ChainlinkClient, AutomationCompatibleInterface, Pausable, ReentrancyGuard, Ownable {
    // Emergency and security state variables
    uint256 public constant EMERGENCY_DELAY = 3 days;
    uint256 public constant RATE_LIMIT_PERIOD = 1 days;
    uint256 public constant MAX_BENEFICIARY_CHANGES = 3;
    uint256 public constant MAX_ASSET_CHANGES = 5;
    uint256 public emergencyModeActivationTime;

    // mapping(address => uint256) public lastEmergencyActionTime;
    mapping(address => uint256) public beneficiaryChangeCount;
    mapping(address => uint256) public assetChangeCount;
    mapping(address => uint256) public lastRateLimitReset;
    
    // Emergency recovery address
    address public recoveryAddress;
    bool public emergencyMode;
    
    event EmergencyModeActivated(address indexed user, uint256 timestamp);
    event EmergencyModeDeactivated(address indexed user, uint256 timestamp);
    event RecoveryAddressChanged(address indexed oldAddress, address indexed newAddress);
    event EmergencyWithdrawal(address indexed user, uint256 amount);
    event RateLimitExceeded(address indexed user, string action);

    modifier onlyRecoveryOrOwner() {
        require(msg.sender == recoveryAddress || msg.sender == owner(), "Not authorized");
        _;
    }
    
    modifier withRateLimit(string memory action) {
        // Reset rate limit counters if we're in a new period
        if (block.timestamp >= lastRateLimitReset[msg.sender] + RATE_LIMIT_PERIOD) {
            beneficiaryChangeCount[msg.sender] = 0;
            assetChangeCount[msg.sender] = 0;
            lastRateLimitReset[msg.sender] = block.timestamp;
        }
        
        // Check specific limits based on action
        if (keccak256(bytes(action)) == keccak256(bytes("beneficiary"))) {
            require(beneficiaryChangeCount[msg.sender] < MAX_BENEFICIARY_CHANGES, "Beneficiary rate limit exceeded");
            beneficiaryChangeCount[msg.sender]++;
        } else if (keccak256(bytes(action)) == keccak256(bytes("asset"))) {
            require(assetChangeCount[msg.sender] < MAX_ASSET_CHANGES, "Asset rate limit exceeded");
            assetChangeCount[msg.sender]++;
        }
        _;
    }
    
    modifier notInEmergencyMode() {
        require(!emergencyMode, "Contract is in emergency mode");
        _;
    }
    
    struct DigitalAsset {
        string encryptedData;
        string assetType;
        bool isActive;
        address[] assignedBeneficiaries;
    }
    
    struct Beneficiary {
        address walletAddress;
        uint256 sharePercent;
        bool isActive;
    }
    
    // State variables
    mapping(address => DigitalAsset[]) public userAssets;
    mapping(address => Beneficiary[]) public userBeneficiaries;
    mapping(address => uint256) public lastActivityTime;
    mapping(address => uint256) public userBalances;
    mapping(address => bool) public isActiveUser;
    mapping(uint256 => address) public registeredUsers;
    mapping(address => bool) public inheritanceTriggered;
    uint256 public userCount;

    // Chainlink variables
    uint256 public immutable INACTIVITY_THRESHOLD;
    bytes32 private jobId;
    uint256 private fee;
    
    
    // Events
    event AssetAdded(address indexed user, string assetType, address[] beneficiaries);
    event AssetModified(address indexed user, uint256 assetIndex, string assetType, address[] beneficiaries);
    event AssetRemoved(address indexed user, uint256 assetIndex);
    event BeneficiaryAdded(address indexed user, address beneficiary, uint256 sharePercent);
    event BeneficiaryModified(address indexed user, uint256 beneficiaryIndex, uint256 newSharePercent);
    event BeneficiaryRemoved(address indexed user, uint256 beneficiaryIndex);
    event InheritanceTriggered(address indexed user);
    event ActivityChecked(address indexed user, bool isActive);
    event AssetDistributed(address indexed user, address indexed beneficiary, string encryptedData, string assetType);
    event Deposit(address indexed user, uint256 amount);
    
    constructor(
        address _link,
        address _oracle,
        bytes32 _jobId,
        uint256 _inactivityThreshold,
        address _recoveryAddress
    ) Ownable(msg.sender) {
        require(_recoveryAddress != address(0), "Invalid recovery address");
        _setChainlinkToken(_link);
        _setChainlinkOracle(_oracle);
        jobId = _jobId;
        fee = (1 * LINK_DIVISIBILITY) / 10; // 0.1 LINK
        INACTIVITY_THRESHOLD = _inactivityThreshold;
        recoveryAddress = _recoveryAddress;
    }

    function deposit() public payable {
        require(msg.value > 0, "Must send ETH");
        userBalances[msg.sender] += msg.value;
        if (!isActiveUser[msg.sender]) {
            isActiveUser[msg.sender] = true;
            registeredUsers[userCount] = msg.sender;
            userCount++;
        }
        lastActivityTime[msg.sender] = block.timestamp;
        emit Deposit(msg.sender, msg.value);
    }

    receive() external payable {
        deposit();
    }
    
    // Update addDigitalAsset to track users
    function addDigitalAsset(
        string memory _encryptedData, 
        string memory _assetType,
        address[] memory _beneficiaries
    ) public whenNotPaused withRateLimit("asset") {
        require(_beneficiaries.length > 0, "Must assign at least one beneficiary");
        for (uint i = 0; i < _beneficiaries.length; i++) {
            require(isBeneficiary(msg.sender, _beneficiaries[i]), "Invalid beneficiary");
        }
        
        userAssets[msg.sender].push(DigitalAsset({
            encryptedData: _encryptedData,
            assetType: _assetType,
            isActive: true,
            assignedBeneficiaries: _beneficiaries
        }));
        
        if (!isActiveUser[msg.sender]) {
            isActiveUser[msg.sender] = true;
            registeredUsers[userCount] = msg.sender;
            userCount++;
        }
        lastActivityTime[msg.sender] = block.timestamp;
        emit AssetAdded(msg.sender, _assetType, _beneficiaries);
    }
    
    function modifyAsset(
        uint256 _assetIndex,
        string memory _newEncryptedData,
        string memory _newAssetType,
        address[] memory _newBeneficiaries
    ) public whenNotPaused withRateLimit("asset") {
        require(_assetIndex < userAssets[msg.sender].length, "Invalid asset index");
        require(_newBeneficiaries.length > 0, "Must assign at least one beneficiary");
        
        for (uint i = 0; i < _newBeneficiaries.length; i++) {
            require(isBeneficiary(msg.sender, _newBeneficiaries[i]), "Invalid beneficiary");
        }
        
        DigitalAsset storage asset = userAssets[msg.sender][_assetIndex];
        require(asset.isActive, "Asset already removed");
        
        asset.encryptedData = _newEncryptedData;
        asset.assetType = _newAssetType;
        asset.assignedBeneficiaries = _newBeneficiaries;
        
        lastActivityTime[msg.sender] = block.timestamp;
        emit AssetModified(msg.sender, _assetIndex, _newAssetType, _newBeneficiaries);
    }
    
    function removeAsset(uint256 _assetIndex) public whenNotPaused withRateLimit("asset") {
        require(_assetIndex < userAssets[msg.sender].length, "Invalid asset index");
        require(userAssets[msg.sender][_assetIndex].isActive, "Asset already removed");
        
        userAssets[msg.sender][_assetIndex].isActive = false;
        lastActivityTime[msg.sender] = block.timestamp;
        emit AssetRemoved(msg.sender, _assetIndex);
    }

    // Update addBeneficiary to track users
    function addBeneficiary(address _beneficiary, uint256 _sharePercent) public whenNotPaused withRateLimit("beneficiary") {
        require(_sharePercent <= 100, "Share percentage cannot exceed 100");
        require(_beneficiary != address(0), "Invalid beneficiary address");
        require(_beneficiary != msg.sender, "Cannot add self as beneficiary");
        
        uint256 totalShares = getTotalShares(msg.sender) + _sharePercent;
        require(totalShares <= 100, "Total shares cannot exceed 100%");
        
        userBeneficiaries[msg.sender].push(Beneficiary({
            walletAddress: _beneficiary,
            sharePercent: _sharePercent,
            isActive: true
        }));
        
        if (!isActiveUser[msg.sender]) {
            isActiveUser[msg.sender] = true;
            registeredUsers[userCount] = msg.sender;
            userCount++;
        }
        lastActivityTime[msg.sender] = block.timestamp;
        emit BeneficiaryAdded(msg.sender, _beneficiary, _sharePercent);
    }
    
    function modifyBeneficiary(uint256 _index, uint256 _newSharePercent) public whenNotPaused withRateLimit("beneficiary") {
        require(_index < userBeneficiaries[msg.sender].length, "Invalid beneficiary index");
        require(_newSharePercent <= 100, "Share percentage cannot exceed 100");
        
        Beneficiary storage beneficiary = userBeneficiaries[msg.sender][_index];
        require(beneficiary.isActive, "Beneficiary already removed");
        
        uint256 totalShares = getTotalShares(msg.sender) - beneficiary.sharePercent + _newSharePercent;
        require(totalShares <= 100, "Total shares cannot exceed 100%");
        
        beneficiary.sharePercent = _newSharePercent;
        lastActivityTime[msg.sender] = block.timestamp;
        emit BeneficiaryModified(msg.sender, _index, _newSharePercent);
    }
    
    function removeBeneficiary(uint256 _index) public whenNotPaused withRateLimit("beneficiary") {
        require(_index < userBeneficiaries[msg.sender].length, "Invalid beneficiary index");
        require(userBeneficiaries[msg.sender][_index].isActive, "Beneficiary already removed");
        
        userBeneficiaries[msg.sender][_index].isActive = false;
        lastActivityTime[msg.sender] = block.timestamp;
        emit BeneficiaryRemoved(msg.sender, _index);
    }
    
    function getTotalShares(address _user) public view returns (uint256) {
        uint256 total = 0;
        for (uint i = 0; i < userBeneficiaries[_user].length; i++) {
            if (userBeneficiaries[_user][i].isActive) {
                total += userBeneficiaries[_user][i].sharePercent;
            }
        }
        return total;
    }
    
    function isBeneficiary(address _user, address _beneficiary) public view returns (bool) {
        for (uint i = 0; i < userBeneficiaries[_user].length; i++) {
            if (userBeneficiaries[_user][i].isActive && 
                userBeneficiaries[_user][i].walletAddress == _beneficiary) {
                return true;
            }
        }
        return false;
    }
    
    // Chainlink Automation functions
    function checkUpkeep(
        bytes calldata /* checkData */
    ) 
        external 
        view 
        override 
        returns (bool upkeepNeeded, bytes memory performData) 
    {
        if (paused()) {
            return (false, "");
        }
        
        // Check each user individually
        for (uint256 i = 0; i < userCount; i++) {
            address user = registeredUsers[i];
            if (isActiveUser[user] &&
                !inheritanceTriggered[user] &&
                userBeneficiaries[user].length > 0 &&
                userBalances[user] > 0 &&
                block.timestamp - lastActivityTime[user] > INACTIVITY_THRESHOLD) {
                return (true, abi.encode(user));
            }
        }
        
        
        return (false, "");
    }
    
    function performUpkeep(
        bytes calldata performData
    ) 
        external 
        override 
        whenNotPaused
    {
        if (performData.length > 0) {
            address user = abi.decode(performData, (address));
            if (isActiveUser[user] &&
                !inheritanceTriggered[user] &&
                block.timestamp - lastActivityTime[user] > INACTIVITY_THRESHOLD &&
                userBeneficiaries[user].length > 0) {
                _triggerInheritance(user);
            }
        } else {
            address[] memory users = getActiveUsers();
            for (uint i = 0; i < users.length; i++) {
                if (isActiveUser[users[i]] &&
                    !inheritanceTriggered[users[i]] &&
                    block.timestamp - lastActivityTime[users[i]] > INACTIVITY_THRESHOLD &&
                    userBeneficiaries[users[i]].length > 0) {
                    _triggerInheritance(users[i]);
                    break;
                }
            }
        }
    }
    
    function _triggerInheritance(address user) internal nonReentrant {
        require(isActiveUser[user], "User not active");
        require(!inheritanceTriggered[user], "Inheritance already triggered");
        require(block.timestamp - lastActivityTime[user] > INACTIVITY_THRESHOLD, "Inactivity threshold not met");
        require(userBeneficiaries[user].length > 0, "No beneficiaries");

        inheritanceTriggered[user] = true;
        uint256 totalBalance = userBalances[user];
        require(totalBalance > 0, "No balance to distribute");

        // Distribute ETH to beneficiaries
        for (uint i = 0; i < userBeneficiaries[user].length; i++) {
            Beneficiary memory beneficiary = userBeneficiaries[user][i];
            if (beneficiary.isActive && beneficiary.sharePercent > 0) {
                uint256 amount = (totalBalance * beneficiary.sharePercent) / 100;
                userBalances[user] -= amount;
                (bool success, ) = payable(beneficiary.walletAddress).call{value: amount}("");
                require(success, "ETH transfer failed");
            }
        }

        // Distribute digital assets
        for (uint i = 0; i < userAssets[user].length; i++) {
            DigitalAsset memory asset = userAssets[user][i];
            if (asset.isActive) {
                for (uint j = 0; j < asset.assignedBeneficiaries.length; j++) {
                    emit AssetDistributed(
                        user,
                        asset.assignedBeneficiaries[j],
                        asset.encryptedData,
                        asset.assetType
                    );
                }
            }
        }

        isActiveUser[user] = false;
        emit InheritanceTriggered(user);
    }
    
    function getActiveUsers() public view returns (address[] memory) {
        uint256 activeCount = 0;
        
        // First pass: count active users
        for (uint256 i = 0; i < userCount; i++) {
            address user = registeredUsers[i];
            if (isActiveUser[user] && 
                !inheritanceTriggered[user] && 
                userBeneficiaries[user].length > 0 &&
                userBalances[user] > 0) {
                activeCount++;
            }
        }

        // Second pass: populate array
        address[] memory activeUsers = new address[](activeCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < userCount && currentIndex < activeCount; i++) {
            address user = registeredUsers[i];
            if (isActiveUser[user] && 
                !inheritanceTriggered[user] && 
                userBeneficiaries[user].length > 0 &&
                userBalances[user] > 0) {
                activeUsers[currentIndex] = user;
                currentIndex++;
            }
        }

        return activeUsers;
    }
    
    // Admin functions
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }

    function initiateEmergencyMode() external onlyRecoveryOrOwner {
        require(!emergencyMode, "Already in emergency mode");
        emergencyMode = true;
        emergencyModeActivationTime = block.timestamp;  // Track when emergency mode started
        emit EmergencyModeActivated(msg.sender, block.timestamp);
    }

    function deactivateEmergencyMode() external onlyRecoveryOrOwner {
        require(emergencyMode, "Not in emergency mode");
        emergencyMode = false;
        emit EmergencyModeDeactivated(msg.sender, block.timestamp);
    }

    function emergencyWithdraw() external whenNotPaused {
        require(emergencyMode, "Not in emergency mode");
        require(userBalances[msg.sender] > 0, "No balance to withdraw");
        require(
            block.timestamp >= emergencyModeActivationTime + EMERGENCY_DELAY,
            "Emergency delay not met"
        );

        uint256 amount = userBalances[msg.sender];
        userBalances[msg.sender] = 0;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "ETH transfer failed");
        
        emit EmergencyWithdrawal(msg.sender, amount);
    }

    function setRecoveryAddress(address _newRecoveryAddress) external onlyOwner {
        require(_newRecoveryAddress != address(0), "Invalid address");
        address oldAddress = recoveryAddress;
        recoveryAddress = _newRecoveryAddress;
        emit RecoveryAddressChanged(oldAddress, _newRecoveryAddress);
    }

    // Add this view function to help with testing:
    function getUserAssetDetails(address user, uint256 index) external view returns (
        string memory encryptedData,
        string memory assetType,
        bool isActive,
        address[] memory assignedBeneficiaries
    ) {
        DigitalAsset storage asset = userAssets[user][index];
        return (
            asset.encryptedData,
            asset.assetType,
            asset.isActive,
            asset.assignedBeneficiaries
        );
    }
}
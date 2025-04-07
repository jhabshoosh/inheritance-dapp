// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract InheritanceStorage {
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
    
    // Core storage
    mapping(address => DigitalAsset[]) internal userAssets;
    mapping(address => Beneficiary[]) internal userBeneficiaries;
    mapping(address => uint256) internal lastActivityTime;
    mapping(address => uint256) internal userBalances;
    mapping(address => bool) internal isActiveUser;
    mapping(address => bool) internal inheritanceTriggered;
    uint256 internal userCount;
    
    // Emergency state - moved to the top level to ensure consistent storage layout
    bool public emergencyMode;
    uint256 public emergencyModeActivationTime;
    address public recoveryAddress;
    uint256 public constant EMERGENCY_DELAY = 3 days;
    
    // Events
    event AssetAdded(address indexed user, string assetType);
    event BeneficiaryAdded(address indexed user, address beneficiary, uint256 sharePercent);
    event InheritanceTriggered(address indexed user);
    event EmergencyModeActivated(address indexed activator, uint256 timestamp);
    event EmergencyModeDeactivated(address indexed deactivator, uint256 timestamp);
    event EmergencyWithdrawal(address indexed user, uint256 amount);
}
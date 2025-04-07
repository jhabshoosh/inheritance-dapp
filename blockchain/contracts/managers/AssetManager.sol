// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "../handlers/EmergencyHandler.sol";
import "../storage/InheritanceStorage.sol";

contract AssetManager is InheritanceStorage, Ownable, ReentrancyGuard, UUPSUpgradeable {
    uint256 public constant MAX_ASSET_CHANGES = 5;
    mapping(address => uint256) public assetChangeCount;
    EmergencyHandler public emergencyHandler;
    
    constructor() Ownable(msg.sender) {}
    
    function initialize(address _emergencyHandler) external onlyOwner {
        require(_emergencyHandler != address(0), "Invalid emergency handler");
        emergencyHandler = EmergencyHandler(_emergencyHandler);
    }

    modifier notInEmergencyMode() {
        require(!emergencyHandler.emergencyMode(), "Emergency mode active");
        _;
    }
    
    function addDigitalAsset(
        string memory _encryptedData, 
        string memory _assetType,
        address[] memory _beneficiaries
    ) external nonReentrant notInEmergencyMode {
        require(_beneficiaries.length > 0, "Must assign beneficiaries");
        
        userAssets[msg.sender].push(DigitalAsset({
            encryptedData: _encryptedData,
            assetType: _assetType,
            isActive: true,
            assignedBeneficiaries: _beneficiaries
        }));
        
        lastActivityTime[msg.sender] = block.timestamp;
        emit AssetAdded(msg.sender, _assetType);
    }

    function getAssetCount(address user) public view returns (uint256) {
        uint256 count = 0;
        for (uint i = 0; i < userAssets[user].length; i++) {
            if (userAssets[user][i].isActive) {
                count++;
            }
        }
        return count;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
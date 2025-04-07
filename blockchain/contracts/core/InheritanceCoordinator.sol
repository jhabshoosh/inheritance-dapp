// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../managers/AssetManager.sol";
import "../managers/BeneficiaryManager.sol";
import "../handlers/EmergencyHandler.sol";

contract InheritanceCoordinator is Ownable, Pausable {
    AssetManager public assetManager;
    BeneficiaryManager public beneficiaryManager;
    EmergencyHandler public emergencyHandler;
    uint256 public immutable INACTIVITY_THRESHOLD;
    
    constructor(
        address _assetManager,
        address _beneficiaryManager,
        address _emergencyHandler,
        uint256 _inactivityThreshold
    ) Ownable(msg.sender) {
        assetManager = AssetManager(_assetManager);
        beneficiaryManager = BeneficiaryManager(_beneficiaryManager);
        emergencyHandler = EmergencyHandler(_emergencyHandler);
        INACTIVITY_THRESHOLD = _inactivityThreshold;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
}
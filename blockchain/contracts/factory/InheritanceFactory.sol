// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../core/InheritanceCoordinator.sol";
import "../automation/InheritanceAutomation.sol";
import "../managers/BeneficiaryManager.sol";

contract InheritanceFactory is Ownable {
    event DeploymentCompleted(
        address coordinator,
        address assetManager,
        address beneficiaryManager,
        address emergencyHandler,
        address automation
    );
    
    constructor() Ownable(msg.sender) {}
    
    function deployFullSystem(
        address recoveryAddress,
        uint256 inactivityThreshold
    ) external returns (address) {
        // Deploy all contracts
        AssetManager assetManager = new AssetManager();
        BeneficiaryManager beneficiaryManager = new BeneficiaryManager();
        EmergencyHandler emergencyHandler = new EmergencyHandler(recoveryAddress);
        
        // Initialize managers with EmergencyHandler
        beneficiaryManager.initialize(address(emergencyHandler));
        assetManager.initialize(address(emergencyHandler));
        
        InheritanceCoordinator coordinator = new InheritanceCoordinator(
            address(assetManager),
            address(beneficiaryManager),
            address(emergencyHandler),
            inactivityThreshold
        );
        
        InheritanceAutomation automation = new InheritanceAutomation(
            address(coordinator)
        );
        
        // Transfer ownership to the coordinator
        assetManager.transferOwnership(address(coordinator));
        beneficiaryManager.transferOwnership(address(coordinator));
        emergencyHandler.transferOwnership(address(coordinator));
        
        // Transfer ownership of coordinator to the deployer
        coordinator.transferOwnership(msg.sender);
        
        emit DeploymentCompleted(
            address(coordinator),
            address(assetManager),
            address(beneficiaryManager),
            address(emergencyHandler),
            address(automation)
        );
        
        return address(coordinator);
    }
}
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../storage/InheritanceStorage.sol";

contract EmergencyHandler is InheritanceStorage, Ownable, ReentrancyGuard {
    constructor(address _recoveryAddress) Ownable(msg.sender) {
        require(_recoveryAddress != address(0), "Invalid recovery address");
        recoveryAddress = _recoveryAddress;
    }
    
    modifier onlyRecoveryOrOwner() {
        require(msg.sender == recoveryAddress || msg.sender == owner(), "Not authorized");
        _;
    }
    
    function initiateEmergencyMode() external onlyRecoveryOrOwner {
        require(!emergencyMode, "Already in emergency mode");
        emergencyMode = true;
        emergencyModeActivationTime = block.timestamp;
        emit EmergencyModeActivated(msg.sender, block.timestamp);
    }
    
    function deactivateEmergencyMode() external onlyRecoveryOrOwner {
        require(emergencyMode, "Not in emergency mode");
        emergencyMode = false;
        emit EmergencyModeDeactivated(msg.sender, block.timestamp);
    }
    
    function emergencyWithdraw() external nonReentrant {
        require(emergencyMode, "Not in emergency mode");
        require(userBalances[msg.sender] > 0, "No balance");
        require(
            block.timestamp >= emergencyModeActivationTime + EMERGENCY_DELAY,
            "Emergency delay not met"
        );
        
        uint256 amount = userBalances[msg.sender];
        userBalances[msg.sender] = 0;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
        
        emit EmergencyWithdrawal(msg.sender, amount);
    }
    
    function isEmergencyMode() external view returns (bool) {
        return emergencyMode;
    }
}
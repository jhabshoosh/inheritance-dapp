// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "../handlers/EmergencyHandler.sol";
import "../storage/InheritanceStorage.sol";

contract BeneficiaryManager is InheritanceStorage, Ownable, ReentrancyGuard, UUPSUpgradeable {
    uint256 public constant MAX_BENEFICIARY_CHANGES = 3;
    mapping(address => uint256) public beneficiaryChangeCount;
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
    
    function addBeneficiary(
        address _beneficiary, 
        uint256 _sharePercent
    ) external nonReentrant notInEmergencyMode {
        require(_sharePercent <= 100, "Invalid share");
        require(_beneficiary != address(0), "Invalid address");
        
        uint256 totalShares = getTotalShares(msg.sender);
        require(totalShares + _sharePercent <= 100, "Total shares cannot exceed 100%");
        
        // Check rate limiting
        require(
            beneficiaryChangeCount[msg.sender] < MAX_BENEFICIARY_CHANGES,
            "Beneficiary rate limit exceeded"
        );
        beneficiaryChangeCount[msg.sender]++;
        
        userBeneficiaries[msg.sender].push(Beneficiary({
            walletAddress: _beneficiary,
            sharePercent: _sharePercent,
            isActive: true
        }));
        
        lastActivityTime[msg.sender] = block.timestamp;
        emit BeneficiaryAdded(msg.sender, _beneficiary, _sharePercent);
    }

    function getTotalShares(address user) public view returns (uint256) {
        uint256 total = 0;
        for (uint i = 0; i < userBeneficiaries[user].length; i++) {
            if (userBeneficiaries[user][i].isActive) {
                total += userBeneficiaries[user][i].sharePercent;
            }
        }
        return total;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
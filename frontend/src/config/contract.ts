type NetworkConfig = {
    [chainId: string]: {
      name: string;
      contractAddress: string;
    };
  };
  
  export const SUPPORTED_NETWORKS: NetworkConfig = {
    "31337": { // Hardhat local network
      name: "Hardhat Local",
      contractAddress: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", // Update after local deployment
    },
    "421614": { // Arbitrum Sepolia
      name: "Arbitrum Sepolia",
      contractAddress: "YOUR_ARBITRUM_SEPOLIA_CONTRACT_ADDRESS",
    }
  };
  
  export const CONTRACT_ABI = [
    // Asset Management
    "function addDigitalAsset(string memory _encryptedData, string memory _assetType, address[] memory _beneficiaries) public",
    "function modifyAsset(uint256 _assetIndex, string memory _newEncryptedData, string memory _newAssetType, address[] memory _newBeneficiaries) public",
    "function removeAsset(uint256 _assetIndex) public",
    
    // Beneficiary Management
    "function addBeneficiary(address _beneficiary, uint256 _sharePercent) public",
    "function modifyBeneficiary(uint256 _index, uint256 _newSharePercent) public",
    "function removeBeneficiary(uint256 _index) public",
    
    // View Functions
    "function userAssets(address, uint256) public view returns (string memory encryptedData, string memory assetType, bool isActive)",
    "function userBeneficiaries(address, uint256) public view returns (address walletAddress, uint256 sharePercent, bool isActive)",
    "function lastActivityTime(address) public view returns (uint256)",
    "function isActiveUser(address) public view returns (bool)",
    "function userBalances(address) public view returns (uint256)",
    "function getTotalShares(address _user) public view returns (uint256)"
  ];
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { SUPPORTED_NETWORKS, CONTRACT_ABI } from '@/config/contract';

interface Asset {
  encryptedData: string;
  assetType: string;
  isActive: boolean;
}

interface Beneficiary {
  walletAddress: string;
  sharePercent: number;
  isActive: boolean;
}

export function useInheritanceContract(address: string | null) {
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [lastActivity, setLastActivity] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [networkName, setNetworkName] = useState<string>('');

  // Initialize contract
  useEffect(() => {
    const initContract = async () => {
      try {
        if (!window.ethereum || !address) {
          setLoading(false);
          return;
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        
        // Get chain ID
        const network = await provider.getNetwork();
        const currentChainId = network.chainId.toString();
        setChainId(currentChainId);
        
        // Get contract address for current network
        console.log(`Supported networks access with: ${currentChainId}`);
        // @ts-ignore
        const networkConfig = SUPPORTED_NETWORKS[currentChainId];
        if (!networkConfig) {
          setError(`Network not supported. ChainId: ${currentChainId}`);
          setLoading(false);
          return;
        }

        setNetworkName(networkConfig.name);
        console.log('Connected to network:', networkConfig.name);
        console.log('Using contract address:', networkConfig.contractAddress);

        const contractExists = await verifyContract(provider, networkConfig.contractAddress);
        if (!contractExists) {
          setError(`Contract not found on ${networkConfig.name}`);
          setLoading(false);
          return;
        }

        const signer = await provider.getSigner();
        const inheritanceContract = new ethers.Contract(
          networkConfig.contractAddress,
          CONTRACT_ABI,
          signer
        );

        setContract(inheritanceContract);
      } catch (err) {
        console.error('Error initializing contract:', err);
        setError('Error connecting to contract');
        setLoading(false);
      }
    };

    initContract();
  }, [address]);

  // Verify contract exists at address
  const verifyContract = async (provider: ethers.Provider, contractAddress: string) => {
    const code = await provider.getCode(contractAddress);
    return code !== '0x';
  };


  // Initialize contract
  useEffect(() => {
    const initContract = async () => {
      try {
        if (!window.ethereum || !address) {
          setLoading(false);
          return;
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        
        // Get chain ID
        const network = await provider.getNetwork();
        console.log(`Connected to network: ${network.name} (${network.chainId})`);  
        setChainId(network.chainId.toString());

        // Verify contract exists on this network
        const contractExists = await verifyContract(provider, network.chainId.toString());
        if (!contractExists) {
          setError('Contract not found on this network');
          setLoading(false);
          return;
        }

        const signer = await provider.getSigner();
        const inheritanceContract = new ethers.Contract(
          SUPPORTED_NETWORKS[network.chainId.toString()].contractAddress,
          CONTRACT_ABI,
          signer
        );

        setContract(inheritanceContract);
      } catch (err) {
        console.error('Error initializing contract:', err);
        setError('Error connecting to contract');
        setLoading(false);
      }
    };

    initContract();
  }, [address]);

  // Fetch last activity time
  const fetchLastActivity = useCallback(async () => {
    if (!contract || !address) return;
    
    try {
      const timestamp = await contract.lastActivityTime(address);
      if (timestamp) {
        setLastActivity(Number(timestamp));
      } else {
        setLastActivity(0); // No activity yet
      }
    } catch (err) {
      console.error('Error fetching last activity:', err);
      setLastActivity(0); // Set to 0 on error
    }
  }, [contract, address]);

  // Fetch user's assets with error handling
  const fetchAssets = useCallback(async () => {
    if (!contract || !address) return;
    
    try {
      setLoading(true);
      let assetsList: Asset[] = [];
      let index = 0;
      
      while (true) {
        try {
          const asset = await contract.userAssets(address, index);
          if (!asset || !asset.assetType) break;
          assetsList.push({
            encryptedData: asset.encryptedData,
            assetType: asset.assetType,
            isActive: asset.isActive
          });
          index++;
        } catch (err) {
          // Break the loop if we get an error (likely means we've reached the end)
          break;
        }
      }
      
      setAssets(assetsList.filter(a => a.isActive));
    } catch (err) {
      console.error('Error fetching assets:', err);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [contract, address]);

  // Fetch user's beneficiaries with error handling
  const fetchBeneficiaries = useCallback(async () => {
    if (!contract || !address) return;
    
    try {
      setLoading(true);
      let beneficiariesList: Beneficiary[] = [];
      let index = 0;
      
      while (true) {
        try {
          const beneficiary = await contract.userBeneficiaries(address, index);
          if (!beneficiary || !beneficiary.walletAddress) break;
          beneficiariesList.push({
            walletAddress: beneficiary.walletAddress,
            sharePercent: Number(beneficiary.sharePercent),
            isActive: beneficiary.isActive
          });
          index++;
        } catch (err) {
          break;
        }
      }
      
      setBeneficiaries(beneficiariesList.filter(b => b.isActive));
    } catch (err) {
      console.error('Error fetching beneficiaries:', err);
      setBeneficiaries([]);
    } finally {
      setLoading(false);
    }
  }, [contract, address]);

  // Fetch all data when contract is ready
  useEffect(() => {
    if (contract && address) {
      Promise.all([
        fetchAssets(),
        fetchBeneficiaries(),
        fetchLastActivity()
      ]).finally(() => setLoading(false));
    }
  }, [contract, address, fetchAssets, fetchBeneficiaries, fetchLastActivity]);

  return {
    contract,
    assets,
    beneficiaries,
    lastActivity,
    loading,
    error,
    chainId,
    refetch: {
      assets: fetchAssets,
      beneficiaries: fetchBeneficiaries,
      lastActivity: fetchLastActivity
    },
    networkName
  };
}
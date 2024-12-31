import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ethers } from 'ethers';
import { useInheritanceContract } from '@/hooks/useInheritanceContract';

export const InheritanceDashboard = () => {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState('0');
  const [walletError, setWalletError] = useState<string | null>(null);

  const {
    assets,
    beneficiaries,
    lastActivity,
    loading,
    error: contractError,
    networkName
  } = useInheritanceContract(address);


  const connectWallet = async () => {
    try {
      const { ethereum } = window;
      
      if (!ethereum) {
        setWalletError('Please install MetaMask!');
        return;
      }

      const accounts = await ethereum.request({ 
        method: 'eth_requestAccounts' 
      });

      if (accounts && Array.isArray(accounts)) {
        const provider = new ethers.BrowserProvider(ethereum);
        const signer = await provider.getSigner();
        const userAddress = await signer.getAddress();
        const balance = await provider.getBalance(userAddress);
        
        setAddress(userAddress);
        setBalance(ethers.formatEther(balance));
        setConnected(true);
        setWalletError(null);
        
        ethereum.on('accountsChanged', handleAccountChange);
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setWalletError('Error connecting wallet. Please try again.');
    }
  };

  const handleAccountChange = async (accounts: string[]) => {
    if (accounts.length === 0) {
      setConnected(false);
      setAddress(null);
      setBalance('0');
    } else {
      const { ethereum } = window;
      if (ethereum) {
        setAddress(accounts[0]);
        const provider = new ethers.BrowserProvider(ethereum);
        const balance = await provider.getBalance(accounts[0]);
        setBalance(ethers.formatEther(balance));
      }
    }
  };

  useEffect(() => {
    return () => {
      const { ethereum } = window;
      if (ethereum) {
        ethereum.removeListener('accountsChanged', handleAccountChange);
      }
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Digital Inheritance Dashboard</CardTitle>
          <CardDescription>Manage your digital assets and beneficiaries</CardDescription>
        </CardHeader>
        <CardContent>
          {walletError && (
            <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
              {walletError}
            </div>
          )}
          
          {!connected ? (
            <Button onClick={connectWallet} className="w-full sm:w-auto">
              Connect Wallet
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                </div>
                <span className="text-sm">{balance} ETH</span>
              </div>
              <div className="text-sm text-gray-500">
                Network: {networkName}
              </div>
            </div>
          )}

          {contractError && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
              {contractError}
            </div>
          )}
        </CardContent>
      </Card>

      {connected && (
        <>
          {loading ? (
            <div className="text-center py-4">Loading data...</div>
          ) : contractError ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-md">
              {contractError}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3 mb-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{assets.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Beneficiaries</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{beneficiaries.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Last Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {lastActivity ? new Date(lastActivity * 1000).toLocaleDateString() : 'N/A'}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
};
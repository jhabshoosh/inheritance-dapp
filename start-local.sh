#!/bin/bash

# Start Hardhat node in the background
echo "Starting Hardhat node..."
cd blockchain
npx hardhat node &
HARDHAT_PID=$!

# Wait a bit for the node to start
sleep 5

# Deploy contracts
echo "Deploying contracts..."
npx hardhat run scripts/deploy.js --network localhost

# Start frontend
echo "Starting frontend..."
cd ../frontend
npm run dev

# Cleanup on exit
trap "kill $HARDHAT_PID" EXIT
# Polygon Amoy Deployment Guide

This guide explains how to deploy the Health Vault smart contract to Polygon Amoy testnet and run the application on two different systems.

## Prerequisites

Before starting, ensure you have:
- Node.js installed (v14 or higher)
- MetaMask browser extension installed
- A code editor (VS Code recommended)

---

## Step 1: Get Testnet MATIC

1. Go to https://faucet.polygon.technology/
2. Select "Amoy" network
3. Enter your MetaMask wallet address
4. Click "Submit" to receive test MATIC
5. Wait for the tokens to arrive (may take a few minutes)

---

## Step 2: Get API Keys

### PolygonScan API Key (for contract verification)
1. Go to https://polygonscan.com/
2. Create an account
3. Go to API Keys section
4. Create a new API key
5. Copy the API key

### Pinata JWT Token (for IPFS storage)
1. Go to https://www.pinata.cloud/
2. Create an account
3. Go to Dashboard > API Keys
4. Create a new API key
5. Copy the JWT token

---

## Step 3: Configure Environment Variables

1. Copy the example environment file:
```
bash
copy env.example.txt .env
```

2. Edit the `.env` file and add your values:
```
env
# Required for deployment
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
DEPLOYER_PRIVATE_KEY=your_metaMask_private_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key

# Required for frontend
REACT_APP_PINATA_JWT=your_pinata_jwt_token
REACT_APP_HEALTH_CONTRACT_ADDRESS=
```

**Important:** To get your MetaMask private key:
1. Open MetaMask
2. Click on the account icon (top right)
3. Click "Account details"
4. Click "Show private key"
5. Enter your password
6. Copy the private key

---

## Step 4: Deploy the Smart Contract

Run the deployment command:

```
bash
npx hardhat run scripts/deploy_amoy.js --network polygonAmoy
```

Expected output:
```
Deploying to Polygon Amoy testnet...
HealthRecordsConsent deployed to: 0x...
```

Copy the deployed contract address.

---

## Step 5: Update Frontend Configuration

1. Open the `.env` file
2. Add the deployed contract address:
```
env
REACT_APP_HEALTH_CONTRACT_ADDRESS=0x...
```

---

## Step 6: Run the Frontend

Start the development server:

```
bash
npm start
```

The application will open at http://localhost:3000

---

## Step 7: Configure Second System (Different Computer)

### On System 1 (Already Running):
1. Keep the frontend running
2. Note the contract address from Step 4

### On System 2:

1. Clone the project or copy the files
2. Copy the `.env` file with same values (except DEPLOYER_PRIVATE_KEY)
3. Install dependencies:
```
bash
npm install
```

4. Start the frontend:
```
bash
npm start
```

5. In the running app:
   - Click "Settings" button
   - Select "Polygon Amoy" from network dropdown
   - Enter the same contract address from System 1
   - Click "Connect Wallet"

---

## How It Works

Both systems connect to:
- **Same Blockchain Network**: Polygon Amoy testnet
- **Same Smart Contract**: The deployed contract address
- **Same IPFS**: Pinata for encrypted record storage

This allows:
- Healthcare providers on System 1 to upload records
- Patients on System 2 to view and share their records

---

## Troubleshooting

### "Network not found" error
- Make sure you selected "Polygon Amoy" in the network dropdown
- Check that AMOY_RPC_URL is correct in .env

### "Contract not found" error
- Verify REACT_APP_HEALTH_CONTRACT_ADDRESS is set correctly
- Check the contract was deployed successfully

### "Insufficient funds" error
- Get more test MATIC from the faucet
- Check your wallet balance on https://polygonscan.com/

### MetaMask connection issues
- Make sure MetaMask is installed and unlocked
- Switch to Polygon Amoy network in MetaMask manually:
  - Networks > Add Network
  - Network Name: Polygon Amoy
  - New RPC URL: https://rpc-amoy.polygon.technology
  - Chain ID: 80002
  - Currency Symbol: MATIC

---

## Important Notes

1. **Always use testnet for testing** - Never use real MATIC/ETH
2. **Keep your private key secure** - Never commit it to version control
3. **Both systems need internet access** - To connect to Polygon Amoy
4. **Same contract address** - Both systems must use the same deployed contract

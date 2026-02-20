# Health Vault - User Guide

## How to Run the Application

### Prerequisites
1. Node.js installed
2. MetaMask browser extension installed

### Running the App
```
bash
npm start
```

The app will open at `http://localhost:3000`

## Unified Dashboard - Role Selection

Instead of separate admin/client builds, the app now has a unified dashboard. Users select their role at the top:

- 👤 **Patient** - For patients who want to share their health records
- 🩺 **Doctor** - For doctors who need to view patient records
- 🏥 **Healthcare Provider** - For hospitals/labs that upload records

## MetaMask Wallet Setup

### Installing MetaMask
1. Install MetaMask browser extension from https://metamask.io/
2. Create a new wallet or import existing
3. Note: You'll need at least 2 accounts:
   - One for patient
   - One for provider/admin

### Getting Your Encryption Key
1. Click "📋 Get My Key" button
2. MetaMask will prompt you to allow access to your encryption key
3. The key will be copied to your clipboard
4. Share this key with whoever needs to share records with you

## Input Fields Guide

### For Patients (Patient Role)
1. **Connect Wallet**: Click "🔗 Connect Wallet" and approve in MetaMask
2. **Share My Records**:
   - Record ID: The ID of the record you want to share
   - Share with: Wallet address of the person you want to share with
   - Their Security Key: Paste their encryption key here
   - Expiration: Optional - leave blank for permanent access

### For Doctors (Doctor Role)
1. **Connect Wallet**: Click "🔗 Connect Wallet" and approve in MetaMask
2. **Access Health Data**:
   - Record ID: Enter the record ID shared with you by the patient

### For Healthcare Providers (Provider Role)
1. **Connect Wallet**: Click "🔗 Connect Wallet" and approve in MetaMask
2. **Upload Health Record**:
   - Patient Wallet Address: Enter the patient's Ethereum wallet address
   - Patient's Security Key: Get this from the patient (they click "Get My Key")
   - Record Type: e.g., LAB_RESULT, PRESCRIPTION, IMAGING
   - Record Details: Enter medical data in JSON format

## Network Configuration

Click "⚙️ Settings" to configure:
- **Network**: Select from Local Hardhat, Sepolia Testnet, Polygon Amoy, Ethereum Mainnet, or Custom RPC
- **Contract Address**: Enter the smart contract address

## Transaction History

Click "📜" in the header to view all your transactions.

## Notifications

Click "🔔" in the header to view notifications.

## Offline Mode

Records you view are cached locally, so you can view them even when offline (though you need to be online to fetch new data).

## Running on Different Systems/Laptops

### Option 1: Network Access (Same WiFi)
You can run the app and access it from another laptop on the same network:

1. Run the app with network binding:
   
```
   npm start
   
```

2. Find your computer's IP address:
   - **Windows**: Open Command Prompt and type `ipconfig`
   - **Mac**: Open Terminal and type `ifconfig`
   - Look for "IPv4 Address" (e.g., `192.168.1.100`)

3. On the other laptop, open browser and go to:
   
```
   http://192.168.1.100:3000
   
```
   (Replace with your actual IP address)

### Option 2: Build and Deploy
To share the app with anyone anywhere:

1. Build the app:
   
```
   npm run build
   
```

2. Deploy to a hosting service:
   - **Vercel** (recommended): https://vercel.com
   - **Netlify**: https://www.netlify.com
   - **GitHub Pages**: https://pages.github.com

3. Upload the `build` folder to your chosen hosting service

### Option 3: Share Project Files
Copy the entire project folder to another laptop:

1. Copy the `password-vault` folder to the other laptop
2. Open terminal in that folder
3. Run:
   
```
   npm install
   npm start
   
```

## Example JSON Record Format
```
json
{
  "summary": "Blood Test Results",
  "result": "Normal",
  "date": "2024-01-15",
  "lab": "City Medical Center"
}

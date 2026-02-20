# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Decentralized Password Vault for Healthcare Systems

This project aims to develop a decentralized password vault for healthcare systems using blockchain technology. The system implements smart contracts for securely managing healthcare user and system credential metadata, applies AES encryption for encrypting healthcare-related access credentials on the client side before storage, leverages IPFS for decentralized and tamper-proof storage of encrypted password data, ensures that only authenticated healthcare professionals and authorized users can access their credentials, and validates the feasibility and reliability of the system through a functional prototype and early-stage demonstration.

This repo includes a minimal smart contract (`contracts/HealthRecordsConsent.sol`) and a React demo UI that:

- encrypts healthcare-related access credentials **client-side** (AES-256-GCM)
- uploads the encrypted payload to **IPFS** (via Pinata `pinJSONToIPFS`)
- anchors the **CID + integrity hash** on-chain on **Polygon** via smart contracts
- manages access control for authenticated healthcare professionals and authorized users
- provides a functional prototype for demonstration and validation

### Environment variables

Create a `.env` (not committed) based on `env.example.txt`:

- `REACT_APP_PINATA_JWT`: Pinata JWT (used by the frontend to upload encrypted JSON)
- `REACT_APP_HEALTH_CONTRACT_ADDRESS`: deployed contract address
- `AMOY_RPC_URL`, `DEPLOYER_PRIVATE_KEY`: for Hardhat deploy to Polygon Amoy

### Compile / deploy contract (Polygon Amoy)

```bash
npm run chain:compile
npx hardhat run scripts/deploy.js --network polygonAmoy
```

Copy the printed contract address into `REACT_APP_HEALTH_CONTRACT_ADDRESS`.

### Deploying locally (Hardhat)

For local development you can run a Hardhat node and deploy locally:

```powershell
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

Then copy the deployed address into `.env.local` as `REACT_APP_HEALTH_CONTRACT_ADDRESS`. If you use the local Hardhat node, MetaMask can connect to the node using chainId `0x7a69` and one of the presented accounts.

### Running the realtime indexer (optional)

This repo includes a simple realtime indexer that subscribes to the `RecordAdded` event over WebSocket and saves events to `data/events.json`.

Steps:

1. Start a node with WebSocket support (local Hardhat node exposes ws://127.0.0.1:8545):

```powershell
npx hardhat node
```

2. Deploy the contract to that node and set `REACT_APP_HEALTH_CONTRACT_ADDRESS` in `.env.local`.

3. (Optional) set `INDEXER_WS_URL` in the environment if your node is at a different address. The default used by the indexer is `ws://127.0.0.1:8545`.

4. Run the indexer:

```powershell
npm run indexer
```

The indexer will append events to `data/events.json` as they arrive.

### Run the app

```bash
npm start
```

### Notes (important)

- The contract stores **no PHI**—only pointers/hashes and encrypted DEKs.
- For “patient wallet key management”, the patient needs the viewer’s **encryption public key** (typically published via DID/Ceramic). The demo UI currently expects you to paste this value.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

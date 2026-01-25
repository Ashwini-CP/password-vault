import Web3 from "web3";

// Minimal ABI for the functions used by the frontend.
export const HEALTH_RECORDS_CONSENT_ABI = [
  {
    inputs: [
      { internalType: "address", name: "patient", type: "address" },
      { internalType: "string", name: "cid", type: "string" },
      { internalType: "bytes32", name: "dataHash", type: "bytes32" },
      { internalType: "bytes32", name: "recordType", type: "bytes32" },
      { internalType: "bytes", name: "encryptedDEKForPatient", type: "bytes" },
    ],
    name: "addRecord",
    outputs: [{ internalType: "uint256", name: "recordId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "recordId", type: "uint256" },
      { internalType: "address", name: "viewer", type: "address" },
      { internalType: "bytes", name: "encryptedDEKForViewer", type: "bytes" },
      { internalType: "uint64", name: "expiresAt", type: "uint64" },
    ],
    name: "grantAccess",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "recordId", type: "uint256" },
      { internalType: "address", name: "viewer", type: "address" },
    ],
    name: "revokeAccess",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "recordId", type: "uint256" }],
    name: "getRecord",
    outputs: [
      {
        components: [
          { internalType: "address", name: "patient", type: "address" },
          { internalType: "address", name: "uploader", type: "address" },
          { internalType: "string", name: "cid", type: "string" },
          { internalType: "bytes32", name: "dataHash", type: "bytes32" },
          { internalType: "bytes32", name: "recordType", type: "bytes32" },
          { internalType: "uint64", name: "createdAt", type: "uint64" },
        ],
        internalType: "struct HealthRecordsConsent.RecordMeta",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "recordId", type: "uint256" }],
    name: "getEncryptedDEK",
    outputs: [{ internalType: "bytes", name: "", type: "bytes" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "recordId", type: "uint256" },
      { internalType: "address", name: "viewer", type: "address" },
    ],
    name: "canView",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getMyPatientRecordIds",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getMyViewerRecordIds",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
];

export function getWeb3() {
  if (!window.ethereum) throw new Error("MetaMask not available");
  return new Web3(window.ethereum);
}

export function getHealthRecordsContract(web3) {
  const addr = process.env.REACT_APP_HEALTH_CONTRACT_ADDRESS;
  if (!addr) throw new Error("Missing REACT_APP_HEALTH_CONTRACT_ADDRESS");
  return new web3.eth.Contract(HEALTH_RECORDS_CONSENT_ABI, addr);
}

export function subscribeToEvents(web3, contractAddress, callback) {
  const contract = new web3.eth.Contract(HEALTH_RECORDS_CONSENT_ABI, contractAddress);
  const events = ['RecordAdded', 'ConsentGranted', 'ConsentRevoked', 'EncryptedDEKSet'];

  // For testnet, use polling instead of WebSocket subscription
  const pollEvents = async () => {
    try {
      // Get latest block number
      const latestBlock = await web3.eth.getBlockNumber();

      // Query events from the last 100 blocks (adjust as needed)
      const fromBlock = Math.max(0, latestBlock - 100);

      const eventPromises = events.map(eventName =>
        contract.getPastEvents(eventName, {
          fromBlock: fromBlock,
          toBlock: 'latest'
        })
      );

      const eventResults = await Promise.all(eventPromises);

      eventResults.forEach((eventList, index) => {
        eventList.forEach(event => {
          callback(events[index], event.returnValues);
        });
      });
    } catch (error) {
      console.error('Error polling events:', error);
    }
  };

  // Poll immediately and then every 30 seconds
  pollEvents();
  setInterval(pollEvents, 30000);
}


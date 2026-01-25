#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
// Load .env if present
try {
  require('dotenv').config();
} catch (e) { }

const { ethers } = require('ethers');
const WS = process.env.INDEXER_WS_URL || 'ws://127.0.0.1:8545';
const CONTRACT_ADDR = process.env.REACT_APP_HEALTH_CONTRACT_ADDRESS;
if (!CONTRACT_ADDR) {
  console.error('Missing REACT_APP_HEALTH_CONTRACT_ADDRESS in environment');
  process.exit(1);
}

const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'HealthRecordsConsent.sol', 'HealthRecordsConsent.json');
if (!fs.existsSync(artifactPath)) {
  console.error('Contract artifact not found at', artifactPath);
  process.exit(1);
}
const ABI = require(artifactPath).abi;

const provider = new ethers.WebSocketProvider(WS);
const contract = new ethers.Contract(CONTRACT_ADDR, ABI, provider);

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const eventsFile = path.join(dataDir, 'events.json');

function loadEvents() {
  try {
    return JSON.parse(fs.readFileSync(eventsFile, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveEvents(arr) {
  fs.writeFileSync(eventsFile, JSON.stringify(arr, null, 2));
}

console.log(`Indexer: connecting to ${WS}, contract ${CONTRACT_ADDR}`);

contract.on('RecordAdded', (recordId, patient, uploader, recordType, dataHash, cid, event) => {
  try {
    const ev = {
      recordId: recordId?.toString?.() || null,
      patient,
      uploader,
      recordType,
      dataHash,
      cid,
      txHash: event.transactionHash,
      blockNumber: event.blockNumber,
      timestamp: Date.now(),
    };
    console.log('RecordAdded', ev);
    const arr = loadEvents();
    arr.push(ev);
    saveEvents(arr);
  } catch (e) {
    console.error('Failed to handle event', e);
  }
});

// Keep process alive; provider will emit events and can be stopped with Ctrl+C.

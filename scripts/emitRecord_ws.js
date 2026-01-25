const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

async function main() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) throw new Error('.env.local missing');
  const env = fs.readFileSync(envPath, 'utf8');
  const m = env.match(/REACT_APP_HEALTH_CONTRACT_ADDRESS=(0x[0-9a-fA-F]+)/);
  if (!m) throw new Error('Contract address not found in .env.local');
  const addr = m[1];

  const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');
  const signer = provider.getSigner(0);
  const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'HealthRecordsConsent.sol', 'HealthRecordsConsent.json');
  if (!fs.existsSync(artifactPath)) throw new Error('artifact missing');
  const abi = require(artifactPath).abi;
  const contract = new ethers.Contract(addr, abi, signer);

  const patient = await signer.getAddress();
  const cid = 'QmTestCid' + Math.floor(Math.random() * 10000);
  const dataHash = ethers.utils.id('data-hash');
  const recordType = ethers.utils.id('LAB_RESULT');
  const encryptedDEK = ethers.utils.toUtf8Bytes('edeK');

  console.log('Sending addRecord...');
  const tx = await contract.addRecord(patient, cid, dataHash, recordType, encryptedDEK);
  const receipt = await tx.wait();
  console.log('Sent tx', receipt.transactionHash);
}

main().catch((err) => {
  console.error(err.stack || err);
  process.exitCode = 1;
});

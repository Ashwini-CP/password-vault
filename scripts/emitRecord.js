const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

async function main() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) throw new Error('.env.local missing');
  const env = fs.readFileSync(envPath, 'utf8');
  const m = env.match(/REACT_APP_HEALTH_CONTRACT_ADDRESS=(0x[0-9a-fA-F]+)/);
  if (!m) throw new Error('Contract address not found in .env.local');
  const addr = m[1];

  const [signer] = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt('HealthRecordsConsent', addr, signer);
  console.log('Signer address:', signer.address);

  // sample payload values
  const patient = signer.address;
  const cid = 'QmTestCid' + Math.floor(Math.random() * 10000);
  const Web3 = require('web3').default || require('web3');
  const w3 = new Web3();
  const dataHash = w3.utils.keccak256('data-hash');
  const recordType = w3.utils.keccak256('LAB_RESULT');
  const encryptedDEK = w3.utils.utf8ToHex('edeK');

  try {
    console.log('Sending addRecord tx...');
    const tx = await contract.addRecord(patient, cid, dataHash, recordType, encryptedDEK);
    const receipt = await tx.wait();
    console.log('tx hash', receipt.transactionHash);
  } catch (err) {
    console.error('addRecord error', err && (err.stack || err.message || err));
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

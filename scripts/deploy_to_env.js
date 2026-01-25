const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

async function main() {
  const Factory = await hre.ethers.getContractFactory('HealthRecordsConsent');
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log('Deployed:', address);

  const envPath = path.join(__dirname, '..', '.env.local');
  let content = '';
  if (fs.existsSync(envPath)) content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  const other = lines.filter((l) => !l.startsWith('REACT_APP_HEALTH_CONTRACT_ADDRESS='));
  other.push(`REACT_APP_HEALTH_CONTRACT_ADDRESS=${address}`);
  fs.writeFileSync(envPath, other.join('\n') + '\n');
  console.log('Wrote .env.local with address');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

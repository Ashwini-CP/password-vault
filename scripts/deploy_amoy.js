const hre = require("hardhat");

async function main() {
  console.log("Deploying to Polygon Amoy testnet...");
  
  // Get the contract factory
  const HealthRecordsConsent = await hre.ethers.getContractFactory("HealthRecordsConsent");
  
  // Deploy the contract
  const healthRecords = await HealthRecordsConsent.deploy();
  
  await healthRecords.waitForDeployment();
  const contractAddress = await healthRecords.getAddress();
  
  console.log("HealthRecordsConsent deployed to:", contractAddress);
  console.log("");
  console.log("Add this address to your .env file:");
  console.log(`REACT_APP_HEALTH_CONTRACT_ADDRESS=${contractAddress}`);
  console.log("");
  console.log("Then update your frontend to use Polygon Amoy network.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

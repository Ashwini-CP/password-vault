import React, { useState } from "react";
import { getHealthRecordsContract } from "../utils/healthContract";
import Web3 from "web3";
import {
  randomBytes,
  encryptJsonWithDEK,
  encryptDEKForPublicKey,
} from "../utils/healthCrypto";
import Navigation from "./Navigation";
import { useNetwork, useNotification, useTransaction } from "../App";

function AdminSide({ account, chainId, connectWallet, switchToExpectedChain, userRole }) {
  // Get network configuration
  const { getRpcUrl } = useNetwork();
  // Get notification functions
  const { addNotification } = useNotification();
  // Get transaction functions
  const { addTransaction } = useTransaction();

  // Offline mode - cached uploads
  const [cachedUploads, setCachedUploads] = useState(() => {
    try {
      const saved = localStorage.getItem('healthVaultCachedUploads');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to parse cached uploads:', error);
      return [];
    }
  });

  // Save cached uploads to localStorage
  React.useEffect(() => {
    localStorage.setItem('healthVaultCachedUploads', JSON.stringify(cachedUploads));
  }, [cachedUploads]);

  // Uploader flow (provider/lab/hospital)
  const [patientAddress, setPatientAddress] = useState("");
  const [recordType, setRecordType] = useState("LAB_RESULT");
  const [recordJson, setRecordJson] = useState('{"summary":"CBC panel","result":"NORMAL"}');
  const [patientEncryptionPublicKey, setPatientEncryptionPublicKey] = useState("");
  const [lastRecordId, setLastRecordId] = useState("");
  const [lastCid, setLastCid] = useState("");

  // Show help tooltips
  const [showHelp, setShowHelp] = useState({});

  const toggleHelp = (field) => {
    setShowHelp(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Get user-friendly title based on role
  const getTitle = () => {
    if (userRole === 'provider') {
      return "Healthcare Provider Dashboard";
    }
    return "Doctor Dashboard";
  };

  // Get user-friendly description
  const getDescription = () => {
    if (userRole === 'provider') {
      return "Upload and manage patient health records securely.";
    }
    return "Manage and upload patient health records.";
  };

  // Export the current MetaMask account's encryption public key and fill the given setter.
  async function exportEncryptionKeyAndFill(setter) {
    if (!window.ethereum) return alert('MetaMask not detected. Please install MetaMask browser extension.');
    try {
      let acct = account;
      if (!acct) {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        acct = accounts && accounts[0];
        if (acct) connectWallet();
      }
      if (!acct) return alert('No account available. Please unlock MetaMask and try again.');

      try {
        const current = (await window.ethereum.request({ method: 'eth_accounts' }))[0];
        if (current && acct && current.toLowerCase() !== acct.toLowerCase()) {
          const proceed = window.confirm(
            `Your MetaMask is currently connected to ${current}.\n\nWould you like to use ${acct} instead?`
          );
          if (!proceed) return;
        }
      } catch (e) {
        // ignore account-check failures
      }

      const pub = await window.ethereum.request({ method: 'eth_getEncryptionPublicKey', params: [acct] });
      if (typeof setter === 'function') setter(pub);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(pub);
        }
      } catch (e) {
        // ignore copy failures
      }
      alert('✅ Security key copied to clipboard!');
    } catch (err) {
      console.error('exportEncryptionKeyAndFill error', err);
      alert('Could not get security key: ' + (err && (err.message || err)));
    }
  }

  const uploadEncryptedRecord = async () => {
    if (!account) return alert("Please connect your wallet first.");
    if (!patientAddress || !patientAddress.startsWith("0x")) return alert("Please enter a valid patient wallet address.");
    if (!patientEncryptionPublicKey) return alert("Please enter the patient's security key.");

    let parsed;
    try {
      parsed = JSON.parse(recordJson);
    } catch {
      return alert("Invalid record format. Please check your JSON.");
    }

    // Encrypt payload with per-record DEK, then encrypt DEK for the patient (wallet-based).
    const dek = randomBytes(32);
    const enc = await encryptJsonWithDEK(
      { record: parsed, createdAt: new Date().toISOString(), uploader: account },
      dek
    );
    const encryptedDEKForPatientHex = encryptDEKForPublicKey(dek, patientEncryptionPublicKey);

    // Use Infura IPFS for upload (free tier available)
    const payload = {
      ciphertextB64: enc.ciphertextB64,
      ivB64: enc.ivB64,
      algo: enc.algo,
      schema: "health-record:v1",
    };

    let cid;
    try {
      if (!process.env.REACT_APP_PINATA_JWT_TOKEN) {
        throw new Error("Pinata JWT token not set. Please set REACT_APP_PINATA_JWT_TOKEN in your environment.");
      }
      const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_PINATA_JWT_TOKEN}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Pinata API error:', res.status, errorText);
        throw new Error(`Pinata API error: ${res.status} ${errorText}`);
      }
      const data = await res.json();
      if (!data.IpfsHash) {
        console.error('Pinata response:', data);
        throw new Error("CID not returned from Pinata");
      }
      cid = data.IpfsHash;
      setLastCid(cid);
    } catch (ipfsError) {
      console.error('IPFS upload failed:', ipfsError);
      throw new Error("Failed to upload to storage: " + (ipfsError.message || ipfsError));
    }

    try {
      const rpcUrl = getRpcUrl();
      const web3 = new Web3(rpcUrl);
      const contract = getHealthRecordsContract(web3);

      const code = await web3.eth.getCode(contract.options.address);
      if (!code || code === '0x') {
        alert(
          `Contract not found at ${contract.options.address}. Please check Settings.`
        );
        return;
      }

      const dataHash = web3.utils.keccak256(enc.ciphertextB64);
      const recordTypeHash = web3.utils.keccak256(recordType);

      const receipt = await contract.methods
        .addRecord(patientAddress, cid, dataHash, recordTypeHash, encryptedDEKForPatientHex)
        .send({ from: account });

      const ev = receipt?.events?.RecordAdded;
      const recordId = ev?.returnValues?.recordId?.toString?.() || "";
      setLastRecordId(recordId);

      // Add to transaction history
      addTransaction({
        type: '📤 Upload Record',
        details: `Uploaded ${recordType} for patient ${patientAddress.slice(0, 6)}...`,
        hash: receipt.transactionHash
      });

      // Cache the upload for offline viewing
      const cachedUpload = {
        id: recordId || Date.now().toString(),
        patientAddress,
        recordType,
        recordJson,
        cid,
        timestamp: new Date().toISOString()
      };
      setCachedUploads(prev => [cachedUpload, ...prev].slice(0, 10));

      // Show notification
      addNotification('Record uploaded successfully!', 'success');

      alert(`✅ Success! Record uploaded.\n\n${recordId ? `Record ID: ${recordId}` : `Transaction: ${receipt.transactionHash}`}`);
    } catch (contractError) {
      console.error('Contract interaction failed:', contractError);
      alert(`❌ Error: ${contractError?.message || 'Failed to upload record. Please try again.'}`);
      addNotification('Failed to upload record', 'error');
    }
  };

  return (
    <div className="container">
      <Navigation isAdmin={true} />
      <div className="user-friendly-header">
        <h1>{getTitle()}</h1>
        <p className="description">{getDescription()}</p>
      </div>

      {/* WALLET */}
      <div id="wallet" className="card">
        <h2>💳 My Account</h2>
        {!account ? (
          <div className="connect-wallet-section">
            <p>Connect your wallet to get started</p>
            <button className="primary-btn" onClick={connectWallet}>
              🔗 Connect Wallet
            </button>
          </div>
        ) : (
          <div className="account-info">
            <p>
              <strong>Connected:</strong> 
              <span className="address">{account.slice(0, 6)}...{account.slice(-4)}</span>
            </p>
            <p>
              <small>Network: {chainId || "unknown"}</small>
            </p>
          </div>
        )}
      </div>

      {/* UPLOAD RECORD */}
      <div id="upload" className="card">
        <div className="card-header">
          <h2>📤 Upload Health Record</h2>
          <button 
            className="help-btn" 
            onClick={() => toggleHelp('upload')}
            title="Learn more"
          >
            ❓
          </button>
        </div>

        {showHelp.upload && (
          <div className="help-box">
            <p><strong>How to upload a health record:</strong></p>
            <ol>
              <li>Enter the patient's wallet address</li>
              <li>Get the patient's security key (they can click "Get My Key" to copy it)</li>
              <li>Select the type of record</li>
              <li>Enter the record details in JSON format</li>
              <li>Click "Upload Record" to encrypt and save</li>
            </ol>
          </div>
        )}

        <div className="form-group">
          <label>
            Patient Wallet Address 👤
            <button 
              className="inline-help-btn" 
              onClick={() => toggleHelp('patientAddress')}
              title="What is this?"
            >
              ℹ️
            </button>
          </label>
          {showHelp.patientAddress && (
            <div className="help-text">
              Enter the patient's Ethereum wallet address (starts with 0x).
            </div>
          )}
          <input
            type="text"
            value={patientAddress}
            onChange={(e) => setPatientAddress(e.target.value)}
            placeholder="Patient's wallet address (e.g., 0x...)"
          />
        </div>

        <div className="form-group">
          <label>
            Patient's Security Key 🔐
            <button 
              className="inline-help-btn" 
              onClick={() => toggleHelp('patientKey')}
              title="What is this?"
            >
              ℹ️
            </button>
          </label>
          {showHelp.patientKey && (
            <div className="help-text">
              Ask the patient to click "Get My Key" in their wallet and paste it here. This ensures only they can access their records.
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              value={patientEncryptionPublicKey}
              onChange={(e) => setPatientEncryptionPublicKey(e.target.value)}
              placeholder="Paste patient's security key here"
              style={{ flex: 1 }}
            />
            <button onClick={() => exportEncryptionKeyAndFill(setPatientEncryptionPublicKey)}>
              📋 Get My Key
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>
            Record Type 📋
            <button 
              className="inline-help-btn" 
              onClick={() => toggleHelp('recordType')}
              title="What is this?"
            >
              ℹ️
            </button>
          </label>
          {showHelp.recordType && (
            <div className="help-text">
              Select the type of medical record you're uploading.
            </div>
          )}
          <input
            type="text"
            value={recordType}
            onChange={(e) => setRecordType(e.target.value)}
            placeholder='Record type (e.g., LAB_RESULT, PRESCRIPTION, IMAGING)'
          />
        </div>

        <div className="form-group">
          <label>
            Record Details 📝
            <button 
              className="inline-help-btn" 
              onClick={() => toggleHelp('recordDetails')}
              title="What is this?"
            >
              ℹ️
            </button>
          </label>
          {showHelp.recordDetails && (
            <div className="help-text">
              Enter the medical record data in JSON format. This will be encrypted before storage.
            </div>
          )}
          <textarea
            rows={5}
            value={recordJson}
            onChange={(e) => setRecordJson(e.target.value)}
            placeholder='Record data in JSON format'
          />
        </div>

        <button className="primary-btn" onClick={uploadEncryptedRecord}>
          🔒 Upload Encrypted Record
        </button>

        {(lastCid || lastRecordId) && (
          <div className="upload-result">
            <p><strong>✅ Last Upload Successful!</strong></p>
            <p>Record ID: {lastRecordId || "(see transaction in wallet)"}</p>
            <p>
              CID:{" "}
              <a
                href={`https://ipfs.io/ipfs/${lastCid}`}
                target="_blank"
                rel="noreferrer"
              >
                {lastCid}
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminSide;

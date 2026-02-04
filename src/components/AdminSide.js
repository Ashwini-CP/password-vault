import React, { useState } from "react";
import { getWeb3, getHealthRecordsContract } from "../utils/healthContract";
import {
  randomBytes,
  encryptJsonWithDEK,
  encryptDEKForPublicKey,
} from "../utils/healthCrypto";
import Navigation from "./Navigation";

function AdminSide({ account, chainId, connectWallet, switchToExpectedChain }) {
  // Uploader flow (provider/lab/hospital)
  const [patientAddress, setPatientAddress] = useState("");
  const [recordType, setRecordType] = useState("LAB_RESULT");
  const [recordJson, setRecordJson] = useState('{"summary":"CBC panel","result":"NORMAL"}');
  const [patientEncryptionPublicKey, setPatientEncryptionPublicKey] = useState("");
  const [lastRecordId, setLastRecordId] = useState("");
  const [lastCid, setLastCid] = useState("");

  // Export the current MetaMask account's encryption public key and fill the given setter.
  async function exportEncryptionKeyAndFill(setter) {
    if (!window.ethereum) return alert('MetaMask not detected');
    try {
      // Prefer the account we already have connected in state so the export matches the UI.
      let acct = account;
      if (!acct) {
        // No connected account in state: prompt the wallet to select/connect an account.
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        acct = accounts && accounts[0];
        if (acct) connectWallet(); // Update parent state
      }
      if (!acct) return alert('No account available in MetaMask. Unlock and select an account.');

      // Check currently selected account in MetaMask and warn if it differs
      try {
        const current = (await window.ethereum.request({ method: 'eth_accounts' }))[0];
        if (current && acct && current.toLowerCase() !== acct.toLowerCase()) {
          const proceed = window.confirm(
            `MetaMask currently selected account ${current} differs from the app's account ${acct}.
\nSwitch MetaMask to ${acct} before continuing, or press OK to request the encryption key for ${current} instead.`
          );
          if (!proceed) return;
        }
      } catch (e) {
        // ignore account-check failures
      }

      // Request the encryption public key for the chosen account (MetaMask will prompt).
      const pub = await window.ethereum.request({ method: 'eth_getEncryptionPublicKey', params: [acct] });
      if (typeof setter === 'function') setter(pub);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(pub);
        }
      } catch (e) {
        // ignore copy failures
      }
      alert('Encryption public key copied to clipboard and filled into the field.');
    } catch (err) {
      console.error('exportEncryptionKeyAndFill error', err);
      alert('Could not get encryption public key: ' + (err && (err.message || err)));
    }
  }

  const uploadEncryptedRecord = async () => {
    if (!account) return alert("Connect MetaMask first.");
    if (!patientAddress || !patientAddress.startsWith("0x")) return alert("Enter a patient address.");
    if (!patientEncryptionPublicKey) return alert("Enter patient's encryption public key (from DID/Ceramic).");

    let parsed;
    try {
      parsed = JSON.parse(recordJson);
    } catch {
      return alert("Record JSON is invalid.");
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
      throw new Error("Failed to upload to IPFS: " + (ipfsError.message || ipfsError));
    }

    try {
      // Anchor pointer + integrity hash + patient consent data on-chain.
      const web3 = getWeb3();
      const contract = getHealthRecordsContract(web3);

      // Validate contract is deployed at the configured address.
      const code = await web3.eth.getCode(contract.options.address);
      if (!code || code === '0x') {
        alert(
          `Contract not found at ${contract.options.address}. Did you deploy and restart the frontend so REACT_APP_HEALTH_CONTRACT_ADDRESS is available?`
        );
        return;
      }

      const dataHash = web3.utils.keccak256(enc.ciphertextB64);
      const recordTypeHash = web3.utils.keccak256(recordType);

      const receipt = await contract.methods
        .addRecord(patientAddress, cid, dataHash, recordTypeHash, encryptedDEKForPatientHex)
        .send({ from: account });

      // Pull recordId from emitted event if present; otherwise show tx hash.
      const ev = receipt?.events?.RecordAdded;
      const recordId = ev?.returnValues?.recordId?.toString?.() || "";
      setLastRecordId(recordId);
      alert(`Record anchored on-chain. ${recordId ? `RecordId: ${recordId}` : `Tx: ${receipt.transactionHash}`}`);
    } catch (contractError) {
      console.error('Contract interaction failed:', contractError);
      alert(`Upload/anchor failed: ${contractError?.message || contractError}`);
    }
  };

  return (
    <div className="container">
      <Navigation isAdmin={true} />
      <h1>Admin Side - Healthcare Records (Provider/Uploader)</h1>

      {/* WALLET */}
      <div id="wallet" className="card">
        <h2>Wallet</h2>
        {!account ? (
          <button onClick={connectWallet}>Connect MetaMask</button>
        ) : (
          <p>
            <strong>Connected:</strong> {account}
            <br />
            <small>ChainId: {chainId || "unknown"}</small>
          </p>
        )}
      </div>

      <div id="upload" className="card">
        <h2>Provider Upload (Encrypted record → IPFS → anchored on-chain)</h2>

        <input
          type="text"
          value={patientAddress}
          onChange={(e) => setPatientAddress(e.target.value)}
          placeholder="Patient address (0x...)"
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={patientEncryptionPublicKey}
            onChange={(e) => setPatientEncryptionPublicKey(e.target.value)}
            placeholder="Patient encryption public key (from DID/Ceramic)"
            style={{ flex: 1 }}
          />
          <button onClick={() => exportEncryptionKeyAndFill(setPatientEncryptionPublicKey)}>
            Export my encryption key
          </button>
        </div>
        <small style={{ display: 'block', marginTop: 6, color: '#666' }}>
          Make sure MetaMask is set to the account you want to export; switch accounts in MetaMask before clicking.
        </small>

        <input
          type="text"
          value={recordType}
          onChange={(e) => setRecordType(e.target.value)}
          placeholder='Record type (e.g. "LAB_RESULT")'
        />

        <textarea
          rows={5}
          value={recordJson}
          onChange={(e) => setRecordJson(e.target.value)}
          placeholder='Record JSON (no PHI on-chain; this is encrypted off-chain)'
        />

        <button onClick={uploadEncryptedRecord}>Encrypt + Upload + Anchor</button>

        {(lastCid || lastRecordId) && (
          <p>
            <strong>Last upload</strong>
            <br />
            RecordId: {lastRecordId || "(see tx in wallet)"}
            <br />
            CID:{" "}
            <a
              href={`https://ipfs.io/ipfs/${lastCid}`}
              target="_blank"
              rel="noreferrer"
            >
              {lastCid}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

export default AdminSide;

import React, { useState, useEffect } from "react";
import { getWeb3, getHealthRecordsContract, subscribeToEvents } from "../utils/healthContract";
import Web3 from "web3";
import {
  decryptJsonWithDEK,
  encryptDEKForPublicKey,
  decryptDEKWithWallet,
} from "../utils/healthCrypto";
import { aiCheckAnomaly } from "../utils/aiEngine";
import Navigation from "./Navigation";

function ClientSide({ account, chainId, connectWallet, switchToExpectedChain }) {
  // Patient consent flow
  const [grantRecordId, setGrantRecordId] = useState("");
  const [viewerAddress, setViewerAddress] = useState("");
  const [viewerEncryptionPublicKey, setViewerEncryptionPublicKey] = useState("");
  const [expiresAt, setExpiresAt] = useState(""); // unix seconds or blank

  // View flow (authorized viewer)
  const [viewRecordId, setViewRecordId] = useState("");
  const [viewResult, setViewResult] = useState("");
  const [recordDebug, setRecordDebug] = useState("");
  const [consentStatus, setConsentStatus] = useState("");

  const [anomalyWarning, setAnomalyWarning] = useState("");

  // Real-time audit log
  const [auditLog, setAuditLog] = useState([]);

  // Transaction status feedback
  const [isGranting, setIsGranting] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState("");

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

  useEffect(() => {
    if (account && process.env.REACT_APP_HEALTH_CONTRACT_ADDRESS) {
      // Use localhost Hardhat network for event polling
      const web3 = new Web3('http://127.0.0.1:8545');
      subscribeToEvents(web3, process.env.REACT_APP_HEALTH_CONTRACT_ADDRESS, (eventName, values) => {
        const logEntry = {
          timestamp: new Date().toISOString(),
          event: eventName,
          details: values,
        };
        setAuditLog(prev => [logEntry, ...prev].slice(0, 50)); // Keep last 50 entries
      });
    }
  }, [account]);

  const grantConsent = async () => {
    if (!account) return setTransactionStatus("Error: Connect MetaMask first.");
    if (!grantRecordId) return setTransactionStatus("Error: Enter recordId.");
    if (!viewerAddress || !viewerAddress.startsWith("0x")) return setTransactionStatus("Error: Enter viewer address.");
    if (!viewerEncryptionPublicKey) return setTransactionStatus("Error: Enter viewer encryption public key (from DID/Ceramic).");

    setIsGranting(true);
    setTransactionStatus("Checking for anomalies...");

    const anomaly = aiCheckAnomaly();
    setAnomalyWarning(anomaly);
    if (anomaly === "HIGH RISK") {
      setIsGranting(false);
      return setTransactionStatus("Error: Decryption/encryption blocked due to suspicious activity");
    }

    try {
      setTransactionStatus("Processing consent...");

      const web3 = getWeb3();
      const contract = getHealthRecordsContract(web3);

      // Validate contract exists at address to avoid ABI/decode errors.
      try {
        const code = await web3.eth.getCode(contract.options.address);
        if (!code || code === '0x') {
          throw new Error(`Contract not found at ${contract.options.address}. Check REACT_APP_HEALTH_CONTRACT_ADDRESS and restart the dev server.`);
        }
      } catch (e) {
        console.error('Failed to read contract code', e);
        throw new Error('Failed to verify contract on the node: ' + (e.message || e));
      }

      // Patient decrypts their encrypted DEK, then re-encrypts it to the viewer.
      // Ensure the connected account is the patient for this record (only patient can grant)
      let meta;
      try {
        meta = await contract.methods.getRecord(grantRecordId).call();
      } catch (e) {
        console.error('Failed to read record meta', e);
        throw new Error('Failed to read record metadata: ' + (e.message || e));
      }
      if (!meta || !meta.patient) {
        throw new Error('No record found for id ' + grantRecordId);
      }
      if (meta.patient.toLowerCase() !== account.toLowerCase()) {
        throw new Error(`Connected account ${account} is not the patient for record ${grantRecordId} (patient: ${meta.patient}). Switch MetaMask to the patient account to grant access.`);
      }

      const encryptedDEKForMe = await contract.methods.getEncryptedDEK(grantRecordId).call({ from: account });
      const dek = await decryptDEKWithWallet(encryptedDEKForMe, account);
      const encryptedDEKForViewerHex = encryptDEKForPublicKey(dek, viewerEncryptionPublicKey);

      const expiry = expiresAt ? Number(expiresAt) : 0;

      setTransactionStatus("Sending transaction...");

      await contract.methods
        .grantAccess(grantRecordId, viewerAddress, encryptedDEKForViewerHex, expiry)
        .send({ from: account });

      setTransactionStatus("Success: Consent granted and encrypted key shared on-chain.");
    } catch (e) {
      console.error('grantConsent error', e);
      // Show more details when available
      const detail = e && (e.data || e.error || e.message) ? (e.data || e.error || e.message) : e;
      setTransactionStatus(`Error: Grant failed: ${JSON.stringify(detail)}`);
    } finally {
      setIsGranting(false);
    }
  };

  // Debug helper: fetch and show record metadata for a recordId
  const fetchRecordDebug = async (id) => {
    if (!id) return alert('Enter recordId to fetch');
    try {
      // Use HTTP provider for localhost
      const rpcUrl = 'http://127.0.0.1:8545';
      const localWeb3 = new Web3(rpcUrl);
      const contract = getHealthRecordsContract(localWeb3);
      const meta = await contract.methods.getRecord(id).call();
      // JSON.stringify fails on BigInt; convert BigInt to string for display
      const safe = JSON.stringify(
        meta,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      );
      setRecordDebug(safe);
    } catch (err) {
      console.error('fetchRecordDebug error', err);
      alert('Failed to fetch record: ' + (err && (err.message || JSON.stringify(err))));
    }
  };

  // Check whether a viewer has consent for a record
  const checkConsent = async () => {
    if (!grantRecordId) return alert('Enter RecordId to check');
    if (!viewerAddress) return alert('Enter Viewer address to check');
    try {
      const rpcUrl = 'http://127.0.0.1:8545';
      const localWeb3 = new Web3(rpcUrl);
      const contract = getHealthRecordsContract(localWeb3);
      const ok = await contract.methods.canView(grantRecordId, viewerAddress).call();
      setConsentStatus(ok ? 'YES' : 'NO');
    } catch (err) {
      console.error('checkConsent error', err);
      setConsentStatus('ERROR: ' + (err && (err.message || JSON.stringify(err))));
    }
  };

  const viewRecord = async () => {
    if (!account) return alert("Connect MetaMask first.");
    if (!viewRecordId) return alert("Enter recordId.");

    const anomaly = aiCheckAnomaly();
    setAnomalyWarning(anomaly);
    if (anomaly === "HIGH RISK") {
      alert("Decryption blocked due to suspicious activity");
      return;
    }

    try {
      // Use HTTP provider for localhost
      const rpcUrl = 'http://127.0.0.1:8545';
      const localWeb3 = new Web3(rpcUrl);
      const contract = getHealthRecordsContract(localWeb3);

      // Validate deployment exists
      try {
        const code = await localWeb3.eth.getCode(contract.options.address);
        if (!code || code === '0x') {
          alert(`Contract not found at ${contract.options.address}. Check REACT_APP_HEALTH_CONTRACT_ADDRESS and restart the dev server.`);
          return;
        }
      } catch (e) {
        console.error('Failed to read contract code (testnet)', e);
        alert('Failed to verify contract on the node: ' + (e.message || e));
        return;
      }

      // Read metadata and encrypted DEK using the testnet node but with 'from' set to the connected wallet
      let meta;
      try {
        meta = await contract.methods.getRecord(viewRecordId).call();
      } catch (e) {
        console.error('Failed to read record meta (testnet)', e);
        alert('Failed to read record metadata: ' + (e.message || JSON.stringify(e)));
        return;
      }

      let encryptedDEK;
      try {
        encryptedDEK = await contract.methods.getEncryptedDEK(viewRecordId).call({ from: account });
      } catch (e) {
        console.error('Failed to read encrypted DEK (testnet)', e);
        alert('Failed to read encrypted DEK for this viewer. Ensure viewer has consent: ' + (e.message || JSON.stringify(e)));
        return;
      }

      if (!encryptedDEK || encryptedDEK === '0x') {
        alert('No encrypted DEK available for this viewer (no consent).');
        return;
      }

      // Decrypt DEK via MetaMask (must use wallet)
      let dek;
      try {
        dek = await decryptDEKWithWallet(encryptedDEK, account);
      } catch (e) {
        console.error('eth_decrypt failed', e);
        alert('Decryption via wallet failed: ' + (e && (e.data || e.message || JSON.stringify(e))));
        return;
      }

      // Fetch payload from IPFS and decrypt locally
      const res = await fetch(`https://gateway.pinata.cloud/ipfs/${meta.cid}`);
      const json = await res.json();
      const decrypted = await decryptJsonWithDEK(json.ciphertextB64, json.ivB64, dek);

      setViewResult(JSON.stringify({ meta, decrypted }, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
    } catch (e) {
      console.error('viewRecord error', e);
      const detail = e && (e.data || e.error || e.message) ? (e.data || e.error || e.message) : e;
      alert(`View failed: ${JSON.stringify(detail)}`);
    }
  };

  return (
    <div className="container">
      <Navigation isAdmin={false} />
      <h1>Client Side - Healthcare Records (Patient/Viewer)</h1>

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

      <div id="consent" className="card">
        <h2>Patient Consent (re-encrypt DEK → grant viewer)</h2>

        <input
          type="text"
          placeholder="RecordId"
          value={grantRecordId}
          onChange={(e) => setGrantRecordId(e.target.value)}
        />

        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button onClick={() => fetchRecordDebug(grantRecordId)}>Fetch record</button>
          <button onClick={checkConsent}>Check consent</button>
        </div>

        <input
          type="text"
          placeholder="Viewer address (0x...)"
          value={viewerAddress}
          onChange={(e) => setViewerAddress(e.target.value)}
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Viewer encryption public key (from DID/Ceramic)"
            value={viewerEncryptionPublicKey}
            onChange={(e) => setViewerEncryptionPublicKey(e.target.value)}
            style={{ flex: 1 }}
          />
          <button onClick={() => exportEncryptionKeyAndFill(setViewerEncryptionPublicKey)}>
            Export my encryption key
          </button>
        </div>
        <small style={{ display: 'block', marginTop: 6, color: '#666' }}>
          Make sure MetaMask is set to the account you want to export; switch accounts in MetaMask before clicking.
        </small>

        <input
          type="text"
          placeholder="Expiry unix seconds (optional)"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />

        <button onClick={grantConsent} disabled={isGranting}>
          {isGranting ? "Granting..." : "Grant Access"}
        </button>

        {transactionStatus && (
          <div style={{ marginTop: 12, color: transactionStatus.startsWith("Error") ? "red" : "green" }}>
            <strong>Status:</strong> {transactionStatus}
          </div>
        )}

        {recordDebug && (
          <div style={{ marginTop: 12 }}>
            <h4>Record metadata</h4>
            <pre className="code-box">{recordDebug}</pre>
          </div>
        )}
        {consentStatus && (
          <div style={{ marginTop: 12 }}>
            <strong>Consent:</strong> {consentStatus}
          </div>
        )}

        {anomalyWarning && (
          <p><strong>AI Risk:</strong> {anomalyWarning}</p>
        )}
      </div>

      <div className="card">
        <h2>View Record (authorized viewer)</h2>

        <input
          type="text"
          placeholder="RecordId"
          value={viewRecordId}
          onChange={(e) => setViewRecordId(e.target.value)}
        />

        <button onClick={viewRecord}>
          Fetch + Decrypt
        </button>

        {viewResult && <pre className="code-box">{viewResult}</pre>}
      </div>

      <div className="card">
        <h2>Real-time Audit Log</h2>
        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ccc', padding: '8px' }}>
          {auditLog.length === 0 ? (
            <p>No events yet. Perform actions to see real-time updates.</p>
          ) : (
            auditLog.map((entry, index) => (
              <div key={index} style={{ marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
                <small>{new Date(entry.timestamp).toLocaleString()}</small>
                <br />
                <strong>{entry.event}</strong>
                <pre style={{ fontSize: '12px', margin: '4px 0' }}>
                  {JSON.stringify(entry.details, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default ClientSide;

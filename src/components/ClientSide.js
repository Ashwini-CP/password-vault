import React, { useState, useEffect } from "react";
import { getHealthRecordsContract, subscribeToEvents } from "../utils/healthContract";
import Web3 from "web3";
import {
  decryptJsonWithDEK,
  encryptDEKForPublicKey,
  decryptDEKWithWallet,
} from "../utils/healthCrypto";
import { aiCheckAnomaly } from "../utils/aiEngine";
import Navigation from "./Navigation";
import { useNetwork, useNotification, useTransaction } from "../App";

function ClientSide({ account, chainId, connectWallet, switchToExpectedChain, userRole }) {
  // Get network configuration
  const { getRpcUrl, contractAddress } = useNetwork();
  // Get notification functions
  const { addNotification } = useNotification();
  // Get transaction functions
  const { addTransaction } = useTransaction();

  // Offline mode - cached data
  const [cachedRecords, setCachedRecords] = useState(() => {
    const saved = localStorage.getItem('healthVaultCachedRecords');
    return saved ? JSON.parse(saved) : [];
  });

  // Save cached records to localStorage
  useEffect(() => {
    localStorage.setItem('healthVaultCachedRecords', JSON.stringify(cachedRecords));
  }, [cachedRecords]);
  
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

  // Show help tooltips
  const [showHelp, setShowHelp] = useState({});

  const toggleHelp = (field) => {
    setShowHelp(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Get user-friendly title based on role
  const getTitle = () => {
    if (userRole === 'doctor') {
      return "Doctor Dashboard - View Patient Records";
    }
    return "My Health Records";
  };

  // Get user-friendly description
  const getDescription = () => {
    if (userRole === 'doctor') {
      return "Access and view patient health records that have been shared with you.";
    }
    return "Securely manage and share your health records.";
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

  useEffect(() => {
    if (account && contractAddress) {
      const rpcUrl = getRpcUrl();
      const web3 = new Web3(rpcUrl);
      subscribeToEvents(web3, contractAddress, (eventName, values) => {
        const logEntry = {
          timestamp: new Date().toISOString(),
          event: eventName,
          details: values,
        };
        setAuditLog(prev => [logEntry, ...prev].slice(0, 50));
      });
    }
  }, [account, contractAddress, getRpcUrl]);

  const grantConsent = async () => {
    if (!account) return setTransactionStatus("❌ Please connect your wallet first.");
    if (!grantRecordId) return setTransactionStatus("❌ Please enter the Record ID.");
    if (!viewerAddress || !viewerAddress.startsWith("0x")) return setTransactionStatus("❌ Please enter a valid wallet address.");
    if (!viewerEncryptionPublicKey) return setTransactionStatus("❌ Please enter the recipient's security key.");

    setIsGranting(true);
    setTransactionStatus("🔒 Checking security...");

    const anomaly = aiCheckAnomaly();
    setAnomalyWarning(anomaly);
    if (anomaly === "HIGH RISK") {
      setIsGranting(false);
      return setTransactionStatus("⛔ Security check failed. Please try again later.");
    }

    try {
      setTransactionStatus("📝 Processing your request...");

      const rpcUrl = getRpcUrl();
      const web3 = new Web3(rpcUrl);
      const contract = getHealthRecordsContract(web3);

      try {
        const code = await web3.eth.getCode(contract.options.address);
        if (!code || code === '0x') {
          throw new Error(`Contract not found at ${contract.options.address}. Please check Settings.`);
        }
      } catch (e) {
        console.error('Failed to read contract code', e);
        throw new Error('Could not verify contract. Please check your network settings.');
      }

      let meta;
      try {
        meta = await contract.methods.getRecord(grantRecordId).call();
      } catch (e) {
        console.error('Failed to read record meta', e);
        throw new Error('Could not find this record. Please check the Record ID.');
      }
      if (!meta || !meta.patient) {
        throw new Error('No record found with this ID.');
      }
      if (meta.patient.toLowerCase() !== account.toLowerCase()) {
        throw new Error(`This record belongs to a different wallet. Please switch to the correct account.`);
      }

      const encryptedDEKForMe = await contract.methods.getEncryptedDEK(grantRecordId).call({ from: account });
      const dek = await decryptDEKWithWallet(encryptedDEKForMe, account);
      const encryptedDEKForViewerHex = encryptDEKForPublicKey(dek, viewerEncryptionPublicKey);

      const expiry = expiresAt ? Number(expiresAt) : 0;

      setTransactionStatus("📤 Sending to blockchain...");

      const tx = await contract.methods
        .grantAccess(grantRecordId, viewerAddress, encryptedDEKForViewerHex, expiry)
        .send({ from: account });

      // Add to transaction history
      addTransaction({
        type: '📤 Share Record',
        details: `Shared record ${grantRecordId} with ${viewerAddress.slice(0, 6)}...`,
        hash: tx.transactionHash
      });

      // Show notification
      addNotification('Successfully shared record access!', 'success');

      setTransactionStatus("✅ Success! Access has been granted.");
    } catch (e) {
      console.error('grantConsent error', e);
      const detail = e && (e.data || e.error || e.message) ? (e.data || e.error || e.message) : e;
      setTransactionStatus(`❌ Error: ${typeof detail === 'string' ? detail : 'Something went wrong. Please try again.'}`);
      addNotification('Failed to share record access', 'error');
    } finally {
      setIsGranting(false);
    }
  };

  const fetchRecordDebug = async (id) => {
    if (!id) return alert('Please enter a Record ID');
    try {
      const rpcUrl = getRpcUrl();
      const localWeb3 = new Web3(rpcUrl);
      const contract = getHealthRecordsContract(localWeb3);
      const meta = await contract.methods.getRecord(id).call();
      const safe = JSON.stringify(
        meta,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      );
      setRecordDebug(safe);
    } catch (err) {
      console.error('fetchRecordDebug error', err);
      alert('Could not find this record. Please check the ID.');
    }
  };

  const checkConsent = async () => {
    if (!grantRecordId) return alert('Please enter a Record ID');
    if (!viewerAddress) return alert('Please enter a wallet address');
    try {
      const rpcUrl = getRpcUrl();
      const localWeb3 = new Web3(rpcUrl);
      const contract = getHealthRecordsContract(localWeb3);
      const ok = await contract.methods.canView(grantRecordId, viewerAddress).call();
      setConsentStatus(ok ? '✅ YES - Access Granted' : '❌ NO - No Access');
    } catch (err) {
      console.error('checkConsent error', err);
      setConsentStatus('❌ Error checking permission');
    }
  };

  const viewRecord = async () => {
    if (!account) return alert("Please connect your wallet first.");
    if (!viewRecordId) return alert("Please enter a Record ID.");

    const anomaly = aiCheckAnomaly();
    setAnomalyWarning(anomaly);
    if (anomaly === "HIGH RISK") {
      alert("Security check failed. Please try again later.");
      return;
    }

    try {
      const rpcUrl = getRpcUrl();
      const localWeb3 = new Web3(rpcUrl);
      const contract = getHealthRecordsContract(localWeb3);

      try {
        const code = await localWeb3.eth.getCode(contract.options.address);
        if (!code || code === '0x') {
          alert(`Contract not found. Please check Settings.`);
          return;
        }
      } catch (e) {
        console.error('Failed to read contract code', e);
        alert('Could not verify contract. Please check network settings.');
        return;
      }

      let meta;
      try {
        meta = await contract.methods.getRecord(viewRecordId).call();
      } catch (e) {
        console.error('Failed to read record meta', e);
        alert('Could not find this record. Please check the ID.');
        return;
      }

      let encryptedDEK;
      try {
        encryptedDEK = await contract.methods.getEncryptedDEK(viewRecordId).call({ from: account });
      } catch (e) {
        console.error('Failed to read encrypted DEK', e);
        alert('You do not have permission to view this record.');
        return;
      }

      if (!encryptedDEK || encryptedDEK === '0x') {
        alert('No access granted for this record.');
        return;
      }

      let dek;
      try {
        dek = await decryptDEKWithWallet(encryptedDEK, account);
      } catch (e) {
        console.error('eth_decrypt failed', e);
        alert('Could not decrypt. Please make sure you have permission.');
        return;
      }

      const res = await fetch(`https://gateway.pinata.cloud/ipfs/${meta.cid}`);
      const json = await res.json();
      const decrypted = await decryptJsonWithDEK(json.ciphertextB64, json.ivB64, dek);

      const result = JSON.stringify({ meta, decrypted }, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
      setViewResult(result);

      // Cache the record for offline viewing
      const cachedRecord = {
        id: viewRecordId,
        data: result,
        timestamp: new Date().toISOString()
      };
      setCachedRecords(prev => {
        const filtered = prev.filter(r => r.id !== viewRecordId);
        return [cachedRecord, ...filtered].slice(0, 10); // Keep last 10 records
      });

      // Add to transaction history
      addTransaction({
        type: '📥 View Record',
        details: `Viewed record ${viewRecordId}`,
        hash: ''
      });

      // Show notification
      addNotification('Record loaded successfully!', 'success');
    } catch (e) {
      console.error('viewRecord error', e);
      const detail = e && (e.data || e.error || e.message) ? (e.data || e.error || e.message) : e;
      alert(`Could not load record: ${typeof detail === 'string' ? detail : 'Please try again.'}`);
      addNotification('Failed to load record', 'error');
    }
  };

  return (
    <div className="container">
      <Navigation isAdmin={false} />
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

      {/* SHARE RECORDS - Only show for patients */}
      {userRole === 'patient' && (
        <div id="consent" className="card">
          <div className="card-header">
            <h2>📤 Share My Records</h2>
            <button 
              className="help-btn" 
              onClick={() => toggleHelp('share')}
              title="Learn more"
            >
              ❓
            </button>
          </div>
          
          {showHelp.share && (
            <div className="help-box">
              <p><strong>How to share your records:</strong></p>
              <ol>
                <li>Enter the Record ID you want to share</li>
                <li>Enter the wallet address of the person you want to share with</li>
                <li>Get their security key (they can click "Get My Key" to copy it)</li>
                <li>Click "Share Access" to grant permission</li>
              </ol>
            </div>
          )}

          <div className="form-group">
            <label>Record ID 📋</label>
            <input
              type="text"
              placeholder="Enter the record ID you want to share"
              value={grantRecordId}
              onChange={(e) => setGrantRecordId(e.target.value)}
            />
          </div>

          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button className="secondary-btn" onClick={() => fetchRecordDebug(grantRecordId)}>
              🔍 Verify Record
            </button>
            <button className="secondary-btn" onClick={checkConsent}>
              ✓ Check Permission
            </button>
          </div>

          <div className="form-group">
            <label>Share with 👤</label>
            <input
              type="text"
              placeholder="Wallet address (e.g., 0x...)"
              value={viewerAddress}
              onChange={(e) => setViewerAddress(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>
              Their Security Key 🔐
              <button 
                className="inline-help-btn" 
                onClick={() => toggleHelp('key')}
                title="What is this?"
              >
                ℹ️
              </button>
            </label>
            {showHelp.key && (
              <div className="help-text">
                Ask the person you want to share with to click "Get My Key" and paste it here. This ensures only they can access your records.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Paste their security key here"
                value={viewerEncryptionPublicKey}
                onChange={(e) => setViewerEncryptionPublicKey(e.target.value)}
                style={{ flex: 1 }}
              />
              <button onClick={() => exportEncryptionKeyAndFill(setViewerEncryptionPublicKey)}>
                📋 Get My Key
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Expiration (optional) 📅</label>
            <input
              type="text"
              placeholder="Leave blank for unlimited access"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          <button className="primary-btn" onClick={grantConsent} disabled={isGranting}>
            {isGranting ? "⏳ Processing..." : "✅ Share Access"}
          </button>

          {transactionStatus && (
            <div className={`status-message ${transactionStatus.startsWith("✅") ? "success" : "error"}`}>
              {transactionStatus}
            </div>
          )}

          {recordDebug && (
            <div style={{ marginTop: 12 }}>
              <h4>Record Details</h4>
              <pre className="code-box">{recordDebug}</pre>
            </div>
          )}
          {consentStatus && (
            <div className="consent-status">
              <strong>Permission:</strong> {consentStatus}
            </div>
          )}

          {anomalyWarning && (
            <p className="warning">⚠️ <strong>Security Alert:</strong> {anomalyWarning}</p>
          )}
        </div>
      )}

      {/* VIEW RECORDS */}
      <div className="card">
        <div className="card-header">
          <h2>📥 Access Health Data</h2>
          <button 
            className="help-btn" 
            onClick={() => toggleHelp('view')}
            title="Learn more"
          >
            ❓
          </button>
        </div>

        {showHelp.view && (
          <div className="help-box">
            <p><strong>How to view records:</strong></p>
            <ol>
              <li>Enter the Record ID shared with you</li>
              <li>Click "View Record" to decrypt and display</li>
            </ol>
          </div>
        )}

        <div className="form-group">
          <label>Record ID 📋</label>
          <input
            type="text"
            placeholder="Enter the record ID to view"
            value={viewRecordId}
            onChange={(e) => setViewRecordId(e.target.value)}
          />
        </div>

        <button className="primary-btn" onClick={viewRecord}>
          🔓 View Record
        </button>

        {viewResult && <pre className="code-box">{viewResult}</pre>}
      </div>

      {/* ACTIVITY HISTORY */}
      <div className="card">
        <div className="card-header">
          <h2>📜 Activity History</h2>
          <button 
            className="help-btn" 
            onClick={() => toggleHelp('history')}
            title="Learn more"
          >
            ❓
          </button>
        </div>

        {showHelp.history && (
          <div className="help-text">
            This shows a log of all activities related to your health records, including when records were shared or accessed.
          </div>
        )}

        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ccc', padding: '8px' }}>
          {auditLog.length === 0 ? (
            <p className="empty-state">No activity yet. Your actions will appear here.</p>
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

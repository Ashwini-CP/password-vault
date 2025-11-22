import React, { useState, useEffect } from 'react';
import './App.css';

import { encryptData, decryptData } from './utils/encryption';
import { aiEvaluateStrength, aiSuggestPassword, aiCheckAnomaly } from './utils/aiEngine';

function App() {
  const [account, setAccount] = useState('');
  const [input, setInput] = useState('');
  const [encrypted, setEncrypted] = useState('');
  const [decrypted, setDecrypted] = useState('');
  const [cid, setCid] = useState('');
  const [fetchedEncrypted, setFetchedEncrypted] = useState('');

  const [strength, setStrength] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [anomalyWarning, setAnomalyWarning] = useState('');

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('MetaMask not detected! Please install it.');
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      setAccount(accounts[0]);
    } catch (error) {
      console.error('MetaMask connection denied', error);
    }
  };

  useEffect(() => {
    const autoConnect = async () => {
      if (!window.ethereum) return;

      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) setAccount(accounts[0]);
    };
    autoConnect();
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);

    const analysis = aiEvaluateStrength(value);
    setStrength(analysis.strength);
    setSuggestion(analysis.suggestion);
  };

  const generateAIpassword = () => {
    const generated = aiSuggestPassword();
    setInput(generated);

    const analysis = aiEvaluateStrength(generated);
    setStrength(analysis.strength);
    setSuggestion(analysis.suggestion);
  };

  const handleEncrypt = async () => {
    if (!input.trim()) {
      alert("Enter a password first!");
      return;
    }

    const encryptedText = encryptData({ password: input });
    setEncrypted(encryptedText);

    try {
      const blob = new Blob(
        [JSON.stringify({ vault: encryptedText })],
        { type: 'application/json' }
      );

      const formData = new FormData();
      formData.append('file', blob, 'vault.json');

      const res = await fetch(`https://api.pinata.cloud/pinning/pinFileToIPFS`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.REACT_APP_PINATA_JWT}`
        },
        body: formData,
      });

      const data = await res.json();
      setCid(data.IpfsHash);

    } catch (error) {
      console.error("IPFS upload failed:", error);
    }
  };

  const fetchFromIPFS = async () => {
    if (!cid.trim()) {
      alert("Enter a CID first!");
      return;
    }

    try {
      const res = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
      const json = await res.json();
      setFetchedEncrypted(json.vault);
    } catch (error) {
      console.error("Fetching IPFS data failed:", error);
    }
  };

  const decryptHandler = () => {
    try {
      const source = encrypted || fetchedEncrypted;
      if (!source) {
      alert("No encrypted data available!");
        return;
      }

      const anomaly = aiCheckAnomaly();
      setAnomalyWarning(anomaly);

      if (anomaly === "HIGH RISK") {
        alert("⚠ Suspicious activity detected! Decryption blocked.");
        return;
      }

      const decryptedText = decryptData(source);
      setDecrypted(decryptedText.password);
    } catch (error) {
      console.error("Decrypt failed:", error);
    }
  };

  return (
    <div className="container">

      <h1>🔐 AI-Powered Decentralized Password Vault</h1>

      {/* WALLET CARD */}
      <div className="card">
        <h2 className="section-title">Wallet Connection</h2>

        {!account ? (
          <button onClick={connectWallet}>Connect MetaMask</button>
        ) : (
          <p><strong>Connected:</strong> {account}</p>
        )}
      </div>

      {/* CREATE PASSWORD CARD */}
      <div className="card">
        <h2 className="section-title">Create New Password</h2>

        <input 
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Enter password"
        />

        {/* Strength badge */}
        {strength && (
          <p>
            Strength:  
            <span className={
              strength === "Strong" ? "badge badge-strong" :
              strength === "Medium" ? "badge badge-medium" :
              "badge badge-weak"
            }>
              {strength}
            </span>
            <br />
            <small>{suggestion}</small>
          </p>
        )}

        <button onClick={generateAIpassword}>
          🤖 Generate AI Strong Password
        </button>

        <button onClick={handleEncrypt}>
          Encrypt & Upload to IPFS
        </button>

        {encrypted && (
          <div className="code-box">
            {encrypted}
          </div>
        )}

        {cid && (
          <p>
            <strong>CID:</strong>
            <br />
            <a className="link" href={`https://gateway.pinata.cloud/ipfs/${cid}`} target="_blank" rel="noreferrer">
              {cid}
            </a>
          </p>
        )}
      </div>

      {/* FETCH CARD */}
      <div className="card">
        <h2 className="section-title">Fetch Stored Password</h2>

        <input 
          type="text"
          placeholder="Enter CID"
          value={cid}
          onChange={(e) => setCid(e.target.value)}
        />

        <button onClick={fetchFromIPFS}>Fetch</button>

        {fetchedEncrypted && (
          <div className="code-box">{fetchedEncrypted}</div>
        )}

        <button onClick={decryptHandler}>Decrypt</button>

        {anomalyWarning && (
          <p><strong>AI Risk:</strong> {anomalyWarning}</p>
        )}

        {decrypted && (
          <p><strong>Decrypted Password:</strong> {decrypted}</p>
        )}
      </div>

    </div>
  );
}

export default App;

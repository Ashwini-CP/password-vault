import React, { useState, useEffect } from "react";
import "./App.css";

import { encryptData, decryptData } from "./utils/encryption";
import {
  aiEvaluateStrength,
  aiSuggestPassword,
  aiCheckAnomaly,
} from "./utils/aiEngine";

function App() {
  const [account, setAccount] = useState("");

  const [input, setInput] = useState("");
  const [encrypted, setEncrypted] = useState("");
  const [decrypted, setDecrypted] = useState("");

  const [cid, setCid] = useState("");          // generated CID
  const [inputCid, setInputCid] = useState(""); // user-entered CID
  const [fetchedEncrypted, setFetchedEncrypted] = useState("");

  const [strength, setStrength] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [anomalyWarning, setAnomalyWarning] = useState("");

  /* ---------------- WALLET ---------------- */

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("MetaMask not detected!");
      return;
    }

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    setAccount(accounts[0]);
  };

  useEffect(() => {
    const autoConnect = async () => {
      if (!window.ethereum) return;
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });
      if (accounts.length > 0) setAccount(accounts[0]);
    };
    autoConnect();
  }, []);

  /* ---------------- AI PASSWORD ---------------- */

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);

    const analysis = aiEvaluateStrength(value);
    setStrength(analysis.strength);
    setSuggestion(analysis.suggestion);
  };

  const generateAIpassword = () => {
    const pwd = aiSuggestPassword();
    setInput(pwd);

    const analysis = aiEvaluateStrength(pwd);
    setStrength(analysis.strength);
    setSuggestion(analysis.suggestion);
  };

  /* ---------------- IPFS UPLOAD ---------------- */

  const handleEncrypt = async () => {
  if (!input || input.trim() === "") {
    alert("Enter a password first!");
    return;
  }

  // Encrypt locally first
  const encryptedText = encryptData({ password: input });
  setEncrypted(encryptedText);

  try {
    // Prepare payload for Pinata
    const payload = {
      pinataContent: {
        vault: encryptedText,
        createdAt: new Date().toISOString(),
        app: "AI-Decentralized-Password-Vault",
      },
    };

    console.log("Uploading to Pinata with payload:", payload);

    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.REACT_APP_PINATA_JWT}`,
      },
      body: JSON.stringify(payload),
    });

    // Parse response safely
    let data;
    try {
      data = await res.json();
    } catch (jsonErr) {
      const text = await res.text();
      console.error("Pinata response is not JSON:", text);
      throw new Error("Failed to parse Pinata response as JSON");
    }

    console.log("Pinata response:", data);

    // Check for IpfsHash
    if (!data.IpfsHash) {
      console.error("Pinata response missing IpfsHash:", data);
      throw new Error("CID not returned from Pinata");
    }

    // Success: set CID state
    setCid(data.IpfsHash);
    alert("Successfully uploaded! CID: " + data.IpfsHash);
  } catch (error) {
    console.error("IPFS upload failed:", error);
    alert("IPFS upload failed. Check console for details.");
  }
};

  /* ---------------- IPFS FETCH ---------------- */

  const fetchFromIPFS = async () => {
    if (!inputCid || inputCid.length < 10) {
      alert("Enter a valid CID!");
      return;
    }

    try {
      const res = await fetch(
        `https://gateway.pinata.cloud/ipfs/${inputCid}`
      );
      const json = await res.json();
      setFetchedEncrypted(json.vault);
    } catch (error) {
      console.error("Fetching from IPFS failed:", error);
      alert("Unable to fetch from IPFS");
    }
  };

  /* ---------------- DECRYPT ---------------- */

  const decryptHandler = () => {
    const source = encrypted || fetchedEncrypted;
    if (!source) {
      alert("No encrypted data available!");
      return;
    }

    const anomaly = aiCheckAnomaly();
    setAnomalyWarning(anomaly);

    if (anomaly === "HIGH RISK") {
      alert("⚠ Decryption blocked due to suspicious activity");
      return;
    }

    const decryptedText = decryptData(source);
    setDecrypted(decryptedText.password);
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="container">
      <h1>🔐 AI-Powered Decentralized Password Vault</h1>

      {/* WALLET */}
      <div className="card">
        <h2>Wallet</h2>
        {!account ? (
          <button onClick={connectWallet}>Connect MetaMask</button>
        ) : (
          <p><strong>Connected:</strong> {account}</p>
        )}
      </div>

      {/* CREATE */}
      <div className="card">
        <h2>Create Password</h2>

        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Enter password"
        />

        {strength && (
          <p>
            Strength:
            <span className={`badge badge-${strength.toLowerCase()}`}>
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

        {encrypted && <div className="code-box">{encrypted}</div>}

        {cid && (
          <p>
            <strong>IPFS CID:</strong><br />
            <a
              href={`https://ipfs.io/ipfs/${cid}`}
              target="_blank"
              rel="noreferrer"
            >
              {cid}
            </a>
          </p>
        )}
      </div>

      {/* FETCH */}
      <div className="card">
        <h2>Fetch Stored Vault</h2>

        <input
          type="text"
          placeholder="Enter CID"
          value={inputCid}
          onChange={(e) => setInputCid(e.target.value)}
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

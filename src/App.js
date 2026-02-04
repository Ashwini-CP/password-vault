import React, { useState, useEffect } from "react";
import "./App.css";

import ClientSide from "./components/ClientSide";
import AdminSide from "./components/AdminSide";

function App() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert(
        "MetaMask not detected! Please install or enable the MetaMask browser extension and reload this page."
      );
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (!accounts || accounts.length === 0) {
        alert('No accounts returned from wallet. Unlock MetaMask and try again.');
        return;
      }
      setAccount(accounts[0]);

      let cid = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(cid);


    } catch (err) {
      console.error('connectWallet error', err);
      alert('Wallet connection failed: ' + (err && (err.message || err)));
    }
  };

  const switchToExpectedChain = async () => {
    if (!window.ethereum) return alert('MetaMask not detected');
    const expectedChain = process.env.REACT_APP_NETWORK_CHAIN_ID || '0x7a69'; // Local Hardhat network
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: expectedChain }],
      });
      setChainId(expectedChain);
      alert('Switched MetaMask to Local Network.');
    } catch (err) {
      if (err && (err.code === 4902 || /Unrecognized chain/i.test(err.message || ''))) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: expectedChain,
                chainName: 'Local Hardhat Network',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['http://127.0.0.1:8545'],
                blockExplorerUrls: [],
              },
            ],
          });
          setChainId(expectedChain);
          alert('Added and switched to Local Network.');
        } catch (addError) {
          console.warn('Failed to add chain to wallet', addError);
          alert('Failed to add Local Network to MetaMask: ' + (addError.message || addError));
        }
      } else {
        console.warn('Failed to switch chain', err);
        alert('Failed to switch MetaMask chain: ' + (err.message || err));
      }
    }
  };

  useEffect(() => {
    const autoConnect = async () => {
      if (!window.ethereum) return;
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });
      if (accounts.length > 0) setAccount(accounts[0]);
      const cid = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(cid);
    };
    autoConnect();

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          setAccount("");
        }
      });

      // Listen for chain changes
      window.ethereum.on('chainChanged', (chainId) => {
        setChainId(chainId);
        // Reload the page to avoid issues with chain changes
        window.location.reload();
      });
    }

    // Cleanup listeners on unmount
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', () => {});
        window.ethereum.removeListener('chainChanged', () => {});
      }
    };
  }, []);



  return (
    <div className="container">
      {process.env.REACT_APP_SIDE === 'client' ? (
        <ClientSide account={account} chainId={chainId} connectWallet={connectWallet} switchToExpectedChain={switchToExpectedChain} />
      ) : (
        <AdminSide account={account} chainId={chainId} connectWallet={connectWallet} switchToExpectedChain={switchToExpectedChain} />
      )}
    </div>
  );
}

export default App;

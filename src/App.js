import React, { useState, useEffect, createContext, useContext } from "react";
import "./App.css";

import ClientSide from "./components/ClientSide";
import AdminSide from "./components/AdminSide";

// Network configuration context
const NetworkContext = createContext();

// Notification context
const NotificationContext = createContext();

// Transaction history context
const TransactionContext = createContext();

// Network configurations
const NETWORK_CONFIGS = {
  local: {
    id: '0x7a69',
    name: 'Local Hardhat',
    rpcUrl: 'http://127.0.0.1:8545',
    chainId: 31337,
    explorer: ''
  },
  sepolia: {
    id: '0xaa36a7',
    name: 'Sepolia Testnet',
    rpcUrl: 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
    chainId: 11155111,
    explorer: 'https://sepolia.etherscan.io'
  },
  amoy: {
    id: '0x13882',
    name: 'Polygon Amoy',
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    chainId: 80002,
    explorer: 'https://amoy.polygonscan.com'
  },
  mainnet: {
    id: '0x1',
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
    chainId: 1,
    explorer: 'https://etherscan.io'
  }
};

function NetworkProvider({ children }) {
  const [selectedNetwork, setSelectedNetwork] = useState('local');
  const [contractAddress, setContractAddress] = useState(
    process.env.REACT_APP_HEALTH_CONTRACT_ADDRESS || ''
  );
  const [customRpcUrl, setCustomRpcUrl] = useState('');

  const currentNetwork = NETWORK_CONFIGS[selectedNetwork];
  
  const getRpcUrl = () => {
    if (customRpcUrl) return customRpcUrl;
    return currentNetwork.rpcUrl;
  };

  const value = {
    selectedNetwork,
    setSelectedNetwork,
    currentNetwork,
    contractAddress,
    setContractAddress,
    customRpcUrl,
    setCustomRpcUrl,
    getRpcUrl,
    NETWORK_CONFIGS
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type, timestamp: new Date() }]);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

function TransactionProvider({ children }) {
  const [transactions, setTransactions] = useState(() => {
    // Load from localStorage for offline mode
    const saved = localStorage.getItem('healthVaultTransactions');
    return saved ? JSON.parse(saved) : [];
  });

  // Save to localStorage whenever transactions change
  useEffect(() => {
    localStorage.setItem('healthVaultTransactions', JSON.stringify(transactions));
  }, [transactions]);

  const addTransaction = (tx) => {
    const newTx = {
      id: Date.now(),
      ...tx,
      timestamp: new Date().toISOString()
    };
    setTransactions(prev => [newTx, ...prev].slice(0, 100)); // Keep last 100 transactions
  };

  const clearTransactions = () => {
    setTransactions([]);
    localStorage.removeItem('healthVaultTransactions');
  };

  return (
    <TransactionContext.Provider value={{ transactions, addTransaction, clearTransactions }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

export function useTransaction() {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error('useTransaction must be used within a TransactionProvider');
  }
  return context;
}

// Determine if this is the admin/host system based on environment variable
const isAdminHost = process.env.REACT_APP_SIDE === 'admin';

function App() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  // For admin/host system, default to provider role; for clients, default to patient
  const [userRole, setUserRole] = useState(isAdminHost ? "provider" : "patient"); 
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);

  const { selectedNetwork, setSelectedNetwork, currentNetwork, contractAddress, setContractAddress, customRpcUrl, setCustomRpcUrl, getRpcUrl, NETWORK_CONFIGS } = useNetwork();
  const { notifications, removeNotification } = useNotification();
  const { transactions, clearTransactions } = useTransaction();

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
    const expectedChain = currentNetwork.id;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: expectedChain }],
      });
      setChainId(expectedChain);
      alert(`Switched to ${currentNetwork.name}.`);
    } catch (err) {
      if (err && (err.code === 4902 || /Unrecognized chain/i.test(err.message || ''))) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: expectedChain,
                chainName: currentNetwork.name,
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: [getRpcUrl()],
                blockExplorerUrls: currentNetwork.explorer ? [currentNetwork.explorer] : [],
              },
            ],
          });
          setChainId(expectedChain);
          alert(`Added and switched to ${currentNetwork.name}.`);
        } catch (addError) {
          console.warn('Failed to add chain to wallet', addError);
          alert('Failed to add network to MetaMask: ' + (addError.message || addError));
        }
      } else {
        console.warn('Failed to switch chain', err);
        alert('Failed to switch network: ' + (err.message || err));
      }
    }
  };

  // Listen for chain changes from MetaMask and update network selection
  useEffect(() => {
    const updateNetworkFromChain = async () => {
      if (!window.ethereum) return;
      const cid = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(cid);
      
      // Find matching network config
      for (const [key, config] of Object.entries(NETWORK_CONFIGS)) {
        if (config.id === cid) {
          setSelectedNetwork(key);
          break;
        }
      }
    };

    const autoConnect = async () => {
      if (!window.ethereum) return;
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });
      if (accounts.length > 0) setAccount(accounts[0]);
      await updateNetworkFromChain();
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

  // Role selection UI
  const renderRoleSelector = () => (
    <div className="role-selector">
      <label>I'm a:</label>
      <div className="role-buttons">
        <button 
          className={userRole === 'patient' ? 'active' : ''} 
          onClick={() => setUserRole('patient')}
        >
          👤 Patient
        </button>
        <button 
          className={userRole === 'doctor' ? 'active' : ''} 
          onClick={() => setUserRole('doctor')}
        >
          🩺 Doctor
        </button>
        <button 
          className={userRole === 'provider' ? 'active' : ''} 
          onClick={() => setUserRole('provider')}
        >
          🏥 Healthcare Provider
        </button>
      </div>
    </div>
  );

  // Network selector UI
  const renderNetworkSelector = () => (
    <div className="network-selector">
      <label>Network:</label>
      <select 
        value={selectedNetwork} 
        onChange={(e) => setSelectedNetwork(e.target.value)}
      >
        {Object.entries(NETWORK_CONFIGS).map(([key, config]) => (
          <option key={key} value={key}>{config.name}</option>
        ))}
        <option value="custom">Custom RPC</option>
      </select>
      
      {selectedNetwork === 'custom' && (
        <input
          type="text"
          placeholder="Enter RPC URL (e.g., https://...)"
          className="custom-rpc-input"
          onChange={(e) => setCustomRpcUrl(e.target.value)}
        />
      )}
    </div>
  );

  // Contract address configuration UI
  const renderContractConfig = () => (
    <div className="contract-config">
      <label>Contract Address:</label>
      <input
        type="text"
        placeholder="Enter contract address (0x...)"
        value={contractAddress}
        onChange={(e) => setContractAddress(e.target.value)}
        className="contract-address-input"
      />
    </div>
  );

  // Settings panel
  const renderSettings = () => (
    <div className="settings-panel">
      <h3>⚙️ Settings</h3>
      {renderNetworkSelector()}
      {renderContractConfig()}
      <button className="settings-close-btn" onClick={() => setShowSettings(false)}>
        Close Settings
      </button>
    </div>
  );

  // Notification panel
  const renderNotifications = () => (
    <div className={`notification-panel ${showNotifications ? 'open' : ''}`}>
      <div className="notification-header">
        <h3>🔔 Notifications</h3>
        <button className="close-btn" onClick={() => setShowNotifications(false)}>×</button>
      </div>
      <div className="notification-list">
        {notifications.length === 0 ? (
          <p className="empty-state">No notifications</p>
        ) : (
          notifications.map(n => (
            <div key={n.id} className={`notification-item ${n.type}`}>
              <span>{n.message}</span>
              <button onClick={() => removeNotification(n.id)}>×</button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Transaction history panel
  const renderTransactionHistory = () => (
    <div className={`transaction-panel ${showTransactionHistory ? 'open' : ''}`}>
      <div className="transaction-header">
        <h3>📜 Transaction History</h3>
        <div className="transaction-actions">
          <button className="clear-btn" onClick={clearTransactions}>Clear All</button>
          <button className="close-btn" onClick={() => setShowTransactionHistory(false)}>×</button>
        </div>
      </div>
      <div className="transaction-list">
        {transactions.length === 0 ? (
          <p className="empty-state">No transactions yet</p>
        ) : (
          transactions.map(tx => (
            <div key={tx.id} className="transaction-item">
              <div className="tx-type">{tx.type}</div>
              <div className="tx-details">{tx.details}</div>
              <div className="tx-time">{new Date(tx.timestamp).toLocaleString()}</div>
              {tx.hash && (
                <a href={`${currentNetwork.explorer}/tx/${tx.hash}`} target="_blank" rel="noreferrer" className="tx-link">
                  View on Explorer
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="app-container">
      {/* Header with role selection and settings */}
      <header className="app-header">
        <div className="header-left">
          <h1>🏥 Health Vault</h1>
          <span className="tagline">Your Health Records, Secured</span>
        </div>
        <div className="header-right">
          <button 
            className="icon-btn" 
            onClick={() => setShowNotifications(!showNotifications)}
            title="Notifications"
          >
            🔔{notifications.length > 0 && <span className="badge">{notifications.length}</span>}
          </button>
          <button 
            className="icon-btn" 
            onClick={() => setShowTransactionHistory(!showTransactionHistory)}
            title="Transaction History"
          >
            📜
          </button>
          <button className="settings-btn" onClick={() => setShowSettings(!showSettings)}>
            ⚙️ Settings
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && renderSettings()}

      {/* Notification Panel */}
      {showNotifications && renderNotifications()}

      {/* Transaction History Panel */}
      {showTransactionHistory && renderTransactionHistory()}

      {/* Role Selector */}
      <div className="role-section">
        {renderRoleSelector()}
      </div>

      {/* Main Content */}
      <div className="container">
        {(userRole === 'patient' || userRole === 'doctor') ? (
          <ClientSide 
            account={account} 
            chainId={chainId} 
            connectWallet={connectWallet} 
            switchToExpectedChain={switchToExpectedChain}
            userRole={userRole}
          />
        ) : (
          <AdminSide 
            account={account} 
            chainId={chainId} 
            connectWallet={connectWallet} 
            switchToExpectedChain={switchToExpectedChain}
            userRole={userRole}
          />
        )}
      </div>
    </div>
  );
}

// Wrap App with providers
function AppWrapper() {
  return (
    <NetworkProvider>
      <NotificationProvider>
        <TransactionProvider>
          <App />
        </TransactionProvider>
      </NotificationProvider>
    </NetworkProvider>
  );
}

export default AppWrapper;

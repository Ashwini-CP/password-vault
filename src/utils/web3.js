import Web3 from 'web3';

export function isMetaMaskInstalled() {
  return Boolean(window.ethereum && window.ethereum.isMetaMask);
}

export async function connectWallet() {
  if (!isMetaMaskInstalled()) throw new Error('MetaMask not installed');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  const web3 = new Web3(window.ethereum);
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  return { web3, accounts, chainId };
}

export function createWeb3() {
  if (window.ethereum) return new Web3(window.ethereum);
  return null;
}

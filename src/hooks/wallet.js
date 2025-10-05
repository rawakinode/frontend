// wallet.js - Alternative approach if you need a client object
import { createWalletClient, custom, http } from 'viem';
import { monadTestnet } from 'viem/chains';

// This function should only be called on the client side
export async function getMetaMaskWalletClient() {
  // Check for window.ethereum on the client only
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error("MetaMask not found or not in client environment");
  }

  // Optionally request accounts if needed
  const accounts = await window.ethereum.request({ 
    method: "eth_requestAccounts" 
  });
  const address = accounts[0];

  const client = createWalletClient({
    account: address,
    chain: monadTestnet,
    transport: custom(window.ethereum)
  });

  return {client, address};
}
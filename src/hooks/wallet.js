
import { createWalletClient, custom } from "viem";
import { monadTestnet } from 'viem/chains';

export async function createMetaMaskWalletClient() {
    if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("MetaMask not found (must run in browser)");
    }

    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const address = accounts[0];

    const walletClient = createWalletClient({
        account: address,
        transport: custom(window.ethereum),
        chain: monadTestnet
    });

    return { walletClient, address };
}

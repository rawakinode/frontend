// wallet.js
import 'viem/window';
import { createWalletClient, custom } from "viem";
import { monadTestnet } from 'viem/chains';


export async function createMetaMaskWalletClient() {
    // if (!window.ethereum) throw new Error("MetaMask not found");

    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const address = accounts[0];

    const walletClient = createWalletClient({
        account: address, 
        transport: custom(window.ethereum),
    });

    return { walletClient, address };
}

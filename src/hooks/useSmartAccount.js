import { toMetaMaskSmartAccount, Implementation } from "@metamask/delegation-toolkit";
import { createPublicClient, http, zeroAddress, parseEther } from "viem";
import { createBundlerClient, createPaymasterClient, entryPoint07Address } from "viem/account-abstraction";
import { createPimlicoClient } from "permissionless/clients/pimlico"
import { monadTestnet } from "viem/chains";
import { createMetaMaskWalletClient } from "@/hooks/wallet.js";
import axios from "axios";
import { API_URL } from "@/config/api";
import { getBalances } from "./useMonorail";


export const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http()
});

export const bundlerClient = createBundlerClient({
    client: publicClient,
    paymaster: true,
    transport: http("https://api.pimlico.io/v2/10143/rpc?apikey=pim_iYGAe4x4v8AvhBDiCNmaS2")
});

export const paymasterClient = createPaymasterClient({
    transport: http("https://api.pimlico.io/v2/10143/rpc?apikey=pim_iYGAe4x4v8AvhBDiCNmaS2")
});

export const pimlicoClient = createPimlicoClient({
    chain: monadTestnet,
    entryPoint: {
        address: entryPoint07Address,
        version: "0.7",
    },
    transport: http("https://api.pimlico.io/v2/10143/rpc?apikey=pim_iYGAe4x4v8AvhBDiCNmaS2"),
})

export async function getSmartAccounts(withBalance) {
    try {
        const { walletClient, address } = await createMetaMaskWalletClient();

        let allAccounts = [];
        let initialSalt = "0x0";
        let id = 0;

        while (true) {
            id++;
            console.log('smart account found: ', id);
            
            const smartAccount = await toMetaMaskSmartAccount({
                client: publicClient,
                implementation: Implementation.Hybrid,
                deployParams: [address, [], [], []],
                deploySalt: initialSalt,
                signer: { walletClient }
            });
            const deployStatus = await smartAccount.isDeployed();

            if (deployStatus) {

                if (withBalance) {
                    const response = await getBalances(smartAccount.address, zeroAddress);
                    let monBalance = response;

                    allAccounts.push({
                        id,
                        address: smartAccount.address,
                        monBalance,
                        totalValueUSD: "",
                        salt: initialSalt
                    })
                } else {
                    allAccounts.push({
                        id,
                        address: smartAccount.address,
                        totalValueUSD: "",
                        salt: initialSalt
                    })
                }

                initialSalt = smartAccount.address;

            } else {
                break;
            }
        }
        console.log(allAccounts);

        return allAccounts;

    } catch (error) {
        console.error("Error in getSmartAccounts:", error);
        throw error;
    }
}

export async function deploySmartContract(salt) {
    try {
        const { walletClient, address } = await createMetaMaskWalletClient();
        const smartAccount = await toMetaMaskSmartAccount({
            client: publicClient,
            implementation: Implementation.Hybrid,
            deployParams: [address, [], [], []],
            deploySalt: salt,
            signer: { walletClient }
        });
        const deployStatus = await smartAccount.isDeployed();
        if (deployStatus) {
            return null;
        }

        const gasPrice = await bundlerClient.request({
            method: "pimlico_getUserOperationGasPrice",
            params: [],
        });

        const userOperationHash = await bundlerClient.sendUserOperation({
            account: smartAccount,
            calls: [
                {
                    to: smartAccount.address,
                    value: parseEther("0")
                }
            ],
            maxFeePerGas: gasPrice.standard.maxFeePerGas,
            maxPriorityFeePerGas: gasPrice.standard.maxPriorityFeePerGas,
        });

        return userOperationHash;

    } catch (error) {
        console.log(error);
        return null;
    }
}

export async function importSmartAccountWithSalt(salt) {
    try {
        const { walletClient, address } = await createMetaMaskWalletClient();

        const smartAccount = await toMetaMaskSmartAccount({
            client: publicClient,
            implementation: Implementation.Hybrid,
            deployParams: [address, [], [], []],
            deploySalt: salt,
            signer: { walletClient }
        });

        const deployStatus = await smartAccount.isDeployed();

        if (!deployStatus) {
            return null;
        }

        return smartAccount;

    } catch (error) {
        console.error("Error in getSmartAccounts:", error);
        throw error;
    }
}
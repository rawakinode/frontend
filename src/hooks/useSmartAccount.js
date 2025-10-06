import { toMetaMaskSmartAccount, Implementation } from "@metamask/delegation-toolkit";
import { createPublicClient, http, zeroAddress, parseEther } from "viem";
import { createBundlerClient, createPaymasterClient, entryPoint07Address } from "viem/account-abstraction";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { monadTestnet } from "viem/chains";
import { getBalances } from "./useMonorail";
import { getUserWalletClient } from "./walletClient";

/**
 * Public client for blockchain interactions
 */
export const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http()
});

/**
 * Bundler client for user operation handling
 */
export const bundlerClient = createBundlerClient({
    client: publicClient,
    paymaster: true,
    transport: http("https://api.pimlico.io/v2/10143/rpc?apikey=pim_iYGAe4x4v8AvhBDiCNmaS2")
});

/**
 * Paymaster client for gas sponsorship
 */
export const paymasterClient = createPaymasterClient({
    transport: http("https://api.pimlico.io/v2/10143/rpc?apikey=pim_iYGAe4x4v8AvhBDiCNmaS2")
});

/**
 * Pimlico client for account abstraction services
 */
export const pimlicoClient = createPimlicoClient({
    chain: monadTestnet,
    entryPoint: {
        address: entryPoint07Address,
        version: "0.7",
    },
    transport: http("https://api.pimlico.io/v2/10143/rpc?apikey=pim_iYGAe4x4v8AvhBDiCNmaS2"),
});

/**
 * Retrieves all smart accounts for the current user
 * @param {boolean} withBalance - Whether to include balance information
 * @returns {Promise<Array>} Array of smart account objects
 */
export async function getSmartAccounts(withBalance) {
    const walletClient = await getUserWalletClient();
    const address = walletClient.account?.address;

    if (!address) {
        throw new Error("No wallet address found");
    }

    try {
        const allAccounts = [];
        let currentSalt = "0x0";
        let accountId = 0;

        while (true) {
            accountId++;
            console.log(`Checking smart account ${accountId} with salt:`, currentSalt);

            const smartAccount = await createSmartAccount(walletClient, address, currentSalt);
            const isDeployed = await smartAccount.isDeployed();

            if (!isDeployed) {
                console.log(`No more deployed accounts found. Stopped at account ${accountId - 1}`);
                break;
            }

            const accountData = await buildAccountData(
                accountId, 
                smartAccount, 
                currentSalt, 
                withBalance
            );
            
            allAccounts.push(accountData);
            currentSalt = smartAccount.address;
        }

        console.log(`Found ${allAccounts.length} smart accounts:`, allAccounts);
        return allAccounts;

    } catch (error) {
        console.error("Error retrieving smart accounts:", error);
        throw error;
    }
}

/**
 * Creates a smart account instance
 */
async function createSmartAccount(walletClient, ownerAddress, salt) {
    return await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [ownerAddress, [], [], []],
        deploySalt: salt,
        signer: { walletClient }
    });
}

/**
 * Builds account data object with optional balance information
 */
async function buildAccountData(accountId, smartAccount, salt, withBalance) {
    const baseData = {
        id: accountId,
        address: smartAccount.address,
        salt: salt,
        totalValueUSD: ""
    };

    if (!withBalance) {
        return baseData;
    }

    try {
        const balance = await getBalances(smartAccount.address, zeroAddress);
        return {
            ...baseData,
            monBalance: balance
        };
    } catch (balanceError) {
        console.warn(`Failed to get balance for account ${smartAccount.address}:`, balanceError);
        return baseData;
    }
}

/**
 * Deploys a smart contract wallet with the specified salt
 * @param {string} salt - Salt for smart account deployment
 * @returns {Promise<string|null>} User operation hash or null if already deployed
 */
export async function deploySmartContract(salt) {
    const walletClient = await getUserWalletClient();
    const address = walletClient.account?.address;

    if (!address) {
        throw new Error("No wallet address found");
    }

    try {
        const smartAccount = await createSmartAccount(walletClient, address, salt);
        const isDeployed = await smartAccount.isDeployed();

        if (isDeployed) {
            console.log("Smart account already deployed at address:", smartAccount.address);
            return null;
        }

        console.log("Deploying smart account with salt:", salt);

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

        console.log("User operation sent with hash:", userOperationHash);
        return userOperationHash;

    } catch (error) {
        console.error("Error deploying smart contract:", error);
        throw error;
    }
}

/**
 * Imports an existing smart account using the specified salt
 * @param {string} salt - Salt used for smart account creation
 * @returns {Promise<Object|null>} Smart account instance or null if not deployed
 */
export async function importSmartAccountWithSalt(salt) {
    const walletClient = await getUserWalletClient();
    const address = walletClient.account?.address;

    if (!address) {
        throw new Error("No wallet address found");
    }

    try {
        const smartAccount = await createSmartAccount(walletClient, address, salt);
        const isDeployed = await smartAccount.isDeployed();

        if (!isDeployed) {
            console.warn(`Smart account with salt ${salt} is not deployed`);
            return null;
        }

        console.log("Successfully imported smart account:", smartAccount.address);
        return smartAccount;

    } catch (error) {
        console.error(`Error importing smart account with salt ${salt}:`, error);
        throw error;
    }
}
import { encodeFunctionData, erc20Abi, parseEther, parseUnits, zeroAddress } from "viem";
import { bundlerClient, importSmartAccountWithSalt, pimlicoClient, publicClient } from "./useSmartAccount";
import { monadTestnet } from "viem/chains";
import { Implementation, toMetaMaskSmartAccount } from "@metamask/delegation-toolkit";
import { getUserWalletClient } from "./walletClient";
import { MONORAIL_CONTRACT } from "@/config/contract";

const SWAP_CONTRACT = MONORAIL_CONTRACT;

/**
 * Deposits funds from main wallet to smart account
 * @param {string} to - Smart account address to deposit to
 * @param {number} amount - Amount to deposit
 * @param {string} erc20Address - Token address (zeroAddress for native token)
 * @param {number} decimals - Token decimals
 * @returns {Promise<string|null>} Transaction hash or null if failed
 */
export async function deposit(to, amount, erc20Address, decimals) {
    const walletClient = await getUserWalletClient();

    try {
        if (erc20Address.toLowerCase() === zeroAddress.toLowerCase()) {
            return await depositNativeToken(walletClient, to, amount);
        } else {
            return await depositERC20Token(walletClient, to, amount, erc20Address, decimals);
        }
    } catch (error) {
        console.error("Deposit error:", error);
        return null;
    }
}

/**
 * Deposits native token (ETH) to smart account
 */
async function depositNativeToken(walletClient, to, amount) {
    const tx = await walletClient.sendTransaction({
        to,
        value: parseUnits(amount.toString(), 18),
        chain: monadTestnet
    });
    return tx;
}

/**
 * Deposits ERC20 token to smart account
 */
async function depositERC20Token(walletClient, to, amount, erc20Address, decimals) {
    const tx = await walletClient.writeContract({
        address: erc20Address,
        abi: erc20Abi,
        functionName: "transfer",
        args: [to, parseUnits(amount.toString(), decimals)],
        chain: monadTestnet
    });
    return tx;
}

/**
 * Withdraws funds from smart account to main wallet
 * @param {string} to - Recipient address
 * @param {number} amount - Amount to withdraw
 * @param {string} erc20Address - Token address (zeroAddress for native token)
 * @param {number} decimals - Token decimals
 * @param {string} salt - Smart account salt
 * @returns {Promise<string|null>} Transaction hash or null if failed
 */
export async function withdraw(to, amount, erc20Address, decimals, salt) {
    try {
        const walletClient = await getUserWalletClient();
        const address = walletClient.account?.address;

        if (!address) {
            throw new Error("No wallet address found");
        }

        const smartAccount = await createSmartAccountForWithdrawal(walletClient, to, salt);

        if (erc20Address.toLowerCase() === zeroAddress.toLowerCase()) {
            return await withdrawNativeToken(smartAccount, address, amount);
        } else {
            return await withdrawERC20Token(smartAccount, address, amount, erc20Address, decimals);
        }
    } catch (error) {
        console.error("Withdrawal error:", error);
        return null;
    }
}

/**
 * Creates smart account instance for withdrawal operations
 */
async function createSmartAccountForWithdrawal(walletClient, ownerAddress, salt) {
    return await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [ownerAddress, [], [], []],
        deploySalt: salt,
        signer: { walletClient }
    });
}

/**
 * Withdraws native token from smart account
 */
async function withdrawNativeToken(smartAccount, recipientAddress, amount) {
    const fee = await getGasPrice();
    
    const userOperationHash = await bundlerClient.sendUserOperation({
        account: smartAccount,
        calls: [{
            to: recipientAddress,
            value: parseEther(amount)
        }],
        ...fee
    });

    const { receipt } = await bundlerClient.waitForUserOperationReceipt({ hash: userOperationHash });
    return receipt.transactionHash;
}

/**
 * Withdraws ERC20 token from smart account
 */
async function withdrawERC20Token(smartAccount, recipientAddress, amount, erc20Address, decimals) {
    const fee = await getGasPrice();
    
    const userOperationHash = await bundlerClient.sendUserOperation({
        account: smartAccount,
        calls: [
            {
                to: erc20Address,
                value: 0n,
                data: encodeFunctionData({
                    abi: erc20Abi,
                    functionName: "transfer",
                    args: [recipientAddress, parseUnits(amount, decimals)],
                }),
            },
        ],
        ...fee,
    });

    const { receipt } = await bundlerClient.waitForUserOperationReceipt({ hash: userOperationHash });
    return receipt.transactionHash;
}

/**
 * Gets current gas price for user operations
 */
async function getGasPrice() {
    const userOperationGasPrice = await pimlicoClient.getUserOperationGasPrice();
    return userOperationGasPrice.fast;
}

/**
 * Executes swap from native token to ERC20 token
 * @param {Object} quoteData - Swap quote data
 * @param {string} salt - Smart account salt
 * @returns {Promise<string|null>} Transaction hash or null if failed
 */
export async function swapMonToERC20(quoteData, salt) {
    try {
        const smartAccount = await importSmartAccountWithSalt(salt);
        const fee = await getGasPrice();

        const userOperationHash = await bundlerClient.sendUserOperation({
            account: smartAccount,
            calls: [{
                to: SWAP_CONTRACT,
                value: BigInt(quoteData.input),
                data: quoteData.transaction.data
            }],
            ...fee
        });

        const { receipt } = await bundlerClient.waitForUserOperationReceipt({ hash: userOperationHash });
        return receipt.transactionHash;

    } catch (error) {
        console.error("Swap MON to ERC20 error:", error);
        return null;
    }
}

/**
 * Executes swap from ERC20 token to native token
 * @param {Object} quoteData - Swap quote data
 * @param {string} salt - Smart account salt
 * @returns {Promise<string|null>} Transaction hash or null if failed
 */
export async function swapERC20ToMon(quoteData, salt) {
    try {
        const smartAccount = await importSmartAccountWithSalt(salt);
        const fee = await getGasPrice();

        const userOperationHash = await executeERC20ToNativeSwap(
            smartAccount, 
            quoteData
        );

        const { receipt } = await bundlerClient.waitForUserOperationReceipt({ hash: userOperationHash });
        return receipt.transactionHash;

    } catch (error) {
        console.error("Swap ERC20 to MON error:", error);
        return null;
    }
}

/**
 * Executes ERC20 to native token swap with approval
 */
async function executeERC20ToNativeSwap(smartAccount, quoteData) {
    const approveCallData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [SWAP_CONTRACT, BigInt(quoteData.input)],
    });

    return await bundlerClient.sendUserOperation({
        account: smartAccount,
        calls: [
            {
                to: quoteData.from,
                value: 0n,
                data: approveCallData
            },
            {
                to: SWAP_CONTRACT,
                value: 0n,
                data: quoteData.transaction.data
            },
        ],
        ...(await getGasPrice())
    });
}
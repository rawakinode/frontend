import { encodeFunctionData, erc20Abi, parseEther, parseUnits, zeroAddress } from "viem";
import { bundlerClient, importSmartAccountWithSalt, pimlicoClient, publicClient } from "./useSmartAccount";
import { monadTestnet } from "viem/chains";
import { Implementation, toMetaMaskSmartAccount } from "@metamask/delegation-toolkit";
import { getUserWalletClient } from "./walletClient";

const SWAP_CONTRACT = "0x525b929fcd6a64aff834f4eecc6e860486ced700";

// deposit mon & token from main wallet to smart acoount
export async function deposit(to, amount, erc20Address, decimals) {

    const walletClient = await getUserWalletClient();

    try {
        let txHash;

        if (erc20Address.toLowerCase() == zeroAddress.toLowerCase()) {
            // Native transfer (ETH)
            const tx = await walletClient.sendTransaction({
                to,
                value: parseUnits(amount.toString(), 18),
                chain: monadTestnet
            });
            txHash = tx;
        } else {
            // ERC20 token transfer
            const erc20Contract = {
                address: erc20Address,
                abi: erc20Abi,
                functionName: "transfer",
            };

            const tx = await walletClient.writeContract({
                ...erc20Contract,
                functionName: "transfer",
                args: [to, parseUnits(amount.toString(), decimals)],
                chain: monadTestnet
            });

            txHash = tx;
        }

        return txHash;

    } catch (error) {
        console.error("Deposit error:", error);
        return null;
    }
}

// withdraw mon & token from smart account to main wallet
export async function withdraw(to, amount, erc20Address, decimals, salt) {
    try {

        const walletClient = await getUserWalletClient();

        let txHash;

        const smartAccount = await toMetaMaskSmartAccount({
            client: publicClient,
            implementation: Implementation.Hybrid,
            deployParams: [to, [], [], []],
            deploySalt: salt,
            signer: { walletClient }
        });

        if (erc20Address.toLowerCase() == zeroAddress.toLowerCase()) {

            const userOperationGasPrice = await pimlicoClient.getUserOperationGasPrice();
            const fee = userOperationGasPrice.fast;

            const userOperationHash = await bundlerClient.sendUserOperation({
                account: smartAccount,
                calls: [{
                    to: address,
                    value: parseEther(amount)
                }],
                ...fee
            });

            const { receipt } = await bundlerClient.waitForUserOperationReceipt({ hash: userOperationHash });
            txHash = receipt.transactionHash;

        } else {
            const userOperationGasPrice = await pimlicoClient.getUserOperationGasPrice();
            const fee = userOperationGasPrice.fast;
            const userOperationHash = await bundlerClient.sendUserOperation({
                account: smartAccount,
                calls: [
                    {
                        to: erc20Address,
                        value: 0n,
                        data: encodeFunctionData({
                            abi: erc20Abi,
                            functionName: "transfer",
                            args: [address, parseUnits(amount, decimals)],
                        }),
                    },
                ],
                ...fee,
            });
            const { receipt } = await bundlerClient.waitForUserOperationReceipt({ hash: userOperationHash });
            txHash = receipt.transactionHash;
        }

        return txHash;
    } catch (error) {
        console.log(error);

        return null;
    }
}

export async function swapMonToERC20(quoteData, salt) {
    try {
        const smartAccount = await importSmartAccountWithSalt(salt);

        const userOperationGasPrice = await pimlicoClient.getUserOperationGasPrice();
        const fee = userOperationGasPrice.fast;

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
        const txHash = receipt.transactionHash;

        return txHash;

    } catch (error) {
        console.log(error);
        return null;
    }
}

export async function swapERC20ToMon(quoteData, salt) {
    try {

        const smartAccount = await importSmartAccountWithSalt(salt);

        // Approve erc
        const callData = encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [SWAP_CONTRACT, BigInt(quoteData.input)],
        });

        const userOperationGasPrice = await pimlicoClient.getUserOperationGasPrice();
        const fee = userOperationGasPrice.fast;

        // aprove & send batch
        const userOperationHash = await bundlerClient.sendUserOperation({
            account: smartAccount,
            calls: [
                {
                    to: quoteData.from,
                    value: 0n,
                    data: callData
                },
                {
                    to: SWAP_CONTRACT,
                    value: 0n,
                    data: quoteData.transaction.data
                },

            ],
            ...fee
        });

        const { receipt } = await bundlerClient.waitForUserOperationReceipt({ hash: userOperationHash });
        const txHash = receipt.transactionHash;

        return txHash;

    } catch (error) {
        console.log(error);
        return null;
    }
}

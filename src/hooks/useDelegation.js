import { DELEGATOR_ADDRESS, MONORAIL_AGREGATE, MONORAIL_CONTRACT, DELEGATOR_ADDRESS_PRICE } from "@/config/contract";
import { BalanceChangeType, createDelegation } from "@metamask/delegation-toolkit";
import { importSmartAccountWithSalt } from "./useSmartAccount";
import { encodeFunctionData, erc20Abi, parseUnits, zeroAddress } from "viem";

export async function createSwapDelegation(
    postDelegationData, address, swap_type, quote, salt, date, fromToken, fromAmount, toToken,
    swapLimitExpired, swapLimitToAmount, swapLimitPrice, exchangeRate, settings
) {

    try {

        console.log(exchangeRate);
        console.log(swapLimitPrice); // ini 0 jika tidak ada kenaikan harga dari exchange rate

        console.log(settings);

        console.log(swapLimitExpired);
        console.log(parseUnits(swapLimitToAmount.toString(), toToken.decimals));

        const slippage = settings.slippage;

        // Untuk Schedule Swap
        // waktu eksekusi
        const timestampExecute = date.getTime();
        const timestampExecuteStart = Math.floor(timestampExecute / 1000);

        // initial smart akun dengan salt
        const smartAccount = await importSmartAccountWithSalt(salt);

        // initial data
        let delegationData = {};
        let initialDelegationData = {
            type: swap_type,
            owner_address: address,
            smart_account: smartAccount.address,
            fromToken,
            toToken,
            amount: quote.input,
            amount_formatted: quote.input_formatted,
            slippage
        }

        // Jika tike swap adalah terjadwal
        if (swap_type == "scheduled") {

            // Jika swap Native ke ERC-20
            if (fromToken.address.toLowerCase() == zeroAddress.toLowerCase()) {

                // caveats for swap native to token
                const caveats = [
                    {
                        type: "nativeTokenTransferAmount",
                        maxAmount: BigInt(quote.input)
                    },
                    {
                        type: "limitedCalls",
                        limit: 1,
                    },
                    {
                        type: "allowedTargets",
                        targets: [
                            MONORAIL_CONTRACT,
                        ]
                    },
                    {
                        type: "erc20BalanceChange",
                        tokenAddress: toToken.address,
                        recipient: smartAccount.address,
                        balance: BigInt(quote.min_output),
                        changeType: BalanceChangeType.Increase,
                    },
                    {
                        type: "timestamp",
                        afterThreshold: timestampExecuteStart,
                        beforeThreshold: 0
                    }
                ];

                // Buat delegasi untuk transaksi spesifik
                const delegation = createDelegation({
                    to: DELEGATOR_ADDRESS,
                    from: smartAccount.address,
                    environment: smartAccount.environment,
                    scope: {
                        type: "functionCall",
                        targets: [MONORAIL_CONTRACT],
                        selectors: [MONORAIL_AGREGATE],
                    },
                    caveats
                });

                // Sign in delegasi
                const signature = await smartAccount.signDelegation({
                    delegation,
                })

                const signedSwapDelegation = {
                    ...delegation,
                    signature,
                }

                delegationData = {
                    ...initialDelegationData,
                    output: quote.output,
                    output_formatted: quote.output_formatted,
                    min_output: quote.min_output,
                    min_output_formatted: quote.min_output_formatted,
                    timestampExecute: timestampExecute,
                    swapLimitPrice: "",
                    limitOrderPrice: "",
                    signedSwapDelegation,
                    signedApproveDelegation: {}
                }

            } else {
                // Swap from erc-20 to native or erc-20
                // Get delegation aproved tokenFrom
                const signedApproveDelegation = await createAprovedDelegate(smartAccount, BigInt(quote.input), fromToken.address, swap_type);

                let caveats = [
                    {
                        type: "limitedCalls",
                        limit: 1,
                    },
                    {
                        type: "allowedTargets",
                        targets: [
                            MONORAIL_CONTRACT
                        ]
                    },
                    {
                        type: "timestamp",
                        afterThreshold: timestampExecuteStart,
                        beforeThreshold: 0
                    }
                ];

                if (toToken.address.toLowerCase() == zeroAddress.toLowerCase()) {
                    caveats.push({
                        type: "nativeBalanceChange",
                        recipient: smartAccount.address, // akun smartwallet
                        balance: BigInt(quote.min_output),
                        changeType: BalanceChangeType.Increase,
                    });
                } else {
                    caveats.push({
                        type: "erc20BalanceChange",
                        tokenAddress: toToken.address.toLowerCase(),
                        recipient: smartAccount.address, // akun smartwallet
                        balance: BigInt(quote.min_output),
                        changeType: BalanceChangeType.Increase,
                    });
                }

                // Buat delegasi untuk transaksi spesifik
                const delegation = createDelegation({
                    to: DELEGATOR_ADDRESS,
                    from: smartAccount.address,
                    environment: smartAccount.environment,
                    scope: {
                        type: "functionCall",
                        targets: [MONORAIL_CONTRACT],
                        selectors: [MONORAIL_AGREGATE],
                    },
                    caveats
                });

                // Sign in delegasi
                const signature = await smartAccount.signDelegation({ delegation })
                const signedSwapDelegation = { ...delegation, signature }

                delegationData = {
                    ...initialDelegationData,
                    output: quote.output,
                    output_formatted: quote.output_formatted,
                    min_output: quote.min_output,
                    min_output_formatted: quote.min_output_formatted,
                    timestampExecute: timestampExecute,
                    swapLimitPrice: "",
                    limitOrderPrice: "",
                    signedSwapDelegation,
                    signedApproveDelegation
                }

            }

        }

        if (swap_type == "price") {

            // cek output minimum
            const limitAmount = Number(swapLimitPrice || exchangeRate) * (Number(quote.input_formatted));
            const limitMinAmount = limitAmount - (limitAmount * settings.slippage / 100);
            const minimunLimitAmount = limitMinAmount.toFixed(Number(toToken.decimals));

            console.log('minimum output limit price:', minimunLimitAmount);

            // cek timestamp expired
            const limitPriceExpired = Math.floor(swapLimitExpired.getTime() / 1000);
            

            // Jika swap Native ke ERC-20
            if (fromToken.address.toLowerCase() == zeroAddress.toLowerCase()) {

                // caveats for swap native to token
                const caveats = [
                    // {
                    //     type: "nativeTokenTransferAmount",
                    //     maxAmount: BigInt(quote.input)
                    // },
                    {
                        type: "limitedCalls",
                        limit: 1,
                    },
                    {
                        type: "allowedTargets",
                        targets: [
                            MONORAIL_CONTRACT,
                        ]
                    },
                    {
                        type: "erc20BalanceChange",
                        tokenAddress: toToken.address,
                        recipient: smartAccount.address,
                        balance: parseUnits(minimunLimitAmount.toString(), toToken.decimals),
                        changeType: BalanceChangeType.Increase,
                    },
                    {
                        type: "timestamp",
                        afterThreshold: 0,
                        beforeThreshold: limitPriceExpired
                    }
                ];

                // Buat delegasi untuk transaksi spesifik
                const delegation = createDelegation({
                    to: DELEGATOR_ADDRESS_PRICE,
                    from: smartAccount.address,
                    environment: smartAccount.environment,
                    scope: {
                        type: "functionCall",
                        targets: [MONORAIL_CONTRACT],
                        selectors: [MONORAIL_AGREGATE],
                    },
                    caveats
                });

                // Sign in delegasi
                const signature = await smartAccount.signDelegation({
                    delegation,
                })

                const signedSwapDelegation = {
                    ...delegation,
                    signature,
                }

                delegationData = {
                    ...initialDelegationData,
                    output: parseUnits(swapLimitToAmount.toString(), toToken.decimals).toString(),
                    output_formatted: swapLimitToAmount.toString(),
                    min_output: quote.min_output,
                    min_output_formatted: quote.min_output_formatted,
                    limitOrderPrice: parseUnits(swapLimitToAmount.toString(), toToken.decimals).toString(),
                    timestampExecute: timestampExecute,
                    limitPriceExpired,
                    swapLimitPrice: swapLimitPrice.toString(),
                    signedSwapDelegation,
                    signedApproveDelegation: {}
                }

            } else {
                // Swap from erc-20 to native or erc-20
                // Get delegation aproved tokenFrom
                const signedApproveDelegation = await createAprovedDelegate(smartAccount, BigInt(quote.input), fromToken.address, swap_type);

                if (!signedApproveDelegation) {
                    throw new Error("Failed to Approve");
                }

                const caveats = [
                    // {
                    //     type: "erc20TransferAmount",
                    //     tokenAddress: fromToken.address,
                    //     maxAmount: BigInt(quote.input)
                    // },
                    {
                        type: "limitedCalls",
                        limit: 1,
                    },
                    {
                        type: "allowedTargets",
                        targets: [
                            MONORAIL_CONTRACT,
                        ]
                    },
                    {
                        type: "timestamp",
                        afterThreshold: 0,
                        beforeThreshold: limitPriceExpired
                    }
                ];


                if (toToken.address.toLowerCase() == zeroAddress.toLowerCase()) {
                    caveats.push({
                        type: "nativeBalanceChange",
                        recipient: smartAccount.address, // akun smartwallet
                        balance: parseUnits(minimunLimitAmount.toString(), toToken.decimals),
                        changeType: BalanceChangeType.Increase,
                    });
                } else {
                    caveats.push({
                        type: "erc20BalanceChange",
                        tokenAddress: toToken.address.toLowerCase(),
                        recipient: smartAccount.address, // akun smartwallet
                        balance: parseUnits(minimunLimitAmount.toString(), toToken.decimals),
                        changeType: BalanceChangeType.Increase,
                    });
                }

                // Buat delegasi untuk transaksi spesifik
                const delegation = createDelegation({
                    to: DELEGATOR_ADDRESS_PRICE,
                    from: smartAccount.address,
                    environment: smartAccount.environment,
                    scope: {
                        type: "functionCall",
                        targets: [MONORAIL_CONTRACT],
                        selectors: [MONORAIL_AGREGATE],
                    },
                    caveats
                });

                // Sign in delegasi
                const signature = await smartAccount.signDelegation({
                    delegation,
                })

                const signedSwapDelegation = {
                    ...delegation,
                    signature,
                }

                delegationData = {
                    ...initialDelegationData,
                    output: parseUnits(swapLimitToAmount.toString(), toToken.decimals).toString(),
                    output_formatted: swapLimitToAmount.toString(),
                    min_output: quote.min_output,
                    min_output_formatted: quote.min_output_formatted,
                    limitOrderPrice: parseUnits(swapLimitToAmount.toString(), toToken.decimals).toString(),
                    swapLimitPrice: swapLimitPrice.toString(),
                    timestampExecute: timestampExecute,
                    limitPriceExpired,
                    signedSwapDelegation,
                    signedApproveDelegation
                }

            }
        }

        console.log(delegationData);

        const res = await postDelegationData(delegationData);

        return res;

    } catch (error) {
        console.log(error);
    }
}

async function createAprovedDelegate(smartAccount, fromAmount, fromContract, swapType) {

    try {
        const callData = encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [MONORAIL_CONTRACT, fromAmount],
        });

        const caveats = [
            {
                type: "allowedTargets",
                targets: [fromContract]
            }
        ];

        // Buat delegasi untuk transaksi spesifik
        const delegation = createDelegation({
            to: (swapType == "price" ? DELEGATOR_ADDRESS_PRICE : DELEGATOR_ADDRESS),
            from: smartAccount.address, // smart account kamu
            environment: smartAccount.environment,
            scope: {
                type: "functionCall",
                targets: [fromContract],
                selectors: ["approve(address, uint256)"],
                allowedCalldata: [
                    { startIndex: 0, value: callData } //work, hanya bisa menjalankan call data ini
                ]
            },
            caveats
        });

        // Sign in delegasi
        const signature = await smartAccount.signDelegation({ delegation })
        const signedDelegation = { ...delegation, signature, }
        return signedDelegation;
    } catch (error) {
        console.log(error);
        return null;
    }
}
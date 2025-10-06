import { DELEGATOR_ADDRESS, MONORAIL_AGREGATE, MONORAIL_CONTRACT, DELEGATOR_ADDRESS_PRICE } from "@/config/contract";
import { BalanceChangeType, createDelegation } from "@metamask/delegation-toolkit";
import { importSmartAccountWithSalt } from "./useSmartAccount";
import { encodeFunctionData, erc20Abi, parseUnits, zeroAddress } from "viem";

/**
 * Creates a swap delegation for scheduled or price-based swaps
 * @param {Function} postDelegationData - Function to post delegation data
 * @param {string} address - User's wallet address
 * @param {string} swap_type - Type of swap ('scheduled' or 'price')
 * @param {Object} quote - Swap quote information
 * @param {string} salt - Salt for smart account generation
 * @param {Date} date - Execution date for scheduled swaps
 * @param {Object} fromToken - Source token information
 * @param {string} fromAmount - Amount to swap from
 * @param {Object} toToken - Destination token information
 * @param {Date} swapLimitExpired - Expiration date for limit orders
 * @param {string} swapLimitToAmount - Limit amount for swap
 * @param {string} swapLimitPrice - Limit price for swap
 * @param {string} exchangeRate - Current exchange rate
 * @param {Object} settings - Swap settings including slippage
 * @returns {Promise<Object>} Delegation data response
 */
export async function createSwapDelegation(
    postDelegationData, address, swap_type, quote, salt, date, fromToken, fromAmount, toToken,
    swapLimitExpired, swapLimitToAmount, swapLimitPrice, exchangeRate, settings
) {
    try {
        console.log('Exchange rate:', exchangeRate);
        console.log('Swap limit price:', swapLimitPrice);
        console.log('Settings:', settings);
        console.log('Swap limit expired:', swapLimitExpired);
        console.log('Parsed limit amount:', parseUnits(swapLimitToAmount.toString(), toToken.decimals));

        const slippage = settings.slippage;
        const timestampExecute = date.getTime();
        const timestampExecuteStart = Math.floor(timestampExecute / 1000);
        const smartAccount = await importSmartAccountWithSalt(salt);

        const initialDelegationData = {
            type: swap_type,
            owner_address: address,
            smart_account: smartAccount.address,
            fromToken,
            toToken,
            amount: quote.input,
            amount_formatted: quote.input_formatted,
            slippage
        };

        let delegationData = {};

        if (swap_type === "scheduled") {
            delegationData = await handleScheduledSwap(
                smartAccount,
                initialDelegationData,
                quote,
                fromToken,
                toToken,
                timestampExecuteStart,
                timestampExecute,
                slippage
            );
        } else if (swap_type === "price") {
            delegationData = await handlePriceSwap(
                smartAccount,
                initialDelegationData,
                quote,
                fromToken,
                toToken,
                swapLimitExpired,
                swapLimitToAmount,
                swapLimitPrice,
                exchangeRate,
                settings,
                timestampExecute
            );
        }

        console.log('Final delegation data:', delegationData);
        const res = await postDelegationData(delegationData);
        return res;

    } catch (error) {
        console.error('Error creating swap delegation:', error);
        throw error;
    }
}

/**
 * Handles scheduled swap delegation creation
 */
async function handleScheduledSwap(
    smartAccount,
    initialDelegationData,
    quote,
    fromToken,
    toToken,
    timestampExecuteStart,
    timestampExecute,
    slippage
) {
    const isNativeToToken = fromToken.address.toLowerCase() === zeroAddress.toLowerCase();

    if (isNativeToToken) {
        return createNativeToTokenScheduledSwap(
            smartAccount,
            initialDelegationData,
            quote,
            toToken,
            timestampExecuteStart,
            timestampExecute
        );
    } else {
        return createTokenToTokenScheduledSwap(
            smartAccount,
            initialDelegationData,
            quote,
            fromToken,
            toToken,
            timestampExecuteStart,
            timestampExecute
        );
    }
}

/**
 * Creates scheduled swap from native token to ERC20 token
 */
async function createNativeToTokenScheduledSwap(
    smartAccount,
    initialDelegationData,
    quote,
    toToken,
    timestampExecuteStart,
    timestampExecute
) {
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
            targets: [MONORAIL_CONTRACT]
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

    const signature = await smartAccount.signDelegation({ delegation });
    const signedSwapDelegation = { ...delegation, signature };

    return {
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
    };
}

/**
 * Creates scheduled swap from ERC20 token to native or another ERC20 token
 */
async function createTokenToTokenScheduledSwap(
    smartAccount,
    initialDelegationData,
    quote,
    fromToken,
    toToken,
    timestampExecuteStart,
    timestampExecute
) {
    const signedApproveDelegation = await createAprovedDelegate(
        smartAccount,
        BigInt(quote.input),
        fromToken.address,
        "scheduled"
    );

    const caveats = [
        {
            type: "limitedCalls",
            limit: 1,
        },
        {
            type: "allowedTargets",
            targets: [MONORAIL_CONTRACT]
        },
        {
            type: "timestamp",
            afterThreshold: timestampExecuteStart,
            beforeThreshold: 0
        },
        {
            type: "erc20BalanceChange",
            tokenAddress: fromToken.address.toLowerCase(),
            recipient: smartAccount.address,
            balance: parseUnits(quote.input_formatted, fromToken.decimals),
            changeType: BalanceChangeType.Decrease,
        }
    ];

    // Add balance change caveat based on destination token type
    if (toToken.address.toLowerCase() === zeroAddress.toLowerCase()) {
        caveats.push({
            type: "nativeBalanceChange",
            recipient: smartAccount.address,
            balance: BigInt(quote.min_output),
            changeType: BalanceChangeType.Increase,
        });
    } else {
        caveats.push({
            type: "erc20BalanceChange",
            tokenAddress: toToken.address.toLowerCase(),
            recipient: smartAccount.address,
            balance: BigInt(quote.min_output),
            changeType: BalanceChangeType.Increase,
        });
    }

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

    const signature = await smartAccount.signDelegation({ delegation });
    const signedSwapDelegation = { ...delegation, signature };

    return {
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
    };
}

/**
 * Handles price-based swap delegation creation
 */
async function handlePriceSwap(
    smartAccount,
    initialDelegationData,
    quote,
    fromToken,
    toToken,
    swapLimitExpired,
    swapLimitToAmount,
    swapLimitPrice,
    exchangeRate,
    settings,
    timestampExecute
) {
    const limitAmount = Number(swapLimitPrice || exchangeRate) * Number(quote.input_formatted);
    const limitMinAmount = limitAmount - (limitAmount * settings.slippage / 100);
    const minimunLimitAmount = limitMinAmount.toFixed(Number(toToken.decimals));
    const limitPriceExpired = Math.floor(swapLimitExpired.getTime() / 1000);

    console.log('Minimum output limit price:', minimunLimitAmount);

    const isNativeToToken = fromToken.address.toLowerCase() === zeroAddress.toLowerCase();

    if (isNativeToToken) {
        return createNativeToTokenPriceSwap(
            smartAccount,
            initialDelegationData,
            quote,
            toToken,
            swapLimitToAmount,
            swapLimitPrice,
            minimunLimitAmount,
            limitPriceExpired,
            timestampExecute
        );
    } else {
        return createTokenToTokenPriceSwap(
            smartAccount,
            initialDelegationData,
            quote,
            fromToken,
            toToken,
            swapLimitToAmount,
            swapLimitPrice,
            minimunLimitAmount,
            limitPriceExpired,
            timestampExecute
        );
    }
}

/**
 * Creates price-based swap from native token to ERC20 token
 */
async function createNativeToTokenPriceSwap(
    smartAccount,
    initialDelegationData,
    quote,
    toToken,
    swapLimitToAmount,
    swapLimitPrice,
    minimunLimitAmount,
    limitPriceExpired,
    timestampExecute
) {
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
            targets: [MONORAIL_CONTRACT]
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

    const signature = await smartAccount.signDelegation({ delegation });
    const signedSwapDelegation = { ...delegation, signature };

    return {
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
    };
}

/**
 * Creates price-based swap from ERC20 token to native or another ERC20 token
 */
async function createTokenToTokenPriceSwap(
    smartAccount,
    initialDelegationData,
    quote,
    fromToken,
    toToken,
    swapLimitToAmount,
    swapLimitPrice,
    minimunLimitAmount,
    limitPriceExpired,
    timestampExecute
) {
    const signedApproveDelegation = await createAprovedDelegate(
        smartAccount,
        BigInt(quote.input),
        fromToken.address,
        "price"
    );

    if (!signedApproveDelegation) {
        throw new Error("Failed to create approval delegation");
    }

    const caveats = [
        {
            type: "limitedCalls",
            limit: 1,
        },
        {
            type: "allowedTargets",
            targets: [MONORAIL_CONTRACT]
        },
        {
            type: "timestamp",
            afterThreshold: 0,
            beforeThreshold: limitPriceExpired
        },
        {
            type: "erc20BalanceChange",
            tokenAddress: fromToken.address.toLowerCase(),
            recipient: smartAccount.address,
            balance: parseUnits(quote.input_formatted, fromToken.decimals),
            changeType: BalanceChangeType.Decrease,
        }
    ];

    // Add balance change caveat based on destination token type
    if (toToken.address.toLowerCase() === zeroAddress.toLowerCase()) {
        caveats.push({
            type: "nativeBalanceChange",
            recipient: smartAccount.address,
            balance: parseUnits(minimunLimitAmount.toString(), toToken.decimals),
            changeType: BalanceChangeType.Increase,
        });
    } else {
        caveats.push({
            type: "erc20BalanceChange",
            tokenAddress: toToken.address.toLowerCase(),
            recipient: smartAccount.address,
            balance: parseUnits(minimunLimitAmount.toString(), toToken.decimals),
            changeType: BalanceChangeType.Increase,
        });
    }

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

    const signature = await smartAccount.signDelegation({ delegation });
    const signedSwapDelegation = { ...delegation, signature };

    return {
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
    };
}

/**
 * Creates approval delegation for ERC20 tokens
 * @param {Object} smartAccount - Smart account object
 * @param {bigint} fromAmount - Amount to approve
 * @param {string} fromContract - Token contract address
 * @param {string} swapType - Type of swap ('scheduled' or 'price')
 * @returns {Promise<Object|null>} Signed delegation object or null if failed
 */
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

        const delegation = createDelegation({
            to: (swapType === "price" ? DELEGATOR_ADDRESS_PRICE : DELEGATOR_ADDRESS),
            from: smartAccount.address,
            environment: smartAccount.environment,
            scope: {
                type: "functionCall",
                targets: [fromContract],
                selectors: ["approve(address, uint256)"],
                allowedCalldata: [
                    { startIndex: 0, value: callData }
                ]
            },
            caveats
        });

        const signature = await smartAccount.signDelegation({ delegation });
        const signedDelegation = { ...delegation, signature };
        return signedDelegation;
    } catch (error) {
        console.error('Error creating approval delegation:', error);
        return null;
    }
}
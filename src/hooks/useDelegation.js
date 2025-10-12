import { DELEGATOR_ADDRESS, MONORAIL_AGREGATE, MONORAIL_CONTRACT, DELEGATOR_ADDRESS_PRICE, DELEGATOR_ADDRESS_AUTOBUY } from "@/config/contract";
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
// Duration Options for subscription calculation
const DURATION_OPTIONS = [
    { label: "1 Day", value: "1day", days: 1 },
    { label: "1 Week", value: "1week", days: 7 },
    { label: "2 Weeks", value: "2weeks", days: 14 },
    { label: "1 Month", value: "1month", days: 30 },
    { label: "3 Months", value: "3months", days: 90 },
    { label: "6 Months", value: "6months", days: 180 },
    { label: "1 Year", value: "1year", days: 365 },
    { label: "Indefinite", value: "indefinite", days: null }
];

// Updated Frequency mapping to seconds based on component
const FREQUENCY_SECONDS = {
    "1hour": 1 * 60 * 60,                    // 1 hour in seconds
    "12hours": 12 * 60 * 60,                 // 12 hours in seconds
    "daily": 24 * 60 * 60,                   // 1 day in seconds
    "3days": 3 * 24 * 60 * 60,               // 3 days in seconds
    "weekly": 7 * 24 * 60 * 60,              // 1 week in seconds
    "biweekly": 14 * 24 * 60 * 60,           // 2 weeks in seconds
    "monthly": 30 * 24 * 60 * 60,            // 1 month in seconds (30 days)
    "custom": null // Will be calculated from customInterval
};

export async function createSubscribeDelegation(postSubscribeDelegationData, smartAccountObj, subscriptionData, address) {
    try {
        console.log('Creating subscription delegation with data:', subscriptionData);

        const smartAccount = await importSmartAccountWithSalt(smartAccountObj.salt);

        // Parse amount to wei based on payment token decimals
        const amountWei = parseUnits(subscriptionData.amount.toString(), subscriptionData.paymentToken.decimals);

        // Calculate start and end timestamps
        const startDate = new Date();
        let endDate = new Date();

        // Calculate end date based on duration
        const durationOption = DURATION_OPTIONS.find(d => d.value === subscriptionData.duration);
        let durationInSecond = null;

        if (durationOption && durationOption.days) {
            endDate.setDate(endDate.getDate() + durationOption.days);
            durationInSecond = durationOption.days * 24 * 60 * 60; // Convert days to seconds
        } else if (subscriptionData.duration === "indefinite") {
            // Set end date to 10 years from now for indefinite subscriptions
            endDate.setFullYear(endDate.getFullYear() + 10);
            durationInSecond = 10 * 365 * 24 * 60 * 60; // 10 years in seconds
        }

        const startTimestamp = Math.floor(startDate.getTime() / 1000);
        const endTimestamp = Math.floor(endDate.getTime() / 1000);

        // Convert nextExecution string to timestamp
        const nextExecutionTimestamp = subscriptionData.nextExecutionTimestamp;

        // Calculate frequency in seconds based on component logic
        let frequencyInSecond;
        let customIntervalInSecond = null;

        if (subscriptionData.frequency === "custom" && subscriptionData.customInterval) {
            // Handle custom interval with days and hours
            const days = subscriptionData.customInterval.days || 0;
            const hours = subscriptionData.customInterval.hours || 0;
            const totalHours = (days * 24) + hours;
            customIntervalInSecond = totalHours * 60 * 60;
            frequencyInSecond = customIntervalInSecond;
        } else {
            // Use predefined frequency mapping
            frequencyInSecond = FREQUENCY_SECONDS[subscriptionData.frequency] || 0;
        }

        console.log('Timestamps - Start:', startTimestamp, 'End:', endTimestamp,
            'Next Execution:', nextExecutionTimestamp,
            'Duration in seconds:', durationInSecond,
            'Frequency in seconds:', frequencyInSecond,
            'Custom Interval in seconds:', customIntervalInSecond);

        // Determine if it's native token swap
        const isNativePayment = subscriptionData.paymentToken.address.toLowerCase() === zeroAddress.toLowerCase();

        let signedSwapDelegation;
        let signedApproveDelegation = {};

        // Handle ERC20 token approval first if not native
        if (!isNativePayment) {
            try {
                const callData = encodeFunctionData({
                    abi: erc20Abi,
                    functionName: "approve",
                    args: [MONORAIL_CONTRACT, amountWei],
                });

                const approvalCaveats = [
                    {
                        type: "allowedTargets",
                        targets: [subscriptionData.paymentToken.address]
                    },
                    {
                        type: "limitedCalls",
                        limit: subscriptionData.totalExecutions,
                    }
                ];

                const approvalDelegation = createDelegation({
                    to: DELEGATOR_ADDRESS_AUTOBUY,
                    from: smartAccount.address,
                    environment: smartAccount.environment,
                    scope: {
                        type: "functionCall",
                        targets: [subscriptionData.paymentToken.address],
                        selectors: ["approve(address, uint256)"],
                        allowedCalldata: [
                            { startIndex: 0, value: callData }
                        ]
                    },
                    caveats: approvalCaveats
                });

                console.log(approvalDelegation);

                const approvalSignature = await smartAccount.signDelegation({ delegation: approvalDelegation });
                signedApproveDelegation = { ...approvalDelegation, signature: approvalSignature };
            } catch (error) {
                console.error('Error creating approval delegation:', error);
                throw new Error("Failed to create approval delegation");
            }
        }

        // Create swap delegation based on token type
        const swapCaveats = [
            {
                type: "limitedCalls",
                limit: subscriptionData.totalExecutions,
            },
            {
                type: "allowedTargets",
                targets: [MONORAIL_CONTRACT]
            },
            {
                type: "timestamp",
                afterThreshold: startTimestamp,
                beforeThreshold: endTimestamp
            }
        ];

        const swapDelegation = createDelegation({
            to: DELEGATOR_ADDRESS_AUTOBUY,
            from: smartAccount.address,
            environment: smartAccount.environment,
            scope: {
                type: "functionCall",
                targets: [MONORAIL_CONTRACT],
                selectors: [MONORAIL_AGREGATE],
            },
            caveats: swapCaveats
        });

        const swapSignature = await smartAccount.signDelegation({ delegation: swapDelegation });
        signedSwapDelegation = { ...swapDelegation, signature: swapSignature };

        // Prepare subscription payload according to your data structure
        const payload = {
            type: subscriptionData.type || "subscription",
            frequency: subscriptionData.frequency,
            customInterval: subscriptionData.customInterval,
            customIntervalInSecond: customIntervalInSecond,
            duration: subscriptionData.duration,
            amount: amountWei.toString(),
            amount_formatted: subscriptionData.amount,
            paymentToken: subscriptionData.paymentToken,
            targetToken: subscriptionData.targetToken,
            settings: subscriptionData.settings,
            nextExecution: subscriptionData.nextExecution,
            nextExecutionTimestamp: subscriptionData.nextExecutionTimestamp,
            totalExecutions: subscriptionData.totalExecutions,
            startTimestamp: startTimestamp,
            endTimestamp: endTimestamp,
            durationInSecond: durationInSecond,
            frequencyInSecond: frequencyInSecond,
            owner_address: address,
            smart_account: smartAccount.address,
            signedSwapDelegation,
            signedApproveDelegation,
            status: "active",
            executed: 0
        };

        console.log('Final subscription payload:', payload);

        // Send to backend using the provided function
        const res = await postSubscribeDelegationData(payload);
        return res;

    } catch (error) {
        console.error('Error creating subscription delegation:', error);
        throw error;
    }
}
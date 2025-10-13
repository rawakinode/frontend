import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import { cn } from "@/lib/utils";
import {
    SlidersHorizontal,
    HelpCircle,
    ArrowDownUp,
    Check,
    ChevronDown,
    Search,
    AlertCircle,
    Loader2,
    CheckCircle2,
} from "lucide-react";

import { useAccount } from "wagmi"
import { getSwapQuote, getBalances } from "@/hooks/useMonorail";
import { formatBalance } from "@/lib/formatBalance";
import { getSmartAccounts } from "@/hooks/useSmartAccount";
import { useAuth } from "@/context/AuthContext";
import { tokens } from "@/config/tokens";
import { createSubscribeDelegation } from "@/hooks/useDelegation";

// Frequency Options for Auto-Swap
const FREQUENCY_OPTIONS = [
    { label: "1 Hour", value: "1hour", description: "Every 1 hour" },
    { label: "12 Hours", value: "12hours", description: "Every 12 hours" },
    { label: "1 Day", value: "daily", description: "Every day at selected time" },
    { label: "3 Days", value: "3days", description: "Every 3 days" },
    { label: "1 Week", value: "weekly", description: "Every 7 days" },
    { label: "2 Weeks", value: "biweekly", description: "Every 14 days" },
    { label: "30 Days", value: "monthly", description: "Every 30 days" },
    { label: "Custom", value: "custom", description: "Custom interval" }
];

// Duration Options
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

// Helper function to calculate next execution timestamp
const calculateNextExecution = (frequency, customInterval = null) => {
    const now = new Date();
    let nextDate = new Date(now);

    switch (frequency) {
        case "1hour":
            nextDate.setHours(nextDate.getHours() + 1);
            break;
        case "12hours":
            nextDate.setHours(nextDate.getHours() + 12);
            break;
        case "daily":
            nextDate.setDate(nextDate.getDate() + 1);
            break;
        case "3days":
            nextDate.setDate(nextDate.getDate() + 3);
            break;
        case "weekly":
            nextDate.setDate(nextDate.getDate() + 7);
            break;
        case "biweekly":
            nextDate.setDate(nextDate.getDate() + 14);
            break;
        case "monthly":
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
        case "custom":
            if (customInterval) {
                nextDate.setDate(nextDate.getDate() + (customInterval.days || 0));
                nextDate.setHours(nextDate.getHours() + (customInterval.hours || 0));
            }
            break;
        default:
            nextDate.setDate(nextDate.getDate() + 7); // default weekly
    }

    return {
        timestamp: Math.floor(nextDate.getTime() / 1000),
        display: nextDate.toLocaleString()
    };
};

// Reusable Token Select Component
function TokenSelect({ selected, onChange, disabled }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const handleSearch = (value) => {
        setSearch(value);
    };

    const handleTokenSelect = (token) => {
        onChange(token);
        setOpen(false);
        setSearch("");
    };

    function TokenItem({ token, onSelect, isSelected }) {
        return (
            <button
                onClick={() => onSelect(token)}
                className="flex items-center justify-between w-full p-3 hover:bg-white/5 transition-colors rounded-lg"
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                        {token?.image_url ? (
                            <img
                                src={token.image_url}
                                alt={token.symbol}
                                className="w-full h-full rounded-full object-cover"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                }}
                            />
                        ) : (
                            <span className="text-xs font-medium text-white">{token?.symbol?.charAt(0) || '?'}</span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{token?.symbol}</span>
                            {token?.verified && (
                                <span className="text-xs bg-blue-500 text-white px-1 rounded">✓</span>
                            )}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">{token?.name}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isSelected && (
                        <Check className="w-4 h-4 text-green-400" />
                    )}
                </div>
            </button>
        );
    }

    const filteredTokens = tokens.filter(token =>
        token?.symbol?.toLowerCase().includes(search.toLowerCase()) ||
        token?.name?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    disabled={disabled}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                >
                    {selected ? (
                        <>
                            <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                                {selected?.image_url ? (
                                    <img
                                        src={selected.image_url}
                                        alt={selected.symbol || 'token'}
                                        className="w-full h-full rounded-full object-cover"
                                        onError={e => { e.target.style.display = 'none'; }}
                                        title={selected.symbol}
                                    />
                                ) : (
                                    <span className="text-xs font-medium text-white">{selected?.symbol?.charAt(0) || '?'}</span>
                                )}
                            </div>
                            <span className="font-semibold">{selected?.symbol}</span>
                        </>
                    ) : (
                        <span className="font-semibold">-</span>
                    )}
                    <ChevronDown className="w-4 h-4" />
                </button>
            </DialogTrigger>

            <DialogContent className="max-w-90 p-0 gap-0 bg-card backdrop-blur-md border border-white/10 rounded-2xl">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="font-semibold">Select a token</h3>
                </div>

                <div className="p-4 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search token"
                            className="pl-10 pr-4 py-2 bg-white/5 border-0 text-white placeholder:text-gray-400"
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                    {filteredTokens.length > 0 ? (
                        <div className="divide-y divide-white/10">
                            {filteredTokens.map((token) => (
                                <TokenItem
                                    key={token.address}
                                    token={token}
                                    onSelect={handleTokenSelect}
                                    isSelected={selected?.address === token.address}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center">
                            <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No tokens found</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Settings Modal Component
function SettingsModal({ open, onOpenChange, settings, onSettingsChange }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-90 bg-card backdrop-blur-md border border-white/10">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Swap Settings</h3>
                </div>

                <div className="space-y-6">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Label className="text-xs font-medium">Slippage tolerance</Label>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="w-64 text-xs">
                                        Your transaction will revert if the price changes unfavorably by more than this percentage.
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <div className="flex gap-2">
                            {[0.5, 1, 2, 5].map((value) => (
                                <Button
                                    key={value}
                                    variant={settings.slippage === value ? "default" : "outline"}
                                    size="sm"
                                    onClick={() =>
                                        onSettingsChange({
                                            ...settings,
                                            slippage: value,
                                            customSlippage: false,
                                        })
                                    }
                                    className="flex-1 text-xs"
                                >
                                    {value}%
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Label className="text-xs font-medium">Transaction deadline</Label>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="w-64 text-xs">
                                        Your transaction will revert if it is pending for more than this period of time.
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                value={settings.deadline}
                                onChange={(e) => onSettingsChange({ ...settings, deadline: Number(e.target.value) })}
                            />
                            <span className="text-muted-foreground text-xs">minutes</span>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Success Popup Component for Subscription
function SubscriptionSuccessPopup({ open, onOpenChange, subscriptionData }) {
    const getFrequencyText = () => {
        const freq = FREQUENCY_OPTIONS.find(f => f.value === subscriptionData.frequency);
        return freq?.label || subscriptionData.frequency;
    };

    const getDurationText = () => {
        const duration = DURATION_OPTIONS.find(d => d.value === subscriptionData.duration);
        return duration?.label || subscriptionData.duration;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-card backdrop-blur-md border border-white/10 p-0 gap-0">
                <div className="p-6">
                    {/* Success Icon Animation */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                            type: "spring",
                            stiffness: 260,
                            damping: 20,
                            delay: 0.1
                        }}
                        className="mb-6 flex justify-center"
                    >
                        <div className="relative">
                            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
                            <div className="relative bg-green-500/10 p-4 rounded-full">
                                <CheckCircle2 className="w-12 h-12 text-green-500" />
                            </div>
                        </div>
                    </motion.div>

                    {/* Title */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-center mb-6"
                    >
                        <h2 className="text-2xl font-bold mb-2">Subscription Created!</h2>
                        <p className="text-muted-foreground text-sm">
                            Your auto-buy subscription has been successfully set up
                        </p>
                    </motion.div>

                    {/* Subscription Details */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white/5 rounded-xl p-4 mb-4"
                    >
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Frequency:</span>
                                <span className="font-semibold">{getFrequencyText()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Duration:</span>
                                <span className="font-semibold">{getDurationText()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Each Purchase:</span>
                                <span className="font-semibold">{subscriptionData.amount} {subscriptionData.fromToken?.symbol} → {subscriptionData.toToken?.symbol}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Next Execution:</span>
                                <span className="font-semibold">{subscriptionData.nextExecution}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Executions:</span>
                                <span className="font-semibold">{subscriptionData.totalExecutions}</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Action Button */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <Button
                            onClick={() => onOpenChange(false)}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            Create Another Subscription
                        </Button>
                    </motion.div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Error Popup Component
function PopUpError({ open, onOpenChange, title, description, actionButton }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-card backdrop-blur-md border border-white/10 p-0 gap-0">
                <div className="p-6">
                    {/* Error Icon Animation */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                            type: "spring",
                            stiffness: 260,
                            damping: 20,
                            delay: 0.1
                        }}
                        className="mb-6 flex justify-center"
                    >
                        <div className="relative">
                            <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />
                            <div className="relative bg-red-500/10 p-4 rounded-full">
                                <AlertCircle className="w-12 h-12 text-red-500" />
                            </div>
                        </div>
                    </motion.div>

                    {/* Title */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-center mb-6"
                    >
                        <h2 className="text-2xl font-bold mb-2 text-red-500">{title}</h2>
                        <p className="text-muted-foreground text-sm">
                            {description}
                        </p>
                    </motion.div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <Button
                            onClick={() => onOpenChange(false)}
                            className="flex-1 bg-red-600 hover:bg-red-700"
                        >
                            Close
                        </Button>
                        {actionButton && (
                            <div className="flex-1">
                                {actionButton}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Main SubscribeSwap Component
export default function SubscribeSwap() {
    // Default tokens - USDT for payment and ETH for purchase
    const defaultFromTo = useMemo(() => {
        const usdtToken = tokens.find(token => token.symbol === 'MON') || tokens.find(token => token.symbol === 'MON') || tokens[0];
        const ethToken = tokens.find(token => token.symbol === 'USDC') || tokens[1];
        return [usdtToken, ethToken];
    }, []);

    // Core states
    const [fromToken, setFromToken] = useState(defaultFromTo[0]); // Payment token (USDT)
    const [toToken, setToToken] = useState(defaultFromTo[1]);     // Target token (ETH)
    const [fromAmount, setFromAmount] = useState("0");          // Amount in payment token
    const [fromBalanceWallet, setFromBalance] = useState("0"); // Balance of payment token in wallet
    const [toBalanceWallet, setToBalance] = useState("0");

    // Subscription states
    const [selectedFrequency, setSelectedFrequency] = useState("weekly"); 
    const [selectedDuration, setSelectedDuration] = useState("1month"); 
    const [customInterval, setCustomInterval] = useState({
        days: 0,
        hours: 1
    });

    // Swap states
    const [settings, setSettings] = useState({
        slippage: 2,
        deadline: 5
    });
    const [loading, setLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Popup states
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [showErrorPopup, setShowErrorPopup] = useState(false);
    const [errorData, setErrorData] = useState({ title: "", description: "" });

    const { address, isConnected } = useAccount();
    const { postSubscribeDelegationData } = useAuth();

    // Smart account states
    const [selectedSmartAccount, setSelectedSmartAccount] = useState(null);
    const [allSmartAccounts, setAllSmartAccounts] = useState([]);
    const [loadingSmartAccounts, setLoadingSmartAccounts] = useState(false);

    // Validation state
    const [durationError, setDurationError] = useState("");

    // Calculate subscription summary
    const subscriptionSummary = useMemo(() => {
        if (!fromAmount || parseFloat(fromAmount) <= 0) return null;

        const amountPerSwap = parseFloat(fromAmount);

        // count interval in hours
        let intervalInHours = 0;

        switch (selectedFrequency) {
            case "1hour":
                intervalInHours = 1;
                break;
            case "12hours":
                intervalInHours = 12;
                break;
            case "daily":
                intervalInHours = 24;
                break;
            case "3days":
                intervalInHours = 24 * 3;
                break;
            case "weekly":
                intervalInHours = 24 * 7;
                break;
            case "biweekly":
                intervalInHours = 24 * 14;
                break;
            case "monthly":
                intervalInHours = 24 * 30;
                break;
            case "custom":
                intervalInHours = (customInterval.days * 24) + customInterval.hours;
                break;
            default:
                intervalInHours = 24 * 7; // default weekly
        }

        // Count total duration in hours
        let totalDurationInHours = 0;
        const durationOption = DURATION_OPTIONS.find(d => d.value === selectedDuration);

        if (selectedDuration === "indefinite") {
            totalDurationInHours = 24 * 365 * 10; // 10 years for practical purposes
        } else if (durationOption) {
            totalDurationInHours = durationOption.days * 24;
        }

        // Validation: frequency must not be longer than duration
        if (selectedDuration !== "indefinite" && intervalInHours > totalDurationInHours) {
            setDurationError(`Frequency cannot be longer than duration. For ${durationOption?.label}, frequency must be at least ${durationOption?.label}`);
        } else {
            setDurationError("");
        }

        // Count total executions
        let totalExecutions = 0;
        if (intervalInHours > 0 && totalDurationInHours > 0) {
            totalExecutions = Math.floor(totalDurationInHours / intervalInHours);
            totalExecutions = Math.max(1, totalExecutions);

            // For indefinite, cap at 999 executions
            if (selectedDuration === "indefinite" && totalExecutions > 999) {
                totalExecutions = 999;
            }
        } else {
            totalExecutions = 1; // fallback
        }

        const totalInvestment = amountPerSwap * totalExecutions;

        // Count next execution timestamp
        const nextExecution = calculateNextExecution(selectedFrequency, customInterval);

        return {
            frequencyDays: customInterval.days || 0,
            frequencyHours: customInterval.hours || 0,
            totalExecutions,
            totalInvestment,
            nextExecutionTimestamp: nextExecution.timestamp,
            nextExecutionDisplay: nextExecution.display, 
            amountPerSwap,
            intervalInHours,
            totalDurationInHours
        };
    }, [fromAmount, selectedFrequency, selectedDuration, customInterval]);

    // Fetch smart accounts dengan loading state dan auto-select
    useEffect(() => {
        const fetchSmartAccounts = async () => {
            if (!isConnected) {
                setAllSmartAccounts([]);
                setSelectedSmartAccount(null);
                setLoadingSmartAccounts(false);
                return;
            }

            setLoadingSmartAccounts(true);
            try {
                const sa = await getSmartAccounts(false);
                setAllSmartAccounts(sa);

                // Select smart account automatically available
                if (sa.length > 0) {
                    setSelectedSmartAccount(sa[0]);
                } else {
                    setSelectedSmartAccount(null);
                }
            } catch (err) {
                console.error(err);
                setAllSmartAccounts([]);
                setSelectedSmartAccount(null);
            } finally {
                setLoadingSmartAccounts(false);
            }
        };

        fetchSmartAccounts();
    }, [address, isConnected]);

    // Fetch balances
    const fetchBalances = async () => {
        if (!isConnected || !selectedSmartAccount?.address) {
            setFromBalance("0");
            setToBalance("0");
            return;
        }
        try {
            const a = await getBalances(selectedSmartAccount.address, fromToken.address);
            setFromBalance(a);
            const b = await getBalances(selectedSmartAccount.address, toToken.address);
            setToBalance(b);
        } catch (error) {
            console.error(error);
            setFromBalance("0");
            setToBalance("0");
        }
    };

    useEffect(() => {
        fetchBalances();
    }, [fromToken, toToken, address, selectedSmartAccount, isConnected]);

    // Create subscription delegation
    const createSubscriptionDelegation = async () => {
        if (!selectedSmartAccount?.address) return;

        setLoading(true);

        try {
            const subscriptionData = {
                type: "subscription",
                frequency: selectedFrequency,
                customInterval: selectedFrequency === 'custom' ? customInterval : null,
                duration: selectedDuration,
                amount: fromAmount,
                paymentToken: fromToken,
                targetToken: toToken,
                settings: settings,
                nextExecution: subscriptionSummary.nextExecutionDisplay,
                nextExecutionTimestamp: subscriptionSummary.nextExecutionTimestamp,
                totalExecutions: subscriptionSummary.totalExecutions
            };

            console.log("Creating subscription:", subscriptionData);

            // Call API for creating subscription
            const res = await createSubscribeDelegation(postSubscribeDelegationData, selectedSmartAccount, subscriptionData, address);

            console.log("Subscription response:", res);

            // Handle response based on structured response
            if (res && res.status === 'ok') {
                setShowSuccessPopup(true);
                resetAfterSubscription();
            } else if (res && res.message === 'duplicate_pair') {
                setErrorData({
                    title: "Duplicate Token Pair",
                    description: res.error || `You already have an active subscription with the token pair ${fromToken.symbol} ↔ ${toToken.symbol}. Please choose a different token pair.`
                });
                setShowErrorPopup(true);
            } else if (res && res.message === 'limit') {
                setErrorData({
                    title: "Subscription Limit Reached",
                    description: res.error || "You have reached the maximum limit of 5 active subscriptions per smart account."
                });
                setShowErrorPopup(true);
            } else {
                setErrorData({
                    title: "Subscription Failed",
                    description: res?.error || res?.message || "Unable to create subscription. Please try again."
                });
                setShowErrorPopup(true);
            }
        } catch (error) {
            console.error("Subscription creation failed:", error);
            
            if (error.message === 'duplicate_pair') {
                setErrorData({
                    title: "Duplicate Token Pair",
                    description: error.error || `You already have an active subscription with the token pair ${fromToken.symbol} ↔ ${toToken.symbol}. Please choose a different token pair.`
                });
            } else if (error.message === 'limit') {
                setErrorData({
                    title: "Subscription Limit Reached",
                    description: error.error || "You have reached the maximum limit of 5 active subscriptions per smart account."
                });
            } else {
                setErrorData({
                    title: "Subscription Failed",
                    description: error.message || "Unable to create recurring swap subscription. Please try again."
                });
            }
            setShowErrorPopup(true);
        } finally {
            setLoading(false);
        }
    };

    const resetAfterSubscription = () => {
        setFromAmount("0");
    };

    const handleMax = useCallback((val) => {
        const count = parseFloat(fromBalanceWallet) * val;
        setFromAmount(`${count}`);
    }, [fromBalanceWallet]);

    // Handle account change
    const handleAccountChange = useCallback((val) => {
        const selected = allSmartAccounts.find(acc => acc.address === val);
        setSelectedSmartAccount(selected || null);
    }, [allSmartAccounts]);

    const swapTokens = useCallback(() => {
        setFromToken(toToken);
        setToToken(fromToken);
        setFromAmount("");
    }, [fromToken, toToken]);

    // Handle change in custom interval inputs
    const handleCustomIntervalChange = (field, value) => {
        const newValue = parseInt(value) || 0;
        setCustomInterval(prev => ({
            ...prev,
            [field]: newValue
        }));
    };

    // Balance check if sufficient
    const hasSufficientBalance = useMemo(() => {
        if (!fromAmount || parseFloat(fromAmount) <= 0) return true;
        if (!fromBalanceWallet || parseFloat(fromBalanceWallet) <= 0) return false;
        return parseFloat(fromAmount) <= parseFloat(fromBalanceWallet);
    }, [fromAmount, fromBalanceWallet]);

    const subscribeDisabled = useMemo(() => {
        if (!isConnected) return true;
        if (!fromAmount || parseFloat(fromAmount) <= 0) return true;
        if (!selectedSmartAccount?.address) return true;
        if (loading) return true;
        if (!hasSufficientBalance) return true;
        if (durationError) return true;

        // Validation for same token
        if (fromToken?.address === toToken?.address) {
            return true;
        }

        // Validation for custom interval
        if (selectedFrequency === 'custom') {
            const totalCustomHours = (customInterval.days * 24) + customInterval.hours;
            if (totalCustomHours <= 0) return true;
            if (customInterval.days < 0 || customInterval.hours < 0) return true;
            if (customInterval.hours > 23) return true;
        }

        return false;
    }, [isConnected, fromAmount, selectedSmartAccount, loading, hasSufficientBalance, selectedFrequency, customInterval, durationError]);

    // Function to get button text based on state
    const getButtonText = () => {
        if (loading) {
            return (
                <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating Subscription...
                </>
            );
        }

        if (!selectedSmartAccount) {
            return "Select Smart Account First";
        }

        if (!isConnected) {
            return "Connect Wallet to Subscribe";
        }

        if (!hasSufficientBalance) {
            return "Insufficient Balance";
        }

        return `Subscribe to Auto-Buy ${toToken?.symbol}`;
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-[400px] w-full mx-auto bg-card backdrop-blur-xl rounded-3xl p-6 border-1 border-card shadow-2xl mt-10"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-md font-semibold">Subscription</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {isConnected && (
                            <Select
                                onValueChange={handleAccountChange}
                                value={selectedSmartAccount?.address || ""}
                                disabled={loadingSmartAccounts}
                            >
                                <SelectTrigger className="w-[180px] text-xs">
                                    {loadingSmartAccounts ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span>Loading accounts...</span>
                                        </div>
                                    ) : (
                                        <SelectValue placeholder="Select Smart Account" />
                                    )}
                                </SelectTrigger>
                                <SelectContent>
                                    {allSmartAccounts?.map((acc, idx) => (
                                        <SelectItem key={idx} value={acc.address} className="text-xs">
                                            {`${acc.address.slice(0, 8)}...${acc.address.slice(-8)}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowSettings(true)}
                            className="rounded-full"
                            disabled={!selectedSmartAccount}
                        >
                            <SlidersHorizontal className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Payment Section */}
                <div className="bg-white/5 rounded-2xl p-4 mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <Label className="text-sm text-muted-foreground">Pay With</Label>
                        <div className="flex gap-2">
                            {[0.25, 0.5, 0.75, 1].map((val) => (
                                <button
                                    key={val}
                                    onClick={() => handleMax(val)}
                                    className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded hover:bg-blue-500/30 transition-colors"
                                    disabled={!selectedSmartAccount}
                                >
                                    {val === 1 ? 'Max' : `${val * 100}%`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <Input
                            type="number"
                            placeholder="0.0"
                            value={fromAmount}
                            onChange={(e) => setFromAmount(e.target.value)}
                            className="md:text-2xl text-2xl font-semibold border-0 bg-transparent p-0 focus-visible:ring-0 shadow-none"
                            disabled={!selectedSmartAccount}
                        />
                        <TokenSelect
                            selected={fromToken}
                            onChange={setFromToken}
                            disabled={!selectedSmartAccount}
                        />
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                        Balance: {formatBalance(fromBalanceWallet)} {fromToken?.symbol}
                    </div>
                </div>

                {/* Swap Arrow */}
                <div className="flex justify-center my-2">
                    <button
                        onClick={swapTokens}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors border-1 border-black/90"
                        disabled={!selectedSmartAccount}
                    >
                        <ArrowDownUp className="w-4 h-4" />
                    </button>
                </div>

                {/* Purchase Target Section - DIUBAH: tidak menampilkan jumlah token */}
                <div className="bg-white/5 rounded-2xl p-4 mb-4">
                    <Label className="text-sm text-muted-foreground">Auto-Buy</Label>
                    <div className="flex items-center justify-between">
                        <div className="md:text-2xl text-2xl font-semibold border-0 bg-transparent p-0">
                            {toToken?.symbol}
                        </div>
                        <TokenSelect
                            selected={toToken}
                            onChange={setToToken}
                            disabled={!selectedSmartAccount}
                        />
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                        {selectedSmartAccount
                            ? `You will receive ${toToken?.symbol} based on market price at execution time`
                            : "Select a smart account to configure auto-buy"
                        }
                    </div>
                </div>

                {/* // Tambahkan di JSX, setelah section Purchase Target */}
                {fromToken?.address === toToken?.address && (
                    <Alert className="mt-2 bg-yellow-500/10 border-yellow-500/20 mb-4">
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                        <AlertTitle className="text-yellow-500 text-sm font-medium">Invalid Token Pair</AlertTitle>
                        <AlertDescription className="text-yellow-400 text-xs">
                            Payment token and target token cannot be the same.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Subscription Settings */}
                <div className="bg-white/5 rounded-2xl p-4 mb-4">
                    <h3 className="text-sm font-semibold mb-3">Subscription Settings</h3>

                    {/* Frequency Selection */}
                    <div className="mb-4">
                        <Label className="text-xs text-muted-foreground mb-2 block">Frequency</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {FREQUENCY_OPTIONS.map((option) => (
                                <Button
                                    key={option.value}
                                    variant={selectedFrequency === option.value ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setSelectedFrequency(option.value)}
                                    className="text-xs h-8"
                                    disabled={!selectedSmartAccount}
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Interval Settings */}
                    {selectedFrequency === 'custom' && (
                        <div className="mb-4 p-3 bg-white/5 rounded-lg">
                            <Label className="text-xs text-muted-foreground mb-2 block">Custom Interval</Label>
                            <div className="flex gap-2 items-center">
                                <div className="flex-1">
                                    <Label className="text-xs text-muted-foreground mb-1 block">Days</Label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={customInterval.days}
                                        onChange={(e) => handleCustomIntervalChange('days', e.target.value)}
                                        className="text-sm"
                                        min="0"
                                        disabled={!selectedSmartAccount}
                                    />
                                </div>
                                <div className="flex-1">
                                    <Label className="text-xs text-muted-foreground mb-1 block">Hours</Label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={customInterval.hours}
                                        onChange={(e) => handleCustomIntervalChange('hours', e.target.value)}
                                        className="text-sm"
                                        min="0"
                                        max="23"
                                        disabled={!selectedSmartAccount}
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                Set days to 0 if you only want hour-based intervals
                            </p>
                        </div>
                    )}

                    {/* Duration Selection */}
                    <div>
                        <Label className="text-xs text-muted-foreground mb-2 block">Duration</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {DURATION_OPTIONS.map((option) => (
                                <Button
                                    key={option.value}
                                    variant={selectedDuration === option.value ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setSelectedDuration(option.value)}
                                    className="text-xs h-8"
                                    disabled={!selectedSmartAccount}
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Tampilkan error durasi */}
                    {durationError && (
                        <Alert className="mt-4 bg-red-500/10 border-red-500/20">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <AlertTitle className="text-red-500 text-sm font-medium">Invalid Duration</AlertTitle>
                            <AlertDescription className="text-red-400 text-xs">
                                {durationError}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                {subscriptionSummary && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="bg-blue-500/10 rounded-2xl p-4 mb-4 border border-blue-500/20"
                    >
                        <h3 className="text-sm font-semibold mb-2 text-blue-300">Subscription Summary</h3>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Each purchase:</span>
                                <span>{fromAmount} {fromToken?.symbol} → {toToken?.symbol}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Frequency:</span>
                                <span>
                                    {selectedFrequency === 'custom'
                                        ? `${customInterval.days > 0 ? customInterval.days + ' days ' : ''}${customInterval.hours > 0 ? customInterval.hours + ' hours' : ''}`
                                        : FREQUENCY_OPTIONS.find(f => f.value === selectedFrequency)?.label
                                    }
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Duration:</span>
                                <span>{DURATION_OPTIONS.find(d => d.value === selectedDuration)?.label}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Next execution:</span>
                                <span>{subscriptionSummary.nextExecutionDisplay}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Total executions:</span>
                                <span>
                                    {selectedDuration === "indefinite" ? "Unlimited" : subscriptionSummary.totalExecutions}
                                    {selectedFrequency === 'custom' && ` (every ${customInterval.days}d ${customInterval.hours}h)`}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Total investment:</span>
                                <span className="font-semibold">
                                    {selectedDuration === "indefinite" ? "Ongoing" : `${subscriptionSummary.totalInvestment.toFixed(2)} ${fromToken?.symbol}`}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Subscribe Button */}
                <Button
                    onClick={createSubscriptionDelegation}
                    disabled={subscribeDisabled}
                    className={cn(
                        "w-full py-3 rounded-xl text-md font-semibold transition-all",
                        subscribeDisabled
                            ? "bg-gray-600 cursor-not-allowed"
                            : "bg-green-600 hover:bg-green-700"
                    )}
                >
                    {getButtonText()}
                </Button>
            </motion.div>

            {/* Success Popup */}
            <SubscriptionSuccessPopup
                open={showSuccessPopup}
                onOpenChange={setShowSuccessPopup}
                subscriptionData={{
                    frequency: selectedFrequency,
                    duration: selectedDuration,
                    fromToken: fromToken,
                    toToken: toToken,
                    amount: fromAmount,
                    nextExecution: subscriptionSummary?.nextExecutionDisplay,
                    totalExecutions: subscriptionSummary?.totalExecutions
                }}
            />

            {/* Error Popup */}
            <PopUpError
                open={showErrorPopup}
                onOpenChange={setShowErrorPopup}
                title={errorData.title}
                description={errorData.description}
            />

            {/* Settings Modal */}
            <SettingsModal
                open={showSettings}
                onOpenChange={setShowSettings}
                settings={settings}
                onSettingsChange={setSettings}
            />
        </>
    );
}
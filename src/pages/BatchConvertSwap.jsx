import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

import { cn } from "@/lib/utils";
import {
    Check,
    ChevronDown,
    Search,
    AlertCircle,
    Loader2,
    CheckCircle2,
    Copy,
    ExternalLink,
    Zap
} from "lucide-react";

import { useAccount } from "wagmi"
import { getSwapQuote, getBalancesAllToken } from "@/hooks/useMonorail";
import { formatBalance } from "@/lib/formatBalance";
import { getSmartAccounts } from "@/hooks/useSmartAccount";
import { useAuth } from "@/context/AuthContext";
import { tokens } from "@/config/tokens";
import { batchSwapERC20ToMon } from "@/hooks/useWallet";

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

// Success Popup Component for Batch Convert
function BatchConvertSuccessPopup({ open, onOpenChange, conversionData }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(conversionData.txHash);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shortenHash = (hash) => {
        if (!hash) return "";
        return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
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
                        <h2 className="text-2xl font-bold mb-2">Batch Conversion Successful!</h2>
                        <p className="text-muted-foreground text-sm">
                            Your tokens have been successfully converted
                        </p>
                    </motion.div>

                    {/* Conversion Details */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white/5 rounded-xl p-4 mb-4"
                    >
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Target Token:</span>
                                <span className="font-semibold">{conversionData.targetToken?.symbol}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Received:</span>
                                <span className="font-semibold">{conversionData.totalReceived} {conversionData.targetToken?.symbol}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Tokens Converted:</span>
                                <span className="font-semibold">{conversionData.convertedTokens}</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Transaction Hash */}
                    {conversionData.txHash && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-white/5 rounded-xl p-4 mb-6"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Transaction Hash</p>
                                    <p className="font-mono text-sm">{shortenHash(conversionData.txHash)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleCopy}
                                        className="h-8 w-8"
                                    >
                                        {copied ? (
                                            <Check className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        asChild
                                        className="h-8 w-8"
                                    >
                                        <a
                                            href={`https://testnet.monadexplorer.com/tx/${conversionData.txHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Action Button */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                    >
                        <Button
                            onClick={() => onOpenChange(false)}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            Convert More Tokens
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

// Warning Popup Component for Failed Quotes
function PopUpWarning({ open, onOpenChange, title, description, actionButton, onContinue }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-card backdrop-blur-md border border-white/10 p-0 gap-0">
                <div className="p-6">
                    {/* Warning Icon Animation */}
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
                            <div className="absolute inset-0 bg-yellow-500/20 rounded-full animate-ping" />
                            <div className="relative bg-yellow-500/10 p-4 rounded-full">
                                <AlertCircle className="w-12 h-12 text-yellow-500" />
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
                        <h2 className="text-2xl font-bold mb-2 text-yellow-500">{title}</h2>
                        <p className="text-muted-foreground text-sm">
                            {description}
                        </p>
                    </motion.div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <Button
                            onClick={() => onOpenChange(false)}
                            variant="outline"
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={onContinue}
                            className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                        >
                            Continue Anyway
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Main BatchConvertSwap Component
export default function BatchConvertSwap() {
    // Default target token
    const defaultTargetToken = useMemo(() => {
        return tokens.find(token => token.symbol === 'MON') ||
            tokens.find(token => token.symbol === 'USDC') ||
            tokens[0];
    }, []);

    // Core states
    const [selectedSmartAccount, setSelectedSmartAccount] = useState(null);
    const [allSmartAccounts, setAllSmartAccounts] = useState([]);
    const [targetToken, setTargetToken] = useState(defaultTargetToken);

    // Token detection states
    const [detectedTokens, setDetectedTokens] = useState([]);
    const [selectedTokens, setSelectedTokens] = useState([]);
    const [conversionQuotes, setConversionQuotes] = useState({});
    const [totalReceived, setTotalReceived] = useState("0");

    // Loading states
    const [detectingTokens, setDetectingTokens] = useState(false);
    const [fetchingQuotes, setFetchingQuotes] = useState(false);
    const [converting, setConverting] = useState(false);
    const [loadingSmartAccounts, setLoadingSmartAccounts] = useState(false);

    // Popup states
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [showErrorPopup, setShowErrorPopup] = useState(false);
    const [showWarningPopup, setShowWarningPopup] = useState(false);
    const [errorData, setErrorData] = useState({ title: "", description: "" });
    const [warningData, setWarningData] = useState({
        title: "",
        description: "",
        failedTokens: [],
        successfulTokens: []
    });

    // Success data state
    const [successData, setSuccessData] = useState({
        txHash: "",
        targetToken: null,
        totalReceived: "",
        convertedTokens: 0
    });

    const { address, isConnected } = useAccount();

    // Fetch smart accounts
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

    // Detect ERC20 tokens using the new API
    const detectERC20Tokens = async () => {

        if (!selectedSmartAccount?.address) return;

        setDetectingTokens(true);
        setDetectedTokens([]);
        setSelectedTokens([]);
        setConversionQuotes({});
        setTotalReceived("0");

        try {
            const allTokens = await getBalancesAllToken(selectedSmartAccount.address);
            const filteredTokens = allTokens
                .filter((token, index) => index !== 0) // 
                .filter(token => token.balance && parseFloat(token.balance) > 0) 
                .filter(token => {
                    const isTargetToken = token.address.toLowerCase() === targetToken.address.toLowerCase();
                    return !isTargetToken;
                })
                .map(apiToken => {
                    const matchedToken = tokens.find(tokenListItem =>
                        tokenListItem.address.toLowerCase() === apiToken.address.toLowerCase()
                    );

                    if (matchedToken) {
                        return {
                            ...apiToken,
                            image_url: matchedToken.image_url,
                            verified: matchedToken.verified, 
                            balanceFormatted: formatBalance(apiToken.balance),
                            symbol: matchedToken.symbol || apiToken.symbol,
                            name: matchedToken.name || apiToken.name
                        };
                    }
                    return null;
                })
                .filter(token => token !== null); 

            setDetectedTokens(filteredTokens);
        } catch (error) {
            console.error("Token detection failed:", error);
            setErrorData({
                title: "Detection Failed",
                description: "Failed to detect ERC20 tokens. Please try again."
            });
            setShowErrorPopup(true);
        } finally {
            setDetectingTokens(false);
        }
    };

    // Reset detected tokens when target token changes
    useEffect(() => {
        if (detectedTokens.length > 0) {
            setDetectedTokens([]);
            setSelectedTokens([]);
            setConversionQuotes({});
            setTotalReceived("0");
        }
    }, [targetToken]);

    // Fetch quotes for selected tokens
    const fetchConversionQuotes = async () => {
        if (selectedTokens.length === 0 || !selectedSmartAccount?.address) return;

        setFetchingQuotes(true);
        setConversionQuotes({});
        setTotalReceived("0");

        try {
            const quotes = {};
            let total = 0;
            const successfulTokens = [];
            const failedTokens = [];

            for (const tokenAddress of selectedTokens) {
                const token = detectedTokens.find(t => t.address === tokenAddress);
                if (!token) continue;

                try {
                    const quote = await getSwapQuote(
                        token.address,
                        targetToken.address,
                        token.balance,
                        2 * 100,
                        5 * 60,
                        selectedSmartAccount.address
                    );

                    if (Object.keys(quote).length === 0 || !quote.output_formatted) {
                        throw new Error('Empty quote response');
                    }

                    quotes[tokenAddress] = {
                        success: true,
                        output: quote.output_formatted,
                        minOutput: quote.min_output_formatted,
                        exchangeRate: Number(quote.output_formatted) / Number(token.balance),
                        raw: quote
                    };

                    total += Number(quote.output_formatted);
                    successfulTokens.push(tokenAddress);
                } catch (error) {
                    console.error(`Quote failed for ${token.symbol}:`, error);
                    quotes[tokenAddress] = {
                        success: false,
                        error: "No liquidity available"
                    };
                    failedTokens.push({
                        symbol: token.symbol,
                        address: token.address
                    });
                }
            }

            setConversionQuotes(quotes);
            setTotalReceived(total.toFixed(6));

            // Auto-deselect failed tokens
            setSelectedTokens(successfulTokens);

            // Show warning if there are failed tokens
            if (failedTokens.length > 0) {
                setWarningData({
                    title: "Some Quotes Failed",
                    description: `Unable to get quotes for ${failedTokens.length} token(s). These tokens have been automatically deselected. You can still convert the remaining ${successfulTokens.length} tokens.`,
                    failedTokens: failedTokens,
                    successfulTokens: successfulTokens
                });
                setShowWarningPopup(true);
            }

        } catch (error) {
            console.error("Quote fetching failed:", error);
            setErrorData({
                title: "Quote Failed",
                description: "Failed to get conversion quotes. Please try again."
            });
            setShowErrorPopup(true);
        } finally {
            setFetchingQuotes(false);
        }
    };

    // Continue with conversion despite failed quotes
    const continueWithSuccessfulTokens = () => {
        setShowWarningPopup(false);
    };

    // Handle token selection
    const handleTokenSelect = (tokenAddress) => {
        setSelectedTokens(prev => {
            if (prev.includes(tokenAddress)) {
                return prev.filter(addr => addr !== tokenAddress);
            } else {
                return [...prev, tokenAddress];
            }
        });
    };

    // Handle select all tokens
    const handleSelectAll = () => {
        if (selectedTokens.length === detectedTokens.length) {
            setSelectedTokens([]);
        } else {
            setSelectedTokens(detectedTokens.map(token => token.address));
        }
    };

    // Handle account change
    const handleAccountChange = useCallback((val) => {
        const selected = allSmartAccounts.find(acc => acc.address === val);
        setSelectedSmartAccount(selected);
        setDetectedTokens([]);
        setSelectedTokens([]);
        setConversionQuotes({});
        setTotalReceived("0");
    }, [allSmartAccounts]);

    // Handle target token change
    const handleTargetTokenChange = (newTargetToken) => {
        setTargetToken(newTargetToken);
        setDetectedTokens([]);
        setSelectedTokens([]);
        setConversionQuotes({});
        setTotalReceived("0");
    };

    const canDetectTokens = useMemo(() => {
        return isConnected && selectedSmartAccount?.address;
    }, [isConnected, selectedSmartAccount]);

    const canFetchQuotes = useMemo(() => {
        return selectedTokens.length > 0 && detectedTokens.length > 0 && selectedSmartAccount?.address;
    }, [selectedTokens, detectedTokens, selectedSmartAccount]);

    const canConvert = useMemo(() => {
        const successfulTokens = selectedTokens.filter(address =>
            conversionQuotes[address]?.success === true
        );
        return successfulTokens.length > 0 &&
            parseFloat(totalReceived) > 0 &&
            !converting &&
            selectedSmartAccount?.address;
    }, [selectedTokens, conversionQuotes, totalReceived, converting, selectedSmartAccount]);

    // Get count of successful tokens
    const successfulTokensCount = useMemo(() => {
        return selectedTokens.filter(address =>
            conversionQuotes[address]?.success === true
        ).length;
    }, [selectedTokens, conversionQuotes]);

    // Get count of failed tokens
    const failedTokensCount = useMemo(() => {
        return selectedTokens.filter(address =>
            conversionQuotes[address] && !conversionQuotes[address]?.success
        ).length;
    }, [selectedTokens, conversionQuotes]);

    // Prepare data for batch conversion
    const prepareConversionData = () => {
        const conversionData = selectedTokens
            .filter(tokenAddress => conversionQuotes[tokenAddress]?.success === true)
            .map(tokenAddress => {
                const token = detectedTokens.find(t => t.address === tokenAddress);
                const quote = conversionQuotes[tokenAddress];

                return {
                    tokenAddress: token.address,
                    amount: token.balance,
                    quoteData: quote.raw
                };
            });

        return conversionData;
    };

    const executeBatchConversion = async () => {
        if (!selectedSmartAccount?.address || !selectedSmartAccount?.salt) return;

        setConverting(true);

        try {
            const conversionData = prepareConversionData();
            const successfulConversions = conversionData.filter(item => item.quoteData);

            if (successfulConversions.length === 0) {
                setErrorData({
                    title: "No Valid Tokens",
                    description: "No tokens with valid quotes available for conversion."
                });
                setShowErrorPopup(true);
                setConverting(false);
                return;
            }

            console.log("Executing batch conversion for:", successfulConversions.length, "tokens");

            const hash = await batchSwapERC20ToMon(successfulConversions, selectedSmartAccount.salt);

            if (!hash) {
                throw new Error('Batch conversion transaction failed - no hash returned');
            }

            console.log("Batch conversion successful, transaction hash:", hash);

            // Set success data for popup
            setSuccessData({
                txHash: hash,
                targetToken: targetToken,
                totalReceived: totalReceived,
                convertedTokens: successfulConversions.length
            });

            setShowSuccessPopup(true);

            // Reset after successful conversion
            setSelectedTokens([]);
            setConversionQuotes({});
            setTotalReceived("0");

            // Refresh token detection after a delay
            setTimeout(() => {
                detectERC20Tokens();
            }, 2000);

        } catch (error) {
            console.error("Batch conversion failed:", error);
            setErrorData({
                title: "Conversion Failed",
                description: error.message || "Batch conversion transaction failed. Please try again."
            });
            setShowErrorPopup(true);
        } finally {
            setConverting(false);
        }
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
                        <h3 className="text-md font-semibold">Batch Convert</h3>
                        <p className="text-xs text-muted-foreground">Convert all ERC20</p>
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
                    </div>
                </div>

                {/* Target Token Selection */}
                <div className="bg-white/5 rounded-2xl p-4 mb-4">
                    <Label className="text-sm text-muted-foreground mb-2 block">Convert to</Label>
                    <div className="space-y-3">
                        <p className="text-xs font-semibold">All selected tokens will be converted to:</p>
                        <div className="w-full">
                            <TokenSelect
                                selected={targetToken}
                                onChange={handleTargetTokenChange}
                                disabled={!selectedSmartAccount}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {selectedSmartAccount
                                ? `${targetToken.symbol} will be excluded from detected tokens`
                                : "Select a smart account first"
                            }
                        </p>
                    </div>
                </div>

                {/* Token Detection Section */}
                <div className="bg-white/5 rounded-2xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-4">
                        <Label className="text-xs text-muted-foreground">Detected ERC20 Tokens</Label>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                                {detectedTokens.length} tokens found
                            </span>
                            <Button
                                onClick={detectERC20Tokens}
                                disabled={!canDetectTokens || detectingTokens}
                                size="sm"
                                className="flex items-center gap-2 text-xs"
                            >
                                {detectingTokens ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Zap className="w-4 h-4" />
                                )}
                                {detectingTokens ? "Detecting..." : "Detect Tokens"}
                            </Button>
                        </div>
                    </div>

                    {/* Token List */}
                    <div className="max-h-60 overflow-y-auto">
                        {detectingTokens ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="w-6 h-6 animate-spin" />
                                <span className="ml-2 text-xs text-muted-foreground">Detecting tokens...</span>
                            </div>
                        ) : detectedTokens.length > 0 ? (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 p-2 border-b border-white/10">
                                    <Checkbox
                                        checked={selectedTokens.length === detectedTokens.length && detectedTokens.length > 0}
                                        onCheckedChange={handleSelectAll}
                                        disabled={detectedTokens.length === 0}
                                    />
                                    <span className="text-xs text-muted-foreground">
                                        Select All ({selectedTokens.length}/{detectedTokens.length})
                                    </span>
                                </div>
                                {detectedTokens.map((token) => {
                                    const quote = conversionQuotes[token.address];
                                    const isSelected = selectedTokens.includes(token.address);
                                    const hasQuote = quote !== undefined;
                                    const isQuoteSuccessful = quote?.success;

                                    return (
                                        <div
                                            key={token.address}
                                            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isSelected
                                                    ? isQuoteSuccessful
                                                        ? "bg-green-500/10 border border-green-500/20"
                                                        : hasQuote && !isQuoteSuccessful
                                                            ? "bg-red-500/10 border border-red-500/20"
                                                            : "bg-white/5 hover:bg-white/10"
                                                    : "bg-white/5 hover:bg-white/10"
                                                }`}
                                        >
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => handleTokenSelect(token.address)}
                                            />
                                            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                                                {token?.image_url ? (
                                                    <img
                                                        src={token.image_url}
                                                        alt={token.symbol}
                                                        className="w-full h-full rounded-full object-cover"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.nextSibling.style.display = 'flex';
                                                        }}
                                                    />
                                                ) : null}
                                                <span
                                                    className="text-xs font-medium text-white"
                                                    style={{ display: token?.image_url ? 'none' : 'flex' }}
                                                >
                                                    {token?.symbol?.charAt(0) || '?'}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm">{token.symbol}</span>
                                                        {token.verified && (
                                                            <Badge variant="outline" className="text-xs px-1 py-0">
                                                                ✓
                                                            </Badge>
                                                        )}
                                                        {hasQuote && !isQuoteSuccessful && (
                                                            <Badge variant="outline" className="text-xs px-1 py-0 bg-red-500/20 text-red-400 border-red-500/30">
                                                                No Quote
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <span className="font-semibold text-sm">{token.balanceFormatted}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-muted-foreground truncate">{token.name}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {isQuoteSuccessful
                                                            ? `~${quote.output} ${targetToken.symbol}`
                                                            : quote?.error || ""
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-muted-foreground text-xs">
                                {!isConnected
                                    ? "Connect your wallet to start"
                                    : !selectedSmartAccount
                                        ? "Select a smart account to detect tokens"
                                        : "Click 'Detect Tokens' to find ERC20 tokens in your wallet"
                                }
                            </div>
                        )}
                    </div>
                </div>

                {/* Status Summary */}
                {(successfulTokensCount > 0 || failedTokensCount > 0) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="bg-blue-500/10 rounded-2xl p-4 mb-4 border border-blue-500/20"
                    >
                        <h3 className="text-sm font-semibold mb-2 text-blue-300">Conversion Status</h3>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Tokens with quotes:</span>
                                <span className="text-green-400">{successfulTokensCount} ready</span>
                            </div>
                            {failedTokensCount > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Tokens without quotes:</span>
                                    <span className="text-red-400">{failedTokensCount} failed</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Total to receive:</span>
                                <span className="font-semibold">{totalReceived} {targetToken.symbol}</span>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 mb-4">
                    <Button
                        onClick={fetchConversionQuotes}
                        disabled={!canFetchQuotes || fetchingQuotes}
                        variant="outline"
                        className="flex-1"
                    >
                        {fetchingQuotes ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Getting Quotes...
                            </>
                        ) : (
                            "Get Conversion Quotes"
                        )}
                    </Button>
                </div>

                {/* Convert Button */}
                <Button
                    onClick={executeBatchConversion}
                    disabled={!canConvert}
                    className={cn(
                        "w-full py-3 rounded-xl text-md font-semibold transition-all",
                        canConvert
                            ? "bg-green-600 hover:bg-green-700"
                            : "bg-gray-600 cursor-not-allowed"
                    )}
                >
                    {converting ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Converting Tokens...
                        </>
                    ) : (
                        `Convert ${successfulTokensCount} Tokens to ${targetToken.symbol}`
                    )}
                </Button>
            </motion.div>

            {/* Success Popup */}
            <BatchConvertSuccessPopup
                open={showSuccessPopup}
                onOpenChange={setShowSuccessPopup}
                conversionData={successData}
            />

            {/* Warning Popup */}
            <PopUpWarning
                open={showWarningPopup}
                onOpenChange={setShowWarningPopup}
                title={warningData.title}
                description={warningData.description}
                onContinue={continueWithSuccessfulTokens}
            />

            {/* Error Popup */}
            <PopUpError
                open={showErrorPopup}
                onOpenChange={setShowErrorPopup}
                title={errorData.title}
                description={errorData.description}
            />
        </>
    );
}
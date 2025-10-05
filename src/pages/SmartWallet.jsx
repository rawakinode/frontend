import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { Wallet, ExternalLink, Copy, CheckCircle, AlertCircle, Plus, Loader2, Unplug, XCircle, Check, ArrowDownUp } from "lucide-react";

import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import { getSmartAccounts, deploySmartContract } from "@/hooks/useSmartAccount";
import { getBalancesAllToken } from "@/hooks/useMonorail";
import { Slider } from "@/components/ui/slider";
import { deposit, withdraw } from "@/hooks/useWallet";
import { Skeleton } from "@/components/ui/skeleton";

const ITEMS_PER_PAGE = 3;

// Transaction Success Popup Component
function TransactionSuccessPopup({ open, onOpenChange, txData }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(txData.txHash);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shortenHash = (hash) => {
        if (!hash) return "";
        return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
    };

    const formatAddress = (address) => {
        if (!address) return "";
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
                                <CheckCircle className="w-12 h-12 text-green-500" />
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
                        <h2 className="text-2xl font-bold mb-2">
                            {txData.type === "deposit" ? "Deposit" : "Withdraw"} Successful!
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Your transaction has been submitted successfully
                        </p>
                    </motion.div>

                    {/* Transaction Details */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white/5 rounded-xl p-4 mb-4"
                    >
                        <div className="space-y-3">
                            {/* Amount and Token */}
                            <div className="flex items-center justify-center gap-2 mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                                        <span className="text-sm font-medium">{txData.token?.charAt(0)}</span>
                                    </div>
                                    <span className="text-2xl font-bold">{txData.amount} {txData.token}</span>
                                </div>
                            </div>

                            {/* Arrow and Type */}
                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                <ArrowDownUp className="w-4 h-4" />
                                <span className="text-sm font-medium">
                                    {txData.type === "deposit" ? "Deposited to" : "Withdrawn from"}
                                </span>
                            </div>

                            {/* Wallet Address */}
                            <div className="bg-white/5 rounded-lg p-3 text-center">
                                <p className="text-xs text-muted-foreground mb-1">Smart Wallet</p>
                                <p className="font-mono text-sm">{formatAddress(txData.walletAddress)}</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Transaction Hash */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white/5 rounded-xl p-4 mb-6"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground mb-1">Transaction Hash</p>
                                <p className="font-mono text-sm truncate">{shortenHash(txData.txHash)}</p>
                            </div>
                            <div className="flex gap-2 ml-4">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleCopy}
                                    className="h-8 w-8 flex-shrink-0"
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
                                    className="h-8 w-8 flex-shrink-0"
                                >
                                    <a
                                        href={`https://testnet.monadexplorer.com/tx/${txData.txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                </Button>
                            </div>
                        </div>
                    </motion.div>

                    {/* Action Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="flex gap-3"
                    >
                        <Button
                            onClick={() => onOpenChange(false)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                            Done
                        </Button>
                    </motion.div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function SmartWallet() {
    const [smartWallets, setSmartWallets] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isCreating, setIsCreating] = useState(false);
    const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);
    const [isDepositConfirmOpen, setIsDepositConfirmOpen] = useState(false);
    const [depositTokenList, setDepositTokenList] = useState([]);
    const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
    const [isWithdrawConfirmOpen, setIsWithdrawConfirmOpen] = useState(false);
    const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
    const [isFailedDialogOpen, setIsFailedDialogOpen] = useState(false);
    const [selectedWallet, setSelectedWallet] = useState(null);
    const [selectedToken, setSelectedToken] = useState({});
    const [withdrawTokenList, setWithdrawTokenList] = useState([]);
    const [sliderValue, setSliderValue] = useState([0]);
    const [amount, setAmount] = useState("");
    const [transactionHash, setTransactionHash] = useState("");
    const [copiedAddress, setCopiedAddress] = useState("");
    const [isDataLoading, setIsDataLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isFetchingWithdrawTokens, setIsFetchingWithdrawTokens] = useState(false);
    const [transactionType, setTransactionType] = useState("");
    const [saltForWithdraw, setSaltForWithdraw] = useState("");

    // Transaction Success Popup State
    const [showTxSuccessPopup, setShowTxSuccessPopup] = useState(false);
    const [txSuccessData, setTxSuccessData] = useState({
        txHash: "",
        type: "",
        amount: "",
        token: "",
        walletAddress: ""
    });

    const { address, isConnected } = useAccount();
    const [lastSalt, setLastSalt] = useState('0x0');

    const {
        data: transactionReceipt,
        isSuccess: isTransactionSuccess,
        isError: isTransactionError,
        error: transactionError
    } = useWaitForTransactionReceipt({
        hash: transactionHash ? transactionHash : undefined,
        confirmations: 1,
    });

    useEffect(() => {
        const handleTransactionResult = async () => {
            if (!transactionHash) return;

            if (isTransactionSuccess && transactionReceipt) {
                // Set data untuk popup success
                setTxSuccessData({
                    txHash: transactionHash,
                    type: transactionType,
                    amount: amount,
                    token: selectedToken.symbol,
                    walletAddress: selectedWallet.address
                });
                
                // Tampilkan popup success yang baru
                setShowTxSuccessPopup(true);

                try {
                    const updatedWallets = await getSmartAccounts(true);
                    setSmartWallets(updatedWallets);
                } catch (error) {
                    console.error("Error refreshing wallets:", error);
                }

                setIsCreating(false);
                setIsProcessing(false);
                setTransactionHash("");
            } else if (isTransactionError) {
                setIsFailedDialogOpen(true);
                setIsCreating(false);
                setIsProcessing(false);

                if (transactionError?.message?.includes('rejected') ||
                    transactionError?.message?.includes('denied')) {
                    console.log("User rejected transaction");
                    setIsFailedDialogOpen(false);
                }
            }
        };

        handleTransactionResult();
    }, [isTransactionSuccess, isTransactionError, transactionReceipt, transactionError, transactionHash]);

    const fetchSmartAccounts = async () => {
        if (!isConnected || !address) return;

        setIsDataLoading(true);
        try {
            const sm = await getSmartAccounts(true);
            if (sm.length > 0) {
                let salts = sm[sm.length - 1]['address'];
                setLastSalt(salts);
            }
            setSmartWallets(sm);

            const b = await getBalancesAllToken(address);
            setDepositTokenList(b);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setIsDataLoading(false);
        }
    };

    const fetchWithdrawTokens = async (walletAddress) => {
        setIsFetchingWithdrawTokens(true);
        try {
            const tokens = await getBalancesAllToken(walletAddress);
            setWithdrawTokenList(tokens);
            return tokens;
        } catch (error) {
            console.error("Error fetching withdraw tokens:", error);
            setWithdrawTokenList([]);
            return [];
        } finally {
            setIsFetchingWithdrawTokens(false);
        }
    };

    useEffect(() => {
        fetchSmartAccounts();
    }, [address, isConnected]);

    const sortedWallets = useMemo(() => {
        return [...smartWallets].sort((a, b) => b.totalValueUSD - a.totalValueUSD);
    }, [smartWallets]);

    const totalPages = Math.ceil(sortedWallets.length / ITEMS_PER_PAGE);

    const currentWallets = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return sortedWallets.slice(startIndex, endIndex);
    }, [sortedWallets, currentPage]);

    const generatePaginationLinks = () => {
        const pages = [];
        const maxVisiblePages = 3;

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(
                    <PaginationItem key={i}>
                        <PaginationLink
                            href="#"
                            isActive={currentPage === i}
                            onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(i);
                            }}
                        >
                            {i}
                        </PaginationLink>
                    </PaginationItem>
                );
            }
        } else {
            if (currentPage > 2) {
                pages.push(<PaginationEllipsis key="ellipsis-start" />);
            }

            const startPage = Math.max(1, currentPage - 1);
            const endPage = Math.min(totalPages, currentPage + 1);

            for (let i = startPage; i <= endPage; i++) {
                pages.push(
                    <PaginationItem key={i}>
                        <PaginationLink
                            href="#"
                            isActive={currentPage === i}
                            onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(i);
                            }}
                        >
                            {i}
                        </PaginationLink>
                    </PaginationItem>
                );
            }

            if (currentPage < totalPages - 1) {
                pages.push(<PaginationEllipsis key="ellipsis-end" />);
            }
        }

        return pages;
    };

    const handlePreviousPage = (e) => {
        e.preventDefault();
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleNextPage = (e) => {
        e.preventDefault();
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const handleCreateSmartWallet = async () => {
        setIsCreating(true);
        try {
            const hash = await deploySmartContract(lastSalt);

            if (hash) {
                await new Promise(r => setTimeout(r, 3000));
                setIsCreating(false);
                setIsProcessing(false);
                setTransactionHash("");
                await fetchSmartAccounts();
            } else {
                setIsFailedDialogOpen(true);
                setIsCreating(false);
            }
        } catch (error) {
            console.error("Error creating wallet:", error);
            setIsFailedDialogOpen(true);
            setIsCreating(false);
        }
    };

    const handleDeposit = (wallet) => {
        setSelectedWallet(wallet);
        setSelectedToken({});
        setAmount("");
        setSliderValue([0]);
        setIsDepositDialogOpen(true);
    };

    const handleWithdraw = async (wallet) => {
        setSelectedWallet(wallet);
        setSelectedToken({});
        setAmount("");
        setSliderValue([0]);
        setSaltForWithdraw(wallet.salt);
        setIsWithdrawDialogOpen(true);
        await fetchWithdrawTokens(wallet.address);
    };

    const handleConfirmDeposit = async () => {
        if (!selectedToken || !amount || amount <= 0) return;
        setIsDepositDialogOpen(false);
        setIsDepositConfirmOpen(true);
        setTransactionType("deposit");
    };

    const handleConfirmWithdraw = async () => {
        if (!selectedToken || !amount || amount <= 0) return;
        setIsWithdrawDialogOpen(false);
        setIsWithdrawConfirmOpen(true);
        setTransactionType("withdraw");
    };

    const executeTransaction = async () => {
        setIsProcessing(true);
        setIsDepositConfirmOpen(false);
        setIsWithdrawConfirmOpen(false);

        try {
            let tx;
            if (transactionType === "deposit") {
                tx = await deposit(selectedWallet.address, amount, selectedToken.address, selectedToken.decimals);
            } else {
                tx = await withdraw(address, amount, selectedToken.address, selectedToken.decimals, saltForWithdraw);
            }

            if (tx) {
                setTransactionHash(tx);
            } else {
                throw new Error("Transaction returned null");
            }
        } catch (error) {
            console.error("Transaction error:", error);
            if (error.message?.includes('rejected') ||
                error.message?.includes('denied') ||
                error.code === 4001) {
                console.log("User rejected transaction");
            } else {
                setIsFailedDialogOpen(true);
            }
            setIsProcessing(false);
        }
    };

    const copyAddress = (address) => {
        navigator.clipboard.writeText(address);
        setCopiedAddress(address);
        setTimeout(() => setCopiedAddress(""), 2000);
    };

    const formatAddress = (address) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const handleSliderChange = (val) => {
        setSliderValue(val);
        const percent = val[0] / 100;
        const amountValue = Math.floor(Number(selectedToken.balance) * percent * 1000000000) / 1000000000;
        setAmount(amountValue.toString());
    };

    const handleAmountChange = (val) => {
        setAmount(val);
        if (selectedToken && selectedToken.balance) {
            const percent = (val / selectedToken.balance) * 100;
            setSliderValue([Math.min(100, Math.max(0, percent))]);
        }
    };

    const handleMaxAmount = () => {
        if (selectedToken && selectedToken.balance) {
            setAmount(selectedToken.balance.toString());
            setSliderValue([100]);
        }
    };

    const handleDepositDialogClose = () => {
        setIsDepositDialogOpen(false);
        setSelectedToken({});
        setAmount("");
        setSliderValue([0]);
    };

    const handleWithdrawDialogClose = () => {
        setIsWithdrawDialogOpen(false);
        setSelectedToken({});
        setAmount("");
        setSliderValue([0]);
        setWithdrawTokenList([]);
    };

    return (
        <div className="w-full p-2">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-[400px] w-full mx-auto bg-card backdrop-blur-xl rounded-3xl p-6 border border-card shadow-2xl mt-10"
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-md font-bold">Smart Accounts</h2>
                    <Button
                        onClick={handleCreateSmartWallet}
                        disabled={isCreating || !isConnected || isDataLoading}
                        size="sm"
                        className="flex items-center font-bold gap-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isCreating ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Plus className="h-4 w-4" />
                                Create
                            </>
                        )}
                    </Button>
                </div>

                {isConnected && !isDataLoading && (
                    <div className="space-y-4 mb-6">
                        {currentWallets.length > 0 ? (
                            currentWallets.map((wallet) => (
                                <Card key={wallet.id} className="relative p-4">
                                    <CardHeader className="flex flex-row justify-between items-center p-0 pb-3">
                                        <div className="flex items-center gap-2">
                                            <Wallet className="h-4 w-4 text-blue-500" />
                                            <span className="text-sm font-medium">
                                                {formatAddress(wallet.address)}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={() => copyAddress(wallet.address)}
                                            >
                                                {copiedAddress === wallet.address ? (
                                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                                ) : (
                                                    <Copy className="h-3 w-3" />
                                                )}
                                            </Button>
                                        </div>
                                        <Badge className="bg-green-800 text-white text-xs hover:bg-green-800">
                                            ${wallet.totalValueUSD.toLocaleString()}
                                        </Badge>
                                    </CardHeader>

                                    <CardContent className="p-0 space-y-3">
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between items-center">
                                                <span className="font-semibold">MON Balance:</span>
                                                <span>{wallet.monBalance} MON</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="flex-1 text-xs"
                                                onClick={() => handleDeposit(wallet)}
                                            >
                                                Deposit
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 text-xs"
                                                onClick={() => handleWithdraw(wallet)}
                                            >
                                                Withdraw
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center p-6 border rounded-2xl bg-muted/40 text-center">
                                <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
                                <p className="text-sm font-medium text-muted-foreground">
                                    No smart wallets found
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {isConnected && isDataLoading && (
                    <div className="flex flex-col space-y-3">
                        <Skeleton className="h-[100px] w-full rounded-xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-[250px]" />
                            <Skeleton className="h-4 w-[200px]" />
                        </div>
                    </div>
                )}

                {!isConnected && (
                    <div className="flex flex-col items-center justify-center p-6 border rounded-2xl bg-muted/40 text-center">
                        <Unplug className="w-8 h-8 text-muted-foreground my-4" />
                        <p className="text-sm font-medium text-muted-foreground">
                            Please connect first
                        </p>
                    </div>
                )}

                {isConnected && totalPages > 1 && (
                    <>
                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        href="#"
                                        onClick={handlePreviousPage}
                                        className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                                    />
                                </PaginationItem>
                                {generatePaginationLinks()}
                                <PaginationItem>
                                    <PaginationNext
                                        href="#"
                                        onClick={handleNextPage}
                                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                        <div className="text-center text-xs text-muted-foreground mt-2">
                            Page {currentPage} of {totalPages} • {sortedWallets.length} accounts total
                        </div>
                    </>
                )}
            </motion.div>

            {/* Deposit Dialog */}
            <Dialog open={isDepositDialogOpen} onOpenChange={handleDepositDialogClose}>
                <DialogContent className="max-w-[400px] bg-card">
                    <DialogHeader>
                        <DialogTitle>Deposit Funds</DialogTitle>
                        <DialogDescription className="text-xs">
                            Deposit tokens to your smart wallet {selectedWallet && formatAddress(selectedWallet.address)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="token">Token</Label>
                            <Select
                                value={selectedToken.symbol || ""}
                                onValueChange={(symbol) => {
                                    const token = depositTokenList.find(t => t.symbol === symbol);
                                    setSelectedToken(token || {});
                                    setAmount("");
                                    setSliderValue([0]);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select token" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60 overflow-y-auto">
                                    {depositTokenList.map((t) => {
                                        if (!t.symbol) return null;
                                        return (
                                            <SelectItem key={t.address} value={t.symbol}>
                                                {t.symbol}
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedToken.symbol && (
                            <>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label htmlFor="amount">Amount</Label>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleMaxAmount}
                                            className="text-xs h-6"
                                        >
                                            Max
                                        </Button>
                                    </div>
                                    <Input
                                        id="amount"
                                        type="number"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={(e) => handleAmountChange(e.target.value)}
                                        min="0"
                                        max={selectedToken.balance}
                                    />
                                    <div className="text-xs text-muted-foreground">
                                        Balance: {selectedToken.balance} {selectedToken.symbol}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Use Balance (%)</Label>
                                    <Slider
                                        value={sliderValue}
                                        onValueChange={handleSliderChange}
                                        max={100}
                                        step={1}
                                    />
                                    <p className="text-xs text-muted-foreground">{sliderValue[0]}%</p>
                                </div>
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleDepositDialogClose}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmDeposit}
                            disabled={!selectedToken.symbol || !amount || amount <= 0 || Number(amount) > Number(selectedToken.balance)}
                        >
                            Confirm Deposit
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Withdraw Dialog */}
            <Dialog open={isWithdrawDialogOpen} onOpenChange={handleWithdrawDialogClose}>
                <DialogContent className="max-w-[400px] bg-card">
                    <DialogHeader>
                        <DialogTitle>Withdraw Funds</DialogTitle>
                        <DialogDescription>
                            Withdraw tokens from your smart wallet {selectedWallet && formatAddress(selectedWallet.address)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="withdraw-token">Token</Label>
                            <Select
                                value={selectedToken.symbol || ""}
                                onValueChange={(symbol) => {
                                    const token = withdrawTokenList.find(t => t.symbol === symbol);
                                    setSelectedToken(token || {});
                                    setAmount("");
                                    setSliderValue([0]);
                                }}
                                disabled={isFetchingWithdrawTokens}
                            >
                                <SelectTrigger>
                                    {isFetchingWithdrawTokens ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Loading tokens...
                                        </div>
                                    ) : (
                                        <SelectValue placeholder="Select token" />
                                    )}
                                </SelectTrigger>
                                <SelectContent>
                                    {withdrawTokenList.map((token, index) => (
                                        <SelectItem key={index} value={token.symbol}>
                                            {token.symbol}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedToken.symbol && (
                            <>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label htmlFor="withdraw-amount">Amount</Label>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setAmount(selectedToken.balance);
                                                setSliderValue([100]);
                                            }}
                                            className="text-xs h-6"
                                        >
                                            Max
                                        </Button>
                                    </div>
                                    <Input
                                        id="withdraw-amount"
                                        type="number"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={(e) => handleAmountChange(e.target.value)}
                                        min="0"
                                        max={selectedToken.balance}
                                    />
                                    <div className="text-xs text-muted-foreground">
                                        Balance: {selectedToken.balance} {selectedToken.symbol}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Use Balance (%)</Label>
                                    <Slider
                                        value={sliderValue}
                                        onValueChange={handleSliderChange}
                                        max={100}
                                        step={1}
                                    />
                                    <p className="text-xs text-muted-foreground">{sliderValue[0]}%</p>
                                </div>
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleWithdrawDialogClose}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmWithdraw}
                            disabled={!selectedToken.symbol || !amount || amount <= 0 || Number(amount) > Number(selectedToken.balance) || isFetchingWithdrawTokens}
                        >
                            Confirm Withdraw
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Deposit Confirmation Dialog */}
            <Dialog open={isDepositConfirmOpen} onOpenChange={setIsDepositConfirmOpen}>
                <DialogContent className="max-w-[400px] bg-card">
                    <DialogHeader>
                        <DialogTitle>Confirm Deposit</DialogTitle>
                        <DialogDescription>
                            Please confirm your deposit transaction
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="text-muted-foreground">Amount:</div>
                            <div className="text-right">{amount} {selectedToken.symbol}</div>
                            <div className="text-muted-foreground">To Wallet:</div>
                            <div className="text-right">{selectedWallet && formatAddress(selectedWallet.address)}</div>
                            <div className="text-muted-foreground">Token:</div>
                            <div className="text-right">{selectedToken.symbol}</div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDepositConfirmOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={executeTransaction} disabled={isProcessing}>
                            {isProcessing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Processing...
                                </>
                            ) : (
                                "Confirm Transaction"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Withdraw Confirmation Dialog */}
            <Dialog open={isWithdrawConfirmOpen} onOpenChange={setIsWithdrawConfirmOpen}>
                <DialogContent className="max-w-[400px] bg-card">
                    <DialogHeader>
                        <DialogTitle>Confirm Withdraw</DialogTitle>
                        <DialogDescription>
                            Please confirm your withdrawal transaction
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="text-muted-foreground">Amount:</div>
                            <div className="text-right">{amount} {selectedToken.symbol}</div>
                            <div className="text-muted-foreground">From Wallet:</div>
                            <div className="text-right">{selectedWallet && formatAddress(selectedWallet.address)}</div>
                            <div className="text-muted-foreground">Token:</div>
                            <div className="text-right">{selectedToken.symbol}</div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsWithdrawConfirmOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={executeTransaction} disabled={isProcessing}>
                            {isProcessing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Processing...
                                </>
                            ) : (
                                "Confirm Transaction"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* OLD Success Dialog - Tetap ada untuk backward compatibility */}
            <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
                <DialogContent className="max-w-[350px] bg-card">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-green-600 text-md">
                            <CheckCircle className="h-5 w-5" />
                            Transaction Successful
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <p className="text-xs">
                            Your transaction has been completed.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => {
                            setIsSuccessDialogOpen(false);
                            setTransactionHash("");
                        }}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Failed Dialog */}
            <Dialog open={isFailedDialogOpen} onOpenChange={setIsFailedDialogOpen}>
                <DialogContent className="max-w-[350px] bg-card">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600 text-md">
                            <XCircle className="h-5 w-5" />
                            Transaction Failed
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <p className="text-xs">
                            Your transaction failed. Please try again.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => {
                            setIsFailedDialogOpen(false);
                            setTransactionHash("");
                        }}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* NEW Transaction Success Popup - Desain seperti Swap */}
            <TransactionSuccessPopup
                open={showTxSuccessPopup}
                onOpenChange={setShowTxSuccessPopup}
                txData={txSuccessData}
            />
        </div>
    );
}
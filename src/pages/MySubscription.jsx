// src/components/features/MySubscription.jsx
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MoreVertical, AlertCircle, Unplug, Loader2, X, CheckCircle, XCircle, Calendar, Clock, Repeat, RefreshCcw } from "lucide-react";
import { useAccount } from "wagmi";
import { getSmartAccounts } from "@/hooks/useSmartAccount";
import { useAuth } from "@/context/AuthContext";

// ✅ IMPORT ACCORDION COMPONENTS
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

const statusColor = {
    active: "bg-green-600",
    canceled: "bg-gray-600",
    completed: "bg-blue-600",
    expired: "bg-orange-600"
};

const frequencyLabels = {
    "1hour": "Every 1 hour",
    "12hours": "Every 12 hours",
    "daily": "Every day",
    "3days": "Every 3 days",
    "weekly": "Every week",
    "biweekly": "Every 2 weeks",
    "monthly": "Every month",
    "custom": "Custom interval"
};

const durationLabels = {
    "1day": "1 Day",
    "1week": "1 Week",
    "2weeks": "2 Weeks",
    "1month": "1 Month",
    "3months": "3 Months",
    "6months": "6 Months",
    "1year": "1 Year",
    "indefinite": "Indefinite"
};

// Items per page
const ITEMS_PER_PAGE = 3;

// Helper function untuk extract nilai dari MongoDB format
const extractMongoValue = (value) => {
    if (!value) return 0;
    if (typeof value === 'object' && value.$numberInt) {
        return parseInt(value.$numberInt);
    }
    if (typeof value === 'object' && value.$numberLong) {
        return parseInt(value.$numberLong);
    }
    if (typeof value === 'object' && value.$date) {
        return extractMongoValue(value.$date);
    }
    return value;
};

// Fungsi untuk memformat timestamp
const formatTimestamp = (timestamp) => {
    const extractedTimestamp = extractMongoValue(timestamp);
    if (!extractedTimestamp) return "N/A";

    // Jika timestamp dalam detik (Unix timestamp), convert ke milidetik
    const date = extractedTimestamp > 10000000000
        ? new Date(extractedTimestamp) // Sudah dalam milidetik
        : new Date(extractedTimestamp * 1000); // Convert dari detik ke milidetik

    return date.toLocaleString();
};

// Fungsi untuk menghitung waktu sampai next execution
const calculateTimeUntilNextExecution = (nextExecutionTimestamp) => {
    const extractedTimestamp = extractMongoValue(nextExecutionTimestamp);
    if (!extractedTimestamp) return "N/A";

    const now = Math.floor(Date.now() / 1000);
    const executeTime = extractedTimestamp;
    const diff = executeTime - now;

    if (diff <= 0) return "Now";

    const days = Math.floor(diff / (24 * 60 * 60));
    const hours = Math.floor((diff % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((diff % (60 * 60)) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};

// Fungsi untuk mendapatkan custom interval label
const getCustomIntervalLabel = (customInterval) => {
    if (!customInterval) return "Custom";

    const days = extractMongoValue(customInterval.days);
    const hours = extractMongoValue(customInterval.hours);

    if (days > 0 && hours > 0) {
        return `Every ${days}d ${hours}h`;
    } else if (days > 0) {
        return `Every ${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
        return `Every ${hours} hour${hours > 1 ? 's' : ''}`;
    }
    return "Custom";
};

// Confirmation Dialog Component
const ConfirmationDialog = ({ isOpen, onClose, onConfirm, subscription, loading }) => {
    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card rounded-2xl p-6 max-w-md w-full border border-border shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Cancel Subscription</h3>
                    <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="space-y-4 mb-6">
                    <p className="text-sm text-muted-foreground">
                        Are you sure you want to cancel this subscription? This action cannot be undone.
                    </p>

                    {/* Subscription Data Display */}
                    {subscription && (
                        <Card className="p-3 bg-muted/20">
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="font-semibold">Subscription:</span>
                                    <span>{subscription.from} → {subscription.to}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">Amount per swap:</span>
                                    <span>{subscription.amount} {subscription.from}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">Frequency:</span>
                                    <span>{subscription.frequencyLabel}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">Duration:</span>
                                    <span>{subscription.durationLabel}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">Executions:</span>
                                    <span>{subscription.executed}/{subscription.totalExecutions === 999 ? "∞" : subscription.totalExecutions}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">Next execution:</span>
                                    <span>{subscription.nextExecutionTime}</span>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>

                <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Keep Subscription
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex items-center gap-2"
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {loading ? "Cancelling..." : "Cancel Subscription"}
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    );
};

// Result Popup Component
const ResultPopup = ({ isOpen, onClose, isSuccess, message }) => {
    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card rounded-2xl p-6 max-w-sm w-full border border-border shadow-2xl text-center"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-center mb-4">
                    {isSuccess ? (
                        <CheckCircle className="h-12 w-12 text-green-500" />
                    ) : (
                        <XCircle className="h-12 w-12 text-red-500" />
                    )}
                </div>

                <h3 className={`text-lg font-bold mb-2 ${isSuccess ? 'text-green-500' : 'text-red-500'}`}>
                    {isSuccess ? 'Subscription Cancelled' : 'Cancellation Failed'}
                </h3>

                <p className="text-sm text-muted-foreground mb-4">
                    {message}
                </p>

                <Button onClick={onClose} className="w-full">
                    Close
                </Button>
            </motion.div>
        </motion.div>
    );
};

export default function MySubscription() {
    const [activeStatus, setActiveStatus] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [allSmartAccounts, setAllSmartAccounts] = useState([]);
    const [selectedSmartAccount, setSelectedSmartAccount] = useState("");
    const [subscriptionsData, setSubscriptionsData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // State untuk cancellation functionality
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [selectedSubscription, setSelectedSubscription] = useState(null);
    const [cancelling, setCancelling] = useState(false);
    const [resultPopup, setResultPopup] = useState({
        open: false,
        success: false,
        message: ""
    });

    const statuses = ["all", "active", "canceled", "completed", "expired"];

    const { getSubscriptionDataFromAPI, cancelSubscription } = useAuth();

    // wagmi
    const { address, isConnected } = useAccount();

    // Fetch smart accounts saat komponen mount
    useEffect(() => {
        const fetchSmartAccounts = async () => {
            if (isConnected && address) {
                try {
                    setLoading(true);
                    const accounts = await getSmartAccounts(false);
                    setAllSmartAccounts(accounts);
                    if (accounts.length > 0) {
                        setSelectedSmartAccount(accounts[0].address);
                    }
                } catch (err) {
                    console.error("Failed to fetch smart accounts:", err);
                    setError("Failed to load smart accounts");
                } finally {
                    setLoading(false)
                }
            }
        };

        fetchSmartAccounts();
    }, [isConnected, address]);

    // Fetch subscription data ketika smart account berubah
    const fetchSubscriptionData = useCallback(async (smartAccountAddress) => {
        if (!smartAccountAddress) return;

        setLoading(true);
        setError("");
        try {
            const response = await getSubscriptionDataFromAPI(smartAccountAddress);
            if (response.status === 'ok') {
                setSubscriptionsData(Array.isArray(response.data) ? response.data : [response.data]);
            }
        } catch (err) {
            console.error("Failed to fetch subscription data:", err);
            setError("Failed to load subscription data");
            setSubscriptionsData([]);
        } finally {
            setTimeout(() => setLoading(false), 1000);
        }
    }, []);

    useEffect(() => {
        if (selectedSmartAccount) {
            fetchSubscriptionData(selectedSmartAccount);
        }
    }, [selectedSmartAccount, fetchSubscriptionData]);

    // Map data dari API ke format subscription dengan handling MongoDB format
    const mappedSubscriptions = useMemo(() => {
        const subscriptions = subscriptionsData.map(sub => {
            // Extract values dari MongoDB format
            const frequency = sub.frequency;
            const customInterval = sub.customInterval;
            const duration = sub.duration;
            const amountFormatted = sub.amount_formatted;
            const totalExecutions = extractMongoValue(sub.totalExecutions);
            const executed = extractMongoValue(sub.executed);
            const nextExecutionTimestamp = extractMongoValue(sub.nextExecutionTimestamp);
            const created_at = extractMongoValue(sub.created_at);
            const startTimestamp = extractMongoValue(sub.startTimestamp);
            const endTimestamp = extractMongoValue(sub.endTimestamp);

            // Generate frequency label
            const frequencyLabel = frequency === 'custom'
                ? getCustomIntervalLabel(customInterval)
                : frequencyLabels[frequency] || frequency;

            const durationLabel = durationLabels[duration] || duration;
            const nextExecutionTime = calculateTimeUntilNextExecution(nextExecutionTimestamp);

            return {
                id: sub._id?.$oid || sub._id || Math.random().toString(),
                status: sub.status || "active",
                from: sub.paymentToken?.symbol || "UNKNOWN",
                to: sub.targetToken?.symbol || "UNKNOWN",
                amount: amountFormatted ? parseFloat(amountFormatted).toFixed(6) : "0",
                frequency: frequency,
                frequencyLabel,
                duration: duration,
                durationLabel,
                totalExecutions: totalExecutions || 0,
                executed: executed || 0,
                nextExecution: formatTimestamp(nextExecutionTimestamp),
                nextExecutionTime,
                createdTime: created_at,
                startTime: formatTimestamp(startTimestamp),
                endTime: formatTimestamp(endTimestamp),
                originalData: sub
            };
        });

        // Sort descending berdasarkan created time (baru → lama)
        return subscriptions.sort((a, b) => {
            const timeA = extractMongoValue(a.originalData.created_at);
            const timeB = extractMongoValue(b.originalData.created_at);
            return timeB - timeA;
        });
    }, [subscriptionsData]);

    // Filter subscriptions berdasarkan status aktif 
    const filteredSubscriptions = useMemo(() => {
        if (activeStatus === "all") return mappedSubscriptions;
        return mappedSubscriptions.filter(sub => sub.status === activeStatus);
    }, [mappedSubscriptions, activeStatus]);

    // Pagination logic
    const totalPages = Math.ceil(filteredSubscriptions.length / ITEMS_PER_PAGE);

    // Get subscriptions untuk halaman saat ini
    const currentSubscriptions = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return filteredSubscriptions.slice(startIndex, endIndex);
    }, [filteredSubscriptions, currentPage]);

    // Handler untuk membuka dialog konfirmasi cancel
    const handleOpenCancelDialog = (subscription) => {
        setSelectedSubscription(subscription);
        setCancelDialogOpen(true);
    };

    // Handler untuk menutup dialog konfirmasi cancel
    const handleCloseCancelDialog = () => {
        if (!cancelling) {
            setCancelDialogOpen(false);
            setSelectedSubscription(null);
        }
    };

    // Handler untuk eksekusi cancel subscription
    const handleConfirmCancel = async () => {
        if (!selectedSubscription || !selectedSmartAccount) return;

        setCancelling(true);
        try {
            // Panggil API untuk cancel subscription
            const response = await cancelSubscription(selectedSubscription.originalData._id);

            if (response.status === 'ok' || response.success) {
                // Show success popup
                setResultPopup({
                    open: true,
                    success: true,
                    message: "The subscription has been successfully cancelled."
                });

                // Refresh data subscriptions
                await fetchSubscriptionData(selectedSmartAccount);
            } else {
                throw new Error(response.message || "Failed to cancel subscription");
            }
        } catch (err) {
            console.error("Failed to cancel subscription:", err);
            // Show error popup
            setResultPopup({
                open: true,
                success: false,
                message: err.message || "Failed to cancel subscription. Please try again."
            });
        } finally {
            setCancelling(false);
            setCancelDialogOpen(false);
            setSelectedSubscription(null);
            await fetchSubscriptionData(selectedSmartAccount);
        }
    };

    // Handler untuk menutup result popup
    const handleCloseResultPopup = () => {
        setResultPopup(prev => ({ ...prev, open: false }));
    };

    // Generate pagination links dengan ellipsis
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

    const handleAccountChange = (value) => {
        setSelectedSmartAccount(value);
        setCurrentPage(1);
    };

    const handleStatusChange = (status) => {
        setActiveStatus(status);
        setCurrentPage(1);
    };

    return (
        <div className="w-full p-2">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-[400px] w-full mx-auto bg-card backdrop-blur-xl rounded-3xl p-6 border border-card shadow-2xl mt-10"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold">My Subscriptions</h3>
                </div>

                {/* Smart Account and Status Selection */}
                {isConnected && allSmartAccounts.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="space-y-2">
                            <label className="text-xs text-muted-foreground">Smart Account</label>
                            <Select onValueChange={handleAccountChange} value={selectedSmartAccount}>
                                <SelectTrigger className="w-full text-xs">
                                    <SelectValue placeholder="Select Smart Account" />
                                </SelectTrigger>
                                <SelectContent>
                                    {allSmartAccounts.map((acc, idx) => (
                                        <SelectItem key={idx} value={acc.address} className="text-xs">
                                            {`${acc.address.slice(0, 8)}...${acc.address.slice(-8)}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-muted-foreground">Status</label>
                            <Select onValueChange={handleStatusChange} value={activeStatus}>
                                <SelectTrigger className="w-full text-xs">
                                    <SelectValue placeholder="Select Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {statuses.map((status) => (
                                        <SelectItem key={status} value={status} className="text-xs">
                                            {status.charAt(0).toUpperCase() + status.slice(1)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {isConnected && loading && (
                    <div className="flex flex-col space-y-3">
                        <Skeleton className="h-[120px] w-full rounded-xl" />
                        <Skeleton className="h-[120px] w-full rounded-xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-[250px]" />
                        </div>
                    </div>
                )}

                {/* Error State */}
                {isConnected && error && !loading && (
                    <div className="flex flex-col items-center justify-center p-6 border rounded-2xl bg-red-500/10 text-center mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                        <p className="text-sm font-medium text-red-500">{error}</p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => selectedSmartAccount && fetchSubscriptionData(selectedSmartAccount)}
                        >
                            Retry
                        </Button>
                    </div>
                )}

                {/* Subscription List */}
                {isConnected && !loading && (
                    <div className="space-y-3 mb-6">
                        {currentSubscriptions.length > 0 ? (
                            currentSubscriptions.map((subscription) => (
                                <Card key={subscription.id} className="relative p-3 text-sm border-border/50">
                                    <CardHeader className="flex flex-row justify-between items-center p-0 pb-2">
                                        <div className="flex items-center gap-2">
                                            <Badge className={`${statusColor[subscription.status] || statusColor.active} text-white text-xs`}>
                                                {subscription.status.toUpperCase()}
                                            </Badge>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Repeat className="h-3 w-3" />
                                                <span>Auto Buy</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {subscription.status === "active" && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                            <MoreVertical className="h-3 w-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            className="text-xs"
                                                            onClick={() => handleOpenCancelDialog(subscription)}
                                                        >
                                                            Cancel Subscription
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0 space-y-3">
                                        {/* Main Swap Info */}
                                        <div className="flex justify-between items-center mb-0">
                                            <div className="text-lg font-bold">
                                                {subscription.from} → {subscription.to}
                                            </div>
                                            <div className="text-right">
                                                <div className="font-semibold">{subscription.amount} {subscription.from}</div>
                                                <div className="text-xs text-muted-foreground">per swap</div>
                                            </div>
                                        </div>

                                        {/* ✅ ACCORDION UNTUK DETAILS */}
                                        <Accordion type="single" collapsible className="w-full">
                                            <AccordionItem value="details" className="border-none">
                                                <AccordionTrigger className="text-xs py-2 hover:no-underline">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">Subscription Details</span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="pb-0">
                                                    <div className="space-y-3">
                                                        {/* Frequency */}
                                                        <div className="flex justify-between items-center mb-0">
                                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                                <Repeat className="h-3 w-3" />
                                                                <span className="text-xs font-medium">Frequency:</span>
                                                            </div>
                                                            <span className="text-xs font-semibold">{subscription.frequencyLabel}</span>
                                                        </div>

                                                        {/* Duration */}
                                                        <div className="flex justify-between items-center mb-0">
                                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                                <Calendar className="h-3 w-3" />
                                                                <span className="text-xs font-medium">Duration:</span>
                                                            </div>
                                                            <span className="text-xs font-semibold">{subscription.durationLabel}</span>
                                                        </div>

                                                        {/* Next Execution */}
                                                        <div className="flex justify-between items-center mb-0">
                                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                                <Clock className="h-3 w-3" />
                                                                <span className="text-xs font-medium">Next in:</span>
                                                            </div>
                                                            <span className="text-xs font-semibold text-green-500">
                                                                {subscription.status == 'active' ? subscription.nextExecutionTime : "-"}
                                                            </span>
                                                        </div>

                                                        {/* Progress */}
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                                <RefreshCcw className="h-3 w-3" />
                                                                <span className="text-xs font-medium">Progress:</span>
                                                            </div>
                                                            <span className="text-xs font-semibold">
                                                                {subscription.executed}/{subscription.totalExecutions === 999 ? "∞" : subscription.totalExecutions}
                                                            </span>
                                                        </div>

                                                        {/* Created Time */}
                                                        <div className="flex justify-between items-center pt-2 border-t border-border/50">
                                                            <span className="text-xs text-muted-foreground">Created:</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {subscription.createdTime ? new Date(subscription.createdTime).toLocaleString() : "Unknown"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                    </CardContent>
                                </Card>
                            ))
                        ) : !error && (
                            <div className="flex flex-col items-center justify-center p-6 border rounded-2xl bg-muted/40 text-center">
                                <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
                                <p className="text-sm font-medium text-muted-foreground">
                                    No subscriptions found
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Create your first autobuy subscription to get started
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Pagination Component - hanya tampil jika ada lebih dari 1 page */}
                {isConnected && !loading && totalPages > 1 && (
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
                )}

                {/* Info pagination */}
                {isConnected && !loading && filteredSubscriptions.length > 0 && (
                    <div className="text-center text-xs text-muted-foreground mt-2">
                        Page {currentPage} of {totalPages} • {filteredSubscriptions.length} subscriptions total
                    </div>
                )}

                {!isConnected && (
                    <div className="flex flex-col items-center justify-center p-6 border rounded-2xl bg-muted/40 text-center">
                        <Unplug className="w-8 h-8 text-muted-foreground my-4" />
                        <p className="text-sm font-medium text-muted-foreground">
                            Please connect wallet first
                        </p>
                    </div>
                )}
            </motion.div>

            {/* Confirmation Dialog */}
            <ConfirmationDialog
                isOpen={cancelDialogOpen}
                onClose={handleCloseCancelDialog}
                onConfirm={handleConfirmCancel}
                subscription={selectedSubscription}
                loading={cancelling}
            />

            {/* Result Popup */}
            <ResultPopup
                isOpen={resultPopup.open}
                onClose={handleCloseResultPopup}
                isSuccess={resultPopup.success}
                message={resultPopup.message}
            />
        </div>
    );
}
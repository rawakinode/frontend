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
import { MoreVertical, AlertCircle, Unplug, Loader2, X, CheckCircle, XCircle } from "lucide-react";
import { useAccount } from "wagmi";
import { getSmartAccounts } from "@/hooks/useSmartAccount";
import { useAPI } from "@/hooks/useAPI";

const typeColor = {
    immediately: "bg-green-700",
    scheduled: "bg-blue-500",
    price: "bg-purple-500",
    "price-limit": "bg-purple-500",
};

const statusColor = {
    active: "bg-yellow-400",
    completed: "bg-green-400",
    failed: "bg-red-400",
    canceled: "bg-gray-400",
};

// Items per page
const ITEMS_PER_PAGE = 3;

// Fungsi untuk memformat timestamp
const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(Number(timestamp));
    return date.toLocaleString();
};

// Fungsi untuk menghitung sisa waktu
const calculateRemainingTime = (timestampExecute) => {
    if (!timestampExecute) return "N/A";

    const now = new Date().getTime();
    const executeTime = Number(timestampExecute);
    const diff = executeTime - now;

    if (diff <= 0) return "Expired";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
};

// Confirmation Dialog Component
const ConfirmationDialog = ({ isOpen, onClose, onConfirm, task, loading }) => {
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
                    <h3 className="text-lg font-bold">Cancel Task</h3>
                    <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                
                <div className="space-y-4 mb-6">
                    <p className="text-sm text-muted-foreground">
                        Are you sure you want to cancel this task? This action cannot be undone.
                    </p>
                    
                    {/* Task Data Display */}
                    {task && (
                        <Card className="p-3 bg-muted/20">
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="font-semibold">SWAP:</span>
                                    <span>{task.from} → {task.to}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">Amount:</span>
                                    <span>{task.price} {task.from}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">Receive:</span>
                                    <span>{task.targetPrice} {task.to}</span>
                                </div>
                                {task.type === "price" && (
                                    <div className="flex justify-between">
                                        <span className="font-semibold">Target Price:</span>
                                        <span>{task.swapLimitPrice}</span>
                                    </div>
                                )}
                                {task.type === "scheduled" && task.remaining !== "Expired" && (
                                    <div className="flex justify-between">
                                        <span className="font-semibold">Will swap in:</span>
                                        <span>{task.remaining}</span>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}
                </div>

                <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Keep Task
                    </Button>
                    <Button 
                        variant="destructive" 
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex items-center gap-2"
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {loading ? "Cancelling..." : "Cancel Task"}
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
                    {isSuccess ? 'Task Cancelled Successfully' : 'Cancellation Failed'}
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

export default function Task() {
    const [activeStatus, setActiveStatus] = useState("active");
    const [currentPage, setCurrentPage] = useState(1);
    const [allSmartAccounts, setAllSmartAccounts] = useState([]);
    const [selectedSmartAccount, setSelectedSmartAccount] = useState("");
    const [tasksData, setTasksData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    
    // State untuk cancellation functionality
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [cancelling, setCancelling] = useState(false);
    const [resultPopup, setResultPopup] = useState({
        open: false,
        success: false,
        message: ""
    });

    const statuses = ["active", "failed", "completed", "canceled"];

    const { getDelegationDataFromAPI, cancelDelegationTask } = useAPI();

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

    // Fetch delegation data ketika smart account berubah
    const fetchDelegationData = useCallback(async (smartAccountAddress) => {
        if (!smartAccountAddress) return;

        setLoading(true);
        setError("");
        try {
            const response = await getDelegationDataFromAPI(smartAccountAddress);
            if (response.status == 'ok') {
                setTasksData(Array.isArray(response.data) ? response.data : [response.data]);
            }
        } catch (err) {
            console.error("Failed to fetch delegation data:", err);
            setError("Failed to load task data");
            setTasksData([]);
        } finally {
            setTimeout(() => setLoading(false), 1000);
        }
    }, []);

    useEffect(() => {
        if (selectedSmartAccount) {
            fetchDelegationData(selectedSmartAccount);
        }
    }, [selectedSmartAccount, fetchDelegationData]);

    // Map data dari API ke format task
    const mappedTasks = useMemo(() => {
        return tasksData.map(task => ({
            id: task._id?.$oid || Math.random().toString(),
            type: task.type || "scheduled",
            status: task.status || "active",
            from: task.fromToken?.symbol || "MON",
            to: task.toToken?.symbol || "USDC",
            price: task.amount_formatted ? parseFloat(task.amount_formatted).toFixed(8) : "0",
            targetPrice: task.output_formatted ? parseFloat(task.output_formatted).toFixed(8) : "0",
            swapLimitPrice: task.swap_limit_price ? parseFloat(task.swap_limit_price).toFixed(8) : "0",
            executeTime: formatTimestamp(task.timestampExecute?.$numberDouble || task.timestampExecute),
            remaining: calculateRemainingTime(task.timestampExecute?.$numberDouble || task.timestampExecute),
            txHash: task.hash || "",
            messageStatus: task.message_status || "",
            originalData: task
        }));
    }, [tasksData]);

    // Filter tasks berdasarkan status aktif 
    const filteredTasks = useMemo(() => {
        return mappedTasks.filter(task => task.status === activeStatus);
    }, [mappedTasks, activeStatus]);

    // Pagination logic
    const totalPages = Math.ceil(filteredTasks.length / ITEMS_PER_PAGE);

    // Get tasks untuk halaman saat ini
    const currentTasks = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return filteredTasks.slice(startIndex, endIndex);
    }, [filteredTasks, currentPage]);

    // Handler untuk membuka dialog konfirmasi cancel
    const handleOpenCancelDialog = (task) => {
        setSelectedTask(task);
        setCancelDialogOpen(true);
    };

    // Handler untuk menutup dialog konfirmasi cancel
    const handleCloseCancelDialog = () => {
        if (!cancelling) {
            setCancelDialogOpen(false);
            setSelectedTask(null);
        }
    };

    // Handler untuk eksekusi cancel task :cite[1]
    const handleConfirmCancel = async () => {
        if (!selectedTask || !selectedSmartAccount) return;

        setCancelling(true);
        try {
            // Panggil API untuk cancel task
            const response = await cancelDelegationTask(selectedTask.originalData._id);
            
            if (response.status === 'ok' || response.success) {
                // Show success popup
                setResultPopup({
                    open: true,
                    success: true,
                    message: "The task has been successfully cancelled."
                });
                
                // Refresh data tasks
                await fetchDelegationData(selectedSmartAccount);
            } else {
                throw new Error(response.message || "Failed to cancel task");
            }
        } catch (err) {
            console.error("Failed to cancel task:", err);
            // Show error popup
            setResultPopup({
                open: true,
                success: false,
                message: err.message || "Failed to cancel task. Please try again."
            });
        } finally {
            setCancelling(false);
            setCancelDialogOpen(false);
            setSelectedTask(null);
            await fetchDelegationData(selectedSmartAccount);
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
                    <h2 className="text-md font-bold">Tasks</h2>
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
                        <Skeleton className="h-[100px] w-full rounded-xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-[250px]" />
                            <Skeleton className="h-4 w-[200px]" />
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
                            onClick={() => selectedSmartAccount && fetchDelegationData(selectedSmartAccount)}
                        >
                            Retry
                        </Button>
                    </div>
                )}

                {/* Task List */}
                {isConnected && !loading && (
                    <div className="space-y-2 mb-6">
                        {currentTasks.length > 0 ? (
                            currentTasks.map((task) => (
                                <Card key={task.id} className="relative p-2 text-sm">
                                    <CardHeader className="flex flex-row justify-between items-center p-2 pb-1">
                                        <Badge className={`${typeColor[task.type] || typeColor.scheduled} text-white text-xs`}>
                                            {task.type.replace("-", " ").toUpperCase()}
                                        </Badge>
                                        <div className="flex items-center gap-2 mt-[-6px]">
                                            <Badge className={`${statusColor[task.status] || statusColor.active} text-background text-xs`}>
                                                {task.status.toLowerCase()}
                                            </Badge>
                                            {(task.status === "active") && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem 
                                                            className="text-xs"
                                                            onClick={() => handleOpenCancelDialog(task)}
                                                        >
                                                            Cancel
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-2 space-y-2">
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between leading-none">
                                                <span className="font-semibold">SWAP:</span>
                                                <span>{task.from} → {task.to}</span>
                                            </div>
                                            <div className="flex justify-between leading-none">
                                                <span className="font-semibold">Amount:</span>
                                                <span>{task.price} {task.from}</span>
                                            </div>
                                            <div className="flex justify-between leading-none">
                                                <span className="font-semibold">Receive:</span>
                                                <span>{task.targetPrice} {task.to}</span>
                                            </div>

                                            {(task.status === "active" && task.type === "price") && (
                                                <div className="flex justify-between leading-none">
                                                    <span className="font-semibold">Target Price:</span>
                                                    <span>{task.swapLimitPrice}</span>
                                                </div>
                                            )}

                                            {(task.status === "active" && task.type === "scheduled" && task.remaining !== "Expired") && (
                                                <div className="flex justify-between leading-none">
                                                    <span className="font-semibold">Will swap in:</span>
                                                    <span>{task.remaining}</span>
                                                </div>
                                            )}
                                            {task.status === "completed" && task.txHash && (
                                                <div className="flex justify-between leading-none">
                                                    <span className="font-semibold">Tx Hash:</span>
                                                    <a
                                                        href={`https://testnet.monadexplorer.com/tx/${task.txHash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-500 underline text-xs"
                                                    >
                                                        {`${task.txHash.slice(0, 16)}...`}
                                                    </a>
                                                </div>
                                            )}

                                            {(task.status === "failed") && (
                                                <div className="flex justify-between leading-none">
                                                    <span className="font-semibold">Error:</span>
                                                    <span className="text-red-400">{task.messageStatus}</span>
                                                </div>
                                            )}

                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : !error && (
                            <div className="flex flex-col items-center justify-center p-6 border rounded-2xl bg-muted/40 text-center">
                                <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
                                <p className="text-sm font-medium text-muted-foreground">
                                    No task
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
                {isConnected && !loading && filteredTasks.length > 0 && (
                    <div className="text-center text-xs text-muted-foreground mt-2">
                        Page {currentPage} of {totalPages} • {filteredTasks.length} tasks total
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
                task={selectedTask}
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
import React, { useState, useEffect } from 'react';
import { WinnerPayment } from '@/hooks/useWinnerPayments';
import { FaTrophy, FaCheckCircle, FaExternalLinkAlt, FaCopy, FaBell } from 'react-icons/fa';
import { ethers } from 'ethers';

interface WinnerNotificationProps {
    payment: WinnerPayment;
    onDismiss: () => void;
    onViewDetails: () => void;
}

export function WinnerNotification({ payment, onDismiss, onViewDetails }: WinnerNotificationProps) {
    const [copied, setCopied] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    const formatAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleString();
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const getExplorerUrl = (txHash: string) => {
        const network = process.env.NEXT_PUBLIC_NETWORK || 'mainnet';
        const baseUrl = network === 'mainnet'
            ? 'https://etherscan.io'
            : 'https://sepolia.etherscan.io';
        return `${baseUrl}/tx/${txHash}`;
    };

    return (
        <div className="fixed top-4 right-4 w-96 bg-white rounded-lg shadow-xl border border-green-200 z-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-t-lg p-4 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <FaTrophy className="text-yellow-300" />
                        <span className="font-bold">🎉 You Won!</span>
                    </div>
                    <button
                        onClick={onDismiss}
                        className="text-white hover:text-gray-200 text-lg"
                    >
                        ×
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {/* Prize Amount */}
                <div className="text-center mb-4">
                    <div className="text-3xl font-bold text-green-600 mb-1">
                        {payment.amountFormatted}
                    </div>
                    <div className="text-sm text-gray-600">
                        Prize Pool: {payment.totalPrizePoolFormatted}
                    </div>
                </div>

                {/* Game Info */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Game Type:</span>
                        <span className="font-medium">
                            {payment.gameType === 'tournament' ? 'Tournament' :
                                payment.gameType === 'match' ? '1v1 Match' : '2v2 Match'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Tournament ID:</span>
                        <span className="font-medium">#{payment.tournamentId}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Completed:</span>
                        <span className="font-medium">{formatDate(payment.timestamp)}</span>
                    </div>
                </div>

                {/* Transaction Info */}
                <div className="bg-blue-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-600">Transaction:</span>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => copyToClipboard(payment.transactionHash)}
                                className="text-blue-600 hover:text-blue-800"
                            >
                                <FaCopy className={copied ? "text-green-500" : ""} />
                            </button>
                            <a
                                href={getExplorerUrl(payment.transactionHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                            >
                                <FaExternalLinkAlt />
                            </a>
                        </div>
                    </div>
                    <div className="text-xs text-gray-500 break-all">
                        {payment.transactionHash}
                    </div>
                    {copied && (
                        <div className="text-xs text-green-600 mt-1">Copied to clipboard!</div>
                    )}
                </div>

                {/* Winner Info */}
                <div className="bg-green-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center space-x-2 mb-2">
                        <FaCheckCircle className="text-green-500" />
                        <span className="font-medium text-green-800">Payment Confirmed</span>
                    </div>
                    <div className="text-sm text-gray-600">
                        <div>Winner: {payment.winnerName || formatAddress(payment.winnerAddress)}</div>
                        <div>Address: {formatAddress(payment.winnerAddress)}</div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                    <button
                        onClick={onViewDetails}
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                        View Details
                    </button>
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                    >
                        {showDetails ? 'Hide' : 'More'}
                    </button>
                </div>

                {/* Expanded Details */}
                {showDetails && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="font-medium text-gray-800 mb-2">Game Details</h4>
                        <div className="space-y-1 text-sm text-gray-600">
                            <div>Block Number: {payment.blockNumber}</div>
                            <div>Token: {payment.tokenSymbol}</div>
                            <div>Token Address: {formatAddress(payment.tokenAddress)}</div>
                            <div>Participants: {payment.participants.length}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Notification Manager Component
interface NotificationManagerProps {
    payments: WinnerPayment[];
    onDismissPayment: (paymentId: string) => void;
    onViewPaymentDetails: (payment: WinnerPayment) => void;
}

export function NotificationManager({
    payments,
    onDismissPayment,
    onViewPaymentDetails
}: NotificationManagerProps) {
    const [visibleNotifications, setVisibleNotifications] = useState<string[]>([]);

    useEffect(() => {
        // Show new payments as notifications
        const newPayments = payments.filter(p => !visibleNotifications.includes(p.transactionHash));
        if (newPayments.length > 0) {
            setVisibleNotifications(prev => [...prev, ...newPayments.map(p => p.transactionHash)]);
        }
    }, [payments, visibleNotifications]);

    const handleDismiss = (transactionHash: string) => {
        setVisibleNotifications(prev => prev.filter(id => id !== transactionHash));
        onDismissPayment(transactionHash);
    };

    return (
        <div className="fixed top-4 right-4 z-50 space-y-4">
            {payments
                .filter(payment => visibleNotifications.includes(payment.transactionHash))
                .slice(0, 3) // Limit to 3 notifications at once
                .map((payment, index) => (
                    <div
                        key={payment.transactionHash}
                        style={{ transform: `translateY(${index * 20}px)` }}
                    >
                        <WinnerNotification
                            payment={payment}
                            onDismiss={() => handleDismiss(payment.transactionHash)}
                            onViewDetails={() => onViewPaymentDetails(payment)}
                        />
                    </div>
                ))}
        </div>
    );
} 
import React from 'react';
import { RecentGameResult, WinnerPayment } from '@/hooks/useWinnerPayments';
import { FaTrophy, FaUsers, FaCoins, FaClock, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { ethers } from 'ethers';

interface LastGameSectionProps {
    lastGame: RecentGameResult | null;
    recentPayments: WinnerPayment[];
    isLoading: boolean;
    onRefresh: () => void;
}

export function LastGameSection({ lastGame, recentPayments, isLoading, onRefresh }: LastGameSectionProps) {
    const formatAddress = (address: string) => {
        if (!address || address.length < 10) return address;
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleString();
    };

    const getStatusIcon = (status: string) => {
        return status === 'completed' ? (
            <FaCheckCircle className="text-green-500" />
        ) : (
            <FaTimesCircle className="text-red-500" />
        );
    };

    const getGameTypeIcon = (gameType: string) => {
        switch (gameType) {
            case 'tournament':
                return <FaTrophy className="text-yellow-500" />;
            case 'match':
                return <FaUsers className="text-blue-500" />;
            case '2v2match':
                return <FaUsers className="text-purple-500" />;
            default:
                return <FaUsers className="text-gray-500" />;
        }
    };

    const getGameTypeDisplay = (gameType: string | undefined): string => {
        if (!gameType) return 'Game';
        switch (gameType) {
            case 'tournament':
                return 'Tournament';
            case 'match':
                return 'MATCH';
            case '2v2match':
                return '2v2 Match';
            default:
                // Capitalize first letter of each word for other types
                return gameType.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
        }
    };

    if (isLoading) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Last Game</h2>
                    <button
                        onClick={onRefresh}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                        Refresh
                    </button>
                </div>
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                    <div className="h-20 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (!lastGame) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Last Game</h2>
                    <button
                        onClick={onRefresh}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                        Refresh
                    </button>
                </div>
                <div className="text-center py-8">
                    <FaClock className="text-gray-400 text-4xl mx-auto mb-2" />
                    <p className="text-gray-500">Pending results of Next Tournament</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">Last Game</h2>
                <button
                    onClick={onRefresh}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                    Refresh
                </button>
            </div>

            {/* Game Header */}
            <div className="border-b border-gray-200 pb-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                        {getGameTypeIcon(lastGame.gameType)}
                        <span className="font-semibold text-gray-800">
                            {getGameTypeDisplay(lastGame.gameType)}
                        </span>
                        <span className="text-sm text-gray-500">#{lastGame.tournamentId}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        {getStatusIcon(lastGame.status)}
                        <span className={`text-sm font-medium capitalize ${lastGame.status === 'completed' ? 'text-green-600' : 'text-gray-600'
                            }`}>
                            {lastGame.status.toLowerCase()}
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Room: {lastGame.roomCode}</span>
                    <span>{formatDate(lastGame.completedAt)}</span>
                </div>
            </div>

            {/* Prize Pool */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <FaCoins className="text-yellow-500" />
                        <span className="font-semibold text-gray-800">Total Prize Pool</span>
                    </div>
                    <span className="text-lg font-bold text-gray-800">
                        {lastGame.totalPrizePoolFormatted}
                    </span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                    Entry Fee: {lastGame.entryFeeFormatted} per player
                </div>
            </div>

            {/* Winners Section */}
            {lastGame.winners && lastGame.winners.length > 0 && (
                <div className="mb-4">
                    <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
                        <FaTrophy className="text-yellow-500 mr-2" />
                        Winners
                    </h3>
                    <div className="space-y-2">
                        {lastGame.winners.map((winner, index) => (
                            <div key={winner.address} className="flex items-center justify-between bg-green-50 rounded-lg p-3">
                                <div className="flex items-center space-x-3">
                                    <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                        {index + 1}
                                    </div>
                                    <div>
                                        <div className="font-medium text-gray-800">{winner.name}</div>
                                        <div className="text-sm text-gray-500">{formatAddress(winner.address)}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-semibold text-green-600">{winner.amountFormatted}</div>
                                    <div className="text-sm text-gray-500">{winner.percentage}%</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Participants */}
            <div>
                <h3 className="font-semibold text-gray-800 mb-2">Participants ({lastGame.participants ? lastGame.participants.length : 0})</h3>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                    {lastGame.participants && lastGame.participants.map((participant) => (
                        <div key={participant.address} className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-2">
                                <span className="font-medium text-gray-700">{participant.name}</span>
                                <span className="text-gray-500">({formatAddress(participant.address)})</span>
                                {participant.isWinner && (
                                    <FaTrophy className="text-yellow-500 text-xs" />
                                )}
                            </div>
                            <span className="text-gray-600">Score: {participant.score ?? 'N/A'}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Payments Link */}
            {recentPayments && recentPayments.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                        <span className="font-medium">Recent Payments:</span> {recentPayments.length} payments processed
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        Latest: {formatDate(recentPayments[0].timestamp)}
                    </div>
                </div>
            )}
        </div>
    );
} 
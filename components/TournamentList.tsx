import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';
import { useAddress, useConnectionStatus } from "@thirdweb-dev/react";
import { usePrivy } from '@privy-io/react-auth';
import { TournamentJoinModal } from './TournamentJoinModal';

interface Tournament {
    id: string;
    tournamentId: string;
    roomCode: string;
    entryFee: string;
    entryFeeFormatted?: string;
    maxParticipants: number;
    currentParticipants: number;
    totalPrize: number;
    status: string;
    createdAt: string;
}

interface PaginationInfo {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

interface JoinModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
    onJoin: (name: string) => void;
}

function JoinModal({ isOpen, onClose, tournament, onJoin }: JoinModalProps) {
    const [playerName, setPlayerName] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                <h3 className="text-xl font-semibold mb-4">Join Tournament</h3>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Your Name
                    </label>
                    <input
                        type="text"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                    />
                </div>
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            if (playerName.trim()) {
                                onJoin(playerName);
                            }
                        }}
                        disabled={!playerName.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        Join Game
                    </button>
                </div>
            </div>
        </div>
    );
}

export function TournamentList() {
    const router = useRouter();
    const address = useAddress();
    const connectionStatus = useConnectionStatus();
    const { authenticated: isAuthenticated, login: signIn } = usePrivy();
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [pagination, setPagination] = useState<PaginationInfo>({
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0
    });
    const [statusFilter, setStatusFilter] = useState<string[]>(['ACTIVE', 'FILLING']);
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('desc');

    const fetchTournaments = async () => {
        try {
            setLoading(true);
            setError(null);

            const queryParams = new URLSearchParams({
                page: currentPage.toString(),
                limit: '10',
                status: statusFilter.join(','),
                sortBy,
                sortOrder
            });

            if (searchTerm) {
                queryParams.append('search', searchTerm);
            }

            const response = await fetch(`/api/tournament?${queryParams.toString()}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch tournaments');
            }

            setTournaments(data.tournaments);
            setPagination(data.pagination);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTournaments();
    }, [currentPage, statusFilter, sortBy, sortOrder, searchTerm]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setCurrentPage(1); // Reset to first page on new search
        fetchTournaments();
    };

    const handleStatusFilterChange = (status: string) => {
        setCurrentPage(1);
        if (statusFilter.includes(status)) {
            setStatusFilter(statusFilter.filter(s => s !== status));
        } else {
            setStatusFilter([...statusFilter, status]);
        }
    };

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return 'bg-green-100 text-green-800';
            case 'FILLING':
                return 'bg-blue-100 text-blue-800';
            case 'COMPLETED':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const formatEntryFee = (entryFee: string, entryFeeFormatted?: string) => {
        try {
            // If we already have a formatted value, use it
            if (entryFeeFormatted) {
                return entryFeeFormatted;
            }

            // Check if the value is in Wei format (large number)
            if (entryFee && entryFee.toString().length > 10) {
                return ethers.utils.formatEther(entryFee);
            }

            // If it's already in ETH format, return as is
            return entryFee;
        } catch (error) {
            console.error('Error formatting entry fee:', error);
            return '0';
        }
    };

    const handleJoinTournament = (playerName: string) => {
        if (!selectedTournament || !address) return;

        // Navigate to the game room with tournament parameters
        router.push(
            `/game/${selectedTournament.roomCode}?name=${encodeURIComponent(playerName)}&role=player&tournamentId=${selectedTournament.tournamentId}&walletAddress=${address}`
        );
    };

    if (loading && tournaments.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-red-600 p-4 bg-red-50 rounded-lg">
                Error: {error}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search and Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
                <form onSubmit={handleSearch} className="space-y-4">
                    <div className="flex gap-4">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by room code or tournament ID..."
                            className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            Search
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {['ACTIVE', 'FILLING', 'COMPLETED'].map((status) => (
                            <button
                                key={status}
                                type="button"
                                onClick={() => handleStatusFilterChange(status)}
                                className={`px-3 py-1 rounded-full text-sm font-medium ${statusFilter.includes(status)
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-600'
                                    }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </form>
            </div>

            {/* Tournament List */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('roomCode')}
                                >
                                    Room Code {sortBy === 'roomCode' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('entryFee')}
                                >
                                    Entry Fee {sortBy === 'entryFee' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >
                                    Players
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('totalPrize')}
                                >
                                    Prize Pool {sortBy === 'totalPrize' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('status')}
                                >
                                    Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('createdAt')}
                                >
                                    Created {sortBy === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th scope="col" className="relative px-6 py-3">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {tournaments.map((tournament) => (
                                <tr key={tournament.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {tournament.roomCode}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {formatEntryFee(tournament.entryFee, tournament.entryFeeFormatted)} ETH
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {tournament.currentParticipants} / {tournament.maxParticipants}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {tournament.totalPrize} ETH
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(tournament.status)}`}>
                                            {tournament.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {formatDate(tournament.createdAt)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => {
                                                setSelectedTournament(tournament);
                                                setShowJoinModal(true);
                                            }}
                                            className="text-blue-600 hover:text-blue-900"
                                        >
                                            Join
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex justify-center space-x-2 mt-4">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded border disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="px-3 py-1">
                        Page {currentPage} of {pagination.totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                        disabled={currentPage === pagination.totalPages}
                        className="px-3 py-1 rounded border disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Join Modal */}
            {selectedTournament && (
                <TournamentJoinModal
                    isOpen={showJoinModal}
                    onClose={() => setShowJoinModal(false)}
                    tournament={selectedTournament}
                    onJoin={handleJoinTournament}
                />
            )}
        </div>
    );
} 
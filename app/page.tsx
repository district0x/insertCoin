'use client';

// Import section - unchanged
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthButton } from '@/components/AuthButton';
import { useTournamentContract } from '@/hooks/useTournamentContract';
import { TournamentStatus, OnChainTournament } from './types/tournament';
import { supabase } from '@/lib/supabase';
import { TournamentJoinModal } from '@/components/JoinTournamentModule';
import { ethers } from 'ethers';
import PrivyLogin from '@/components/PrivyLogin';
import { usePrivy } from '@privy-io/react-auth';
import { TournamentList } from '@/components/TournamentList';
import { FaCog } from 'react-icons/fa';
import gameResults from '../data/game-results.json';
import { useWinnerPayments } from '@/hooks/useWinnerPayments';
import { LastGameSection } from '@/components/LastGameSection';
import { NotificationManager } from '@/components/WinnerNotification';


// Define types
interface LeaderboardEntry {
  id: string;
  timestamp: string;
  players: {
    name: string;
    score: number;
  }[];
}

interface TournamentDetails {
  tournamentId: string;
  entryFee: string;
  maxParticipants: number;
  currentParticipants: number;
  totalPrize: string;
  status: string;
  roomCode: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
}

const CATEGORIES = [
  'Any',
  'General Knowledge',
  'Science',
  'History',
  'Geography',
  'Entertainment',
  'Sports',
  'Art',
];
const DIFFICULTIES = ['Any', 'Easy', 'Medium', 'Hard'];
const GAME_MODES = [
  { label: 'Standard', value: false },
  { label: 'Sudden Death', value: true },
];

export default function Home() {
  // Wallet and contract logic
  const { authenticated: isAuthenticated, user, login: signIn } = usePrivy();
  const { createTournament } = useTournamentContract();
  const router = useRouter();

  // Winner payments hook
  const {
    recentPayments,
    recentGames,
    isLoading: isLoadingPayments,
    error: paymentsError,
    refreshData: refreshPayments
  } = useWinnerPayments();

  const [activeAddress, setActiveAddress] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [entryFee, setEntryFee] = useState('0.01');
  const [maxParticipants, setMaxParticipants] = useState(5);
  const [category, setCategory] = useState('Any');
  const [difficulty, setDifficulty] = useState('Any');
  const [questionCount, setQuestionCount] = useState(10);
  const [gameMode, setGameMode] = useState(false); // false = Standard, true = Sudden Death
  const [timerDuration, setTimerDuration] = useState(15);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isTournamentMode, setIsTournamentMode] = useState(false);
  const [isTournamentRoom, setIsTournamentRoom] = useState(false);
  const [tournamentRoomDetails, setTournamentRoomDetails] = useState<TournamentDetails | null>(null);
  const [showTournamentJoinModal, setShowTournamentJoinModal] = useState(false);
  const [currentGame, setCurrentGame] = useState<{
    tournamentId: string;
    roomCode: string;
    status: string;
    statusDisplay: string;
    statusColor: string;
    playerCount: number;
    maxParticipants: number;
    participants: Array<{
      name: string;
      address: string;
      joinedAt: string;
    }>;
    entryFee: string;
    entryFeeFormatted: string;
    prizePool: string;
    prizePoolFormatted: string;
    tokenAddress: string;
    tokenSymbol: string;
    tokenDecimals: number;
    createdAt: string;
    updatedAt: string;
    isFull: boolean;
  } | null>(null);
  const [participants, setParticipants] = useState([]);
  const [isLoadingCurrentGame, setIsLoadingCurrentGame] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Example: get current matching pool in ETH (stubbed, replace with real value if available)
  const matchingPoolETH = 1.2345; // Replace with actual value from contract or API
  const [ethToUsdRate, setEthToUsdRate] = useState(3500); // Default fallback
  const [ethPriceLoading, setEthPriceLoading] = useState(false);
  const [ethPriceError, setEthPriceError] = useState<string | null>(null);
  const [lastEthPriceUpdate, setLastEthPriceUpdate] = useState<Date | null>(null);
  const matchingPoolUSD = matchingPoolETH * ethToUsdRate;

  // Token selection state
  const [approvedTokens, setApprovedTokens] = useState<Array<{
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
    isApproved: boolean;
    isNative?: boolean;
    error?: string;
  }>>([]);
  const [selectedToken, setSelectedToken] = useState<string>('0x0000000000000000000000000000000000000000'); // Default to ETH
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);

  // Enhanced ETH price fetching with multiple fallbacks
  const fetchEthPrice = async () => {
    try {
      setEthPriceLoading(true);
      setEthPriceError(null);

      // Use our dedicated ETH price API
      const res = await fetch('/api/eth-price');
      if (res.ok) {
        const data = await res.json();
        setEthToUsdRate(data.price);
        setLastEthPriceUpdate(new Date(data.lastUpdate));

        if (data.warning) {
          setEthPriceError(data.warning);
        } else if (data.error) {
          setEthPriceError(data.error);
        } else {
          setEthPriceError(null);
        }
      } else {
        throw new Error('Failed to fetch ETH price');
      }
    } catch (error) {
      console.error('Error fetching ETH price:', error);
      setEthPriceError('Failed to fetch current ETH price');
      setEthToUsdRate(3500); // Safe fallback
    } finally {
      setEthPriceLoading(false);
    }
  };

  // Fetch approved tokens for tournament creation
  const fetchApprovedTokens = async () => {
    try {
      setIsLoadingTokens(true);
      const response = await fetch('/api/approved-tokens');
      if (response.ok) {
        const data = await response.json();
        setApprovedTokens(data.tokens || []);
      } else {
        console.error('Failed to fetch approved tokens');
        // Fallback to just ETH
        setApprovedTokens([{
          address: '0x0000000000000000000000000000000000000000',
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18,
          totalSupply: '∞',
          isApproved: true,
          isNative: true
        }]);
      }
    } catch (error) {
      console.error('Error fetching approved tokens:', error);
      // Fallback to just ETH
      setApprovedTokens([{
        address: '0x0000000000000000000000000000000000000000',
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
        totalSupply: '∞',
        isApproved: true,
        isNative: true
      }]);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  // Helper function to convert ETH to USD
  const ethToUsd = (ethAmount: string | number): string => {
    const eth = typeof ethAmount === 'string' ? parseFloat(ethAmount) : ethAmount;
    if (isNaN(eth)) return '$0.00';
    return `$${(eth * ethToUsdRate).toFixed(2)}`;
  };

  // Helper function to format ETH amounts
  const formatEth = (ethAmount: string | number): string => {
    const eth = typeof ethAmount === 'string' ? parseFloat(ethAmount) : ethAmount;
    if (isNaN(eth)) return '0 ETH';
    return `${eth.toFixed(4)} ETH`;
  };

  // Helper function to convert Wei to ETH
  const weiToEth = (weiAmount: string | number): number => {
    const wei = typeof weiAmount === 'string' ? parseFloat(weiAmount) : weiAmount;
    if (isNaN(wei)) return 0;
    return wei / Math.pow(10, 18); // Convert Wei to ETH (18 decimals)
  };

  // Helper function to convert Wei to USD
  const weiToUsd = (weiAmount: string | number): string => {
    const eth = weiToEth(weiAmount);
    return ethToUsd(eth);
  };

  // Helper function to format Wei as ETH
  const formatWeiAsEth = (weiAmount: string | number): string => {
    const eth = weiToEth(weiAmount);
    return formatEth(eth);
  };

  // Helper function to convert a token amount to its USD value
  const tokenToUsd = (tokenAmount: string | number, tokenSymbol: string): string => {
    const amount = typeof tokenAmount === 'string' ? parseFloat(tokenAmount) : tokenAmount;
    if (isNaN(amount)) return '$0.00';

    // We only have the ETH price for now.
    if (tokenSymbol === 'ETH' || tokenSymbol === 'WETH') {
      return `$${(amount * ethToUsdRate).toFixed(2)}`;
    }

    // Return a placeholder for other tokens.
    return `USD N/A`;
  };

  // Sync activeAddress with both MetaMask and Privy
  useEffect(() => {
    // Priority: Privy wallet first, then MetaMask
    if (user?.wallet?.address) {
      // User is logged in with Privy (Gmail, etc.) - use their embedded wallet
      setActiveAddress(user.wallet.address);
      console.log('Using Privy wallet address:', user.wallet.address);
    } else {
      // Fallback to MetaMask if available
      async function syncMetaMaskAddress() {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          try {
            const provider = new ethers.providers.Web3Provider((window as any).ethereum);
            await provider.send('eth_requestAccounts', []);
            const signer = provider.getSigner();
            const addr = await signer.getAddress();
            setActiveAddress(addr);
            console.log('Using MetaMask wallet address:', addr);
          } catch (error) {
            console.log('MetaMask not connected or permission denied');
            setActiveAddress(null);
          }
        }
      }
      syncMetaMaskAddress();
    }
  }, [user?.wallet?.address]); // Re-run when Privy user/wallet changes

  // Handle MetaMask account changes (only if not using Privy)
  useEffect(() => {
    if (!user?.wallet?.address && typeof window !== 'undefined' && (window as any).ethereum) {
      const handler = (accounts: string[]) => {
        setActiveAddress(accounts[0] || null);
      };
      (window as any).ethereum.on('accountsChanged', handler);
      return () => {
        (window as any).ethereum.removeListener('accountsChanged', handler);
      };
    }
  }, [user?.wallet?.address]);

  // Fetch the latest game and its participants with smart polling
  useEffect(() => {
    let pollInterval = 3000; // Start with 3 seconds
    const maxInterval = 15000; // Max 15 seconds
    const minInterval = 2000; // Min 2 seconds
    let isUserActive = true;
    let pollTimer: NodeJS.Timeout;
    let activityTimer: NodeJS.Timeout;

    const fetchCurrentGame = async () => {
      try {
        setIsLoadingCurrentGame(true);
        const res = await fetch('/api/current-tournament');
        if (!res.ok) {
          throw new Error('Failed to fetch current game');
        }
        const data = await res.json();
        setCurrentGame(data.tournament);
        setLastUpdated(new Date());

        // Adjust polling interval based on tournament activity
        if (data.tournament && data.tournament.status === 'FILLING') {
          // More frequent updates when tournament is filling up
          pollInterval = Math.max(pollInterval * 0.8, minInterval);
        } else if (data.tournament && data.tournament.status === 'ACTIVE') {
          // Moderate updates during active game
          pollInterval = Math.min(pollInterval * 1.2, maxInterval);
        } else {
          // Slower updates for completed/cancelled tournaments
          pollInterval = maxInterval;
        }
      } catch (err) {
        console.error('Error fetching current game:', err);
        setCurrentGame(null);
        // Increase interval on error to avoid overwhelming the server
        pollInterval = Math.min(pollInterval * 1.5, maxInterval);
      } finally {
        setIsLoadingCurrentGame(false);
      }
    };

    const handleUserActivity = () => {
      isUserActive = true;
      clearTimeout(activityTimer);
      activityTimer = setTimeout(() => {
        isUserActive = false;
        console.log('User inactive, reducing poll frequency');
      }, 30000); // 30 seconds of inactivity
    };

    const pollWithSmartInterval = () => {
      if (isUserActive) {
        fetchCurrentGame();
        pollTimer = setTimeout(pollWithSmartInterval, pollInterval);
      } else {
        // Slower polling when user is inactive
        fetchCurrentGame();
        pollTimer = setTimeout(pollWithSmartInterval, maxInterval);
      }
    };

    // Initial fetch
    fetchCurrentGame();

    // Start polling
    pollTimer = setTimeout(pollWithSmartInterval, pollInterval);

    // Listen for user activity
    document.addEventListener('mousemove', handleUserActivity);
    document.addEventListener('keypress', handleUserActivity);
    document.addEventListener('click', handleUserActivity);
    document.addEventListener('scroll', handleUserActivity);

    // Cleanup
    return () => {
      clearTimeout(pollTimer);
      clearTimeout(activityTimer);
      document.removeEventListener('mousemove', handleUserActivity);
      document.removeEventListener('keypress', handleUserActivity);
      document.removeEventListener('click', handleUserActivity);
      document.removeEventListener('scroll', handleUserActivity);
    };
  }, []);

  // Check if room code is a tournament room
  useEffect(() => {
    if (roomCode) {
      console.log('[DEBUG] Checking room code:', roomCode);
      fetch(`/api/tournament/${roomCode}`)
        .then(res => {
          console.log('[DEBUG] Room code check response status:', res.status);
          return res.json();
        })
        .then(data => {
          console.log('[DEBUG] Room code check result:', data);
          setIsTournamentRoom(data.isTournament);
          if (data.isTournament) {
            console.log('[DEBUG] Setting tournament room details:', data);
            setTournamentRoomDetails(data.details);
          } else {
            console.log('[DEBUG] Not a tournament room, clearing details');
            setTournamentRoomDetails(null);
          }
        })
        .catch(err => {
          console.log('[DEBUG] Room code check error:', err);
          setIsTournamentRoom(false);
          setTournamentRoomDetails(null);
        });
    } else {
      console.log('[DEBUG] No room code, clearing tournament state');
      setIsTournamentRoom(false);
      setTournamentRoomDetails(null);
    }
  }, [roomCode]);

  // Generate a room code
  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // Handle creating a game
  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName || playerName.trim() === '') {
      alert('Please enter your name');
      return;
    }

    // Validate name length
    const trimmedName = playerName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      alert('Player name must be between 2 and 50 characters');
      return;
    }

    const newRoomCode = generateRoomCode();
    if (isTournamentMode) {
      if (!activeAddress) {
        alert('Please connect your wallet to create a tournament game');
        return;
      }
      setIsCreating(true);
      try {
        const result = await createTournament({
          numEntrants: maxParticipants,
          winnersPercentage: 80,
          multisigPercentage: 10,
          tokenAddress: selectedToken,
          entryFee
        });
        const tournamentId = result.tournamentId;

        // Find the selected token to get its decimals
        const selectedTokenDetails = approvedTokens.find(t => t.address === selectedToken);
        if (!selectedTokenDetails) {
          throw new Error('Could not find details for the selected token.');
        }

        // Correctly calculate entry fee and total prize in their smallest unit (wei)
        const entryFeeInWei = ethers.utils.parseUnits(entryFee, selectedTokenDetails.decimals).toString();
        const totalPrizeInWei = ethers.utils.parseUnits(entryFee, selectedTokenDetails.decimals).mul(maxParticipants).toString();

        await fetch('/api/tournament', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tournamentId,
            roomCode: newRoomCode,
            entryFee: entryFeeInWei,
            maxParticipants,
            tokenAddress: selectedToken,
            totalPrize: totalPrizeInWei
          })
        });
        router.push(
          `/game/${newRoomCode}?name=${encodeURIComponent(trimmedName)}&role=host&category=${category}&questionCount=${questionCount}&timerDuration=${timerDuration}&suddenDeath=${gameMode}&tournamentId=${tournamentId}&walletAddress=${activeAddress}`
        );
      } catch (err: any) {
        alert(`Failed to create tournament: ${err.message || "Unknown error"}`);
      } finally {
        setIsCreating(false);
      }
    } else {
      // Regular game creation (no blockchain integration)
      router.push(
        `/game/${newRoomCode}?name=${encodeURIComponent(trimmedName)}&role=host&category=${category}&questionCount=${questionCount}&timerDuration=${timerDuration}&suddenDeath=${gameMode}${activeAddress ? `&walletAddress=${activeAddress}` : ''}`
      );
    }
  };

  // Handle joining a game
  const handleJoinMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[DEBUG] handleJoinMatch called with:', { playerName, roomCode, isTournamentRoom, tournamentRoomDetails });

    if (!playerName || playerName.trim() === '') {
      alert('Please enter your name');
      return;
    }

    // Validate name length
    const trimmedName = playerName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      alert('Player name must be between 2 and 50 characters');
      return;
    }

    if (!roomCode) {
      alert('Please enter a room code');
      return;
    }

    console.log('[DEBUG] Checking if this is a tournament room...');
    if (isTournamentRoom && tournamentRoomDetails && typeof tournamentRoomDetails.tournamentId === 'string') {
      console.log('[DEBUG] This is a tournament room, showing join modal');
      setShowTournamentJoinModal(true);
    } else {
      console.log('[DEBUG] This is a regular room, redirecting to game');
      router.push(
        `/game/${roomCode}?name=${encodeURIComponent(trimmedName)}&role=player&walletAddress=${activeAddress || ''}`
      );
    }
  };

  // Tournament join modal success handler
  const handleTournamentJoinSuccess = () => {
    console.log('[DEBUG] handleTournamentJoinSuccess called');
    setShowTournamentJoinModal(false);
    if (tournamentRoomDetails && typeof tournamentRoomDetails.tournamentId === 'string') {
      const trimmedName = playerName.trim();
      console.log('[DEBUG] Redirecting to game after successful join');
      router.push(
        `/game/${roomCode}?name=${encodeURIComponent(trimmedName)}&role=player&tournamentId=${tournamentRoomDetails.tournamentId}&walletAddress=${activeAddress || ''}`
      );
    }
  };

  // Helper for formatting date
  const formatDate = (iso: string) => new Date(iso).toLocaleString();

  // Helper function to format wallet addresses
  const formatAddress = (address: string) => {
    if (!address || address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Manual refresh function
  const handleManualRefresh = async () => {
    try {
      setIsLoadingCurrentGame(true);
      const res = await fetch('/api/current-tournament');
      if (!res.ok) {
        throw new Error('Failed to fetch current game');
      }
      const data = await res.json();
      setCurrentGame(data.tournament);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error refreshing current game:', err);
    } finally {
      setIsLoadingCurrentGame(false);
    }
  };

  // Fetch ETH price on page load and refresh periodically
  useEffect(() => {
    fetchEthPrice(); // Initial fetch

    // Refresh ETH price every 5 minutes
    const intervalId = setInterval(fetchEthPrice, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  // Fetch approved tokens when component mounts and when wallet connects
  useEffect(() => {
    fetchApprovedTokens();
  }, [activeAddress]); // Re-fetch when wallet connects

  console.log('[DEBUG] Page state:', {
    showTournamentJoinModal,
    isTournamentRoom,
    tournamentRoomDetails,
    roomCode,
    playerName
  });

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-black relative font-sans">
      {/* Top Bar */}
      <div className="flex justify-between items-start p-8">
        {/* Left: Wallet Connect, Address, Wallet Actions */}
        <div>
          <div className="mb-2">
            <AuthButton />
          </div>
          {activeAddress && (
            <div className="space-y-1">
              {/* Wallet Type Indicator */}
              <div className="flex items-center space-x-2">
                {user?.wallet?.address ? (
                  <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                    Privy Wallet
                  </span>
                ) : (
                  <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded">
                    MetaMask
                  </span>
                )}
              </div>

              {/* User Email (if available from Privy) */}
              {user?.email?.address && (
                <div className="text-xs text-gray-300 mb-1">
                  {user.email.address}
                </div>
              )}

              {/* Wallet Address */}
              <div className="text-xs text-gray-400 break-all">
                {formatAddress(activeAddress)}
              </div>
            </div>
          )}
          <button className="mt-4 text-gray-200 text-xs border border-gray-400 px-3 py-1 rounded hover:bg-gray-700">
            EXPORT WALLET
          </button>
        </div>
        {/* Center: Matching Pool */}
        <div className="flex flex-col items-center flex-1">
          <div className="mx-auto">
            <div className="text-white text-4xl font-extrabold tracking-widest text-center">
              ${matchingPoolUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-gray-300 text-lg text-center mt-1">
              {matchingPoolETH} ETH
            </div>
            <div className="text-xs text-gray-500 text-center mt-1">Current Matching Pool</div>
            <div className="flex items-center justify-center mt-2 space-x-2">
              <span className="text-xs text-gray-400">ETH: ${ethToUsdRate.toFixed(2)}</span>
              <button
                onClick={fetchEthPrice}
                disabled={ethPriceLoading}
                className="text-gray-400 hover:text-white disabled:opacity-50"
                title="Refresh ETH price"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              {ethPriceLoading && (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div>
              )}
              {ethPriceError && (
                <span className="text-xs text-yellow-400" title={ethPriceError}>⚠</span>
              )}
              {lastEthPriceUpdate && (
                <span className="text-xs text-gray-500">
                  {lastEthPriceUpdate.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Right: Settings Icon */}
        <div>
          <button className="text-gray-300 text-2xl hover:text-white">
            <FaCog />
          </button>
        </div>
      </div>

      {/* Main Content: Forms and Active Games */}
      <div className="flex flex-1 items-start justify-center gap-16 px-8 pb-12">
        {/* Forms Column */}
        <div className="flex flex-col items-center gap-12 w-full max-w-md">
          {/* Create Match Form */}
          <form onSubmit={handleCreateMatch} className="bg-gray-900 rounded-lg p-8 shadow-lg w-full max-w-md mb-8">
            <h2 className="text-white text-2xl font-bold uppercase mb-4 tracking-wide">Create Match</h2>
            <div className="mb-4">
              <label className="block text-gray-300 mb-1">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-300 mb-1">
                Entry Fee {isTournamentMode && selectedToken !== '0x0000000000000000000000000000000000000000'
                  ? `(${approvedTokens.find(t => t.address === selectedToken)?.symbol || 'TOKEN'})`
                  : '(ETH)'}
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={entryFee}
                onChange={e => setEntryFee(e.target.value)}
                className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
                required
              />
              <div className="text-xs text-gray-400 mt-1">
                {isTournamentMode && selectedToken !== '0x0000000000000000000000000000000000000000'
                  ? `Amount in ${approvedTokens.find(t => t.address === selectedToken)?.symbol || 'TOKEN'}`
                  : `≈ ${ethToUsd(entryFee)} USD`}
              </div>
            </div>

            {/* Token Selection - Only show when Tournament Mode is enabled */}
            {isTournamentMode && (
              <div className="mb-4">
                <label className="block text-gray-300 mb-1">Entry Token</label>
                <div className="relative">
                  <select
                    value={selectedToken}
                    onChange={e => setSelectedToken(e.target.value)}
                    className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 appearance-none"
                    disabled={isLoadingTokens}
                  >
                    {isLoadingTokens ? (
                      <option value="">Loading tokens...</option>
                    ) : (
                      approvedTokens.map(token => (
                        <option key={token.address} value={token.address}>
                          {token.symbol} - {token.name}
                        </option>
                      ))
                    )}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {selectedToken && !isLoadingTokens && (
                  <div className="text-xs text-gray-400 mt-1">
                    Selected: {approvedTokens.find(t => t.address === selectedToken)?.symbol || 'Unknown Token'}
                  </div>
                )}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-gray-300 mb-1">Max Participants</label>
              <input
                type="number"
                min="2"
                max="100"
                value={maxParticipants}
                onChange={e => setMaxParticipants(Number(e.target.value))}
                className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-300 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-gray-300 mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={e => setDifficulty(e.target.value)}
                className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
              >
                {DIFFICULTIES.map(diff => (
                  <option key={diff} value={diff}>{diff}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-gray-300 mb-1">Question Count</label>
              <input
                type="number"
                min="5"
                max="50"
                value={questionCount}
                onChange={e => setQuestionCount(Number(e.target.value))}
                className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-300 mb-1">Game Mode</label>
              <select
                value={gameMode ? 'true' : 'false'}
                onChange={e => setGameMode(e.target.value === 'true')}
                className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
              >
                {GAME_MODES.map(mode => (
                  <option key={mode.label} value={mode.value.toString()}>{mode.label}</option>
                ))}
              </select>
            </div>
            <div className="mb-6">
              <label className="block text-gray-300 mb-1">Timer Duration (seconds)</label>
              <input
                type="number"
                min="5"
                max="60"
                value={timerDuration}
                onChange={e => setTimerDuration(Number(e.target.value))}
                className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
                required
              />
            </div>
            <div className="mb-4 flex items-center">
              <input
                id="tournament-mode"
                type="checkbox"
                checked={isTournamentMode}
                onChange={e => setIsTournamentMode(e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded"
                disabled={!activeAddress}
              />
              <label htmlFor="tournament-mode" className="ml-2 block text-sm text-gray-200 font-medium">
                Tournament Mode
              </label>
              {!activeAddress && (
                <span className="ml-2 text-xs text-gray-400">(Connect wallet to enable)</span>
              )}
            </div>
            <button
              type="submit"
              disabled={isCreating}
              className={`w-full py-2 px-4 rounded font-bold uppercase ${isCreating ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
            >
              {isCreating ? 'Creating...' : 'Create Match'}
            </button>
          </form>

          {/* Join Match Form */}
          <form onSubmit={handleJoinMatch} className="bg-gray-900 rounded-lg p-8 shadow-lg w-full max-w-md">
            <h2 className="text-white text-2xl font-bold uppercase mb-4 tracking-wide">Join Match</h2>
            <div className="mb-4">
              <label className="block text-gray-300 mb-1">Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-300 mb-1">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isJoining}
              onClick={() => console.log('[DEBUG] Join button clicked')}
              className={`w-full py-2 px-4 rounded font-bold uppercase ${isJoining ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              {isJoining ? 'Joining...' : 'Join Match'}
            </button>
          </form>
        </div>

        {/* Right Column: Current Game & Last Game */}
        <div className="md:col-span-2 space-y-8">
          {/* Current Game Section */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-2">
              <h2 className="text-2xl font-bold">CURRENT GAME</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleManualRefresh}
                  disabled={isLoadingCurrentGame}
                  className="text-gray-400 hover:text-white disabled:opacity-50"
                  title="Refresh tournament data"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                {isLoadingCurrentGame && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                )}
                {lastUpdated && (
                  <span className="text-xs text-gray-500">
                    Updated: {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
            {currentGame ? (
              <div>
                <div className="mb-3">
                  <span className="font-semibold text-gray-300">Tournament ID:</span>
                  <span className="ml-2 text-white text-lg font-bold">#{currentGame.tournamentId}</span>
                </div>
                <div className="mb-3">
                  <span className="font-semibold text-gray-300">Room Code:</span>
                  <span className="ml-2 text-white font-mono">{currentGame.roomCode}</span>
                </div>
                <div className="mb-3">
                  <span className="font-semibold text-gray-300">Status:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-bold ${currentGame.statusColor === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                    currentGame.statusColor === 'blue' ? 'bg-blue-100 text-blue-800' :
                      currentGame.statusColor === 'green' ? 'bg-green-100 text-green-800' :
                        currentGame.statusColor === 'red' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                    }`}>
                    {currentGame.statusDisplay}
                  </span>
                </div>
                <div className="mb-3">
                  <span className="font-semibold text-gray-300">Entry Fee:</span>
                  <span className="ml-2 text-white">{currentGame.entryFeeFormatted} {currentGame.tokenSymbol}</span>
                  <span className="ml-2 text-gray-400">({tokenToUsd(currentGame.entryFeeFormatted, currentGame.tokenSymbol)})</span>
                </div>
                <div className="mb-3">
                  <span className="font-semibold text-gray-300">Prize Pool:</span>
                  <span className="ml-2 text-green-400 font-bold">{currentGame.prizePoolFormatted} {currentGame.tokenSymbol}</span>
                  <span className="ml-2 text-green-300">({tokenToUsd(currentGame.prizePoolFormatted, currentGame.tokenSymbol)})</span>
                </div>
                <div className="mb-3">
                  <span className="font-semibold text-gray-300">Participants:</span>
                  <span className="ml-2 text-white">{currentGame.playerCount} / {currentGame.maxParticipants}</span>
                  {currentGame.isFull && (
                    <span className="ml-2 text-red-400 text-sm">(FULL)</span>
                  )}
                </div>
                <div className="mb-3">
                  <span className="font-semibold text-gray-300">Players:</span>
                  {currentGame.participants.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {currentGame.participants.map((participant, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-700 p-2 rounded">
                          <div className="flex items-center space-x-2">
                            <span className="bg-gray-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                              {participant.name.substring(0, 2).toUpperCase()}
                            </span>
                            <span className="text-white font-medium">{participant.name}</span>
                          </div>
                          <span className="text-gray-400 text-xs font-mono">
                            {formatAddress(participant.address)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 mt-1">No players have joined yet.</p>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-4">
                  Created: {formatDate(currentGame.createdAt)}
                </div>
              </div>
            ) : (
              <p className="text-gray-400">No active tournament found.</p>
            )}
          </div>

          {/* Last Game Section */}
          <LastGameSection
            lastGame={recentGames[0] || null}
            recentPayments={recentPayments}
            isLoading={isLoadingPayments}
            onRefresh={refreshPayments}
          />

          {/* Leaderboard section */}
          <div className="bg-gray-800 p-6 rounded-lg">
            {/* Leaderboard content */}
          </div>
        </div>
      </div>

      {/* Join Tournament Modal */}
      {showTournamentJoinModal && tournamentRoomDetails && (
        <TournamentJoinModal
          isOpen={showTournamentJoinModal}
          onClose={() => setShowTournamentJoinModal(false)}
          tournamentDetails={{
            ...tournamentRoomDetails,
          }}
          playerName={playerName}
          onJoinSuccess={handleTournamentJoinSuccess}
        />
      )}

      {/* Winner Payment Notifications */}
      <NotificationManager
        payments={recentPayments}
        onDismissPayment={(paymentId) => {
          // Handle dismissing a payment notification
          console.log('Payment notification dismissed:', paymentId);
        }}
        onViewPaymentDetails={(payment) => {
          // Handle viewing payment details - could open a modal or navigate to details page
          console.log('View payment details:', payment);
          // You could implement a modal or navigation here
        }}
      />
    </div>
  );
} 

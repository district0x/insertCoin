'use client';

// Import section - unchanged
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAddress, useConnectionStatus } from "@thirdweb-dev/react";
import { WalletConnect } from '@/components/WalletConnect';
import { AuthButton } from '@/components/AuthButton';
import { useAuth } from '@/hooks/useAuth';
import { CustomWalletConnect } from '@/components/CustomWalletConnect';
import { WalletConnectWrapper } from '@/components/WalletConnectWrapper';
import { useTournamentContract } from '@/hooks/useTournamentContract';
import { TournamentStatus, OnChainTournament } from './types/tournament';
import { supabase } from '@/lib/supabase';
import { TournamentJoinModal } from '@/components/JoinTournamentModule';
import { ethers } from 'ethers';


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
  totalPrize: number;
  status: string;
}

export default function Home() {
  // State declarations - unchanged
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [category, setCategory] = useState('any');
  const [questionCount, setQuestionCount] = useState(10);
  const [suddenDeath, setSuddenDeath] = useState(false);
  const [timerDuration, setTimerDuration] = useState(15);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const address = useAddress();
  const connectionStatus = useConnectionStatus();
  const { createTournament, isLoading: isTournamentLoading } = useTournamentContract();
  const { isAuthenticated, signIn } = useAuth();

  // Tournament-related state
  const [isTournamentMode, setIsTournamentMode] = useState(false);
  const [entryFee, setEntryFee] = useState('0.01');
  const [maxParticipants, setMaxParticipants] = useState(5);  // Default to 5 participants
  const [winnersPercentage, setWinnersPercentage] = useState(80);
  const [multisigPercentage, setMultisigPercentage] = useState(10);
  const [isCreating, setIsCreating] = useState(false);
  const [isTournamentRoom, setIsTournamentRoom] = useState(false);
  const [tournamentRoomDetails, setTournamentRoomDetails] = useState<TournamentDetails | null>(null);
  const [isJoiningTournament, setIsJoiningTournament] = useState(false);
  const [showTournamentJoinModal, setShowTournamentJoinModal] = useState(false);

  useEffect(() => {
    console.log("Authentication state:", {
      address,
      isAuthenticated,
      connectionStatus,
      isTournamentMode
    });
  }, [address, isAuthenticated, connectionStatus, isTournamentMode]);

  // Check if room code corresponds to a tournament
  useEffect(() => {
    const checkTournamentRoom = async () => {
      if (!roomCode || roomCode.length < 3) {
        setIsTournamentRoom(false);
        setTournamentRoomDetails(null);
        return;
      }

      try {
        setIsLoading(true);
        // Use the existing roomCode route
        const response = await fetch(`/api/tournament/${roomCode}`);
        const data = await response.json();

        if (data.isTournament) {
          setIsTournamentRoom(true);
          setTournamentRoomDetails({
            tournamentId: data.tournamentId,
            entryFee: data.entryFee,
            maxParticipants: data.maxParticipants,
            currentParticipants: data.currentParticipants || 0,
            totalPrize: data.totalPrize,
            status: data.status
          });
          console.log('Tournament room detected:', data);
        } else {
          setIsTournamentRoom(false);
          setTournamentRoomDetails(null);
        }
      } catch (error) {
        console.error('Error checking tournament room:', error);
        setIsTournamentRoom(false);
        setTournamentRoomDetails(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkTournamentRoom();
  }, [roomCode]);

  // Fetch leaderboard data - unchanged
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/leaderboard');
        const data = await response.json();

        if (data.results) {
          setLeaderboard(data.results);
        }
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  // Handle joining a game

  const handleTournamentJoinSuccess = () => {
    // Hide the modal
    setShowTournamentJoinModal(false);

    // Navigate to the game room with tournament parameters
    if (tournamentRoomDetails) {
      router.push(
        `/game/${roomCode}?name=${encodeURIComponent(playerName)}&role=player&tournamentId=${tournamentRoomDetails.tournamentId}&walletAddress=${address || ''}`
      );
    }
  };

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();

    if (!playerName) {
      alert('Please enter your name');
      return;
    }

    if (!roomCode) {
      alert('Please enter a room code');
      return;
    }

    // If this is a tournament room, open the tournament join modal
    if (isTournamentRoom && tournamentRoomDetails) {
      if (connectionStatus !== "connected") {
        alert('Please connect your wallet to join a tournament');
        return;
      }

      if (!isAuthenticated) {
        alert('Please sign in with your wallet to join a tournament');
        return;
      }

      // Show tournament join modal
      setShowTournamentJoinModal(true);
    } else {
      // For regular games, just join directly
      router.push(
        `/game/${roomCode}?name=${encodeURIComponent(playerName)}&role=player&walletAddress=${address || ''}`
      );
    }
  };


  // Generate a room code
  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // Handle creating a game
  // Updated handleCreateGame function for page.tsx
  // This removes references to currentParticipants which doesn't exist in your schema

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!playerName) {
      alert('Please enter your name');
      return;
    }

    // Generate the room code
    const newRoomCode = generateRoomCode();

    // Check if creating as tournament
    if (isTournamentMode) {
      // Check wallet connection
      if (connectionStatus !== "connected" || !address) {
        alert('Please connect your wallet to create a tournament game');
        return;
      }

      // Check authentication
      if (!isAuthenticated) {
        // Try to authenticate
        const success = await signIn().catch(err => {
          console.error("Authentication error:", err);
          return false;
        });

        if (!success) {
          alert('Please sign in with your wallet to create a tournament game');
          return;
        }
      }

      // Validate percentages don't exceed 100%
      if (winnersPercentage + multisigPercentage > 100) {
        alert('Winners percentage and platform fee cannot exceed 100%');
        return;
      }

      // Validate max participants
      if (maxParticipants < 2) {
        alert('Tournament must have at least 2 participants');
        return;
      }

      setIsCreating(true);

      try {
        // Zero address for ETH tournaments
        const zeroAddress = "0x0000000000000000000000000000000000000000";

        // Create tournament using contract with correct number of participants
        const result = await createTournament({
          numEntrants: maxParticipants, // Use maxParticipants instead of questionCount
          winnersPercentage,
          multisigPercentage,
          tokenAddress: zeroAddress,
          entryFee
        });

        console.log("Tournament created:", result);

        // Extract tournament ID from result
        const tournamentId = result.tournamentId;

        // Calculate total prize based on entry fee and max participants
        const totalPrize = parseFloat(entryFee) * maxParticipants;

        // Convert entry fee to Wei before sending to API
        const entryFeeInWei = ethers.utils.parseEther(entryFee).toString();

        console.log("Sending to API:", {
          tournamentId,
          roomCode: newRoomCode,
          entryFee: entryFeeInWei,
          maxParticipants: maxParticipants, // Use maxParticipants
          tokenAddress: zeroAddress,
          totalPrize: totalPrize
        });

        // Store tournament data in Supabase via API
        const tournamentResponse = await fetch('/api/tournament', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            tournamentId,
            roomCode: newRoomCode,
            entryFee: entryFeeInWei,
            maxParticipants: maxParticipants, // Use maxParticipants
            tokenAddress: zeroAddress,
            totalPrize: totalPrize
          })
        });

        const tournamentData = await tournamentResponse.json();

        if (!tournamentResponse.ok) {
          throw new Error(tournamentData.error || 'Failed to store tournament data');
        }

        console.log("Tournament data stored:", tournamentData);

        alert(`Tournament game created successfully! Tournament ID: ${tournamentId}`);

        // Navigate to game room with tournament ID
        router.push(
          `/game/${newRoomCode}?name=${encodeURIComponent(playerName)}&role=host&category=${category}&questionCount=${questionCount}&timerDuration=${timerDuration}&suddenDeath=${suddenDeath}&tournamentId=${tournamentId}&walletAddress=${address}`
        );

      } catch (err: any) {
        console.error("Error creating tournament:", err);
        alert(`Failed to create tournament: ${err.message || "Unknown error"}`);
      } finally {
        setIsCreating(false);
      }
    } else {
      // Regular game creation (no blockchain integration)
      router.push(
        `/game/${newRoomCode}?name=${encodeURIComponent(playerName)}&role=host&category=${category}&questionCount=${questionCount}&timerDuration=${timerDuration}&suddenDeath=${suddenDeath}${address ? `&walletAddress=${address}` : ''}`
      );
    }
  };

  // Render leaderboard function - unchanged
  const renderLeaderboard = () => {
    // Existing implementation...
    if (isLoading) {
      return <p className="text-gray-500">Loading leaderboard data...</p>;
    }

    if (leaderboard.length === 0) {
      return <p className="text-gray-500">Game history will appear here once games have been played.</p>;
    }

    return (
      <div className="space-y-4">
        {leaderboard.map((entry) => {
          // Sort players by score (highest first)
          const sortedPlayers = [...entry.players].sort((a, b) => b.score - a.score);
          const winner = sortedPlayers[0];
          const date = new Date(entry.timestamp);

          return (
            <div key={entry.id} className="border border-gray-200 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <div className="font-semibold">
                  Winner: <span className="text-green-600">{winner.name}</span> ({winner.score} pts)
                </div>
                <div className="text-sm text-gray-500">
                  {date.toLocaleDateString()} at {date.toLocaleTimeString()}
                </div>
              </div>

              <div className="text-sm">
                <p className="mb-1">Top Players:</p>
                <div className="grid grid-cols-2 gap-2">
                  {sortedPlayers.slice(0, 4).map((player, index) => (
                    <div key={index} className="flex justify-between">
                      <span>#{index + 1} {player.name}</span>
                      <span className="font-medium">{player.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Component render - UI remains unchanged
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
      <div className="max-w-4xl w-full">
        <h1 className="text-4xl font-bold text-center mb-8 text-blue-700">Multiplayer Trivia Game</h1>
        <div className="flex items-center gap-3 mb-6">
          <WalletConnectWrapper />
          {address && <AuthButton />}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Join Game Card */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">Join a Game</h2>
            <form onSubmit={handleJoinGame}>
              <div className="mb-4">
                <label htmlFor="room-code" className="block text-sm font-medium mb-1">
                  Room Code
                </label>
                <input
                  id="room-code"
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-digit code"
                  className="w-full p-2 border border-gray-300 rounded"
                  required
                />
              </div>

              <div className="mb-4">
                <label htmlFor="player-name" className="block text-sm font-medium mb-1">
                  Your Name
                </label>
                <input
                  id="player-name"
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full p-2 border border-gray-300 rounded"
                  required
                />
              </div>

              {/* Tournament Room Info */}
              {isTournamentRoom && tournamentRoomDetails && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="font-medium text-blue-800 mb-2">Tournament Game</p>
                  <div className="text-sm text-blue-700 space-y-1">
                    <div className="flex justify-between">
                      <span>Entry Fee:</span>
                      <span className="font-medium">{parseFloat(tournamentRoomDetails.entryFee).toFixed(4)} ETH</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Prize Pool:</span>
                      <span className="font-medium">{tournamentRoomDetails.totalPrize.toFixed(4)} ETH</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Players:</span>
                      <span className="font-medium">{tournamentRoomDetails.currentParticipants} / {tournamentRoomDetails.maxParticipants}</span>
                    </div>
                    {tournamentRoomDetails.currentParticipants >= tournamentRoomDetails.maxParticipants && (
                      <div className="text-red-600 font-medium text-center mt-1">
                        This tournament is full
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className={`w-full py-2 px-4 rounded font-medium ${isLoading
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Join Game'}
              </button>
            </form>
          </div>

          {/* Create Game Card */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">Host a Game</h2>
            <form onSubmit={handleCreateGame}>
              {/* Game creation form - unchanged */}
              {/* ... (existing code) ... */}
              <div className="mb-4">
                <label htmlFor="host-name" className="block text-sm font-medium mb-1">
                  Your Name
                </label>
                <input
                  id="host-name"
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full p-2 border border-gray-300 rounded"
                  required
                />
              </div>

              <div className="mb-4">
                <label htmlFor="category" className="block text-sm font-medium mb-1">
                  Category
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded"
                >
                  <option value="any">Any Category</option>
                  <option value="9">General Knowledge</option>
                  <option value="10">Books</option>
                  <option value="11">Film</option>
                  <option value="12">Music</option>
                  <option value="14">Television</option>
                  <option value="15">Video Games</option>
                  <option value="17">Science & Nature</option>
                  <option value="18">Computers</option>
                  <option value="19">Mathematics</option>
                  <option value="21">Sports</option>
                  <option value="22">Geography</option>
                  <option value="23">History</option>
                </select>
              </div>

              <div className="mb-4">
                <label htmlFor="question-count" className="block text-sm font-medium mb-1">
                  Number of Questions
                </label>
                <select
                  id="question-count"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded"
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="15">15</option>
                  <option value="20">20</option>
                </select>
              </div>

              <div className="mb-4">
                <label htmlFor="timer-duration" className="block text-sm font-medium mb-1">
                  Time Per Question
                </label>
                <select
                  id="timer-duration"
                  value={timerDuration}
                  onChange={(e) => setTimerDuration(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded"
                >
                  <option value="5">5 seconds (Speed Round)</option>
                  <option value="10">10 seconds (Quick)</option>
                  <option value="15">15 seconds (Standard)</option>
                  <option value="30">30 seconds (Relaxed)</option>
                </select>
              </div>

              <div className="mb-4">
                <div className="flex items-center">
                  <input
                    id="sudden-death"
                    type="checkbox"
                    checked={suddenDeath}
                    onChange={(e) => setSuddenDeath(e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="sudden-death" className="ml-2 block text-sm text-gray-900">
                    Sudden Death Mode
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Players are eliminated after an incorrect answer
                </p>
              </div>

              {/* Tournament Mode Toggle */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="tournament-mode"
                    checked={isTournamentMode}
                    onChange={(e) => setIsTournamentMode(e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded"
                    disabled={connectionStatus !== "connected"}
                  />
                  <label htmlFor="tournament-mode" className="ml-2 font-medium">
                    Create as Tournament Game
                  </label>
                </div>

                {connectionStatus !== "connected" && (
                  <div className="text-sm text-blue-700 mb-2">
                    Connect your wallet to create tournament games
                  </div>
                )}

                {connectionStatus === "connected" && !isAuthenticated && (
                  <div className="text-sm text-blue-700 mb-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        try {
                          signIn();
                        } catch (error) {
                          console.error("Sign-in error:", error);
                          alert("Failed to sign in. Please try again.");
                        }
                      }}
                      className="underline"
                    >
                      Sign in with your wallet
                    </button> to create tournament games
                  </div>
                )}

                {isTournamentMode && connectionStatus === "connected" && isAuthenticated && (
                  <div className="space-y-3 mt-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Number of Participants
                      </label>
                      <input
                        type="number"
                        min="2"
                        max="100"
                        value={maxParticipants}
                        onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                      <p className="text-xs text-gray-500 mt-1">Maximum number of players allowed in the tournament</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Entry Fee (ETH)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={entryFee}
                        onChange={(e) => setEntryFee(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                    </div>

                    {/* Show estimated prize pool */}
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-green-800">Estimated Prize Pool:</span>
                        <span className="font-bold text-green-700">{(parseFloat(entryFee) * maxParticipants).toFixed(4)} ETH</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Winners Percentage (%)
                      </label>
                      <input
                        type="number"
                        min="50"
                        max="95"
                        value={winnersPercentage}
                        onChange={(e) => setWinnersPercentage(parseInt(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                      <p className="text-xs text-gray-500 mt-1">Percentage of pool that goes to winners</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Platform Fee (%)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={multisigPercentage}
                        onChange={(e) => setMultisigPercentage(parseInt(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                      <p className="text-xs text-gray-500 mt-1">Percentage that goes to platform</p>
                    </div>

                    {/* Distribution preview */}
                    <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                      <div className="font-medium mb-1">Prize Distribution Preview:</div>
                      <div className="flex justify-between">
                        <span>Winners Pool:</span>
                        <span>{(parseFloat(entryFee) * maxParticipants * winnersPercentage / 100).toFixed(4)} ETH</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Platform Fee:</span>
                        <span>{(parseFloat(entryFee) * maxParticipants * multisigPercentage / 100).toFixed(4)} ETH</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isCreating || (isTournamentMode && (!isAuthenticated || connectionStatus !== "connected"))}
                className={`w-full py-2 px-4 rounded font-medium ${isCreating || (isTournamentMode && (!isAuthenticated || connectionStatus !== "connected"))
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
              >
                {isCreating ? 'Creating Tournament...' : 'Create Game'}
              </button>
            </form>
          </div>
        </div>

        {/* Recent Winners Section */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Recent Winners</h2>
          {renderLeaderboard()}
        </div>
      </div>

      {/* Tournament Join Modal */}
      {showTournamentJoinModal && tournamentRoomDetails && (
        <TournamentJoinModal
          isOpen={showTournamentJoinModal}
          onClose={() => setShowTournamentJoinModal(false)}
          tournamentDetails={tournamentRoomDetails}
          playerName={playerName}
          roomCode={roomCode}
          onJoinSuccess={handleTournamentJoinSuccess}
        />
      )}
    </main>
  );
} 

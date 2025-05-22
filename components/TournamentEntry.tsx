// components/EnhancedTournamentEntry.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTournamentContract } from '@/hooks/useTournamentContract';
import { useAddress, useConnectionStatus } from "@thirdweb-dev/react";
import { useAuth } from '@/hooks/useAuth';
import { ethers } from 'ethers';
import { formatTournamentError } from '@/lib/tournamentDiagnostics';

interface EnhancedTournamentEntryProps {
  tournamentId: string;
  entryFee: string;
  onJoinSuccess: () => void;
  isHost?: boolean;
}

export function EnhancedTournamentEntry({
  tournamentId,
  entryFee,
  onJoinSuccess,
  isHost = false
}: EnhancedTournamentEntryProps) {
  const [isJoining, setIsJoining] = useState(false);
  const [isParticipant, setIsParticipant] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [tournamentDetails, setTournamentDetails] = useState<any>(null);

  const { joinTournament, isEntrantInTournament, getTournamentDetails } = useTournamentContract();
  const address = useAddress();
  const connectionStatus = useConnectionStatus();
  const { isAuthenticated, signIn } = useAuth();

  // Formatted entry fee for display
  const formattedEntryFee = typeof entryFee === 'string' && entryFee.includes('.')
    ? entryFee // Already formatted as ETH with decimal point
    : ethers.utils.formatEther(entryFee || '0'); // Format from Wei to ETH

  // Fetch tournament details
  useEffect(() => {
    const fetchTournamentDetails = async () => {
      if (!tournamentId) return;

      try {
        const details = await getTournamentDetails(parseInt(tournamentId));
        setTournamentDetails(details);
      } catch (err) {
        console.error('Error fetching tournament details:', err);
        setError('Could not load tournament details');
      }
    };

    fetchTournamentDetails();
  }, [tournamentId, getTournamentDetails]);

  // Check if user is already a participant
  useEffect(() => {
    const checkParticipantStatus = async () => {
      if (!tournamentId || !address) return;

      try {
        setIsCheckingStatus(true);
        const isParticipant = await isEntrantInTournament(
          parseInt(tournamentId),
          address
        );
        setIsParticipant(isParticipant);
      } catch (err) {
        console.error('Error checking participant status:', err);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkParticipantStatus();
  }, [tournamentId, address, isEntrantInTournament]);

  // Handle joining the tournament
  const handleJoinTournament = async () => {
    if (!address) {
      setError('Please connect your wallet first');
      return;
    }

    if (!isAuthenticated) {
      try {
        const success = await signIn();
        if (!success) {
          setError('Authentication failed. Please try again.');
          return;
        }
      } catch (err: any) {
        setError(formatTournamentError(err));
        return;
      }
    }

    setIsJoining(true);
    setError(null);

    try {
      // Join the tournament on the blockchain
      const result = await joinTournament(
        parseInt(tournamentId),
        entryFee
      );

      console.log('Tournament joined successfully:', result);

      // Update participant status in database
      const updateResponse = await fetch(`/api/tournament/byid/${tournamentId}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          walletAddress: address,
          txHash: result.hash
        })
      });

      if (!updateResponse.ok) {
        console.warn('Warning: Failed to update participant status in database');
      }

      setIsParticipant(true);
      onJoinSuccess();

    } catch (err: any) {
      console.error('Error joining tournament:', err);
      setError(formatTournamentError(err));
    } finally {
      setIsJoining(false);
    }
  };

  if (isCheckingStatus) {
    return (
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-center text-blue-700">Checking tournament status...</p>
      </div>
    );
  }

  if (isHost) {
    return (
      <div className="bg-purple-100 p-4 rounded-lg">
        <h3 className="text-xl font-semibold text-purple-800 mb-3">Tournament Host</h3>
        <p className="text-purple-700">
          You are hosting this tournament with an entry fee of {formattedEntryFee} ETH.
        </p>
        <p className="text-sm text-purple-600 mt-2">
          Share the room code with others to invite them to join.
        </p>
      </div>
    );
  }

  if (isParticipant) {
    return (
      <div className="bg-green-100 p-4 rounded-lg">
        <h3 className="text-xl font-semibold text-green-800 mb-3">Tournament Participant</h3>
        <p className="text-center text-green-800 font-medium">
          You have successfully joined this tournament!
        </p>
        {tournamentDetails && (
          <div className="mt-2 text-sm text-green-700">
            <p>The prize pool is currently {ethers.utils.formatEther(tournamentDetails.remainingBalance || '0')} ETH.</p>
            <p className="mt-1">Good luck and have fun!</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-blue-50 p-4 rounded-lg">
      <h3 className="text-xl font-semibold text-blue-800 mb-3">Tournament Entry</h3>

      <div className="mb-4">
        <div className="flex justify-between mb-2">
          <span className="font-medium">Entry Fee:</span>
          <span>{formattedEntryFee} ETH</span>
        </div>

        <p className="text-sm text-blue-700 mb-4">
          By joining this tournament, you agree to pay the entry fee which will be added to the prize pool.
        </p>

        {error && (
          <div className="bg-red-100 text-red-700 p-2 rounded mb-3 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {connectionStatus !== "connected" && (
            <p className="text-center text-blue-700">
              Please connect your wallet to join the tournament
            </p>
          )}

          {connectionStatus === "connected" && !isAuthenticated && (
            <button
              onClick={signIn}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
            >
              Sign in with Ethereum
            </button>
          )}

          {connectionStatus === "connected" && isAuthenticated && (
            <button
              onClick={handleJoinTournament}
              disabled={isJoining}
              className={`w-full py-2 px-4 rounded font-medium ${isJoining
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-green-600 text-white hover:bg-green-700'
                }`}
            >
              {isJoining ? 'Joining Tournament...' : 'Join Tournament'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
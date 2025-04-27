'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Define types
interface LeaderboardEntry {
  id: string;
  timestamp: string;
  players: {
    name: string;
    score: number;
  }[];
}

export default function Home() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [category, setCategory] = useState('any');
  const [questionCount, setQuestionCount] = useState(10);
  const [suddenDeath, setSuddenDeath] = useState(false);
  const [timerDuration, setTimerDuration] = useState(15);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch leaderboard data
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
  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();

    if (playerName && roomCode) {
      router.push(`/game/${roomCode}?name=${encodeURIComponent(playerName)}&role=player`);
    }
  };

  // Handle creating a game
  const handleCreateGame = (e: React.FormEvent) => {
    e.preventDefault();

    if (playerName) {
      // Generate a random room code
      const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      router.push(
        `/game/${newRoomCode}?name=${encodeURIComponent(playerName)}&role=host&category=${category}&questionCount=${questionCount}&suddenDeath=${suddenDeath}&timerDuration=${timerDuration}`
      );
    }
  };

  // Render leaderboard function
  const renderLeaderboard = () => {
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
      <div className="max-w-4xl w-full">
        <h1 className="text-4xl font-bold text-center mb-8 text-blue-700">Multiplayer Trivia Game</h1>

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

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
              >
                Join Game
              </button>
            </form>
          </div>

          {/* Create Game Card */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">Host a Game</h2>
            <form onSubmit={handleCreateGame}>
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

              <button
                type="submit"
                className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition"
              >
                Create Game
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
    </main>
  );
}
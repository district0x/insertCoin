'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSocket } from '@/app/hooks/useSocket';
import { usePrivy } from '@privy-io/react-auth';
import { Player, Question } from '@/app/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTournamentContract } from '@/hooks/useTournamentContract';
import { OnChainTournament, TournamentPlayer, TournamentWinner } from '@/app/types/tournament';
import { TournamentPayoutPanel } from '@/components/TournamentPayoutPanel';
import { WinnerSummary } from '@/components/WinnerSummary';
import { GameDebugPanel } from '@/components/GameDebugPanel';




export default function GameRoom() {
    const params = useParams();
    const searchParams = useSearchParams();
    const { socket, updateRoomSettings } = useSocket();
    const [isClient, setIsClient] = useState(false);
    const { authenticated: isAuthenticated, user } = usePrivy();
    const address = user?.wallet?.address || '';
    const connectionStatus = isAuthenticated ? 'connected' : 'disconnected';
    const tournamentId = searchParams.get('tournamentId');
    const [isTournamentMode, setIsTournamentMode] = useState(!!tournamentId);
    const [tournamentDetails, setTournamentDetails] = useState<OnChainTournament | null>(null);
    const [entryFee, setEntryFee] = useState('0.01');
    const [hasJoinedTournament, setHasJoinedTournament] = useState(false);
    const { joinTournament, isEntrantInTournament, endTournament, getTournamentDetails, saveGameResult, startTournament, isLoading: isTournamentLoading } = useTournamentContract();
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);


    // Safe logging functions
    const safeLog = (...args: any[]) => {
        if (typeof window !== 'undefined') {
            console.log(...args);
        }
    };

    // Get URL parameters
    const roomId = params.roomId as string;
    const playerName = searchParams.get('name') || 'Anonymous';
    const role = searchParams.get('role') || 'player';
    const [isHost, setIsHost] = useState(role === 'host');
    const [waitingForPlayers, setWaitingForPlayers] = useState(false);
    const hasMovedToNextQuestion = useRef(false);
    const submittedAnswersRef = useRef<Record<number, boolean>>({});

    // Use refs for stable settings values
    const gameSettingsRef = useRef({
        suddenDeath: searchParams.get('suddenDeath') === 'true',
        timerDuration: parseInt(searchParams.get('timerDuration') || '15')
    });

    // State derived from settings - used for UI only
    const [gameMode, setGameMode] = useState<'standard' | 'sudden-death'>(
        gameSettingsRef.current.suddenDeath ? 'sudden-death' : 'standard'
    );
    const [timerDuration, setTimerDuration] = useState(gameSettingsRef.current.timerDuration);

    // Settings update tracking
    const hasInitializedSettings = useRef(false);
    const settingsUpdateTimeRef = useRef<number>(0);

    // Game state
    const [gameStatus, setGameStatus] = useState<'waiting' | 'in-progress' | 'completed'>('waiting');
    const [players, setPlayers] = useState<Player[]>([]);
    const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [shuffledAnswers, setShuffledAnswers] = useState<string[]>([]);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [timer, setTimer] = useState(gameSettingsRef.current.timerDuration);
    const [results, setResults] = useState<Player[]>([]);
    const currentQuestion = questions[currentQuestionIndex];

    // Track whether answers have been shuffled for the current question
    const hasShuffledRef = useRef<Record<string, boolean>>({});

    // Calculate active players (not eliminated) - memoized for performance
    const activePlayerCount = useMemo(() => {
        return players.filter(p => !p.eliminated).length;
    }, [players]);



    // Join the room when socket is ready
    useEffect(() => {
        if (socket) {
            // Get wallet address from URL parameters or connected wallet
            const walletAddress = searchParams.get('walletAddress') || address || '';
            console.log('Joining room with wallet address:', walletAddress);

            // Join the room with wallet address
            socket.emit('join-room', roomId, playerName, walletAddress);
            // Set up socket event listeners
            socket.on('player-info', (playerInfo) => {
                setCurrentPlayer({
                    id: playerInfo.id,
                    name: playerInfo.name,
                    score: 0,
                    eliminated: false,
                    walletAddress: playerInfo.walletAddress || null
                });
                // The server is the source of truth for who the host is
                setIsHost(playerInfo.isHost || false);
            });

            socket.on('player-joined', (player) => {
                setPlayers((prevPlayers) => {
                    // Check if player already exists
                    if (prevPlayers.some(p => p.id === player.id)) {
                        return prevPlayers;
                    }
                    return [...prevPlayers, player];
                });
            });

            socket.on('game-started', async () => {
                console.log('GAME STARTED EVENT RECEIVED');
                setGameStatus('in-progress');

                // Reset any previous game state
                setCurrentQuestionIndex(0);
                setSelectedAnswer(null);
                setTimer(gameSettingsRef.current.timerDuration);
                hasShuffledRef.current = {}; // Reset shuffled status
                hasMovedToNextQuestion.current = false;
                setWaitingForPlayers(false);
                submittedAnswersRef.current = {};

                // Reset player scores and elimination status
                setPlayers(prevPlayers =>
                    prevPlayers.map(player => ({
                        ...player,
                        score: 0,
                        eliminated: false
                    }))
                );

                if (currentPlayer) {
                    setCurrentPlayer({
                        ...currentPlayer,
                        score: 0,
                        eliminated: false
                    });
                }

                // ONLY the host should fetch questions
                if (isHost) {
                    console.log('HOST: Fetching questions for the game');

                    // Get game settings (from URL if host, or use defaults)
                    const category = searchParams.get('category') || 'any';
                    const questionCount = searchParams.get('questionCount') || '10';

                    console.log(`HOST: Fetching questions: amount=${questionCount}, category=${category}`);

                    try {
                        // Fetch questions from our API
                        const response = await fetch(
                            `/api/questions?amount=${questionCount}&category=${category}`
                        );

                        if (!response.ok) {
                            throw new Error(`API responded with status: ${response.status}`);
                        }

                        const data = await response.json();

                        if (data.questions && data.questions.length > 0) {
                            console.log(`HOST: Received ${data.questions.length} questions from API`);
                            setQuestions(data.questions);

                            // Host sends questions to server for syncing
                            console.log(`HOST: Sending ${data.questions.length} questions to server for synchronization`);
                            socket.emit('questions-loaded', roomId, data.questions);
                        } else {
                            throw new Error('No questions received from API');
                        }
                    } catch (error) {
                        console.error('Error fetching questions:', error);
                        console.log('HOST: Falling back to mock questions');

                        // Generate more mock questions (at least 10)
                        const mockQuestions = generateMockQuestions(parseInt(questionCount));

                        console.log(`HOST: Created ${mockQuestions.length} mock questions as fallback`);
                        setQuestions(mockQuestions);

                        // Send mock questions to server for syncing
                        socket.emit('questions-loaded', roomId, mockQuestions);
                    }
                } else {
                    // Non-host players wait for questions from server
                    console.log('PLAYER: Waiting for host to load questions');

                    // Set a timeout to prevent infinite waiting
                    setTimeout(() => {
                        if (questions.length === 0) {
                            console.error('PLAYER: No questions received after 10 seconds, generating fallback questions');
                            const fallbackQuestions = generateMockQuestions(10);
                            setQuestions(fallbackQuestions);
                        }
                    }, 10000);
                }
            });

            // Add a fallback function to generate mock questions if needed
            const generateMockQuestions = (count: number = 10): Question[] => {
                const questions: Question[] = [];

                // Add some standard questions first
                const standardQuestions = [
                    {
                        id: 'q-1',
                        category: 'General Knowledge',
                        difficulty: 'easy',
                        question: 'What is the capital of France?',
                        correctAnswer: 'Paris',
                        incorrectAnswers: ['London', 'Berlin', 'Madrid']
                    },
                    {
                        id: 'q-2',
                        category: 'Science',
                        difficulty: 'medium',
                        question: 'What is the chemical symbol for gold?',
                        correctAnswer: 'Au',
                        incorrectAnswers: ['Ag', 'Fe', 'Cu']
                    }
                ];

                // Add standard questions
                questions.push(...standardQuestions);

                // Generate additional random questions if needed
                const categories = ['History', 'Geography', 'Science', 'Entertainment', 'Sports', 'Art'];
                const difficulties = ['easy', 'medium', 'hard'];

                for (let i = standardQuestions.length; i < count; i++) {
                    questions.push({
                        id: `q-${i + 1}`,
                        category: categories[Math.floor(Math.random() * categories.length)],
                        difficulty: difficulties[Math.floor(Math.random() * difficulties.length)],
                        question: `Question ${i + 1}: This is a fallback question`,
                        correctAnswer: `Answer ${i + 1}`,
                        incorrectAnswers: [`Wrong A${i}`, `Wrong B${i}`, `Wrong C${i}`]
                    });
                }

                return questions;
            };

            socket.on('player-answered', (data) => {
                // Update the player in the players list
                setPlayers((prevPlayers) =>
                    prevPlayers.map(player =>
                        player.id === data.playerId
                            ? {
                                ...player,
                                score: data.score,
                                eliminated: data.eliminated === true // Ensure this is a boolean
                            }
                            : player
                    )
                );

                // Also update current player if it's the same player
                if (currentPlayer && currentPlayer.id === data.playerId) {
                    setCurrentPlayer(prev => ({
                        ...prev!,
                        score: data.score,
                        eliminated: data.eliminated === true // Ensure this is a boolean
                    }));
                }
            });

            socket.on('game-over', (gameResults) => {
                setGameStatus('completed');
                setResults(gameResults);
            });

            socket.on('game-in-progress', (gameState) => {
                console.log('GAME IN PROGRESS event received', gameState);
                setGameStatus('in-progress');

                if (gameState.questions && gameState.questions.length > 0) {
                    console.log(`Received ${gameState.questions.length} questions and current index ${gameState.currentQuestionIndex}`);
                    setQuestions(gameState.questions);
                    setCurrentQuestionIndex(gameState.currentQuestionIndex || 0);
                    setTimer(gameSettingsRef.current.timerDuration);
                    hasMovedToNextQuestion.current = false;
                    setWaitingForPlayers(false);
                } else {
                    console.warn('Received game-in-progress event without questions data');
                }
            });

            socket.on('questions-ready', (startIndex, questions) => {
                // When questions are loaded by the host and ready on the server
                console.log(`QUESTIONS READY event received, starting at index ${startIndex}, ${questions ? questions.length : 0} questions`);

                if (questions && questions.length > 0) {
                    console.log(`Setting ${questions.length} questions from server`);
                    setQuestions(questions);
                }

                setCurrentQuestionIndex(startIndex);
                setSelectedAnswer(null);
                setTimer(gameSettingsRef.current.timerDuration);
                hasShuffledRef.current = {}; // Reset shuffled status
            });

            // Handle host changes
            socket.on('host-changed', (newHostId) => {
                if (currentPlayer && currentPlayer.id === newHostId) {
                    // Update local state to reflect the player is now the host
                    const searchParams = new URLSearchParams(window.location.search);
                    searchParams.set('role', 'host');
                    window.history.replaceState({}, '', `?${searchParams.toString()}`);
                    setIsHost(true);
                }
            });

            // Handle temporary disconnections
            socket.on('player-disconnected', (playerId) => {
                setPlayers((prevPlayers) =>
                    prevPlayers.map(player =>
                        player.id === playerId
                            ? { ...player, disconnected: true }
                            : player
                    )
                );
            });

            // Handle when a disconnected player returns
            socket.on('player-reconnected', (playerId) => {
                setPlayers((prevPlayers) =>
                    prevPlayers.map(player =>
                        player.id === playerId
                            ? { ...player, disconnected: false }
                            : player
                    )
                );
            });

            // Handle when a player leaves permanently
            socket.on('player-left', (playerId) => {
                setPlayers((prevPlayers) =>
                    prevPlayers.filter(player => player.id !== playerId)
                );
            });

            // Handle question changes (for sync)
            socket.on('question-changed', (index) => {
                setCurrentQuestionIndex(index);
                setSelectedAnswer(null);
                setTimer(gameSettingsRef.current.timerDuration);
            });

            // Handle errors
            socket.on('error', (message) => {
                console.error('Socket error:', message);
                alert(`Game error: ${message}`);
            });

            // Clean up listeners on unmount
            return () => {
                socket.off('player-info');
                socket.off('player-joined');
                socket.off('game-started');
                socket.off('player-answered');
                socket.off('game-over');
                socket.off('game-in-progress');
                socket.off('questions-ready');
                socket.off('host-changed');
                socket.off('player-disconnected');
                socket.off('player-reconnected');
                socket.off('player-left');
                socket.off('question-changed');
                socket.off('error');
                socket.off('room-settings');
                socket.off('settings-confirmed');
            };
        }
    }, [socket, roomId, playerName, searchParams, isHost]);

    useEffect(() => {
        if (!socket) return;

        socket.on('all-players-answered', () => {
            console.log(`ALL PLAYERS ANSWERED EVENT - Current question: ${currentQuestionIndex + 1}/${questions.length}`);
            setWaitingForPlayers(false);

            // Only proceed if we haven't already moved to the next question (prevents double moves)
            if (!hasMovedToNextQuestion.current) {
                console.log(`Setting hasMovedToNextQuestion = true, will advance question shortly`);
                hasMovedToNextQuestion.current = true;

                // Small delay to give players time to see the result
                setTimeout(() => {
                    console.log(`Timeout triggered, calling handleNextQuestion()`);
                    handleNextQuestion();
                }, 2000);
            } else {
                console.log(`Already moving to next question - ignoring duplicate event`);
            }
        });

        socket.on('game-over', (gameResults) => {
            console.log(`GAME OVER EVENT RECEIVED - Final results:`, gameResults.map((p: Player) => `${p.name}: ${p.score}pts${p.eliminated ? ' (eliminated)' : ''}`));
            setGameStatus('completed');
            setResults(gameResults);
        });

        return () => {
            socket.off('all-players-answered');
            socket.off('game-over');
        };
    }, [socket, currentQuestionIndex, questions.length]);

    // Timer countdown when game is in progress
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (gameStatus === 'in-progress' && timer > 0 && !waitingForPlayers) {
            console.log(`TIMER: ${timer}s remaining, GameMode: ${gameSettingsRef.current.suddenDeath ? 'sudden-death' : 'standard'}, Duration: ${gameSettingsRef.current.timerDuration}s`);

            interval = setInterval(() => {
                setTimer((prevTimer) => prevTimer - 1);
            }, 1000);
        } else if (timer === 0 && gameStatus === 'in-progress' && !waitingForPlayers) {
            // Time's up, but don't move to next question yet - just submit the answer
            console.log(`TIMER EXPIRED for question ${currentQuestionIndex + 1}`);

            if (currentPlayer && !currentPlayer.eliminated && !selectedAnswer) {
                // Auto-submit a wrong answer if the player hasn't answered
                const isEliminated = gameSettingsRef.current.suddenDeath;

                console.log(`AUTO-SUBMITTING answer for player ${currentPlayer.name} - Will be eliminated: ${isEliminated}`);

                // Update current player state locally first for immediate feedback
                setCurrentPlayer(prev => ({
                    ...prev!,
                    eliminated: prev!.eliminated || isEliminated
                }));

                setSelectedAnswer('');  // Mark as answered with an empty string
                setWaitingForPlayers(true);
                hasMovedToNextQuestion.current = false;

                // Send timeout to server with explicit elimination status
                console.log(`Emitting answer-submitted for timeout: Player ${currentPlayer.name}, Score: ${currentPlayer.score}, Eliminated: ${isEliminated}`);

                socket?.emit(
                    'answer-submitted',
                    roomId,
                    currentPlayer.id,
                    currentPlayer.name,
                    false, // isCorrect
                    currentPlayer.score, // score remains the same
                    isEliminated // Explicit elimination status
                );
            } else {
                console.log(`No auto-submit needed: Player answered=${!!selectedAnswer} or already eliminated=${currentPlayer?.eliminated}`);
            }
        }

        return () => clearInterval(interval);
    }, [gameStatus, timer, currentPlayer, selectedAnswer, waitingForPlayers, roomId, socket]);

    // Save game results when the game ends
    useEffect(() => {
        if (gameStatus === 'completed' && results.length > 0 && connectionStatus === "connected" && address && isAuthenticated) {
            // Find the current player's result
            const playerResult = results.find(p => p.id === currentPlayer?.id);

            if (playerResult && currentPlayer) {
                console.log(`Saving game result for player ${currentPlayer.name} with score ${playerResult.score}`);

                // Save result on-chain
                saveGameResult(roomId, address, playerResult.score)
                    .then((tx) => {
                        console.log("Game result saved on-chain:", tx);
                    })
                    .catch((error) => {
                        console.error("Failed to save game result:", error);
                    });
            }
        }
    }, [gameStatus, results, currentPlayer, roomId, address, connectionStatus, saveGameResult, isAuthenticated]);

    // Shuffle answers only once when a new question is loaded
    useEffect(() => {
        if (currentQuestion && !hasShuffledRef.current[currentQuestion.id]) {
            const allAnswers = [
                currentQuestion.correctAnswer,
                ...currentQuestion.incorrectAnswers
            ];
            // Shuffle answers and store in state
            setShuffledAnswers([...allAnswers].sort(() => Math.random() - 0.5));

            // Mark this question as shuffled
            hasShuffledRef.current[currentQuestion.id] = true;
        }
    }, [currentQuestion]);

    useEffect(() => {
        // Remove the key for the previous question to allow answer submissions for the new question
        if (currentQuestionIndex in submittedAnswersRef.current) {
            const newSubmittedAnswers = { ...submittedAnswersRef.current };
            delete newSubmittedAnswers[currentQuestionIndex];
            submittedAnswersRef.current = newSubmittedAnswers;
        }
    }, [currentQuestionIndex]);

    // Handle room settings updates
    useEffect(() => {
        if (!socket || !isClient) return;

        // Listen for room settings updates
        socket.on('room-settings', (settings) => {
            console.log('ROOM_SETTINGS RECEIVED:', settings);
            console.log('Current settings ref:', gameSettingsRef.current);

            // Only update if it's a new settings event (prevents duplicates)
            const now = Date.now();
            if (now - settingsUpdateTimeRef.current < 500) {
                console.log('Ignoring rapid settings update');
                return; // Ignore rapid updates
            }
            settingsUpdateTimeRef.current = now;

            let needsUpdate = false;

            if (settings.suddenDeath !== undefined &&
                settings.suddenDeath !== gameSettingsRef.current.suddenDeath) {
                console.log(`Updating suddenDeath: ${gameSettingsRef.current.suddenDeath} -> ${settings.suddenDeath}`);
                gameSettingsRef.current.suddenDeath = settings.suddenDeath;
                setGameMode(settings.suddenDeath ? 'sudden-death' : 'standard');
                needsUpdate = true;
            }

            if (settings.timerDuration !== undefined &&
                settings.timerDuration !== gameSettingsRef.current.timerDuration) {
                console.log(`Updating timerDuration: ${gameSettingsRef.current.timerDuration} -> ${settings.timerDuration}`);
                gameSettingsRef.current.timerDuration = settings.timerDuration;
                setTimerDuration(settings.timerDuration);
                needsUpdate = true;
            }

            if (needsUpdate) {
                console.log('Settings updated:', gameSettingsRef.current);
            } else {
                console.log('No settings changes needed');
            }
        });

        // Confirmation from server that settings were received
        socket.on('settings-confirmed', (settings) => {
            safeLog('Settings confirmed by server:', settings);
        });

        return () => {
            socket.off('room-settings');
            socket.off('settings-confirmed');
        };
    }, [socket, isClient]);

    // Send initial settings once when component mounts (only if host)
    useEffect(() => {
        if (isHost && isClient && socket && !hasInitializedSettings.current) {
            // Get settings from URL params explicitly
            const urlTimerDuration = parseInt(searchParams.get('timerDuration') || '15');
            const urlSuddenDeath = searchParams.get('suddenDeath') === 'true';

            console.log(`HOST INITIALIZING SETTINGS from URL:`, {
                timerDuration: urlTimerDuration,
                suddenDeath: urlSuddenDeath
            });

            // Update our local ref to match URL params
            gameSettingsRef.current.timerDuration = urlTimerDuration;
            gameSettingsRef.current.suddenDeath = urlSuddenDeath;

            // Also update state values to match
            setTimerDuration(urlTimerDuration);
            setGameMode(urlSuddenDeath ? 'sudden-death' : 'standard');

            // Wait a bit to ensure connection is stable
            const initTimer = setTimeout(() => {
                if (updateRoomSettings && typeof updateRoomSettings === 'function') {
                    updateRoomSettings(roomId, {
                        suddenDeath: urlSuddenDeath,
                        timerDuration: urlTimerDuration
                    });
                } else {
                    // Fallback if updateRoomSettings is not available
                    socket.emit('update-room-settings', roomId, {
                        suddenDeath: urlSuddenDeath,
                        timerDuration: urlTimerDuration
                    });
                }
                hasInitializedSettings.current = true;
            }, 1000);

            return () => clearTimeout(initTimer);
        }
    }, [isHost, isClient, socket, roomId, searchParams, updateRoomSettings]);


    // Get all answers for the current question
    const getAnswers = () => {
        if (!currentQuestion || shuffledAnswers.length === 0) return [];
        return shuffledAnswers;
    };

    // Handle starting the game
    const handleStartGame = async () => {
        if (socket && isHost) {
            // If this is a tournament, start it on the blockchain first
            if (tournamentId) {
                try {
                    console.log(`Starting tournament ${tournamentId} on blockchain...`);
                    const result = await startTournament(parseInt(tournamentId));
                    console.log('Tournament started on blockchain successfully:', result);
                } catch (error) {
                    console.error("Error starting tournament on blockchain:", error);
                    alert("Failed to start the tournament on blockchain. Please try again.");
                    return; // Don't continue with game start if blockchain transaction fails
                }
            }

            // Once tournament is started on blockchain (or if not a tournament game),
            // emit the start-game event
            console.log(`Emitting start-game event for room ${roomId}`);
            socket.emit('start-game', roomId);
        }
    };

    // Handle selecting an answer
    const handleSelectAnswer = (answer: string) => {
        if (gameStatus === 'in-progress' && !selectedAnswer && currentPlayer && !currentPlayer.eliminated) {
            console.log(`PLAYER SELECTING ANSWER: ${currentPlayer.name}, Answer: "${answer}"`);

            // Immediately mark as selected to prevent multiple submissions
            setSelectedAnswer(answer);
            setWaitingForPlayers(true);
            hasMovedToNextQuestion.current = false;

            // Check if answer is correct
            const currentQuestion = questions[currentQuestionIndex];
            const isCorrect = answer === currentQuestion.correctAnswer;
            const isEliminated = gameSettingsRef.current.suddenDeath && !isCorrect;
            const newScore = currentPlayer.score + (isCorrect ? 10 : 0);

            console.log(`Answer is ${isCorrect ? 'CORRECT' : 'WRONG'}, New score: ${newScore}, Will be eliminated: ${isEliminated}`);

            // Update player score locally first for immediate feedback
            setCurrentPlayer({
                ...currentPlayer,
                score: newScore,
                eliminated: currentPlayer.eliminated || isEliminated
            });

            // Add debounce to prevent multiple submissions
            // Use a ref to track if this answer was already submitted
            if (!submittedAnswersRef.current[currentQuestionIndex]) {
                submittedAnswersRef.current[currentQuestionIndex] = true;

                console.log(`Emitting answer-submitted: Player ${currentPlayer.name}, Correct: ${isCorrect}, Score: ${newScore}, Eliminated: ${isEliminated}`);

                // Send answer to server with explicit elimination status
                socket?.emit(
                    'answer-submitted',
                    roomId,
                    currentPlayer.id,
                    currentPlayer.name,
                    isCorrect,
                    newScore,
                    isEliminated
                );
            } else {
                console.log(`Already submitted answer for question ${currentQuestionIndex + 1} - preventing duplicate`);
            }
        } else {
            console.log(`ANSWER SELECTION IGNORED - GameStatus: ${gameStatus}, Already Selected: ${!!selectedAnswer}, Player Eliminated: ${currentPlayer?.eliminated}`);
        }
    };

    // Handle moving to the next question
    const handleNextQuestion = () => {
        console.log(`HANDLE_NEXT_QUESTION called - Questions: ${questions.length}, Current index: ${currentQuestionIndex}`);

        if (currentQuestionIndex < questions.length - 1) {
            const nextIndex = currentQuestionIndex + 1;
            console.log(`MOVING TO NEXT QUESTION: ${currentQuestionIndex + 1} -> ${nextIndex + 1} of ${questions.length}`);

            // Reset submitted answers for the new question
            const newSubmittedAnswers = { ...submittedAnswersRef.current };
            delete newSubmittedAnswers[nextIndex]; // Ensure we can submit for the new question
            submittedAnswersRef.current = newSubmittedAnswers;

            setCurrentQuestionIndex(nextIndex);
            setSelectedAnswer(null);
            setTimer(gameSettingsRef.current.timerDuration);
            setWaitingForPlayers(false);
            hasMovedToNextQuestion.current = false;

            console.log(`Reset timer to ${gameSettingsRef.current.timerDuration}s for question ${nextIndex + 1}`);

            // Sync question change with server
            if (isHost && socket) {
                console.log(`Host is syncing question change to server: Question ${nextIndex + 1}`);
                socket.emit('question-change', roomId, nextIndex);
            }
        } else {
            // End of game
            console.log(`REACHED LAST QUESTION (${currentQuestionIndex + 1}/${questions.length}) - Ending game`);

            if (socket && isHost) {
                console.log(`Host is sending end-game event`);
                socket.emit('end-game', roomId);
            }
        }
    };

    useEffect(() => {
        if (tournamentId) {
            const fetchTournamentDetails = async () => {
                try {
                    const details = await getTournamentDetails(parseInt(tournamentId));
                    // Ensure details object exists before trying to access its properties
                    if (details) {
                        setTournamentDetails(details);
                        setEntryFee(details.entryFee);
                    } else {
                        console.warn("Received null or undefined tournament details.");
                    }
                } catch (error) {
                    console.error("Error fetching tournament details:", error);
                }
            };

            fetchTournamentDetails();
        }
    }, [tournamentId, getTournamentDetails]);

    // Add this useEffect to check if the player has already joined
    useEffect(() => {
        if (tournamentId) {
            const fetchTournamentDetails = async () => {
                try {
                    // Clear any existing debounce timer
                    if (debounceTimerRef.current) {
                        clearTimeout(debounceTimerRef.current);
                    }

                    // Set a new debounce timer (300ms delay)
                    debounceTimerRef.current = setTimeout(async () => {
                        console.log(`Fetching tournament details for ID: ${tournamentId}`);

                        try {
                            const details = await getTournamentDetails(parseInt(tournamentId));
                            // Ensure details object exists before trying to access its properties
                            if (details) {
                                setTournamentDetails(details);
                                setEntryFee(details.entryFee);
                            } else {
                                console.warn("Received null or undefined tournament details.");
                            }
                        } catch (error) {
                            console.error("Error fetching tournament details:", error);
                            // Add exponential backoff for retries if needed
                        }

                        debounceTimerRef.current = null;
                    }, 300);
                } catch (error) {
                    console.error("Error in tournament details fetch:", error);
                }
            };

            fetchTournamentDetails();

            // Cleanup function to clear any pending debounce timer
            return () => {
                if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current);
                    debounceTimerRef.current = null;
                }
            };
        }
    }, [tournamentId, getTournamentDetails]);

    // Add the function to handle joining a tournament
    const handleJoinTournament = async () => {
        if (!tournamentId || !address || hasJoinedTournament || !tournamentDetails) return;

        try {
            // The third argument indicates if the tournament is ERC20 or not.
            await joinTournament(parseInt(tournamentId), entryFee, tournamentDetails.isERC20);
            setHasJoinedTournament(true);

            alert('Successfully joined the tournament!');

            // Notify the host and other players
            if (currentPlayer) {
                socket?.emit('player-joined-tournament', {
                    roomId,
                    playerId: currentPlayer.id,
                    playerName: currentPlayer.name
                });
            }
        } catch (error: any) {
            console.error("Error joining tournament:", error);
            alert(`Failed to join tournament: ${error.message || "Unknown error"}`);
        }
    };

    // Add this function to handle tournament ending
    const handleEndTournament = async () => {
        if (!tournamentId || !isHost) return;

        try {
            // Sort players by score (highest first)
            const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

            // Get the top 3 players (or fewer if there are less than 3 players)
            const topPlayers = sortedPlayers.slice(0, Math.min(3, sortedPlayers.length));

            // Filter out players without wallet addresses
            const winnersWithAddresses = topPlayers.filter(p => p.walletAddress && p.walletAddress !== '');

            if (winnersWithAddresses.length === 0) {
                alert("No players with wallet addresses found. Cannot distribute prizes.");
                return;
            }

            // Assign percentages based on rank
            let percentages: number[] = [];

            if (winnersWithAddresses.length === 1) {
                percentages = [100];
            } else if (winnersWithAddresses.length === 2) {
                percentages = [70, 30];
            } else {
                percentages = [60, 30, 10];
            }

            // Get the addresses
            const winnerAddresses = winnersWithAddresses.map(p => p.walletAddress || '');

            // End the tournament and distribute prizes
            await endTournament(
                parseInt(tournamentId),
                winnerAddresses,
                percentages
            );

            alert("Tournament ended successfully. Prizes have been distributed!");
        } catch (error: any) {
            console.error("Error ending tournament:", error);
            alert(`Failed to end tournament: ${error.message || "Unknown error"}`);
        }
    };



    useEffect(() => {
        console.log('COMPONENT INITIALIZED - URL Params:', {
            roomId,
            playerName,
            role,
            isHost: role === 'host',
            suddenDeath: searchParams.get('suddenDeath') === 'true',
            timerDuration: parseInt(searchParams.get('timerDuration') || '15')
        });

        setIsClient(true);
    }, []);

    // Set isClient once component mounts
    useEffect(() => {
        setIsClient(true);
    }, []);

    // Render wallet info in the UI components
    const renderWalletInfo = () => (
        <div className="mb-4 bg-gray-50 p-3 rounded-lg text-sm">
            <div className="flex flex-wrap gap-2 justify-between items-center">
                <div>
                    <span className="font-medium">Wallet:</span> {address?.substring(0, 6)}...{address?.substring(address.length - 4)}
                </div>
            </div>
        </div>
    );

    // Render waiting room
    const renderWaitingRoom = () => (
        <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Waiting for players...</h2>

            {address && renderWalletInfo()}
            {tournamentId && renderTournamentInfo()}

            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Game Settings</h3>
                <div className="flex flex-wrap justify-center gap-2">
                    {gameSettingsRef.current.suddenDeath && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                            Sudden Death Mode
                        </span>
                    )}
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {gameSettingsRef.current.timerDuration}s Timer
                    </span>
                </div>
            </div>

            <div className="mb-6">
                <p className="text-lg">Room Code: <span className="font-mono font-bold">{roomId}</span></p>
                <p>Share this code with friends to join</p>
            </div>

            <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2">Players ({players.length})</h3>
                <ul className="max-w-md mx-auto bg-gray-50 rounded p-3">
                    {players.map(player => (
                        <li key={player.id} className="py-1 border-b border-gray-200 last:border-b-0 flex justify-between">
                            <span>{player.name}</span>
                            {/* @ts-ignore - disconnected property might not be in the type but we're adding it */}
                            {player.disconnected && (
                                <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">Disconnected</span>
                            )}
                        </li>
                    ))}
                </ul>
            </div>

            {isHost && (
                <button
                    onClick={handleStartGame}
                    disabled={players.length < 1 || isTournamentLoading}
                    className="bg-green-600 text-white py-2 px-6 rounded disabled:bg-gray-400"
                >
                    {isTournamentLoading ? 'Starting...' : 'Start Game'}
                </button>
            )}
        </div>
    );

    const renderTournamentInfo = () => {
        if (!tournamentId || !tournamentDetails) return null;

        return (
            <div className="mb-4 bg-purple-50 p-4 rounded-lg border border-purple-200">
                <h3 className="font-medium text-purple-800 mb-2">Tournament Game</h3>
                <p className="text-sm text-purple-700 mb-2">
                    Entry Fee: {tournamentDetails.entryFee} ETH
                </p>
                <p className="text-sm text-purple-700 mb-2">
                    Players: {tournamentDetails.currentEntrants}/{tournamentDetails.numEntrants}
                </p>

                {!isHost && !hasJoinedTournament && address && (
                    <button
                        onClick={handleJoinTournament}
                        disabled={isTournamentLoading}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm disabled:bg-purple-300"
                    >
                        {isTournamentLoading ? 'Joining...' : 'Join Tournament'}
                    </button>
                )}

                {hasJoinedTournament && (
                    <div className="text-sm bg-green-50 text-green-700 p-2 rounded-md">
                        You've joined this tournament!
                    </div>
                )}

                {isHost && gameStatus === 'completed' && (
                    <button
                        onClick={handleEndTournament}
                        disabled={isTournamentLoading}
                        className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-md text-sm disabled:bg-purple-300"
                    >
                        {isTournamentLoading ? 'Processing...' : 'End Tournament & Distribute Prizes'}
                    </button>
                )}
            </div>
        );
    };

    // Render game in progress
    const renderGameInProgress = () => {
        if (!currentQuestion) return <div>Loading questions...</div>;

        const answers = getAnswers();

        return (
            <div>
                <div className="flex justify-between items-center mb-4">
                    <div className="text-lg font-semibold">
                        Question {currentQuestionIndex + 1}/{questions.length}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-lg font-medium text-green-700">
                            <span className="font-bold">{activePlayerCount}</span> of {players.length} players active
                        </div>
                        <div className="text-xl font-bold text-red-600">
                            Time: {timer}s
                        </div>
                    </div>
                </div>

                {waitingForPlayers && selectedAnswer && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-center">
                        <p className="text-blue-700">Waiting for other players to answer...</p>
                    </div>
                )}

                <div className="mb-6 p-4 bg-white rounded-lg shadow">
                    <h2 className="text-xl mb-2" dangerouslySetInnerHTML={{ __html: currentQuestion.question }}></h2>
                    <div className="text-sm text-gray-500">
                        {currentQuestion.category} • {currentQuestion.difficulty}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {answers.map((answer, index) => {
                        let buttonClass = "p-4 rounded-lg border-2 text-left";

                        if (selectedAnswer) {
                            if (answer === currentQuestion.correctAnswer) {
                                buttonClass += " border-green-500 bg-green-50";
                            } else if (answer === selectedAnswer && answer !== currentQuestion.correctAnswer) {
                                buttonClass += " border-red-500 bg-red-50";
                            } else {
                                buttonClass += " border-gray-300 opacity-50";
                            }
                        } else {
                            buttonClass += " border-gray-300 hover:border-blue-500 hover:bg-blue-50";
                        }

                        return (
                            <button
                                key={index}
                                onClick={() => handleSelectAnswer(answer)}
                                disabled={!!selectedAnswer || (currentPlayer?.eliminated === true)}
                                className={buttonClass}
                                dangerouslySetInnerHTML={{ __html: answer }}
                            ></button>
                        );
                    })}
                </div>

                {currentPlayer?.eliminated && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-300 rounded-lg text-center">
                        <p className="text-red-700 font-medium">You have been eliminated!</p>
                        <p className="text-sm text-red-600">You can still watch the game unfold</p>
                    </div>
                )}

                <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-2">Players</h3>
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        {players.map(player => (
                            <div
                                key={player.id}
                                className={`flex justify-between items-center p-3 border-b border-gray-200 last:border-b-0 ${player.eliminated ? 'bg-red-50 opacity-60' : ''
                                    }`}
                            >
                                <div className="flex items-center">
                                    <span>{player.name}</span>
                                    {player.eliminated && (
                                        <span className="ml-2 text-xs text-red-600 font-medium px-2 py-1 bg-red-100 rounded-full">
                                            Eliminated
                                        </span>
                                    )}
                                    {/* @ts-ignore - disconnected property might not be in the type but we're adding it */}
                                    {player.disconnected && (
                                        <span className="ml-2 text-xs text-gray-600 font-medium px-2 py-1 bg-gray-100 rounded-full">
                                            Disconnected
                                        </span>
                                    )}
                                    {player.id === currentPlayer?.id && (
                                        <span className="ml-2 text-xs text-blue-600 font-medium px-2 py-1 bg-blue-100 rounded-full">
                                            You
                                        </span>
                                    )}
                                </div>
                                <span className="font-semibold">{player.score} pts</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    useEffect(() => {
        if (gameStatus === 'completed' && tournamentId && isHost) {
            // Wait for all results to be available
            if (players.length > 0 && players.every(p => p.score !== undefined)) {
                // Auto-end the tournament after a delay (to allow players to see results)
                const endTimeout = setTimeout(() => {
                    handleEndTournament();
                }, 10000); // 10 seconds delay

                return () => clearTimeout(endTimeout);
            }
        }
    }, [gameStatus, players, tournamentId, isHost]);

    // Render game over
    // Updated renderGameOver function for your game component

    // Add these state variables at the component level (with the other state declarations)
    // At the top of your GameRoom component where other state variables are declared:

    // Add these near your other state declarations
    const [payoutComplete, setPayoutComplete] = useState(false);

    // Then update your renderGameOver function to use this state:
    // Updated renderGameOver function that includes wallet addresses
    const renderGameOver = () => {
        // First sort by elimination status, then by score
        const sortedPlayers = [...players].sort((a, b) => {
            // Non-eliminated players first
            if (a.eliminated !== b.eliminated) {
                return a.eliminated ? 1 : -1;
            }
            // Then sort by score
            return b.score - a.score;
        });

        const winner = sortedPlayers[0];
        const survivorCount = sortedPlayers.filter(p => !p.eliminated).length;

        // Helper function for tournament payout
        const handlePayoutComplete = () => {
            setPayoutComplete(true);
        };

        return (
            <div className="text-center">
                <h2 className="text-3xl font-bold mb-6">Game Over!</h2>

                {winner && (
                    <div className="mb-8">
                        <div className="text-xl mb-2">Winner:</div>
                        <div className="text-2xl font-bold text-green-600">{winner.name}</div>
                        <div className="text-lg">
                            {winner.score} points
                            {gameSettingsRef.current.suddenDeath && survivorCount === 1 && !winner.eliminated && (
                                <span className="ml-2 text-green-600 font-medium px-2 py-1 bg-green-100 rounded-full">
                                    Last Standing
                                </span>
                            )}
                        </div>
                        {winner.walletAddress && (
                            <div className="text-sm mt-1 text-gray-600">
                                Wallet: {winner.walletAddress.substring(0, 6)}...{winner.walletAddress.substring(winner.walletAddress.length - 4)}
                            </div>
                        )}
                    </div>
                )}

                <div className="mb-8">
                    <h3 className="text-xl font-semibold mb-3">Final Results</h3>
                    <div className="max-w-md mx-auto bg-white rounded-lg shadow overflow-hidden">
                        {sortedPlayers.map((player, index) => (
                            <div
                                key={player.id}
                                className={`flex justify-between items-center p-3 border-b border-gray-200 last:border-b-0 ${player.eliminated ? 'bg-red-50' : 'bg-green-50'
                                    }`}
                            >
                                <div className="flex items-center">
                                    <span className="font-semibold mr-2">#{index + 1}</span>
                                    <span>{player.name}</span>
                                    {player.eliminated ? (
                                        <span className="ml-2 text-xs text-red-600 font-medium px-2 py-1 bg-red-100 rounded-full">
                                            Eliminated
                                        </span>
                                    ) : (
                                        <span className="ml-2 text-xs text-green-600 font-medium px-2 py-1 bg-green-100 rounded-full">
                                            Survived
                                        </span>
                                    )}
                                    {player.id === currentPlayer?.id && (
                                        <span className="ml-2 text-xs text-blue-600 font-medium px-2 py-1 bg-blue-100 rounded-full">
                                            You
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="font-semibold">{player.score} pts</span>
                                    {player.walletAddress && (
                                        <span className="text-xs text-gray-500">
                                            {player.walletAddress.substring(0, 6)}...{player.walletAddress.substring(player.walletAddress.length - 4)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tournament payout section - only shown if this is a tournament */}
                {tournamentId && (
                    <div className="mb-8">
                        {isHost && !payoutComplete ? (
                            <TournamentPayoutPanel
                                tournamentId={tournamentId}
                                isHost={isHost}
                                players={sortedPlayers}
                                onPayoutComplete={handlePayoutComplete}
                            />
                        ) : (
                            <WinnerSummary
                                tournamentId={tournamentId}
                                isCompleted={payoutComplete}
                            />
                        )}

                        {isHost && payoutComplete && (
                            <div className="mt-3 p-3 bg-green-100 rounded-lg text-green-700">
                                Prizes have been distributed successfully!
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-center gap-4">
                    {isHost && (
                        <button
                            onClick={handleStartGame}
                            className="bg-green-600 text-white py-2 px-6 rounded hover:bg-green-700"
                        >
                            Play Again
                        </button>
                    )}
                    <Link
                        href="/"
                        className="bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700"
                    >
                        Back to Home
                    </Link>
                </div>
            </div>
        );
    };

    return (
        <main className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-blue-700">Trivia Game</h1>
                    <div className="text-sm">
                        Playing as: <span className="font-semibold">{playerName}</span>
                        {isHost && <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Host</span>}
                    </div>
                </header>

                <div className="bg-white p-6 rounded-lg shadow-md">
                    {gameStatus === 'waiting' && renderWaitingRoom()}
                    {gameStatus === 'in-progress' && renderGameInProgress()}
                    {gameStatus === 'completed' && renderGameOver()}
                </div>
            </div>

            {/* Debug Panel */}
            <GameDebugPanel
                gameStatus={gameStatus}
                questions={questions}
                currentQuestionIndex={currentQuestionIndex}
                players={players}
                timer={timer}
                isHost={isHost}
                roomId={roomId}
                socket={socket}
            />
        </main>
    );
}
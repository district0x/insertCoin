const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Game state management
const gameRooms = new Map();
const playerSocketMap = new Map(); // Map player IDs to socket IDs

// Helper to store recent game results (for leaderboard)
const storeGameResult = (roomId, players) => {
    try {
        // Create data directory if it doesn't exist
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir);
        }

        const resultsFile = path.join(dataDir, 'game-results.json');
        let results = [];

        // Read existing results if file exists
        if (fs.existsSync(resultsFile)) {
            const data = fs.readFileSync(resultsFile, 'utf8');
            results = JSON.parse(data);
        }

        // Add new result with timestamp
        results.push({
            id: uuidv4(),
            roomId,
            players: players.map(p => ({
                name: p.name,
                score: p.score,
                eliminated: p.eliminated
            })),
            timestamp: new Date().toISOString()
        });

        // Keep only the most recent 20 games
        if (results.length > 20) {
            results = results.slice(-20);
        }

        // Write back to file
        fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    } catch (error) {
        console.error('Error storing game result:', error);
    }
};

// Helper to check if game has ended
const checkGameEnd = (room) => {
    // Game ends when we've completed all questions and all players have answered the last one
    const allQuestionsAnswered = room.currentQuestionIndex >= room.questions.length - 1 &&
        room.playerAnswers &&
        room.playerAnswers.size >= room.players.filter(p => !p.disconnected).length;

    if (allQuestionsAnswered) {
        console.log(`Game ending: All ${room.questions.length} questions completed`);
        return true;
    }

    // Game also ends if only one player left in a room with multiple players in sudden death mode
    const activePlayers = room.players.filter(p => !p.eliminated);
    const totalPlayers = room.players.length;

    // This is especially important for sudden death mode
    if (room.settings.suddenDeath && activePlayers.length === 1 && totalPlayers > 1) {
        console.log(`Game ending: Only one player remaining out of ${totalPlayers} in sudden death mode`);
        return true;
    }

    // Game also ends if all players are eliminated (unlikely but possible edge case)
    if (activePlayers.length === 0 && totalPlayers > 0) {
        console.log('Game ending: All players have been eliminated');
        return true;
    }

    return false;
};

app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    });

    // Initialize Socket.IO
    const io = new Server(server);

    // Socket.IO event handlers
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);

        // Handle player joining a room
        socket.on('join-room', (roomId, playerName, walletAddress) => {
            console.log(`Player ${playerName} joining room ${roomId} with wallet ${walletAddress || 'none'}`);
            socket.join(roomId);

            // Generate a player ID (using UUID for uniqueness)
            const playerId = uuidv4();

            // Map player ID to socket ID for reconnection
            playerSocketMap.set(playerId, socket.id);

            // Create room if it doesn't exist
            if (!gameRooms.has(roomId)) {
                console.log(`Creating new room: ${roomId}`);
                gameRooms.set(roomId, {
                    id: roomId,
                    players: [], // Initialize an empty players array
                    status: 'waiting',
                    hostSocketId: socket.id, // First player is the host
                    questions: [],
                    currentQuestionIndex: 0,
                    settings: {
                        suddenDeath: false,
                        timerDuration: 15
                    },
                    playerAnswers: new Set()
                });
            }

            const room = gameRooms.get(roomId);

            // Check if player with same name already exists in the room
            const existingPlayerIndex = room.players.findIndex(p => p.name === playerName);

            if (existingPlayerIndex !== -1) {
                // Player with same name exists, update their socket info
                const existingPlayer = room.players[existingPlayerIndex];
                playerSocketMap.set(existingPlayer.id, socket.id);

                // Update wallet address if provided and not already set
                if (walletAddress && !existingPlayer.walletAddress) {
                    existingPlayer.walletAddress = walletAddress;
                    console.log(`Updated wallet address for ${playerName}: ${walletAddress}`);
                }

                // Send player their info but keep existing ID
                socket.emit('player-info', {
                    id: existingPlayer.id,
                    name: playerName,
                    roomId,
                    isHost: socket.id === room.hostSocketId,
                    walletAddress: existingPlayer.walletAddress // Include wallet address in info
                });

                // Update room settings for the reconnecting player
                socket.emit('room-settings', {
                    suddenDeath: room.settings?.suddenDeath || false,
                    timerDuration: room.settings?.timerDuration || 15
                });
            } else {
                // New player
                const newPlayer = {
                    id: playerId,
                    name: playerName,
                    score: 0,
                    eliminated: false,
                    walletAddress: walletAddress || null // Store wallet address
                };

                console.log(`Adding new player to room ${roomId}: ${playerName} with wallet: ${walletAddress || 'none'}`);

                // Add player to room
                room.players.push(newPlayer);

                // Notify room that player joined
                io.to(roomId).emit('player-joined', newPlayer);

                // Send player their info
                socket.emit('player-info', {
                    id: playerId,
                    name: playerName,
                    roomId,
                    isHost: socket.id === room.hostSocketId,
                    walletAddress // Include wallet address in player info
                });

                // Send room settings to the new player
                socket.emit('room-settings', {
                    suddenDeath: room.settings?.suddenDeath || false,
                    timerDuration: room.settings?.timerDuration || 15
                });
            }

            // Send existing players to the new or reconnecting player
            room.players.forEach(player => {
                if (player.name !== playerName) {
                    socket.emit('player-joined', player);
                }
            });

            gameRooms.set(roomId, room);

            // If game is already in progress, sync the game state
            if (room.status === 'in-progress' && room.questions.length > 0) {
                socket.emit('game-in-progress', {
                    questions: room.questions,
                    currentQuestionIndex: room.currentQuestionIndex || 0
                });
            }
        });

        // Handle player reconnection
        socket.on('rejoin-room', (roomId, playerName, playerId) => {
            if (roomId && gameRooms.has(roomId)) {
                console.log(`Player ${playerName} rejoining room ${roomId}`);
                socket.join(roomId);

                const room = gameRooms.get(roomId);
                const existingPlayerIndex = room.players.findIndex(p => p.id === playerId);

                // Update socket mapping
                playerSocketMap.set(playerId, socket.id);

                if (existingPlayerIndex !== -1) {
                    // Player exists, update socket reference
                    const player = room.players[existingPlayerIndex];

                    // Send player their info
                    socket.emit('player-info', {
                        id: playerId,
                        name: playerName,
                        isHost: socket.id === room.hostSocketId,
                        roomId
                    });

                    // Send all players to the rejoining player
                    room.players.forEach(p => {
                        socket.emit('player-joined', p);
                    });

                    // Notify other players that this player has reconnected
                    socket.to(roomId).emit('player-reconnected', playerId);

                    // If game is in progress, sync game state
                    if (room.status === 'in-progress' && room.questions.length > 0) {
                        socket.emit('game-in-progress', {
                            questions: room.questions,
                            currentQuestionIndex: room.currentQuestionIndex || 0
                        });
                    }
                } else {
                    // Player doesn't exist, handle as new join
                    socket.emit('rejoin-failed');
                    socket.emit('error', 'Player not found in room');
                }
            } else {
                socket.emit('rejoin-failed');
                socket.emit('error', 'Room not found');
            }
        });

        // Update room settings handler 
        socket.on('update-room-settings', (roomId, settings) => {
            console.log(`SETTINGS UPDATE REQUEST - Room: ${roomId}, Settings:`, settings);

            if (gameRooms.has(roomId)) {
                const room = gameRooms.get(roomId);

                // Verify sender is the host before accepting settings changes
                if (room.hostSocketId === socket.id) {
                    console.log(`HOST (${socket.id}) updated settings for room ${roomId}:`, settings,
                        `Previous settings:`, room.settings);

                    // Only update settings that have actually changed
                    let hasChanges = false;

                    if (settings.suddenDeath !== undefined && room.settings.suddenDeath !== settings.suddenDeath) {
                        room.settings.suddenDeath = settings.suddenDeath;
                        hasChanges = true;
                        console.log(`Updated suddenDeath to: ${settings.suddenDeath}`);
                    }

                    if (settings.timerDuration !== undefined && room.settings.timerDuration !== settings.timerDuration) {
                        room.settings.timerDuration = settings.timerDuration;
                        hasChanges = true;
                        console.log(`Updated timerDuration to: ${settings.timerDuration}`);
                    }

                    // Only broadcast if there were actual changes
                    if (hasChanges) {
                        gameRooms.set(roomId, room);
                        console.log(`Broadcasting updated settings to room ${roomId}: `, room.settings);

                        // Broadcast settings to all players in the room (except the host)
                        socket.to(roomId).emit('room-settings', room.settings);

                        // Also confirm back to the host
                        socket.emit('settings-confirmed', room.settings);
                    } else {
                        console.log(`No setting changes detected for room ${roomId}`);
                    }
                } else {
                    console.warn(`NON-HOST (${socket.id}) attempted to update settings for room ${roomId}`);
                    // Send the correct settings back to this client to correct their state
                    socket.emit('room-settings', room.settings);
                }
            }
        });

        // Handle game start
        socket.on('start-game', (roomId) => {
            console.log(`🎮 GAME STARTED - Room: ${roomId}`);

            if (gameRooms.has(roomId)) {
                const room = gameRooms.get(roomId);
                console.log(`📊 Current room settings for ${roomId}:`, room.settings);
                console.log(`👥 Current players in room ${roomId}:`, room.players.map(p => p.name));
                room.status = 'in-progress';

                // Reset all players' eliminated status and scores when starting a new game
                room.players.forEach(player => {
                    player.eliminated = false;
                    player.score = 0;
                });

                // Reset question state
                room.questions = [];
                room.currentQuestionIndex = 0;
                room.playerAnswers = new Set();
                room.questionsLoaded = false;
                room.gameEnding = false;

                gameRooms.set(roomId, room);
                console.log(`📡 Broadcasting game-started event to room ${roomId}`);
                io.to(roomId).emit('game-started');
            } else {
                console.error(`❌ Room ${roomId} not found when starting game`);
            }
        });

        // Store questions received from client
        socket.on('questions-loaded', (roomId, questions) => {
            console.log(`📚 QUESTIONS LOADED - Room: ${roomId}, Count: ${questions.length}`);

            if (gameRooms.has(roomId)) {
                const room = gameRooms.get(roomId);

                // Validate questions data
                if (!questions || !Array.isArray(questions) || questions.length === 0) {
                    console.error(`❌ Invalid questions data received for room ${roomId}:`, questions);
                    return;
                }

                console.log(`✅ Valid questions received for room ${roomId}:`, {
                    count: questions.length,
                    firstQuestion: questions[0]?.question?.substring(0, 50) + '...',
                    categories: [...new Set(questions.map(q => q.category))]
                });

                room.questions = questions;
                room.currentQuestionIndex = 0;
                room.playerAnswers = new Set(); // Initialize answer tracking
                room.questionsLoaded = true; // Mark that questions are loaded

                gameRooms.set(roomId, room);

                // Broadcast to all clients that questions have been loaded
                console.log(`📡 Broadcasting ${questions.length} questions to all players in room ${roomId}`);
                io.to(roomId).emit('questions-ready', room.currentQuestionIndex, questions);
            } else {
                console.error(`❌ Room ${roomId} not found when loading questions`);
            }
        });

        // Handle question change
        socket.on('question-change', (roomId, index) => {
            console.log(`QUESTION CHANGE - Room: ${roomId}, Index: ${index}`);

            if (gameRooms.has(roomId)) {
                const room = gameRooms.get(roomId);
                room.currentQuestionIndex = index;

                // Reset the set of players who have answered
                room.playerAnswers = new Set();

                console.log(`Reset player answers tracking for question ${index + 1}`);

                // Reset the game ending flag when moving to next question
                room.gameEnding = false;

                gameRooms.set(roomId, room);
                io.to(roomId).emit('question-changed', index);
            }
        });

        // Handle player answers
        socket.on('answer-submitted', (roomId, playerId, playerName, isCorrect, score, isEliminated) => {
            console.log(`🎯 ANSWER SUBMITTED - Room: ${roomId}, Player: ${playerName}(${playerId}), Correct: ${isCorrect}, Score: ${score}, Eliminated: ${isEliminated ? 'YES' : 'NO'}`);

            // Log what the client sent for debugging
            console.log(`⏰ Time received: ${new Date().toISOString()}`);

            if (gameRooms.has(roomId)) {
                const room = gameRooms.get(roomId);

                // CRITICAL FIX: Do not process answers if questions have not been loaded for the room.
                // This prevents the game from ending prematurely if there's a race condition.
                if (!room.questions || room.questions.length === 0) {
                    console.error(`🚨 [CRITICAL] Answer submitted for room ${roomId}, but no questions are loaded. Aborting.`);
                    console.error(`📊 Room state:`, {
                        questionsLoaded: room.questionsLoaded,
                        questionsCount: room.questions?.length || 0,
                        currentQuestionIndex: room.currentQuestionIndex,
                        gameStatus: room.status
                    });
                    return;
                }

                console.log(`✅ Questions available for room ${roomId}: ${room.questions.length} questions, current index: ${room.currentQuestionIndex}`);

                // Check if this answer was already processed (prevent duplicates)
                if (room.playerAnswers && room.playerAnswers.has(playerId)) {
                    console.log(`🔄 DUPLICATE ANSWER from ${playerName} - ignoring`);
                    return;
                }

                // Update player score and elimination status
                const playerIndex = room.players.findIndex(p => p.id === playerId);
                if (playerIndex !== -1) {
                    const prevScore = room.players[playerIndex].score;
                    const prevEliminated = room.players[playerIndex].eliminated;

                    room.players[playerIndex].score = score;

                    // Determine if player should be eliminated based on game mode
                    const shouldBeEliminated = !isCorrect && room.settings.suddenDeath;

                    // Set elimination status if player is eliminated
                    if (isEliminated === true || shouldBeEliminated) {
                        room.players[playerIndex].eliminated = true;
                        console.log(`Player ${playerName} has been eliminated in sudden death mode`);
                    }

                    console.log(`Updated player ${playerName}: Score ${prevScore} -> ${score}, Eliminated: ${prevEliminated} -> ${room.players[playerIndex].eliminated}`);

                    // Track that this player has answered the current question
                    if (!room.playerAnswers) {
                        room.playerAnswers = new Set();
                    }
                    room.playerAnswers.add(playerId);
                    console.log(`Player ${playerName} added to answered list. ${room.playerAnswers.size}/${room.players.length} players have answered.`);
                }

                gameRooms.set(roomId, room);

                // Make sure we're explicitly setting the eliminated status in the broadcast
                const eliminationStatus = playerIndex !== -1 ? room.players[playerIndex].eliminated : false;

                // Broadcast the updated player info with correct elimination status
                console.log(`Broadcasting player answer to room ${roomId}: Player: ${playerName}, Score: ${score}, Eliminated: ${eliminationStatus}`);

                io.to(roomId).emit('player-answered', {
                    playerId,
                    playerName,
                    isCorrect,
                    score,
                    eliminated: eliminationStatus
                });

                // Check if all active players have answered
                const activePlayerCount = room.players.filter(p => !p.disconnected).length;
                const allPlayersAnswered = room.playerAnswers.size >= activePlayerCount;

                // If all players have answered, tell clients they can proceed
                if (allPlayersAnswered) {
                    console.log(`✅ All players (${room.playerAnswers.size}/${activePlayerCount}) have answered. Sending all-answered signal.`);
                    io.to(roomId).emit('all-players-answered');

                    // Only check for game end when all players have answered 
                    // AND if we're on the last question
                    if (room.currentQuestionIndex >= room.questions.length - 1) {
                        // Only the host should trigger the game end
                        console.log(`🏁 Final question completed and all players answered. Signaling game end.`);
                        console.log(`📊 Game end check:`, {
                            currentQuestionIndex: room.currentQuestionIndex,
                            totalQuestions: room.questions.length,
                            isLastQuestion: room.currentQuestionIndex >= room.questions.length - 1,
                            gameEnding: room.gameEnding
                        });

                        if (!room.gameEnding) {
                            room.gameEnding = true;
                            gameRooms.set(roomId, room);

                            console.log(`🎉 Game ended in room ${roomId}`);
                            room.status = 'completed';
                            storeGameResult(roomId, room.players);
                            io.to(roomId).emit('game-over', room.players);
                        } else {
                            console.log(`⚠️ Game end already in progress for room ${roomId} - ignoring duplicate trigger`);
                        }
                    } else {
                        console.log(`⏭️ Not the last question yet. Current: ${room.currentQuestionIndex + 1}/${room.questions.length}`);
                    }
                } else {
                    console.log(`⏳ Waiting for more answers. ${room.playerAnswers.size}/${activePlayerCount} players have answered.`);
                }
            }
        });

        // Handle game end
        socket.on('end-game', (roomId) => {
            console.log(`END-GAME requested for room ${roomId}`);

            if (gameRooms.has(roomId)) {
                const room = gameRooms.get(roomId);

                // Only end the game if it hasn't already been marked as ending
                if (!room.gameEnding) {
                    console.log(`Game ending in room ${roomId} by explicit end-game request`);

                    room.status = 'completed';
                    room.gameEnding = true;

                    // Store the result for leaderboard
                    storeGameResult(roomId, room.players);

                    gameRooms.set(roomId, room);
                    io.to(roomId).emit('game-over', room.players);
                } else {
                    console.log(`Game ending already in progress for room ${roomId} - ignoring duplicate end-game request`);
                }
            }
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);

            // Find all rooms the player was in
            for (const [roomId, room] of gameRooms.entries()) {
                // Check if this socket was in this room
                const playerIndex = room.players.findIndex(p =>
                    playerSocketMap.get(p.id) === socket.id
                );

                if (playerIndex !== -1) {
                    const player = room.players[playerIndex];

                    // Don't remove the player immediately to allow for reconnection
                    // Instead, emit a temporary disconnect event
                    io.to(roomId).emit('player-disconnected', player.id);

                    // If this was the host and the game hasn't started, appoint a new host
                    if (room.hostSocketId === socket.id && room.status === 'waiting' && room.players.length > 1) {
                        // Find another player to be host
                        const newHostIndex = playerIndex === 0 ? 1 : 0;
                        const newHost = room.players[newHostIndex];
                        room.hostSocketId = playerSocketMap.get(newHost.id);

                        // Notify room of host change
                        io.to(roomId).emit('host-changed', newHost.id);
                    }

                    // Set a timer to remove the player if they don't reconnect
                    setTimeout(() => {
                        // Check if player has reconnected
                        const updatedRoom = gameRooms.get(roomId);
                        if (updatedRoom) {
                            const playerStillExists = updatedRoom.players.some(p =>
                                p.id === player.id && playerSocketMap.get(p.id) !== socket.id
                            );

                            // If player has not reconnected, remove them
                            if (!playerStillExists) {
                                updatedRoom.players = updatedRoom.players.filter(p => p.id !== player.id);

                                // If room is empty, delete it
                                if (updatedRoom.players.length === 0) {
                                    gameRooms.delete(roomId);
                                } else {
                                    gameRooms.set(roomId, updatedRoom);
                                    io.to(roomId).emit('player-left', player.id);

                                    // Check if the game should end due to only one player remaining
                                    if (updatedRoom.status === 'in-progress') {
                                        if (checkGameEnd(updatedRoom)) {
                                            updatedRoom.status = 'completed';
                                            storeGameResult(roomId, updatedRoom.players);
                                            gameRooms.set(roomId, updatedRoom);
                                            io.to(roomId).emit('game-over', updatedRoom.players);
                                        }
                                    }
                                }
                            }
                        }
                    }, 30000); // 30 second grace period for reconnection
                }
            }
        });
    });

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://localhost:${PORT}`);
    });
});
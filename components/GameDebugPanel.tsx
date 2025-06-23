import React, { useState, useEffect } from 'react';

interface GameDebugPanelProps {
    gameStatus: string;
    questions: any[];
    currentQuestionIndex: number;
    players: any[];
    timer: number;
    isHost: boolean;
    roomId: string;
    socket: any;
}

export function GameDebugPanel({
    gameStatus,
    questions,
    currentQuestionIndex,
    players,
    timer,
    isHost,
    roomId,
    socket
}: GameDebugPanelProps) {
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const [showDebug, setShowDebug] = useState(false);

    // Add debug log
    const addLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setDebugLogs(prev => [...prev.slice(-19), `${timestamp}: ${message}`]);
    };

    // Monitor game state changes
    useEffect(() => {
        addLog(`Game Status: ${gameStatus}`);
    }, [gameStatus]);

    useEffect(() => {
        addLog(`Questions loaded: ${questions.length}`);
    }, [questions.length]);

    useEffect(() => {
        addLog(`Current Question: ${currentQuestionIndex + 1}/${questions.length}`);
    }, [currentQuestionIndex, questions.length]);

    useEffect(() => {
        addLog(`Timer: ${timer}s`);
    }, [timer]);

    useEffect(() => {
        addLog(`Players: ${players.length} (${players.filter(p => !p.eliminated).length} active)`);
    }, [players.length, players.filter(p => !p.eliminated).length]);

    // Monitor socket events
    useEffect(() => {
        if (!socket) return;

        const eventHandlers = {
            'game-started': () => addLog('🔵 Socket: game-started received'),
            'questions-ready': () => addLog('🔵 Socket: questions-ready received'),
            'game-in-progress': () => addLog('🔵 Socket: game-in-progress received'),
            'all-players-answered': () => addLog('🔵 Socket: all-players-answered received'),
            'game-over': () => addLog('🔵 Socket: game-over received'),
            'player-answered': (data: any) => addLog(`🔵 Socket: player-answered - ${data.playerName}: ${data.isCorrect ? 'CORRECT' : 'WRONG'}`),
        };

        // Add event listeners
        Object.entries(eventHandlers).forEach(([event, handler]) => {
            socket.on(event, handler);
        });

        return () => {
            // Remove event listeners
            Object.entries(eventHandlers).forEach(([event, handler]) => {
                socket.off(event, handler);
            });
        };
    }, [socket]);

    if (!showDebug) {
        return (
            <div className="fixed bottom-4 right-4 z-50">
                <button
                    onClick={() => setShowDebug(true)}
                    className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-mono"
                >
                    DEBUG
                </button>
            </div>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 bg-black bg-opacity-90 text-white p-4 rounded-lg max-w-md max-h-96 overflow-auto">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold">Game Debug Panel</h3>
                <button
                    onClick={() => setShowDebug(false)}
                    className="text-gray-400 hover:text-white"
                >
                    ✕
                </button>
            </div>

            <div className="text-xs space-y-1 mb-3">
                <div>Room: {roomId}</div>
                <div>Host: {isHost ? 'Yes' : 'No'}</div>
                <div>Status: <span className={gameStatus === 'in-progress' ? 'text-green-400' : 'text-yellow-400'}>{gameStatus}</span></div>
                <div>Questions: {questions.length}</div>
                <div>Current Q: {currentQuestionIndex + 1}/{questions.length}</div>
                <div>Timer: {timer}s</div>
                <div>Players: {players.length} ({players.filter(p => !p.eliminated).length} active)</div>
            </div>

            <div className="text-xs font-mono bg-gray-800 p-2 rounded max-h-48 overflow-y-auto">
                {debugLogs.map((log, index) => (
                    <div key={index} className="text-gray-300 mb-1">
                        {log}
                    </div>
                ))}
            </div>

            <div className="mt-2 text-xs">
                <button
                    onClick={() => setDebugLogs([])}
                    className="bg-gray-700 px-2 py-1 rounded mr-2"
                >
                    Clear Logs
                </button>
                <button
                    onClick={() => {
                        if (socket && isHost) {
                            addLog('🔄 Manual: Emitting start-game');
                            socket.emit('start-game', roomId);
                        }
                    }}
                    className="bg-blue-700 px-2 py-1 rounded"
                    disabled={!isHost}
                >
                    Restart Game
                </button>
            </div>
        </div>
    );
} 
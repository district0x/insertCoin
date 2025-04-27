import { useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;
// Cache for storing player information to handle reconnections
let cachedPlayerInfo: { roomId?: string; playerId?: string; playerName?: string } = {};

// Debounce helper to prevent too frequent updates
const debounce = <T extends (...args: any[]) => any>(fn: T, ms = 300) => {
    let timeoutId: NodeJS.Timeout;
    return function (this: any, ...args: Parameters<T>) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), ms);
    };
};

export const useSocket = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const settingsUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Create socket connection only on client side and only if it doesn't exist
        if (typeof window !== 'undefined' && !socketInstance) {
            // Connect to the Socket.IO server with improved reconnection options
            socketInstance = io({
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
                autoConnect: true
            });

            // Set up event listeners
            socketInstance.on('connect', () => {
                console.log(`SOCKET CONNECTED: ${socketInstance?.id}`);

                // Handle reconnection by rejoining the room
                if (cachedPlayerInfo.roomId && cachedPlayerInfo.playerName) {
                    console.log(`RECONNECTING to room: ${cachedPlayerInfo.roomId} as ${cachedPlayerInfo.playerName}`);
                    if (socketInstance) {
                        socketInstance.emit('rejoin-room',
                            cachedPlayerInfo.roomId,
                            cachedPlayerInfo.playerName,
                            cachedPlayerInfo.playerId
                        );
                    }
                }
            });

            socketInstance.on('player-info', (playerInfo) => {
                // Cache player info for reconnection
                cachedPlayerInfo = {
                    roomId: playerInfo.roomId,
                    playerId: playerInfo.id,
                    playerName: playerInfo.name
                };

                // Store in localStorage as a backup
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('playerInfo', JSON.stringify(cachedPlayerInfo));
                }
            });

            socketInstance.on('connect_error', (err) => {
                console.error('Socket connection error:', err);
            });

            socketInstance.on('disconnect', (reason) => {
                console.log('Disconnected from socket server:', reason);

                // Try to recover connection if it was lost
                if (socketInstance && (reason === 'io server disconnect' || reason === 'transport close')) {
                    // the disconnection was initiated by the server, retry immediately
                    socketInstance.connect();
                }
            });

            socketInstance.on('reconnect', (attemptNumber) => {
                console.log(`Reconnected to socket server after ${attemptNumber} attempts`);

                // Re-join the room after reconnection
                if (socketInstance && cachedPlayerInfo.roomId && cachedPlayerInfo.playerName) {
                    socketInstance.emit('rejoin-room',
                        cachedPlayerInfo.roomId,
                        cachedPlayerInfo.playerName,
                        cachedPlayerInfo.playerId
                    );
                }
            });

            socketInstance.on('reconnect_attempt', (attemptNumber) => {
                console.log(`Attempting to reconnect: attempt ${attemptNumber}`);
            });

            socketInstance.on('reconnect_error', (err) => {
                console.error('Reconnection error:', err);
            });

            socketInstance.on('reconnect_failed', () => {
                console.error('Failed to reconnect after maximum attempts');
                // Consider showing a UI message to the user
            });

            setSocket(socketInstance);

            // On initialization, try to restore player info from localStorage
            try {
                if (typeof localStorage !== 'undefined') {
                    const savedInfo = localStorage.getItem('playerInfo');
                    if (savedInfo) {
                        const parsedInfo = JSON.parse(savedInfo);
                        cachedPlayerInfo = parsedInfo;
                    }
                }
            } catch (e) {
                console.error('Error loading saved player info:', e);
            }
        }

        setSocket(socketInstance);

        // Clean up is simplified since we're using a singleton
        return () => {
            // We don't disconnect on component unmount anymore
            // This prevents reconnection issues
        };
    }, []);

    // Helper method to send debounced setting updates
    const updateRoomSettings = (roomId: string, settings: any) => {
        if (!socketInstance) {
            console.log('Cannot update room settings - Socket not connected');
            return;
        }

        console.log('UPDATE_ROOM_SETTINGS request:', settings);

        // Clear any pending update
        if (settingsUpdateTimeoutRef.current) {
            console.log('Clearing previous settings update timeout');
            clearTimeout(settingsUpdateTimeoutRef.current);
        }

        // Set a new timeout for the update
        console.log(`Setting debounced update timeout (300ms) for room ${roomId}`);
        settingsUpdateTimeoutRef.current = setTimeout(() => {
            if (socketInstance) {
                console.log('Sending debounced settings update:', settings);
                socketInstance.emit('update-room-settings', roomId, settings);
            }
            settingsUpdateTimeoutRef.current = null;
        }, 300); // 300ms debounce
    };

    return { socket, updateRoomSettings };
};
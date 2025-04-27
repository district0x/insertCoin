import { NextResponse } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';

// Define types for the Socket.IO server
interface SocketServer extends HTTPServer {
    io?: SocketIOServer | undefined;
}

interface SocketWithIO extends NetSocket {
    server: SocketServer;
}

// Create a Socket.IO instance if it doesn't exist
const initializeSocketServer = (res: NextResponse) => {
    const httpServer = res.socket as SocketWithIO;

    if (!httpServer.server.io) {
        console.log('Initializing Socket.IO server...');

        const io = new SocketIOServer(httpServer.server, {
            path: '/api/socket-io',
            addTrailingSlash: false,
        });

        httpServer.server.io = io;

        // Socket.IO event handlers
        io.on('connection', (socket) => {
            console.log(`User connected: ${socket.id}`);

            // Handle player joining a room
            socket.on('join-room', (roomId, playerName) => {
                socket.join(roomId);

                // Generate a random player ID
                const playerId = Math.random().toString(36).substring(2, 9);

                // Notify the room that a player joined
                io.to(roomId).emit('player-joined', {
                    id: playerId,
                    name: playerName,
                    score: 0
                });

                // Send the player their ID
                socket.emit('player-info', {
                    id: playerId,
                    name: playerName,
                    roomId
                });
            });

            // Handle disconnections
            socket.on('disconnect', () => {
                console.log(`User disconnected: ${socket.id}`);
            });

            // Handle game events (we'll expand these later)
            socket.on('start-game', (roomId) => {
                io.to(roomId).emit('game-started');
            });

            socket.on('answer-submitted', (roomId, playerId, playerName, isCorrect, score) => {
                io.to(roomId).emit('player-answered', {
                    playerId,
                    playerName,
                    isCorrect,
                    score
                });
            });

            socket.on('end-game', (roomId, results) => {
                io.to(roomId).emit('game-over', results);
            });
        });
    }

    return NextResponse.json({ success: true });
};

export async function GET() {
    return NextResponse.json({ success: true });
}

export async function POST(req: Request) {
    const res = new NextResponse();
    return initializeSocketServer(res);
}
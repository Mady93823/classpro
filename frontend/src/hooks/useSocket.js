import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const useSocket = (namespace = '/class') => {
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Create socket connection
        const socketInstance = io(`${SOCKET_URL}${namespace}`, {
            transports: ['websocket', 'polling'],
            reconnection: true,           // Enable auto-reconnection
            reconnectionAttempts: 10,     // Try 10 times before giving up
            reconnectionDelay: 1000,      // Start with 1 second
            reconnectionDelayMax: 5000,   // Max 5 seconds between attempts
            timeout: 20000                // 20 second timeout
        });

        socketRef.current = socketInstance;

        socketInstance.on('connect', () => {
            console.log('Socket connected:', socketInstance.id);
            setIsConnected(true);
        });

        socketInstance.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            setIsConnected(false);

            // Auto-reconnect if disconnected unexpectedly
            if (reason === 'io server disconnect') {
                // Server disconnected, reconnect manually
                socketInstance.connect();
            }
        });

        socketInstance.on('reconnect', (attemptNumber) => {
            console.log('Reconnected after', attemptNumber, 'attempts');
            setIsConnected(true);
        });

        socketInstance.on('reconnect_attempt', (attemptNumber) => {
            console.log('Reconnection attempt', attemptNumber);
        });

        socketInstance.on('reconnect_error', (error) => {
            console.error('Reconnection error:', error);
        });

        socketInstance.on('reconnect_failed', () => {
            console.error('Failed to reconnect after max attempts');
        });

        return () => {
            socketInstance.disconnect();
        };
    }, [namespace]);

    return { socket: socketRef.current, isConnected };
};

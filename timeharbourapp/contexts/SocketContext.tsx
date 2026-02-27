'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/components/auth/AuthProvider';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isOnline: boolean; // Application online state
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  isOnline: true,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Basic online/offline browser detection
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initialize Socket.io
    // Use environment variable or default to localhost:3001
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    // Remove /api suffix if present to connect to root namespace, as sockets run on root
    const SOCKET_URL = apiUrl.replace(/\/api\/?$/, '');
    
    // Only connect if we have a user
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    console.log('Connecting to socket at:', SOCKET_URL, 'User:', user.id);
    
    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'], // Allow fallback
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true,
      query: {
        userId: user.id
      }
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });
    
    socketInstance.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
    });

    setSocket(socketInstance);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      socketInstance.disconnect();
    };
  }, [user?.id]); // Re-connect when user ID changes

  return (
    <SocketContext.Provider value={{ socket, isConnected, isOnline }}>
      {children}
    </SocketContext.Provider>
  );
};

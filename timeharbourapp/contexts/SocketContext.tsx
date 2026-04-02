'use client';

import React, { createContext, useContext } from 'react';

interface SocketContextType {
  socket: null;
  isConnected: boolean;
  isOnline: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  isOnline: true,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <SocketContext.Provider value={{ socket: null, isConnected: false, isOnline: true }}>
      {children}
    </SocketContext.Provider>
  );
};

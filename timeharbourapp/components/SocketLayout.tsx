'use client';

import React from 'react';
import { useSocket, SocketProvider } from '@/contexts/SocketContext';

function ConnectionStatusIndicator() {
    const { isConnected, isOnline } = useSocket();

    if (!isOnline) {
        return (
            <div className="fixed bottom-4 right-4 pb-[env(safe-area-inset-bottom)] bg-red-600 text-white px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2 font-medium text-sm animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full"></span>
                Offline
            </div>
        );
    }

    if (!isConnected) {
        return (
            <div className="fixed bottom-4 right-4 pb-[env(safe-area-inset-bottom)] bg-yellow-500 text-white px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2 font-medium text-sm">
                <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                Connecting...
            </div>
        );
    }

    // Only show "Online" briefly or keep it small
    return (
        <div className="fixed bottom-4 right-4 pb-[env(safe-area-inset-bottom)] bg-emerald-600 text-white px-3 py-1.5 rounded-full shadow-lg z-50 flex items-center gap-2 text-xs font-medium opacity-80 hover:opacity-100 transition-all">
            <span className="w-2 h-2 bg-green-200 rounded-full animate-pulse"></span>
            Server Connected
        </div>
    );
};

export default function SocketLayout({ children }: { children: React.ReactNode }) {
    return (
        <SocketProvider>
            {children}
            <ConnectionStatusIndicator />
        </SocketProvider>
    );
}

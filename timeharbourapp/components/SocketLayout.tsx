'use client';

import React from 'react';
import { SocketProvider } from '@/contexts/SocketContext';

function ConnectionStatusIndicator() {
    return null;
};

export default function SocketLayout({ children }: { children: React.ReactNode }) {
    return (
        <SocketProvider>
            {children}
            <ConnectionStatusIndicator />
        </SocketProvider>
    );
}

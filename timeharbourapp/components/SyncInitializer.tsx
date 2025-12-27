'use client';

import { useEffect } from 'react';
import { syncManager } from '@/TimeharborAPI/SyncManager';

export default function SyncInitializer() {
  useEffect(() => {
    // Initialize the sync manager (which initializes NetworkDetector)
    syncManager.init();
  }, []);

  return null;
}

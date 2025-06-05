/**
 * Custom hook for monitoring offline sync status
 */

import { useState, useEffect } from 'react';
import { OfflineSyncService } from '../services/OfflineSyncService';
import { SyncStatus } from '../types';

interface UseSyncStatusReturn {
  syncStatus: SyncStatus | null;
  refresh: () => Promise<void>;
}

export const useSyncStatus = (): UseSyncStatusReturn => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    loadSyncStatus();
    
    // Subscribe to sync status updates
    const unsubscribe = OfflineSyncService.addSyncListener((status) => {
      setSyncStatus(status);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadSyncStatus = async () => {
    const status = await OfflineSyncService.getSyncStatus();
    setSyncStatus(status);
  };

  const refresh = async () => {
    await loadSyncStatus();
    await OfflineSyncService.forceSync();
  };

  return {
    syncStatus,
    refresh,
  };
};
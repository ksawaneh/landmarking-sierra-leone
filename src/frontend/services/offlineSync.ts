/**
 * OfflineSync Service
 * 
 * Handles caching API requests when offline and synchronizing when back online
 */

import { v4 as uuidv4 } from 'uuid';

// Types for pending operations
type OperationType = 'CREATE' | 'UPDATE' | 'DELETE';

interface PendingOperation {
  id: string;
  timestamp: number;
  type: OperationType;
  endpoint: string;
  payload: any;
  entityId?: string; // Used for updates and deletes
  status: 'pending' | 'syncing' | 'error';
  errorMessage?: string;
}

// Local storage keys
const STORAGE_KEYS = {
  PENDING_OPERATIONS: 'landmarking_pending_operations',
  CACHED_PARCELS: 'landmarking_cached_parcels',
  LAST_SYNC: 'landmarking_last_sync'
};

/**
 * Offline Sync Service
 */
export const offlineSync = {
  // Check if the user is online
  isOnline: (): boolean => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  },

  // Add a pending operation to the queue
  addPendingOperation: (
    type: OperationType,
    endpoint: string,
    payload: any,
    entityId?: string
  ): string => {
    const pendingOperations = offlineSync.getPendingOperations();
    
    const operationId = uuidv4();
    const newOperation: PendingOperation = {
      id: operationId,
      timestamp: Date.now(),
      type,
      endpoint,
      payload,
      entityId,
      status: 'pending'
    };
    
    pendingOperations.push(newOperation);
    offlineSync.savePendingOperations(pendingOperations);
    
    return operationId;
  },

  // Get all pending operations
  getPendingOperations: (): PendingOperation[] => {
    if (typeof localStorage === 'undefined') return [];
    
    const operations = localStorage.getItem(STORAGE_KEYS.PENDING_OPERATIONS);
    return operations ? JSON.parse(operations) : [];
  },

  // Save pending operations to local storage
  savePendingOperations: (operations: PendingOperation[]): void => {
    if (typeof localStorage === 'undefined') return;
    
    localStorage.setItem(STORAGE_KEYS.PENDING_OPERATIONS, JSON.stringify(operations));
  },

  // Cache a parcel for offline access
  cacheParcel: (parcel: any): void => {
    if (typeof localStorage === 'undefined') return;
    
    const cachedParcels = offlineSync.getCachedParcels();
    
    // Update or add the parcel
    const existingIndex = cachedParcels.findIndex(p => p.id === parcel.id);
    if (existingIndex >= 0) {
      cachedParcels[existingIndex] = parcel;
    } else {
      cachedParcels.push(parcel);
    }
    
    localStorage.setItem(STORAGE_KEYS.CACHED_PARCELS, JSON.stringify(cachedParcels));
  },

  // Get all cached parcels
  getCachedParcels: (): any[] => {
    if (typeof localStorage === 'undefined') return [];
    
    const parcels = localStorage.getItem(STORAGE_KEYS.CACHED_PARCELS);
    return parcels ? JSON.parse(parcels) : [];
  },

  // Get a single cached parcel by ID
  getCachedParcel: (id: string): any | null => {
    const cachedParcels = offlineSync.getCachedParcels();
    return cachedParcels.find(parcel => parcel.id === id) || null;
  },

  // Remove a parcel from the cache
  removeCachedParcel: (id: string): void => {
    if (typeof localStorage === 'undefined') return;
    
    const cachedParcels = offlineSync.getCachedParcels();
    const updatedParcels = cachedParcels.filter(parcel => parcel.id !== id);
    
    localStorage.setItem(STORAGE_KEYS.CACHED_PARCELS, JSON.stringify(updatedParcels));
  },

  // Update operation status
  updateOperationStatus: (
    operationId: string,
    status: 'pending' | 'syncing' | 'error',
    errorMessage?: string
  ): void => {
    const operations = offlineSync.getPendingOperations();
    const updatedOperations = operations.map(op => {
      if (op.id === operationId) {
        return { ...op, status, errorMessage };
      }
      return op;
    });
    
    offlineSync.savePendingOperations(updatedOperations);
  },

  // Remove a completed operation
  removeOperation: (operationId: string): void => {
    const operations = offlineSync.getPendingOperations();
    const updatedOperations = operations.filter(op => op.id !== operationId);
    
    offlineSync.savePendingOperations(updatedOperations);
  },

  // Set the last sync timestamp
  setLastSync: (timestamp: number): void => {
    if (typeof localStorage === 'undefined') return;
    
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp.toString());
  },

  // Get the last sync timestamp
  getLastSync: (): number => {
    if (typeof localStorage === 'undefined') return 0;
    
    const timestamp = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return timestamp ? parseInt(timestamp, 10) : 0;
  },

  // Check if there are pending operations
  hasPendingOperations: (): boolean => {
    return offlineSync.getPendingOperations().length > 0;
  },

  // Get the count of pending operations
  getPendingOperationsCount: (): number => {
    return offlineSync.getPendingOperations().length;
  }
};

// Add event listeners for online/offline status if in a browser environment
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Application is online. Starting sync...');
    // Here you would typically trigger synchronization
    // e.g., syncService.startSync();
  });
  
  window.addEventListener('offline', () => {
    console.log('Application is offline. Operations will be queued.');
  });
}

export default offlineSync;
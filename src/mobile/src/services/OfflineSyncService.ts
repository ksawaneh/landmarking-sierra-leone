/**
 * Offline synchronization service for managing data sync between local storage and server
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { DatabaseService } from './DatabaseService';
import { ApiService } from './ApiService';
import { STORAGE_KEYS, OFFLINE_CONFIG } from '../constants';
import { PendingOperation, SyncStatus } from '../types';

export class OfflineSyncService {
  private static syncInterval: NodeJS.Timeout | null = null;
  private static isSyncing = false;
  private static syncCallbacks: ((status: SyncStatus) => void)[] = [];

  /**
   * Initialize offline sync service
   */
  static async init(): Promise<void> {
    try {
      // Initialize database
      await DatabaseService.init();
      
      // Start periodic sync
      this.startPeriodicSync();
      
      // Listen for network changes
      this.setupNetworkListener();
    } catch (error) {
      console.error('OfflineSync initialization error:', error);
      throw error;
    }
  }

  /**
   * Check if device is offline
   */
  static async isOffline(): Promise<boolean> {
    try {
      const networkState = await Network.getNetworkStateAsync();
      return !networkState.isConnected || !networkState.isInternetReachable;
    } catch (error) {
      console.error('Error checking network state:', error);
      return true; // Assume offline if we can't check
    }
  }

  /**
   * Start periodic sync
   */
  private static startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (!this.isSyncing) {
        await this.syncPendingOperations();
      }
    }, OFFLINE_CONFIG.SYNC_INTERVAL);
  }

  /**
   * Setup network state listener
   */
  private static setupNetworkListener(): void {
    // Network state subscription would go here
    // For now, we rely on periodic sync
  }

  /**
   * Add a sync status listener
   */
  static addSyncListener(callback: (status: SyncStatus) => void): () => void {
    this.syncCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.syncCallbacks.indexOf(callback);
      if (index > -1) {
        this.syncCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify sync listeners
   */
  private static notifySyncListeners(status: SyncStatus): void {
    this.syncCallbacks.forEach(callback => callback(status));
  }

  /**
   * Sync all pending operations
   */
  static async syncPendingOperations(): Promise<void> {
    if (this.isSyncing) return;
    
    const isOffline = await this.isOffline();
    if (isOffline) return;

    this.isSyncing = true;
    
    const syncStatus: SyncStatus = {
      syncInProgress: true,
      pendingChanges: 0,
      lastSyncedAt: await this.getLastSyncTime(),
    };
    
    this.notifySyncListeners(syncStatus);

    try {
      const operations = await DatabaseService.getPendingOperations();
      syncStatus.pendingChanges = operations.length;
      
      for (const operation of operations) {
        try {
          await this.processPendingOperation(operation);
          await DatabaseService.deletePendingOperation(operation.id);
          
          syncStatus.pendingChanges--;
          this.notifySyncListeners(syncStatus);
        } catch (error) {
          console.error(`Failed to sync operation ${operation.id}:`, error);
          
          // Update retry count
          if (operation.retryCount < OFFLINE_CONFIG.MAX_RETRY_ATTEMPTS) {
            await DatabaseService.updatePendingOperationRetry(
              operation.id,
              operation.retryCount + 1,
              error.message
            );
          }
        }
      }
      
      // Update last sync time
      await this.setLastSyncTime(Date.now());
      
      syncStatus.syncInProgress = false;
      syncStatus.lastSyncedAt = new Date().toISOString();
      this.notifySyncListeners(syncStatus);
      
    } catch (error) {
      console.error('Sync error:', error);
      
      syncStatus.syncInProgress = false;
      syncStatus.lastError = error.message;
      this.notifySyncListeners(syncStatus);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Process a single pending operation
   */
  private static async processPendingOperation(operation: PendingOperation): Promise<void> {
    switch (operation.entityType) {
      case 'parcel':
        await this.syncParcelOperation(operation);
        break;
      case 'verification':
        await this.syncVerificationOperation(operation);
        break;
      case 'document':
        await this.syncDocumentOperation(operation);
        break;
      default:
        throw new Error(`Unknown entity type: ${operation.entityType}`);
    }
  }

  /**
   * Sync parcel operations
   */
  private static async syncParcelOperation(operation: PendingOperation): Promise<void> {
    switch (operation.type) {
      case 'CREATE':
        await ApiService.createParcel(operation.payload);
        break;
      case 'UPDATE':
        await ApiService.updateParcel(operation.entityId, operation.payload);
        break;
      case 'DELETE':
        await ApiService.deleteParcel(operation.entityId);
        break;
    }
  }

  /**
   * Sync verification operations
   */
  private static async syncVerificationOperation(operation: PendingOperation): Promise<void> {
    switch (operation.type) {
      case 'CREATE':
        await ApiService.createVerification(operation.payload);
        break;
      case 'UPDATE':
        await ApiService.updateVerification(operation.entityId, operation.payload);
        break;
    }
  }

  /**
   * Sync document operations
   */
  private static async syncDocumentOperation(operation: PendingOperation): Promise<void> {
    switch (operation.type) {
      case 'CREATE':
        // Upload document file first if local URI exists
        if (operation.payload.localUri) {
          const uploadedUrl = await ApiService.uploadDocument(
            operation.payload.localUri,
            operation.payload.type
          );
          operation.payload.uri = uploadedUrl;
        }
        await ApiService.createDocument(operation.payload);
        break;
      case 'DELETE':
        await ApiService.deleteDocument(operation.entityId);
        break;
    }
  }

  /**
   * Get last sync time
   */
  static async getLastSyncTime(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return null;
    }
  }

  /**
   * Set last sync time
   */
  static async setLastSyncTime(timestamp: number): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp.toString());
    } catch (error) {
      console.error('Error setting last sync time:', error);
    }
  }

  /**
   * Check if sync is needed based on offline duration
   */
  static async checkSyncRequired(): Promise<boolean> {
    const lastSync = await this.getLastSyncTime();
    if (!lastSync) return true;
    
    const lastSyncTimestamp = parseInt(lastSync, 10);
    const daysSinceSync = (Date.now() - lastSyncTimestamp) / (1000 * 60 * 60 * 24);
    
    return daysSinceSync >= OFFLINE_CONFIG.MAX_OFFLINE_DAYS;
  }

  /**
   * Force sync immediately
   */
  static async forceSync(): Promise<void> {
    await this.syncPendingOperations();
  }

  /**
   * Get sync status
   */
  static async getSyncStatus(): Promise<SyncStatus> {
    const pendingOps = await DatabaseService.getPendingOperations();
    const lastSync = await this.getLastSyncTime();
    
    return {
      syncInProgress: this.isSyncing,
      pendingChanges: pendingOps.length,
      lastSyncedAt: lastSync,
    };
  }

  /**
   * Clear all pending operations (use with caution)
   */
  static async clearPendingOperations(): Promise<void> {
    const operations = await DatabaseService.getPendingOperations();
    for (const op of operations) {
      await DatabaseService.deletePendingOperation(op.id);
    }
  }

  /**
   * Stop sync service
   */
  static stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}
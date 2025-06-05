/**
 * Integration tests for offline sync functionality
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { DatabaseService } from '../../services/DatabaseService';
import { OfflineSyncService } from '../../services/OfflineSyncService';
import { ApiService } from '../../services/ApiService';
import { ParcelService } from '../../services/ParcelService';
import { STORAGE_KEYS, OFFLINE_CONFIG } from '../../constants';
import { Parcel, VerificationStatus } from '../../types';

// Mock dependencies
jest.mock('expo-network');
jest.mock('../../services/ApiService');

describe('Offline Sync Integration', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    
    // Initialize services
    ApiService.init();
    await DatabaseService.init();
    await OfflineSyncService.init();
    
    // Stop periodic sync for tests
    OfflineSyncService.stop();
  });

  afterEach(() => {
    OfflineSyncService.stop();
  });

  const createMockParcel = (id: string): Partial<Parcel> => ({
    id,
    parcelNumber: `P${id}`,
    ownerId: 'user-1',
    ownerName: 'Test User',
    location: {
      latitude: 8.484,
      longitude: -13.2299,
      district: 'Western Area',
      chiefdom: 'Freetown',
    },
    boundaries: [],
    area: 1000,
    landUse: 'RESIDENTIAL',
    verificationStatus: VerificationStatus.DRAFT,
  });

  describe('Offline parcel creation and sync', () => {
    it('should queue parcel creation when offline and sync when online', async () => {
      // Start offline
      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      // Create parcel while offline
      const parcelData = createMockParcel('local-1');
      const createdParcel = await ParcelService.createParcel(parcelData);
      
      expect(createdParcel.id).toMatch(/^local_/);
      expect(createdParcel.localChanges).toBe(true);
      
      // Verify parcel is saved locally
      const localParcel = await DatabaseService.getParcel(createdParcel.id);
      expect(localParcel).toBeTruthy();
      
      // Verify pending operation exists
      const pendingOps = await DatabaseService.getPendingOperations();
      expect(pendingOps).toHaveLength(1);
      expect(pendingOps[0].type).toBe('CREATE');
      expect(pendingOps[0].entityType).toBe('parcel');
      
      // Go online
      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      });
      
      // Mock successful API response
      const serverParcel = { ...createdParcel, id: 'server-1', localChanges: false };
      (ApiService.createParcel as jest.Mock).mockResolvedValue(serverParcel);
      
      // Trigger sync
      await OfflineSyncService.syncPendingOperations();
      
      // Verify API was called
      expect(ApiService.createParcel).toHaveBeenCalledWith(
        expect.objectContaining({
          parcelNumber: parcelData.parcelNumber,
          ownerId: parcelData.ownerId,
        })
      );
      
      // Verify pending operation was removed
      const remainingOps = await DatabaseService.getPendingOperations();
      expect(remainingOps).toHaveLength(0);
      
      // Verify last sync time was updated
      const lastSync = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      expect(lastSync).toBeTruthy();
    });

    it('should handle sync failures with retry', async () => {
      // Create offline parcel
      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });
      
      const parcel = await ParcelService.createParcel(createMockParcel('local-2'));
      
      // Go online but API fails
      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      });
      
      (ApiService.createParcel as jest.Mock).mockRejectedValue(new Error('Server error'));
      
      // First sync attempt
      await OfflineSyncService.syncPendingOperations();
      
      // Verify operation still exists with retry count
      let pendingOps = await DatabaseService.getPendingOperations();
      expect(pendingOps).toHaveLength(1);
      expect(pendingOps[0].retryCount).toBe(1);
      expect(pendingOps[0].lastError).toBe('Server error');
      
      // Second sync attempt
      await OfflineSyncService.syncPendingOperations();
      
      pendingOps = await DatabaseService.getPendingOperations();
      expect(pendingOps[0].retryCount).toBe(2);
      
      // Third sync attempt - should succeed
      (ApiService.createParcel as jest.Mock).mockResolvedValue({ ...parcel, id: 'server-2' });
      await OfflineSyncService.syncPendingOperations();
      
      // Verify operation was removed after success
      pendingOps = await DatabaseService.getPendingOperations();
      expect(pendingOps).toHaveLength(0);
    });
  });

  describe('Multiple operations sync', () => {
    it('should sync multiple operations in correct order', async () => {
      // Go offline
      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });
      
      // Create multiple parcels
      const parcel1 = await ParcelService.createParcel(createMockParcel('local-1'));
      const parcel2 = await ParcelService.createParcel(createMockParcel('local-2'));
      
      // Update first parcel
      await ParcelService.updateParcel(parcel1.id, { area: 2000 });
      
      // Verify 3 pending operations
      const pendingOps = await DatabaseService.getPendingOperations();
      expect(pendingOps).toHaveLength(3);
      
      // Go online
      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      });
      
      // Mock API responses
      (ApiService.createParcel as jest.Mock)
        .mockResolvedValueOnce({ ...parcel1, id: 'server-1' })
        .mockResolvedValueOnce({ ...parcel2, id: 'server-2' });
      (ApiService.updateParcel as jest.Mock).mockResolvedValue({ ...parcel1, area: 2000 });
      
      // Sync
      await OfflineSyncService.syncPendingOperations();
      
      // Verify all operations were processed
      expect(ApiService.createParcel).toHaveBeenCalledTimes(2);
      expect(ApiService.updateParcel).toHaveBeenCalledTimes(1);
      
      // Verify no pending operations remain
      const remainingOps = await DatabaseService.getPendingOperations();
      expect(remainingOps).toHaveLength(0);
    });
  });

  describe('Sync status monitoring', () => {
    it('should notify listeners of sync progress', async () => {
      const syncStatusCallback = jest.fn();
      const unsubscribe = OfflineSyncService.addSyncListener(syncStatusCallback);
      
      // Create offline operation
      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });
      
      await ParcelService.createParcel(createMockParcel('local-1'));
      
      // Go online and sync
      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      });
      
      (ApiService.createParcel as jest.Mock).mockResolvedValue({ id: 'server-1' });
      
      await OfflineSyncService.syncPendingOperations();
      
      // Verify callbacks
      expect(syncStatusCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          syncInProgress: true,
          pendingChanges: 1,
        })
      );
      
      expect(syncStatusCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          syncInProgress: false,
          pendingChanges: 0,
        })
      );
      
      // Cleanup
      unsubscribe();
    });
  });

  describe('Offline duration check', () => {
    it('should detect when max offline duration is exceeded', async () => {
      // Set last sync to 61 days ago
      const pastDate = Date.now() - (61 * 24 * 60 * 60 * 1000);
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, pastDate.toString());
      
      const syncRequired = await OfflineSyncService.checkSyncRequired();
      expect(syncRequired).toBe(true);
    });

    it('should not require sync within offline duration', async () => {
      // Set last sync to 30 days ago
      const pastDate = Date.now() - (30 * 24 * 60 * 60 * 1000);
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, pastDate.toString());
      
      const syncRequired = await OfflineSyncService.checkSyncRequired();
      expect(syncRequired).toBe(false);
    });
  });

  describe('Conflict resolution', () => {
    it('should handle update conflicts when same parcel modified offline and online', async () => {
      // Create parcel online
      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      });
      
      const onlineParcel = { ...createMockParcel('1'), id: 'server-1' };
      (ApiService.createParcel as jest.Mock).mockResolvedValue(onlineParcel);
      
      const parcel = await ParcelService.createParcel(createMockParcel('1'));
      
      // Go offline and update
      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });
      
      await ParcelService.updateParcel(parcel.id, { area: 2000 });
      
      // Meanwhile, server version is updated
      const serverUpdatedParcel = { ...parcel, area: 3000, lastUpdated: new Date().toISOString() };
      
      // Go online - API returns conflict
      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      });
      
      (ApiService.updateParcel as jest.Mock).mockRejectedValue({
        response: { status: 409, data: { conflict: true, serverVersion: serverUpdatedParcel } },
      });
      
      // Sync should handle conflict
      await OfflineSyncService.syncPendingOperations();
      
      // In a real implementation, this would trigger conflict resolution UI
      // For now, verify the operation is still pending
      const pendingOps = await DatabaseService.getPendingOperations();
      expect(pendingOps).toHaveLength(1);
      expect(pendingOps[0].lastError).toContain('409');
    });
  });
});
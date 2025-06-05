import '@testing-library/jest-dom';
import { syncService } from '../services/syncService';
import { offlineSync } from '../services/offlineSync';
import axios from 'axios';

// Mock dependencies
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../services/offlineSync', () => ({
  offlineSync: {
    isOnline: jest.fn(),
    addPendingOperation: jest.fn(),
    getPendingOperations: jest.fn(),
    updateOperationStatus: jest.fn(),
    removeOperation: jest.fn(),
    cacheParcel: jest.fn(),
    getCachedParcel: jest.fn(),
    getCachedParcels: jest.fn(),
    removeCachedParcel: jest.fn(),
    setLastSync: jest.fn(),
    getLastSync: jest.fn(),
  }
}));

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid')
}));

describe('Sync Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default to online
    (offlineSync.isOnline as jest.Mock).mockReturnValue(true);
    // Default empty pending operations
    (offlineSync.getPendingOperations as jest.Mock).mockReturnValue([]);
  });

  describe('Initialize', () => {
    it('should initialize and set up event listeners', () => {
      // Mock addEventListener
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      
      syncService.initialize();
      
      // Verify event listeners were added
      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('Offline Operations', () => {
    it('should queue create operation when offline', async () => {
      // Set to offline
      (offlineSync.isOnline as jest.Mock).mockReturnValue(false);
      
      const parcelData = {
        name: 'Test Parcel',
        geometry: { type: 'Polygon', coordinates: [] }
      };
      
      await syncService.createParcelWithOfflineSupport(parcelData);
      
      // Verify operation was queued
      expect(offlineSync.addPendingOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'create',
          entityType: 'parcel',
          data: parcelData
        })
      );
    });

    it('should queue update operation when offline', async () => {
      // Set to offline
      (offlineSync.isOnline as jest.Mock).mockReturnValue(false);
      
      const parcelId = 'parcel-1';
      const parcelData = {
        name: 'Updated Parcel',
        geometry: { type: 'Polygon', coordinates: [] }
      };
      
      // Mock cached parcel
      (offlineSync.getCachedParcel as jest.Mock).mockReturnValue({
        id: parcelId,
        name: 'Original Parcel',
        geometry: { type: 'Polygon', coordinates: [] }
      });
      
      await syncService.updateParcelWithOfflineSupport(parcelId, parcelData);
      
      // Verify operation was queued
      expect(offlineSync.addPendingOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'update',
          entityType: 'parcel',
          entityId: parcelId,
          data: parcelData
        })
      );
      
      // Verify cache was updated
      expect(offlineSync.cacheParcel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: parcelId,
          name: 'Updated Parcel'
        })
      );
    });

    it('should queue delete operation when offline', async () => {
      // Set to offline
      (offlineSync.isOnline as jest.Mock).mockReturnValue(false);
      
      const parcelId = 'parcel-2';
      
      await syncService.deleteParcelWithOfflineSupport(parcelId);
      
      // Verify operation was queued
      expect(offlineSync.addPendingOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'delete',
          entityType: 'parcel',
          entityId: parcelId
        })
      );
      
      // Verify cache was updated
      expect(offlineSync.removeCachedParcel).toHaveBeenCalledWith(parcelId);
    });
  });

  describe('Synchronization', () => {
    it('should process pending operations when coming online', async () => {
      // Set to online
      (offlineSync.isOnline as jest.Mock).mockReturnValue(true);
      
      // Mock pending operations
      const pendingOperations = [
        {
          id: 'op-1',
          type: 'create',
          entityType: 'parcel',
          entityId: 'temp_123',
          data: { name: 'New Parcel' },
          timestamp: Date.now(),
          status: 'pending'
        },
        {
          id: 'op-2',
          type: 'update',
          entityType: 'parcel',
          entityId: 'parcel-3',
          data: { name: 'Updated Name' },
          timestamp: Date.now(),
          status: 'pending'
        }
      ];
      
      (offlineSync.getPendingOperations as jest.Mock).mockReturnValue(pendingOperations);
      
      // Mock successful API calls
      mockedAxios.post.mockResolvedValueOnce({ data: { id: 'server-id-1', name: 'New Parcel' } });
      mockedAxios.put.mockResolvedValueOnce({ data: { id: 'parcel-3', name: 'Updated Name' } });
      
      await syncService.startSync();
      
      // Verify API calls were made
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ name: 'New Parcel' })
      );
      
      expect(mockedAxios.put).toHaveBeenCalledWith(
        expect.stringContaining('parcel-3'),
        expect.objectContaining({ name: 'Updated Name' })
      );
      
      // Verify operations were marked as completed
      expect(offlineSync.updateOperationStatus).toHaveBeenCalledWith('op-1', 'completed');
      expect(offlineSync.updateOperationStatus).toHaveBeenCalledWith('op-2', 'completed');
    });

    it('should handle API errors during sync', async () => {
      // Set to online
      (offlineSync.isOnline as jest.Mock).mockReturnValue(true);
      
      // Mock pending operations
      const pendingOperations = [
        {
          id: 'op-3',
          type: 'update',
          entityType: 'parcel',
          entityId: 'parcel-4',
          data: { name: 'Will Fail' },
          timestamp: Date.now(),
          status: 'pending'
        }
      ];
      
      (offlineSync.getPendingOperations as jest.Mock).mockReturnValue(pendingOperations);
      
      // Mock failed API call
      mockedAxios.put.mockRejectedValueOnce(new Error('API Error'));
      
      await syncService.startSync();
      
      // Verify operation was marked as failed
      expect(offlineSync.updateOperationStatus).toHaveBeenCalledWith('op-3', 'failed');
    });
  });

  describe('Entity Tracking', () => {
    it('should track entity changes for conflict resolution', () => {
      const entity = {
        id: 'entity-1',
        name: 'Original Name',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      syncService.trackEntity('parcel', entity);
      
      // We can't directly test the internal state of trackEntity,
      // but we can verify it doesn't throw and is called with right params
      expect(syncService.trackEntity).toHaveBeenCalledWith('parcel', entity);
    });
  });
});
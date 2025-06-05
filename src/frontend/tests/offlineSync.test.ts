import '@testing-library/jest-dom';
import { act } from '@testing-library/react';
import { offlineSync } from '../services/offlineSync';
import { syncService } from '../services/syncService';

// Mock localStorage
const localStorageMock = (function() {
  let store: Record<string, string> = {};
  return {
    getItem: function(key: string) {
      return store[key] || null;
    },
    setItem: function(key: string, value: string) {
      store[key] = value;
    },
    removeItem: function(key: string) {
      delete store[key];
    },
    clear: function() {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock online/offline status
Object.defineProperty(navigator, 'onLine', {
  configurable: true,
  get: jest.fn(() => true),
});

// Mock syncService
jest.mock('../services/syncService', () => ({
  syncService: {
    startSync: jest.fn(),
    initialize: jest.fn(),
    trackEntity: jest.fn(),
    createParcelWithOfflineSupport: jest.fn(),
    updateParcelWithOfflineSupport: jest.fn(),
    deleteParcelWithOfflineSupport: jest.fn(),
  }
}));

describe('Offline Synchronization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    // Default to online
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: jest.fn(() => true),
    });
  });

  describe('Network Status Detection', () => {
    it('should correctly detect online status', () => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: jest.fn(() => true),
      });
      
      expect(offlineSync.isOnline()).toBe(true);
    });

    it('should correctly detect offline status', () => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: jest.fn(() => false),
      });
      
      expect(offlineSync.isOnline()).toBe(false);
    });
  });

  describe('Pending Operations', () => {
    it('should add pending operation to queue when offline', () => {
      // Set to offline
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: jest.fn(() => false),
      });

      const operation = {
        id: 'test-op-1',
        type: 'create',
        entityType: 'parcel',
        entityId: 'parcel-1',
        data: { name: 'Test Parcel' },
        timestamp: Date.now(),
        status: 'pending'
      };

      offlineSync.addPendingOperation(operation);
      
      const pendingOps = offlineSync.getPendingOperations();
      expect(pendingOps.length).toBe(1);
      expect(pendingOps[0].id).toBe('test-op-1');
    });

    it('should update operation status', () => {
      const operation = {
        id: 'test-op-2',
        type: 'update',
        entityType: 'parcel',
        entityId: 'parcel-2',
        data: { name: 'Updated Parcel' },
        timestamp: Date.now(),
        status: 'pending'
      };

      offlineSync.addPendingOperation(operation);
      offlineSync.updateOperationStatus('test-op-2', 'completed');
      
      const pendingOps = offlineSync.getPendingOperations();
      const updatedOp = pendingOps.find(op => op.id === 'test-op-2');
      
      expect(updatedOp?.status).toBe('completed');
    });

    it('should remove operation from queue', () => {
      const operation = {
        id: 'test-op-3',
        type: 'delete',
        entityType: 'parcel',
        entityId: 'parcel-3',
        data: null,
        timestamp: Date.now(),
        status: 'pending'
      };

      offlineSync.addPendingOperation(operation);
      offlineSync.removeOperation('test-op-3');
      
      const pendingOps = offlineSync.getPendingOperations();
      const removedOp = pendingOps.find(op => op.id === 'test-op-3');
      
      expect(removedOp).toBeUndefined();
    });
  });

  describe('Parcel Caching', () => {
    it('should cache a parcel for offline access', () => {
      const parcel = {
        id: 'parcel-4',
        name: 'Test Parcel 4',
        geometry: { type: 'Polygon', coordinates: [] },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      offlineSync.cacheParcel(parcel);
      
      const cachedParcel = offlineSync.getCachedParcel('parcel-4');
      expect(cachedParcel).toEqual(parcel);
    });

    it('should get all cached parcels', () => {
      localStorageMock.clear();
      
      const parcel1 = {
        id: 'parcel-5',
        name: 'Test Parcel 5',
        geometry: { type: 'Polygon', coordinates: [] },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      const parcel2 = {
        id: 'parcel-6',
        name: 'Test Parcel 6',
        geometry: { type: 'Polygon', coordinates: [] },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      offlineSync.cacheParcel(parcel1);
      offlineSync.cacheParcel(parcel2);
      
      const cachedParcels = offlineSync.getCachedParcels();
      expect(cachedParcels.length).toBe(2);
      expect(cachedParcels.find(p => p.id === 'parcel-5')).toBeTruthy();
      expect(cachedParcels.find(p => p.id === 'parcel-6')).toBeTruthy();
    });

    it('should remove a cached parcel', () => {
      const parcel = {
        id: 'parcel-7',
        name: 'Test Parcel 7',
        geometry: { type: 'Polygon', coordinates: [] },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      offlineSync.cacheParcel(parcel);
      offlineSync.removeCachedParcel('parcel-7');
      
      const cachedParcel = offlineSync.getCachedParcel('parcel-7');
      expect(cachedParcel).toBeNull();
    });
  });

  describe('Last Sync Management', () => {
    it('should set and get last sync time', () => {
      const time = Date.now();
      offlineSync.setLastSync(time);
      
      expect(offlineSync.getLastSync()).toBe(time);
    });
  });
});
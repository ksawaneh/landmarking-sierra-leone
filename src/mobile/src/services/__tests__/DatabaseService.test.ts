/**
 * Unit tests for DatabaseService
 */

import * as SQLite from 'expo-sqlite';
import { DatabaseService } from '../DatabaseService';
import { DATABASE_CONFIG } from '../../constants';
import { Parcel, Verification, VerificationType, VerificationStatus } from '../../types';

// Mock SQLite
jest.mock('expo-sqlite');

describe('DatabaseService', () => {
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock database
    mockDb = {
      execAsync: jest.fn(),
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn(),
      runAsync: jest.fn(),
      prepareAsync: jest.fn(() => Promise.resolve({
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      })),
      withTransactionAsync: jest.fn((callback) => callback()),
    };
    
    (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(mockDb);
  });

  describe('init', () => {
    it('should initialize database and create tables', async () => {
      await DatabaseService.init();
      
      expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith(DATABASE_CONFIG.NAME);
      expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS parcels'));
      expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS verifications'));
      expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS documents'));
      expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS pending_operations'));
    });

    it('should handle initialization errors', async () => {
      (SQLite.openDatabaseAsync as jest.Mock).mockRejectedValue(new Error('DB error'));
      
      await expect(DatabaseService.init()).rejects.toThrow('DB error');
    });
  });

  describe('saveParcel', () => {
    const mockParcel: Parcel = {
      id: 'parcel-1',
      parcelNumber: 'P12345',
      ownerId: 'owner-1',
      ownerName: 'John Doe',
      location: {
        latitude: 8.484,
        longitude: -13.2299,
        district: 'Western Area',
        chiefdom: 'Freetown',
      },
      boundaries: [{
        id: 'boundary-1',
        points: [
          { latitude: 8.484, longitude: -13.2299, order: 0 },
          { latitude: 8.485, longitude: -13.2299, order: 1 },
          { latitude: 8.485, longitude: -13.2289, order: 2 },
        ],
        type: 'gps',
        createdAt: '2024-01-01T00:00:00Z',
        createdBy: 'user-1',
      }],
      area: 1000,
      landUse: 'RESIDENTIAL',
      documents: [],
      verificationStatus: VerificationStatus.DRAFT,
      verifications: [],
      registrationDate: '2024-01-01T00:00:00Z',
      lastUpdated: '2024-01-01T00:00:00Z',
      localChanges: false,
    };

    beforeEach(async () => {
      await DatabaseService.init();
    });

    it('should save a parcel to the database', async () => {
      const mockStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      };
      mockDb.prepareAsync.mockResolvedValue(mockStatement);

      await DatabaseService.saveParcel(mockParcel);
      
      expect(mockDb.prepareAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO parcels')
      );
      expect(mockStatement.executeAsync).toHaveBeenCalledWith({
        $id: mockParcel.id,
        $parcelNumber: mockParcel.parcelNumber,
        $ownerId: mockParcel.ownerId,
        $ownerName: mockParcel.ownerName,
        $location: JSON.stringify(mockParcel.location),
        $boundaries: JSON.stringify(mockParcel.boundaries),
        $area: mockParcel.area,
        $landUse: mockParcel.landUse,
        $verificationStatus: mockParcel.verificationStatus,
        $registrationDate: mockParcel.registrationDate,
        $lastUpdated: mockParcel.lastUpdated,
        $localChanges: 0,
        $syncStatus: JSON.stringify(mockParcel.syncStatus),
      });
      expect(mockStatement.finalizeAsync).toHaveBeenCalled();
    });

    it('should handle save errors', async () => {
      const mockStatement = {
        executeAsync: jest.fn().mockRejectedValue(new Error('Save failed')),
        finalizeAsync: jest.fn(),
      };
      mockDb.prepareAsync.mockResolvedValue(mockStatement);

      await expect(DatabaseService.saveParcel(mockParcel)).rejects.toThrow('Save failed');
      expect(mockStatement.finalizeAsync).toHaveBeenCalled();
    });

    it('should throw error if database not initialized', async () => {
      // Reset database to simulate uninitialized state
      (DatabaseService as any).db = null;
      
      await expect(DatabaseService.saveParcel(mockParcel)).rejects.toThrow('Database not initialized');
    });
  });

  describe('getParcel', () => {
    beforeEach(async () => {
      await DatabaseService.init();
    });

    it('should retrieve a parcel by ID', async () => {
      const mockRow = {
        id: 'parcel-1',
        parcelNumber: 'P12345',
        ownerId: 'owner-1',
        ownerName: 'John Doe',
        location: JSON.stringify({
          latitude: 8.484,
          longitude: -13.2299,
          district: 'Western Area',
          chiefdom: 'Freetown',
        }),
        boundaries: JSON.stringify([]),
        area: 1000,
        landUse: 'RESIDENTIAL',
        verificationStatus: 'DRAFT',
        registrationDate: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        localChanges: 0,
        syncStatus: null,
      };
      
      mockDb.getFirstAsync.mockResolvedValue(mockRow);

      const result = await DatabaseService.getParcel('parcel-1');
      
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        'SELECT * FROM parcels WHERE id = ?',
        ['parcel-1']
      );
      expect(result).toBeTruthy();
      expect(result?.id).toBe('parcel-1');
      expect(result?.location.latitude).toBe(8.484);
    });

    it('should return null if parcel not found', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const result = await DatabaseService.getParcel('non-existent');
      
      expect(result).toBeNull();
    });
  });

  describe('getAllParcels', () => {
    beforeEach(async () => {
      await DatabaseService.init();
    });

    it('should retrieve all parcels ordered by lastUpdated', async () => {
      const mockRows = [
        {
          id: 'parcel-1',
          parcelNumber: 'P12345',
          ownerId: 'owner-1',
          ownerName: 'John Doe',
          location: JSON.stringify({ latitude: 8.484, longitude: -13.2299, district: 'Western Area', chiefdom: 'Freetown' }),
          boundaries: JSON.stringify([]),
          area: 1000,
          landUse: 'RESIDENTIAL',
          verificationStatus: 'DRAFT',
          registrationDate: '2024-01-01T00:00:00Z',
          lastUpdated: '2024-01-01T00:00:00Z',
          localChanges: 0,
          syncStatus: null,
        },
      ];
      
      mockDb.getAllAsync.mockResolvedValue(mockRows);

      const result = await DatabaseService.getAllParcels();
      
      expect(mockDb.getAllAsync).toHaveBeenCalledWith('SELECT * FROM parcels ORDER BY lastUpdated DESC');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('parcel-1');
    });

    it('should return empty array if no parcels', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const result = await DatabaseService.getAllParcels();
      
      expect(result).toEqual([]);
    });
  });

  describe('saveVerification', () => {
    const mockVerification: Verification = {
      id: 'verification-1',
      parcelId: 'parcel-1',
      type: VerificationType.OWNER,
      signatory: {
        id: 'signatory-1',
        name: 'John Doe',
        role: VerificationType.OWNER,
        phoneNumber: '+23276123456',
      },
      signature: 'signature-hash',
      timestamp: '2024-01-01T00:00:00Z',
      location: {
        latitude: 8.484,
        longitude: -13.2299,
        district: 'Western Area',
        chiefdom: 'Freetown',
      },
      status: 'completed',
    };

    beforeEach(async () => {
      await DatabaseService.init();
    });

    it('should save a verification to the database', async () => {
      const mockStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      };
      mockDb.prepareAsync.mockResolvedValue(mockStatement);

      await DatabaseService.saveVerification(mockVerification);
      
      expect(mockDb.prepareAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO verifications')
      );
      expect(mockStatement.executeAsync).toHaveBeenCalledWith({
        $id: mockVerification.id,
        $parcelId: mockVerification.parcelId,
        $type: mockVerification.type,
        $signatory: JSON.stringify(mockVerification.signatory),
        $signature: mockVerification.signature,
        $biometricData: JSON.stringify(mockVerification.biometricData),
        $timestamp: mockVerification.timestamp,
        $location: JSON.stringify(mockVerification.location),
        $status: mockVerification.status,
        $notes: mockVerification.notes,
      });
    });
  });

  describe('getVerificationsByParcel', () => {
    beforeEach(async () => {
      await DatabaseService.init();
    });

    it('should retrieve verifications for a parcel', async () => {
      const mockRows = [
        {
          id: 'verification-1',
          parcelId: 'parcel-1',
          type: 'OWNER',
          signatory: JSON.stringify({
            id: 'signatory-1',
            name: 'John Doe',
            role: 'OWNER',
          }),
          signature: 'signature-hash',
          biometricData: null,
          timestamp: '2024-01-01T00:00:00Z',
          location: JSON.stringify({ latitude: 8.484, longitude: -13.2299 }),
          status: 'completed',
          notes: null,
        },
      ];
      
      mockDb.getAllAsync.mockResolvedValue(mockRows);

      const result = await DatabaseService.getVerificationsByParcel('parcel-1');
      
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM verifications WHERE parcelId = ? ORDER BY timestamp DESC',
        ['parcel-1']
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('verification-1');
    });
  });

  describe('addPendingOperation', () => {
    beforeEach(async () => {
      await DatabaseService.init();
    });

    it('should add a pending operation', async () => {
      const operation = {
        type: 'CREATE' as const,
        entityType: 'parcel' as const,
        entityId: 'parcel-1',
        payload: { test: 'data' },
        timestamp: '2024-01-01T00:00:00Z',
        retryCount: 0,
      };

      await DatabaseService.addPendingOperation(operation);
      
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pending_operations'),
        expect.arrayContaining([
          expect.stringMatching(/^op_\d+_[a-z0-9]+$/),
          operation.type,
          operation.entityType,
          operation.entityId,
          JSON.stringify(operation.payload),
          operation.timestamp,
          0,
        ])
      );
    });
  });

  describe('getPendingOperations', () => {
    beforeEach(async () => {
      await DatabaseService.init();
    });

    it('should retrieve pending operations ordered by timestamp', async () => {
      const mockRows = [
        {
          id: 'op-1',
          type: 'CREATE',
          entityType: 'parcel',
          entityId: 'parcel-1',
          payload: JSON.stringify({ test: 'data' }),
          timestamp: '2024-01-01T00:00:00Z',
          retryCount: 0,
          lastError: null,
        },
      ];
      
      mockDb.getAllAsync.mockResolvedValue(mockRows);

      const result = await DatabaseService.getPendingOperations();
      
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM pending_operations ORDER BY timestamp ASC'
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('op-1');
      expect(result[0].payload).toEqual({ test: 'data' });
    });
  });

  describe('deletePendingOperation', () => {
    beforeEach(async () => {
      await DatabaseService.init();
    });

    it('should delete a pending operation', async () => {
      await DatabaseService.deletePendingOperation('op-1');
      
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'DELETE FROM pending_operations WHERE id = ?',
        ['op-1']
      );
    });
  });

  describe('updatePendingOperationRetry', () => {
    beforeEach(async () => {
      await DatabaseService.init();
    });

    it('should update retry count and error for pending operation', async () => {
      await DatabaseService.updatePendingOperationRetry('op-1', 2, 'Network error');
      
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'UPDATE pending_operations SET retryCount = ?, lastError = ? WHERE id = ?',
        [2, 'Network error', 'op-1']
      );
    });
  });

  describe('clearAllData', () => {
    beforeEach(async () => {
      await DatabaseService.init();
    });

    it('should clear all data from tables', async () => {
      await DatabaseService.clearAllData();
      
      expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM documents'));
      expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM verifications'));
      expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM parcels'));
      expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM pending_operations'));
    });
  });
});
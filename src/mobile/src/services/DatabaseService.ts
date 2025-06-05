/**
 * SQLite database service for offline data storage
 */

import * as SQLite from 'expo-sqlite';
import { DATABASE_CONFIG } from '../constants';
import { Parcel, Verification, Document, PendingOperation } from '../types';

export class DatabaseService {
  private static db: SQLite.SQLiteDatabase | null = null;

  /**
   * Initialize the database and create tables
   */
  static async init(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync(DATABASE_CONFIG.NAME);
      await this.createTables();
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private static async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
      PRAGMA journal_mode = WAL;
      
      -- Parcels table
      CREATE TABLE IF NOT EXISTS parcels (
        id TEXT PRIMARY KEY,
        parcelNumber TEXT NOT NULL,
        ownerId TEXT NOT NULL,
        ownerName TEXT NOT NULL,
        location TEXT NOT NULL,
        boundaries TEXT NOT NULL,
        area REAL NOT NULL,
        landUse TEXT NOT NULL,
        verificationStatus TEXT NOT NULL,
        registrationDate TEXT NOT NULL,
        lastUpdated TEXT NOT NULL,
        localChanges INTEGER DEFAULT 0,
        syncStatus TEXT
      );

      -- Verifications table
      CREATE TABLE IF NOT EXISTS verifications (
        id TEXT PRIMARY KEY,
        parcelId TEXT NOT NULL,
        type TEXT NOT NULL,
        signatory TEXT NOT NULL,
        signature TEXT,
        biometricData TEXT,
        timestamp TEXT NOT NULL,
        location TEXT NOT NULL,
        status TEXT NOT NULL,
        notes TEXT,
        FOREIGN KEY (parcelId) REFERENCES parcels(id)
      );

      -- Documents table
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        parcelId TEXT NOT NULL,
        type TEXT NOT NULL,
        uri TEXT NOT NULL,
        localUri TEXT,
        hash TEXT NOT NULL,
        uploadedAt TEXT NOT NULL,
        uploadedBy TEXT NOT NULL,
        verified INTEGER DEFAULT 0,
        metadata TEXT,
        FOREIGN KEY (parcelId) REFERENCES parcels(id)
      );

      -- Pending operations table for sync
      CREATE TABLE IF NOT EXISTS pending_operations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        entityType TEXT NOT NULL,
        entityId TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        retryCount INTEGER DEFAULT 0,
        lastError TEXT
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_parcels_owner ON parcels(ownerId);
      CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels(verificationStatus);
      CREATE INDEX IF NOT EXISTS idx_verifications_parcel ON verifications(parcelId);
      CREATE INDEX IF NOT EXISTS idx_documents_parcel ON documents(parcelId);
      CREATE INDEX IF NOT EXISTS idx_pending_operations_timestamp ON pending_operations(timestamp);
    `);
  }

  /**
   * Save a parcel to the database
   */
  static async saveParcel(parcel: Parcel): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const statement = await this.db.prepareAsync(
      `INSERT OR REPLACE INTO parcels 
       (id, parcelNumber, ownerId, ownerName, location, boundaries, area, 
        landUse, verificationStatus, registrationDate, lastUpdated, localChanges, syncStatus)
       VALUES ($id, $parcelNumber, $ownerId, $ownerName, $location, $boundaries, 
               $area, $landUse, $verificationStatus, $registrationDate, $lastUpdated, 
               $localChanges, $syncStatus)`
    );

    try {
      await statement.executeAsync({
        $id: parcel.id,
        $parcelNumber: parcel.parcelNumber,
        $ownerId: parcel.ownerId,
        $ownerName: parcel.ownerName,
        $location: JSON.stringify(parcel.location),
        $boundaries: JSON.stringify(parcel.boundaries),
        $area: parcel.area,
        $landUse: parcel.landUse,
        $verificationStatus: parcel.verificationStatus,
        $registrationDate: parcel.registrationDate,
        $lastUpdated: parcel.lastUpdated,
        $localChanges: parcel.localChanges ? 1 : 0,
        $syncStatus: JSON.stringify(parcel.syncStatus),
      });
    } finally {
      await statement.finalizeAsync();
    }
  }

  /**
   * Get a parcel by ID
   */
  static async getParcel(id: string): Promise<Parcel | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync<any>(
      'SELECT * FROM parcels WHERE id = ?',
      [id]
    );

    if (!result) return null;

    return this.mapToParcel(result);
  }

  /**
   * Get all parcels
   */
  static async getAllParcels(): Promise<Parcel[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync<any>('SELECT * FROM parcels ORDER BY lastUpdated DESC');
    return results.map(this.mapToParcel);
  }

  /**
   * Get parcels by owner
   */
  static async getParcelsByOwner(ownerId: string): Promise<Parcel[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync<any>(
      'SELECT * FROM parcels WHERE ownerId = ? ORDER BY lastUpdated DESC',
      [ownerId]
    );
    return results.map(this.mapToParcel);
  }

  /**
   * Save a verification
   */
  static async saveVerification(verification: Verification): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const statement = await this.db.prepareAsync(
      `INSERT OR REPLACE INTO verifications 
       (id, parcelId, type, signatory, signature, biometricData, timestamp, 
        location, status, notes)
       VALUES ($id, $parcelId, $type, $signatory, $signature, $biometricData, 
               $timestamp, $location, $status, $notes)`
    );

    try {
      await statement.executeAsync({
        $id: verification.id,
        $parcelId: verification.parcelId,
        $type: verification.type,
        $signatory: JSON.stringify(verification.signatory),
        $signature: verification.signature,
        $biometricData: JSON.stringify(verification.biometricData),
        $timestamp: verification.timestamp,
        $location: JSON.stringify(verification.location),
        $status: verification.status,
        $notes: verification.notes,
      });
    } finally {
      await statement.finalizeAsync();
    }
  }

  /**
   * Get verifications for a parcel
   */
  static async getVerificationsByParcel(parcelId: string): Promise<Verification[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync<any>(
      'SELECT * FROM verifications WHERE parcelId = ? ORDER BY timestamp DESC',
      [parcelId]
    );

    return results.map(this.mapToVerification);
  }

  /**
   * Add a pending operation for sync
   */
  static async addPendingOperation(operation: Omit<PendingOperation, 'id'>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const id = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.db.runAsync(
      `INSERT INTO pending_operations 
       (id, type, entityType, entityId, payload, timestamp, retryCount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        operation.type,
        operation.entityType,
        operation.entityId,
        JSON.stringify(operation.payload),
        operation.timestamp,
        0
      ]
    );
  }

  /**
   * Get pending operations
   */
  static async getPendingOperations(): Promise<PendingOperation[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync<any>(
      'SELECT * FROM pending_operations ORDER BY timestamp ASC'
    );

    return results.map((row: any) => ({
      id: row.id,
      type: row.type,
      entityType: row.entityType,
      entityId: row.entityId,
      payload: JSON.parse(row.payload),
      timestamp: row.timestamp,
      retryCount: row.retryCount,
      lastError: row.lastError,
    }));
  }

  /**
   * Delete a pending operation
   */
  static async deletePendingOperation(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync('DELETE FROM pending_operations WHERE id = ?', [id]);
  }

  /**
   * Update retry count for a pending operation
   */
  static async updatePendingOperationRetry(id: string, retryCount: number, lastError: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      'UPDATE pending_operations SET retryCount = ?, lastError = ? WHERE id = ?',
      [retryCount, lastError, id]
    );
  }

  /**
   * Clear all local data (use with caution)
   */
  static async clearAllData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
      DELETE FROM documents;
      DELETE FROM verifications;
      DELETE FROM parcels;
      DELETE FROM pending_operations;
    `);
  }

  /**
   * Map database row to Parcel object
   */
  private static mapToParcel(row: any): Parcel {
    return {
      id: row.id,
      parcelNumber: row.parcelNumber,
      ownerId: row.ownerId,
      ownerName: row.ownerName,
      location: JSON.parse(row.location),
      boundaries: JSON.parse(row.boundaries),
      area: row.area,
      landUse: row.landUse,
      documents: [], // Will be loaded separately if needed
      verificationStatus: row.verificationStatus,
      verifications: [], // Will be loaded separately if needed
      registrationDate: row.registrationDate,
      lastUpdated: row.lastUpdated,
      localChanges: row.localChanges === 1,
      syncStatus: row.syncStatus ? JSON.parse(row.syncStatus) : undefined,
    };
  }

  /**
   * Map database row to Verification object
   */
  private static mapToVerification(row: any): Verification {
    return {
      id: row.id,
      parcelId: row.parcelId,
      type: row.type,
      signatory: JSON.parse(row.signatory),
      signature: row.signature,
      biometricData: row.biometricData ? JSON.parse(row.biometricData) : undefined,
      timestamp: row.timestamp,
      location: JSON.parse(row.location),
      status: row.status,
      notes: row.notes,
    };
  }
}
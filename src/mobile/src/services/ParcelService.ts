/**
 * Service for managing parcel operations with offline support
 */

import { v4 as uuidv4 } from 'uuid';
import { ApiService } from './ApiService';
import { DatabaseService } from './DatabaseService';
import { OfflineSyncService } from './OfflineSyncService';
import { Parcel, PendingOperation } from '../types';

export class ParcelService {
  /**
   * Create a new parcel (works offline)
   */
  static async createParcel(parcelData: Partial<Parcel>): Promise<Parcel> {
    const isOffline = await OfflineSyncService.isOffline();
    
    // Generate local ID if offline
    const parcel: Parcel = {
      id: parcelData.id || `local_${uuidv4()}`,
      parcelNumber: parcelData.parcelNumber || '',
      ownerId: parcelData.ownerId || '',
      ownerName: parcelData.ownerName || '',
      location: parcelData.location!,
      boundaries: parcelData.boundaries || [],
      area: parcelData.area || 0,
      landUse: parcelData.landUse || 'residential',
      documents: parcelData.documents || [],
      verificationStatus: parcelData.verificationStatus || 'DRAFT',
      verifications: parcelData.verifications || [],
      registrationDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      localChanges: isOffline,
      syncStatus: isOffline ? { 
        syncInProgress: false, 
        pendingChanges: 1, 
        lastSyncedAt: undefined 
      } : undefined,
    };

    if (isOffline) {
      // Save to local database
      await DatabaseService.saveParcel(parcel);
      
      // Add to pending operations
      await DatabaseService.addPendingOperation({
        type: 'CREATE',
        entityType: 'parcel',
        entityId: parcel.id,
        payload: parcel,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
      
      return parcel;
    } else {
      // Create on server
      try {
        const serverParcel = await ApiService.createParcel(parcel);
        // Save to local database for offline access
        await DatabaseService.saveParcel(serverParcel);
        return serverParcel;
      } catch (error) {
        // If server fails, fall back to offline mode
        console.error('Failed to create parcel on server, saving locally:', error);
        parcel.localChanges = true;
        await DatabaseService.saveParcel(parcel);
        await DatabaseService.addPendingOperation({
          type: 'CREATE',
          entityType: 'parcel',
          entityId: parcel.id,
          payload: parcel,
          timestamp: new Date().toISOString(),
          retryCount: 0,
        });
        return parcel;
      }
    }
  }

  /**
   * Update a parcel (works offline)
   */
  static async updateParcel(id: string, updates: Partial<Parcel>): Promise<Parcel> {
    const isOffline = await OfflineSyncService.isOffline();
    
    // Get existing parcel
    let parcel = await DatabaseService.getParcel(id);
    if (!parcel) {
      throw new Error('Parcel not found');
    }

    // Apply updates
    parcel = {
      ...parcel,
      ...updates,
      lastUpdated: new Date().toISOString(),
      localChanges: true,
    };

    if (isOffline) {
      // Save to local database
      await DatabaseService.saveParcel(parcel);
      
      // Add to pending operations
      await DatabaseService.addPendingOperation({
        type: 'UPDATE',
        entityType: 'parcel',
        entityId: parcel.id,
        payload: updates,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
      
      return parcel;
    } else {
      // Update on server
      try {
        const serverParcel = await ApiService.updateParcel(id, updates);
        // Update local database
        await DatabaseService.saveParcel(serverParcel);
        return serverParcel;
      } catch (error) {
        // If server fails, fall back to offline mode
        console.error('Failed to update parcel on server, saving locally:', error);
        await DatabaseService.saveParcel(parcel);
        await DatabaseService.addPendingOperation({
          type: 'UPDATE',
          entityType: 'parcel',
          entityId: parcel.id,
          payload: updates,
          timestamp: new Date().toISOString(),
          retryCount: 0,
        });
        return parcel;
      }
    }
  }

  /**
   * Get user's parcels (works offline)
   */
  static async getUserParcels(userId: string): Promise<Parcel[]> {
    const isOffline = await OfflineSyncService.isOffline();
    
    if (isOffline) {
      // Get from local database
      return await DatabaseService.getParcelsByOwner(userId);
    } else {
      // Try to get from server
      try {
        const parcels = await ApiService.getParcels({ ownerId: userId });
        
        // Update local database
        for (const parcel of parcels) {
          await DatabaseService.saveParcel(parcel);
        }
        
        return parcels;
      } catch (error) {
        // Fall back to local database
        console.error('Failed to fetch parcels from server, using local data:', error);
        return await DatabaseService.getParcelsByOwner(userId);
      }
    }
  }

  /**
   * Get a single parcel (works offline)
   */
  static async getParcel(id: string): Promise<Parcel | null> {
    const isOffline = await OfflineSyncService.isOffline();
    
    if (isOffline) {
      // Get from local database
      return await DatabaseService.getParcel(id);
    } else {
      // Try to get from server
      try {
        const parcel = await ApiService.getParcel(id);
        
        // Update local database
        if (parcel) {
          await DatabaseService.saveParcel(parcel);
        }
        
        return parcel;
      } catch (error) {
        // Fall back to local database
        console.error('Failed to fetch parcel from server, using local data:', error);
        return await DatabaseService.getParcel(id);
      }
    }
  }

  /**
   * Delete a parcel (works offline)
   */
  static async deleteParcel(id: string): Promise<void> {
    const isOffline = await OfflineSyncService.isOffline();
    
    if (isOffline) {
      // Mark for deletion in pending operations
      await DatabaseService.addPendingOperation({
        type: 'DELETE',
        entityType: 'parcel',
        entityId: id,
        payload: { id },
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
      
      // Remove from local database
      // Note: In a real app, you might want to mark as deleted instead
      // to handle sync conflicts better
    } else {
      // Delete on server
      try {
        await ApiService.deleteParcel(id);
        // Remove from local database
        // await DatabaseService.deleteParcel(id);
      } catch (error) {
        // If server fails, add to pending operations
        console.error('Failed to delete parcel on server, queuing for later:', error);
        await DatabaseService.addPendingOperation({
          type: 'DELETE',
          entityType: 'parcel',
          entityId: id,
          payload: { id },
          timestamp: new Date().toISOString(),
          retryCount: 0,
        });
      }
    }
  }

  /**
   * Search parcels by location (works offline with limited functionality)
   */
  static async searchByLocation(latitude: number, longitude: number, radius: number): Promise<Parcel[]> {
    const isOffline = await OfflineSyncService.isOffline();
    
    if (isOffline) {
      // Get all parcels from local database and filter by distance
      const allParcels = await DatabaseService.getAllParcels();
      
      return allParcels.filter(parcel => {
        const distance = this.calculateDistance(
          latitude, 
          longitude, 
          parcel.location.latitude, 
          parcel.location.longitude
        );
        return distance <= radius;
      });
    } else {
      // Search on server
      try {
        return await ApiService.getParcels({ 
          latitude, 
          longitude, 
          radius 
        });
      } catch (error) {
        // Fall back to local search
        console.error('Failed to search parcels on server, using local data:', error);
        const allParcels = await DatabaseService.getAllParcels();
        
        return allParcels.filter(parcel => {
          const distance = this.calculateDistance(
            latitude, 
            longitude, 
            parcel.location.latitude, 
            parcel.location.longitude
          );
          return distance <= radius;
        });
      }
    }
  }

  /**
   * Calculate distance between two points (in meters)
   */
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
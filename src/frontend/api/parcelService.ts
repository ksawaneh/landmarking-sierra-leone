import { api } from './axios';
import syncService from '../services/syncService';

export type Document = {
  id: string;
  parcel_id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  upload_date: string;
  status: 'pending' | 'verified' | 'rejected';
  metadata?: Record<string, any>;
};

export type Parcel = {
  id: string;
  parcel_number: string;
  status: 'draft' | 'pending' | 'verified' | 'disputed' | 'rejected';
  land_use: string;
  area_sqm: number;
  created_at: string;
  created_by: string;
  geometry: {
    type: string;
    coordinates: any;
  };
  metadata?: Record<string, any>;
  documents?: Document[];
};

export type CreateParcelPayload = {
  land_use: string;
  geometry: {
    type: string;
    coordinates: any;
  };
  metadata?: Record<string, any>;
  community_id?: string;
};

export type UpdateParcelPayload = {
  land_use?: string;
  geometry?: {
    type: string;
    coordinates: any;
  };
  status?: 'draft' | 'pending' | 'verified' | 'disputed' | 'rejected';
  metadata?: Record<string, any>;
};

export type VerifyParcelPayload = { 
  comments?: string;
  verification_type: 'community' | 'authority' | 'government';
  status?: string;
  metadata?: Record<string, any>;
};

export const parcelService = {
  /**
   * Get a list of all parcels
   */
  async getParcels(params?: { 
    user_id?: string; 
    status?: string; 
    land_use?: string;
  }) {
    const response = await api.get('/parcels', { params });
    return response.data;
  },

  /**
   * Get a single parcel by ID
   */
  async getParcel(id: string) {
    const response = await api.get(`/parcels/${id}`);
    return response.data;
  },

  /**
   * Create a new parcel with offline support
   */
  async createParcel(data: CreateParcelPayload) {
    return syncService.createParcelWithOfflineSupport(data);
  },

  /**
   * Update an existing parcel with offline support
   */
  async updateParcel(id: string, data: UpdateParcelPayload) {
    return syncService.updateParcelWithOfflineSupport(id, data);
  },

  /**
   * Delete a parcel
   */
  async deleteParcel(id: string) {
    const response = await api.delete(`/parcels/${id}`);
    return response.data;
  },

  /**
   * Verify a parcel (request verification) with offline support
   */
  async verifyParcel(id: string, data: VerifyParcelPayload) {
    if (navigator.onLine) {
      try {
        const response = await api.post(`/parcels/${id}/verify`, data);
        
        // Update cached version with verification status
        const parcel = response.data.parcel;
        if (parcel) {
          offlineSync.cacheParcel(parcel);
        }
        
        return response.data;
      } catch (error) {
        console.error('Error verifying parcel:', error);
        // Fall back to offline handling
        return this.queueVerifyParcel(id, data);
      }
    } else {
      // Offline mode - queue for later sync
      return this.queueVerifyParcel(id, data);
    }
  },
  
  /**
   * Queue a verification for offline sync
   */
  queueVerifyParcel(id: string, data: VerifyParcelPayload) {
    // Get cached parcel
    const cachedParcel = offlineSync.getCachedParcel(id);
    if (!cachedParcel) {
      throw new Error('Cannot verify a parcel that is not in the cache');
    }
    
    // Update the parcel with verification data
    const updatedParcel = {
      ...cachedParcel,
      status: data.status || cachedParcel.status,
      verification: {
        ...data,
        pending_sync: true,
        created_at: new Date().toISOString()
      }
    };
    
    // Queue the operation for sync
    const operationId = offlineSync.addPendingOperation(
      'UPDATE',
      `/parcels/${id}/verify`,
      data,
      id
    );
    
    // Update the cache
    offlineSync.cacheParcel(updatedParcel);
    
    // Return a response that mimics the API response
    return {
      success: true,
      message: 'Verification queued for sync',
      parcel: updatedParcel,
      is_offline_pending: true,
      operationId
    };
  },

  /**
   * Get all documents for a parcel
   */
  async getParcelDocuments(parcelId: string) {
    const response = await api.get(`/parcels/${parcelId}/documents`);
    return response.data;
  },

  /**
   * Upload a document for a parcel
   */
  async uploadDocument(parcelId: string, file: File, metadata?: Record<string, any>) {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    // Handle offline upload using service worker if needed
    if (!navigator.onLine) {
      return syncService.queueDocumentUpload(parcelId, file, metadata);
    }

    const response = await api.post(`/parcels/${parcelId}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },

  /**
   * Delete a document
   */
  async deleteDocument(parcelId: string, documentId: string) {
    const response = await api.delete(`/parcels/${parcelId}/documents/${documentId}`);
    return response.data;
  },

  /**
   * Update a document's metadata
   */
  async updateDocument(parcelId: string, documentId: string, data: {
    status?: 'pending' | 'verified' | 'rejected';
    metadata?: Record<string, any>;
  }) {
    const response = await api.patch(`/parcels/${parcelId}/documents/${documentId}`, data);
    return response.data;
  }
};

export default parcelService;
/**
 * Sync Service
 * 
 * Handles synchronization of offline changes when the application comes back online,
 * with advanced conflict resolution using a CRDT-inspired approach
 */

import { api } from '../api/axios';
import { offlineSync } from './offlineSync';
import { v4 as uuidv4 } from 'uuid';

// Types for advanced conflict resolution
interface VersionVector {
  [deviceId: string]: number;
}

interface EntityMetadata {
  id: string;
  versionVector: VersionVector;
  lastModified: number;
  deviceId: string;
  localChanges?: Record<string, any>;
  changeLog: Change[];
}

interface Change {
  id: string;
  fieldName: string;
  value: any;
  timestamp: number;
  deviceId: string;
}

// Get or create a unique device ID
const getDeviceId = (): string => {
  if (typeof localStorage === 'undefined') return 'unknown-device';
  
  let deviceId = localStorage.getItem('landmarking_device_id');
  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem('landmarking_device_id', deviceId);
  }
  return deviceId;
};

// Store a registry of entity metadata for conflict resolution
const entityRegistry = new Map<string, EntityMetadata>();

export const syncService = {
  /**
   * Start synchronizing all pending operations with conflict resolution
   */
  startSync: async (): Promise<{
    success: boolean;
    synced: number;
    conflicts: number;
    errors: number;
  }> => {
    // If not online, don't attempt to sync
    if (!offlineSync.isOnline()) {
      console.log('Cannot sync: Application is offline');
      return { success: false, synced: 0, conflicts: 0, errors: 0 };
    }
    
    console.log('Starting synchronization with conflict resolution...');
    
    // Get all pending operations
    const operations = offlineSync.getPendingOperations();
    
    if (operations.length === 0) {
      console.log('No pending operations to sync');
      return { success: true, synced: 0, conflicts: 0, errors: 0 };
    }
    
    console.log(`Found ${operations.length} operations to sync`);
    
    // Sort operations by timestamp (oldest first)
    const sortedOperations = [...operations].sort((a, b) => a.timestamp - b.timestamp);
    
    let syncedCount = 0;
    let conflictCount = 0;
    let errorCount = 0;
    
    // First, fetch the current state from server for all entities we'll update
    // This is done for conflict detection and resolution
    const entitiesToFetch = new Set<string>();
    
    sortedOperations.forEach(op => {
      if (op.entityId && (op.type === 'UPDATE' || op.type === 'DELETE')) {
        entitiesToFetch.add(op.entityId);
      }
    });
    
    // Fetch current state for all entities we'll update
    if (entitiesToFetch.size > 0) {
      await Promise.all(
        Array.from(entitiesToFetch).map(async (entityId) => {
          try {
            // Skip temporary IDs
            if (entityId.startsWith('temp_')) return;
            
            const response = await api.get(`/parcels/${entityId}`);
            const serverEntity = response.data.parcel;
            
            if (serverEntity) {
              // Store server version for conflict resolution
              syncService.trackEntity(entityId, serverEntity);
            }
          } catch (error) {
            console.warn(`Couldn't fetch current state for entity ${entityId}:`, error);
            // We'll continue anyway and handle conflicts as they arise
          }
        })
      );
    }
    
    // Process each operation
    for (const operation of sortedOperations) {
      try {
        // Update status to syncing
        offlineSync.updateOperationStatus(operation.id, 'syncing');
        
        // Process the operation based on type with conflict resolution
        switch (operation.type) {
          case 'CREATE':
            await syncService.processCreateOperation(operation);
            break;
            
          case 'UPDATE':
            if (!operation.entityId) {
              throw new Error('Entity ID is required for update operations');
            }
            
            // Check for special verification endpoint
            if (operation.endpoint.includes('/verify')) {
              await syncService.processVerificationOperation(operation);
            } else {
              // Handle conflict resolution for updates
              const wasConflict = await syncService.processUpdateOperation(operation);
              if (wasConflict) conflictCount++;
            }
            break;
            
          case 'DELETE':
            if (!operation.entityId) {
              throw new Error('Entity ID is required for delete operations');
            }
            await syncService.processDeleteOperation(operation);
            break;
            
          default:
            throw new Error(`Unknown operation type: ${operation.type}`);
        }
        
        // Operation completed successfully, remove it
        offlineSync.removeOperation(operation.id);
        syncedCount++;
        console.log(`Operation ${operation.id} synchronized successfully`);
        
      } catch (error) {
        console.error(`Error syncing operation ${operation.id}:`, error);
        
        // Update operation status to error
        offlineSync.updateOperationStatus(
          operation.id,
          'error',
          error instanceof Error ? error.message : 'Unknown error'
        );
        errorCount++;
      }
    }
    
    // Update last sync timestamp
    offlineSync.setLastSync(Date.now());
    console.log('Synchronization completed with conflict resolution');
    
    // Fetch and merge any server changes we don't have
    await syncService.pullServerChanges();
    
    return {
      success: errorCount === 0,
      synced: syncedCount,
      conflicts: conflictCount,
      errors: errorCount
    };
  },
  
  /**
   * Process create operation with conflict awareness
   */
  async processCreateOperation(operation: any): Promise<void> {
    // For temp IDs, we need to handle this differently
    const isTempId = operation.entityId?.startsWith('temp_');
    
    // Add device ID and timestamp metadata
    const deviceId = getDeviceId();
    const timestamp = Date.now();
    
    // Enhance payload with metadata for conflict resolution
    const enhancedPayload = {
      ...operation.payload,
      _deviceId: deviceId,
      _timestamp: timestamp,
      _operationId: operation.id
    };
    
    // If it's a temp ID, we need to remove that from the server payload
    if (isTempId && enhancedPayload.id === operation.entityId) {
      delete enhancedPayload.id;
    }
    
    // Send to server
    const response = await api.post(operation.endpoint, enhancedPayload);
    const serverEntity = response.data.parcel || response.data;
    
    // Track this entity for conflict resolution
    syncService.trackEntity(serverEntity.id, serverEntity);
    
    // If this was a temporary ID, we need to update references
    if (isTempId) {
      syncService.resolveTempId(operation.entityId, serverEntity.id);
    }
    
    // Cache the server response
    offlineSync.cacheParcel(serverEntity);
  },
  
  /**
   * Process update operation with conflict resolution
   * Returns true if a conflict was detected and resolved
   */
  async processUpdateOperation(operation: any): Promise<boolean> {
    // Skip if this is a temp ID that hasn't been resolved
    if (operation.entityId.startsWith('temp_')) {
      console.warn(`Skipping update for unresolved temp ID: ${operation.entityId}`);
      return false;
    }
    
    // Add device ID and timestamp metadata
    const deviceId = getDeviceId();
    const timestamp = Date.now();
    
    let hasConflict = false;
    let resolvedPayload = { ...operation.payload };
    
    // Get metadata for this entity (if we have it)
    const metadata = entityRegistry.get(operation.entityId);
    
    // If we have metadata, check for conflicts
    if (metadata) {
      try {
        // Get the latest server version
        const response = await api.get(`${operation.endpoint}/${operation.entityId}`);
        const serverEntity = response.data.parcel || response.data;
        
        // Detect conflicts and resolve them
        const result = syncService.resolveConflicts(
          operation.entityId,
          serverEntity,
          operation.payload
        );
        
        hasConflict = result.hasConflict;
        resolvedPayload = result.resolvedData;
        
        // Update the server with the resolved data
        const updateResponse = await api.put(
          `${operation.endpoint}/${operation.entityId}`,
          {
            ...resolvedPayload,
            _deviceId: deviceId,
            _timestamp: timestamp,
            _operationId: operation.id
          }
        );
        
        // Update our registry and cache
        const updatedEntity = updateResponse.data.parcel || updateResponse.data;
        syncService.trackEntity(operation.entityId, updatedEntity);
        offlineSync.cacheParcel(updatedEntity);
        
      } catch (error) {
        // If 404, the entity might have been deleted
        if (error.response && error.response.status === 404) {
          console.warn(`Entity ${operation.entityId} not found on server, might have been deleted`);
          // Remove from local cache and registry
          offlineSync.removeCachedParcel(operation.entityId);
          entityRegistry.delete(operation.entityId);
          throw new Error(`Entity ${operation.entityId} not found on server`);
        }
        throw error;
      }
    } else {
      // No metadata, just do a basic update
      const updateResponse = await api.put(
        `${operation.endpoint}/${operation.entityId}`,
        {
          ...resolvedPayload,
          _deviceId: deviceId,
          _timestamp: timestamp,
          _operationId: operation.id
        }
      );
      
      // Cache the result
      const updatedEntity = updateResponse.data.parcel || updateResponse.data;
      syncService.trackEntity(operation.entityId, updatedEntity);
      offlineSync.cacheParcel(updatedEntity);
    }
    
    return hasConflict;
  },
  
  /**
   * Process delete operation
   */
  async processDeleteOperation(operation: any): Promise<void> {
    // Skip if this is a temp ID that hasn't been resolved
    if (operation.entityId.startsWith('temp_')) {
      console.warn(`Skipping delete for unresolved temp ID: ${operation.entityId}`);
      return;
    }
    
    try {
      // Check if the entity exists first
      await api.get(`${operation.endpoint}/${operation.entityId}`);
      
      // It exists, send delete request
      await api.delete(`${operation.endpoint}/${operation.entityId}`);
    } catch (error) {
      // If 404, it's already gone which is fine
      if (error.response && error.response.status === 404) {
        console.log(`Entity ${operation.entityId} already deleted on server`);
      } else {
        throw error;
      }
    }
    
    // Remove from local cache and registry
    offlineSync.removeCachedParcel(operation.entityId);
    entityRegistry.delete(operation.entityId);
  },
  
  /**
   * Process verification operation
   * This handles syncing parcel verifications that were done offline
   */
  async processVerificationOperation(operation: any): Promise<void> {
    // Skip if this is a temp ID that hasn't been resolved
    if (operation.entityId.startsWith('temp_')) {
      console.warn(`Skipping verification for unresolved temp ID: ${operation.entityId}`);
      return;
    }
    
    const deviceId = getDeviceId();
    const timestamp = Date.now();
    
    try {
      // Special handling for verification endpoint
      const verificationEndpoint = `${operation.endpoint.split('/verify')[0]}/${operation.entityId}/verify`;
      
      // Add metadata to the verification
      const enhancedPayload = {
        ...operation.payload,
        _deviceId: deviceId,
        _timestamp: timestamp,
        _operationId: operation.id,
        _syncedAt: new Date().toISOString()
      };
      
      // Send verification to server
      const response = await api.post(verificationEndpoint, enhancedPayload);
      
      // Update cache if we got a response
      const updatedEntity = response.data.parcel || response.data;
      if (updatedEntity) {
        // Track the entity
        syncService.trackEntity(operation.entityId, updatedEntity);
        
        // Update the cache
        offlineSync.cacheParcel(updatedEntity);
      }
    } catch (error) {
      // Handle 404 (parcel doesn't exist)
      if (error.response && error.response.status === 404) {
        console.warn(`Entity ${operation.entityId} not found on server, cannot verify`);
        // Remove from local cache and registry
        offlineSync.removeCachedParcel(operation.entityId);
        entityRegistry.delete(operation.entityId);
      } else if (error.response && error.response.status === 409) {
        // Handle conflict (parcel already verified/disputed)
        console.warn(`Entity ${operation.entityId} has a verification conflict`);
        
        // Try to get the latest state
        try {
          const response = await api.get(`${operation.endpoint.split('/verify')[0]}/${operation.entityId}`);
          const serverEntity = response.data.parcel || response.data;
          
          // Update our local cache with server version
          syncService.trackEntity(operation.entityId, serverEntity);
          offlineSync.cacheParcel(serverEntity);
        } catch (fetchError) {
          console.error(`Failed to fetch latest state for ${operation.entityId}:`, fetchError);
        }
      } else {
        throw error;
      }
    }
  },
  
  /**
   * Track an entity for conflict resolution
   */
  trackEntity(entityId: string, data: any): void {
    const deviceId = getDeviceId();
    const timestamp = Date.now();
    
    // Get or create metadata
    let metadata = entityRegistry.get(entityId);
    
    if (!metadata) {
      // Initialize new metadata
      metadata = {
        id: entityId,
        versionVector: { [deviceId]: 1 },
        lastModified: timestamp,
        deviceId: data._deviceId || deviceId,
        changeLog: []
      };
    } else {
      // Update version vector
      if (!metadata.versionVector[deviceId]) {
        metadata.versionVector[deviceId] = 1;
      } else {
        metadata.versionVector[deviceId]++;
      }
      
      metadata.lastModified = timestamp;
    }
    
    // Record this change in the change log
    const changedFields = detectChangedFields(metadata, data);
    
    changedFields.forEach(field => {
      metadata!.changeLog.push({
        id: uuidv4(),
        fieldName: field,
        value: data[field],
        timestamp,
        deviceId: data._deviceId || deviceId
      });
    });
    
    // Trim change log to prevent it from growing too large
    if (metadata.changeLog.length > 50) {
      metadata.changeLog = metadata.changeLog.slice(-50);
    }
    
    // Update registry
    entityRegistry.set(entityId, metadata);
  },
  
  /**
   * Resolve a temporary ID with the real server ID
   */
  resolveTempId(tempId: string, serverId: string): void {
    console.log(`Resolving temp ID ${tempId} to server ID ${serverId}`);
    
    // Update any pending operations that reference this temp ID
    const operations = offlineSync.getPendingOperations();
    let hasUpdates = false;
    
    const updatedOps = operations.map(op => {
      if (op.entityId === tempId) {
        hasUpdates = true;
        return { ...op, entityId: serverId };
      }
      return op;
    });
    
    if (hasUpdates) {
      offlineSync.savePendingOperations(updatedOps);
    }
    
    // Update any cached parcels that might reference this ID
    const cachedItem = offlineSync.getCachedParcel(tempId);
    if (cachedItem) {
      const updatedItem = { ...cachedItem, id: serverId };
      offlineSync.removeCachedParcel(tempId);
      offlineSync.cacheParcel(updatedItem);
    }
  },
  
  /**
   * Resolve conflicts between local and server versions
   */
  resolveConflicts(
    entityId: string,
    serverData: any,
    localChanges: any
  ): { hasConflict: boolean; resolvedData: any } {
    let hasConflict = false;
    const resolvedData = { ...serverData };
    
    // Get the metadata if available
    const metadata = entityRegistry.get(entityId);
    if (!metadata) {
      // No metadata, just use local changes
      return {
        hasConflict: false,
        resolvedData: { ...serverData, ...localChanges }
      };
    }
    
    // Detect changed fields in both versions
    const serverChangedFields = new Set<string>();
    const localChangedFields = new Set<string>(Object.keys(localChanges));
    
    // Get the fields that were changed on both sides
    const conflictFields = [...localChangedFields].filter(field => 
      serverChangedFields.has(field)
    );
    
    if (conflictFields.length > 0) {
      hasConflict = true;
      
      // Resolve each conflict field
      conflictFields.forEach(field => {
        // Get the most recent change for this field from the change log
        const fieldChanges = metadata.changeLog
          .filter(change => change.fieldName === field)
          .sort((a, b) => b.timestamp - a.timestamp);
        
        if (fieldChanges.length > 0) {
          // Use the most recent change
          resolvedData[field] = fieldChanges[0].value;
        } else {
          // If no history, prefer local changes
          resolvedData[field] = localChanges[field];
        }
      });
    }
    
    // Apply non-conflicting local changes
    Object.keys(localChanges).forEach(field => {
      if (!conflictFields.includes(field)) {
        resolvedData[field] = localChanges[field];
      }
    });
    
    return { hasConflict, resolvedData };
  },
  
  /**
   * Pull and integrate server changes
   */
  async pullServerChanges(): Promise<void> {
    if (!offlineSync.isOnline()) return;
    
    const lastSync = offlineSync.getLastSync();
    
    try {
      // Request changes since last sync
      const response = await api.get(`/api/v1/parcels/changes?since=${lastSync}`);
      const changes = response.data.changes || [];
      
      // Process each change
      for (const change of changes) {
        // Skip our own changes to avoid duplication
        if (change._deviceId === getDeviceId()) continue;
        
        // Process based on change type
        switch (change.changeType) {
          case 'create':
          case 'update':
            // Get the existing cached version if any
            const cachedEntity = offlineSync.getCachedParcel(change.entityId);
            
            if (cachedEntity) {
              // Resolve any conflicts with local version
              const resolved = syncService.resolveConflicts(
                change.entityId,
                change.data,
                {}
              );
              
              // Update cache with resolved version
              offlineSync.cacheParcel(resolved.resolvedData);
            } else {
              // No local version, just cache it
              offlineSync.cacheParcel(change.data);
            }
            
            // Track this entity for future conflict resolution
            syncService.trackEntity(change.entityId, change.data);
            break;
            
          case 'delete':
            // Remove from cache and registry
            offlineSync.removeCachedParcel(change.entityId);
            entityRegistry.delete(change.entityId);
            break;
        }
      }
      
    } catch (error) {
      console.error('Error pulling server changes:', error);
    }
  },
  
  /**
   * Create a parcel and handle offline scenario
   */
  createParcelWithOfflineSupport: async (payload: any): Promise<any> => {
    // If online, make the API call directly
    if (offlineSync.isOnline()) {
      try {
        const response = await api.post('/parcels', payload);
        const parcelData = response.data.parcel || response.data;
        
        // Track for conflict resolution
        syncService.trackEntity(parcelData.id, parcelData);
        
        // Cache the created parcel
        offlineSync.cacheParcel(parcelData);
        
        return response.data;
      } catch (error) {
        // If there's an error with the API call, try to handle it offline
        console.error('Error creating parcel:', error);
        return syncService.queueCreateParcel(payload);
      }
    } else {
      // If offline, queue the operation
      return syncService.queueCreateParcel(payload);
    }
  },
  
  /**
   * Queue a create parcel operation for offline handling
   */
  queueCreateParcel: (payload: any): any => {
    // Generate a temporary ID for the parcel
    const tempId = `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const deviceId = getDeviceId();
    const timestamp = Date.now();
    
    // Create a temporary parcel object for the UI
    const tempParcel = {
      id: tempId,
      ...payload,
      status: 'draft',
      created_at: new Date().toISOString(),
      area_sqm: 0, // This would be calculated server-side normally
      parcel_number: `TEMP-${tempId.substring(0, 8)}`, // Temporary parcel number
      created_by: 'current_user', // This would normally come from the server
      is_offline_pending: true,
      _deviceId: deviceId,
      _timestamp: timestamp
    };
    
    // Queue the operation
    const operationId = offlineSync.addPendingOperation('CREATE', '/parcels', payload, tempId);
    
    // Track this entity for conflict resolution
    syncService.trackEntity(tempId, tempParcel);
    
    // Cache the temporary parcel
    offlineSync.cacheParcel(tempParcel);
    
    // Return a response that mimics the API response
    return {
      success: true,
      parcel: tempParcel,
      is_offline_pending: true,
      operationId
    };
  },
  
  /**
   * Update a parcel with offline support and conflict awareness
   */
  updateParcelWithOfflineSupport: async (id: string, payload: any): Promise<any> => {
    // If online, make the API call directly
    if (offlineSync.isOnline()) {
      try {
        // Check for conflicts first if this is a known entity
        if (entityRegistry.has(id)) {
          // Get latest from server
          const checkResponse = await api.get(`/parcels/${id}`);
          const serverData = checkResponse.data.parcel || checkResponse.data;
          
          // Resolve any conflicts
          const { resolvedData, hasConflict } = syncService.resolveConflicts(
            id,
            serverData,
            payload
          );
          
          if (hasConflict) {
            console.log(`Resolved conflicts for entity ${id} automatically`);
            // Use the resolved data instead
            payload = resolvedData;
          }
        }
        
        // Add metadata
        const deviceId = getDeviceId();
        const timestamp = Date.now();
        const enhancedPayload = {
          ...payload,
          _deviceId: deviceId,
          _timestamp: timestamp
        };
        
        // Now do the update
        const response = await api.put(`/parcels/${id}`, enhancedPayload);
        const parcelData = response.data.parcel || response.data;
        
        // Track for conflict resolution
        syncService.trackEntity(id, parcelData);
        
        // Update the cached parcel
        offlineSync.cacheParcel(parcelData);
        
        return response.data;
      } catch (error) {
        // If there's an error with the API call, try to handle it offline
        console.error('Error updating parcel:', error);
        return syncService.queueUpdateParcel(id, payload);
      }
    } else {
      // If offline, queue the operation
      return syncService.queueUpdateParcel(id, payload);
    }
  },
  
  /**
   * Queue an update parcel operation for offline handling
   */
  queueUpdateParcel: (id: string, payload: any): any => {
    // Get the existing parcel from cache
    const existingParcel = offlineSync.getCachedParcel(id);
    
    if (!existingParcel) {
      throw new Error('Cannot update a parcel that is not in the cache');
    }
    
    const deviceId = getDeviceId();
    const timestamp = Date.now();
    
    // Create an updated parcel by merging the existing one with changes
    const updatedParcel = {
      ...existingParcel,
      ...payload,
      updated_at: new Date().toISOString(),
      is_offline_pending: true,
      _deviceId: deviceId,
      _timestamp: timestamp
    };
    
    // Queue the operation
    const operationId = offlineSync.addPendingOperation('UPDATE', '/parcels', payload, id);
    
    // Track this update for conflict resolution
    syncService.trackEntity(id, updatedParcel);
    
    // Update the cached parcel
    offlineSync.cacheParcel(updatedParcel);
    
    // Return a response that mimics the API response
    return {
      success: true,
      parcel: updatedParcel,
      is_offline_pending: true,
      operationId
    };
  },
  
  /**
   * Delete a parcel with offline support
   */
  deleteParcelWithOfflineSupport: async (id: string): Promise<any> => {
    // If online, make the API call directly
    if (offlineSync.isOnline()) {
      try {
        const response = await api.delete(`/parcels/${id}`);
        
        // Remove from conflict tracking
        entityRegistry.delete(id);
        
        // Remove from cache
        offlineSync.removeCachedParcel(id);
        
        return response.data;
      } catch (error) {
        // If there's an error with the API call, try to handle it offline
        console.error('Error deleting parcel:', error);
        return syncService.queueDeleteParcel(id);
      }
    } else {
      // If offline, queue the operation
      return syncService.queueDeleteParcel(id);
    }
  },
  
  /**
   * Queue a delete parcel operation for offline handling
   */
  queueDeleteParcel: (id: string): any => {
    // Get the existing parcel from cache to mark as pending deletion
    const existingParcel = offlineSync.getCachedParcel(id);
    
    if (!existingParcel) {
      throw new Error('Cannot delete a parcel that is not in the cache');
    }
    
    // If it's a temporary ID, we can just remove it
    if (id.startsWith('temp_')) {
      offlineSync.removeCachedParcel(id);
      entityRegistry.delete(id);
      
      // Find and remove any pending operations for this temp entity
      const operations = offlineSync.getPendingOperations();
      const filteredOps = operations.filter(op => op.entityId !== id);
      offlineSync.savePendingOperations(filteredOps);
      
      return { success: true };
    }
    
    // Mark the entity as pending deletion
    const updatedParcel = {
      ...existingParcel,
      is_offline_pending: true,
      is_pending_deletion: true,
      updated_at: new Date().toISOString()
    };
    
    // Queue the operation
    const operationId = offlineSync.addPendingOperation('DELETE', '/parcels', {}, id);
    
    // Update the cached parcel to mark it as pending deletion
    offlineSync.cacheParcel(updatedParcel);
    
    // Return a response that mimics the API response
    return {
      success: true,
      is_offline_pending: true,
      operationId
    };
  },
  
  /**
   * Get sync status information
   */
  getSyncStatus: () => {
    return {
      lastSync: offlineSync.getLastSync(),
      pendingOperations: offlineSync.getPendingOperationsCount(),
      isOnline: offlineSync.isOnline(),
      entitiesTracked: entityRegistry.size
    };
  },
  
  /**
   * Initialize the sync service
   */
  initialize: (): void => {
    // Load cached data into the registry for conflict tracking
    const cachedParcels = offlineSync.getCachedParcels();
    cachedParcels.forEach(parcel => {
      if (!parcel.is_pending_deletion) {
        syncService.trackEntity(parcel.id, parcel);
      }
    });
    
    // Set up online/offline event listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', async () => {
        console.log('Application is back online');
        await syncService.startSync();
      });
      
      // Set up periodic sync attempts
      setInterval(() => {
        if (offlineSync.isOnline() && offlineSync.hasPendingOperations()) {
          syncService.startSync().catch(console.error);
        }
      }, 60000); // Try to sync every minute if needed
    }
    
    // Start an initial sync if online
    if (offlineSync.isOnline()) {
      setTimeout(() => {
        if (offlineSync.hasPendingOperations()) {
          syncService.startSync().catch(console.error);
        } else {
          // If no pending operations, just pull changes
          syncService.pullServerChanges().catch(console.error);
        }
      }, 2000);
    }
  }
};

/**
 * Helper function to detect changed fields between two objects
 */
function detectChangedFields(metadata: EntityMetadata, newData: any): string[] {
  // Get the most recent state from the change log
  const latestState: Record<string, any> = {};
  
  // Build the latest state from change log
  metadata.changeLog.forEach(change => {
    latestState[change.fieldName] = change.value;
  });
  
  // Compare with new data
  const changedFields: string[] = [];
  
  Object.keys(newData).forEach(key => {
    // Skip metadata fields
    if (key.startsWith('_') || key === 'id') return;
    
    // If field doesn't exist in latest state or value is different
    if (!(key in latestState) || 
        JSON.stringify(latestState[key]) !== JSON.stringify(newData[key])) {
      changedFields.push(key);
    }
  });
  
  return changedFields;
}

// Initialize the sync service when this module is imported
if (typeof window !== 'undefined') {
  // Delay initialization to ensure everything is loaded
  setTimeout(() => {
    syncService.initialize();
  }, 1000);
}

export default syncService;
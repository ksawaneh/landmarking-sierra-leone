/**
 * Simple offline service wrapper
 * The main functionality is in OfflineSyncService
 */

import { OfflineSyncService } from './OfflineSyncService';

export class OfflineService {
  /**
   * Check if the device is offline
   */
  static async isOffline(): Promise<boolean> {
    return await OfflineSyncService.isOffline();
  }
}
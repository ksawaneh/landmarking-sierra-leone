/**
 * Service for managing parcel verification workflows
 */

import { v4 as uuidv4 } from 'uuid';
import * as Crypto from 'expo-crypto';
import { ApiService } from './ApiService';
import { DatabaseService } from './DatabaseService';
import { OfflineSyncService } from './OfflineSyncService';
import { LocationService } from './LocationService';
import { BiometricService } from './BiometricService';
import { 
  Verification, 
  VerificationType, 
  VerificationSignatory,
  BiometricData,
  Location 
} from '../types';
import { VERIFICATION_REQUIREMENTS, ERROR_MESSAGES } from '../constants';

export class VerificationService {
  /**
   * Get required verification types for a parcel
   */
  static getRequiredVerifications(): VerificationType[] {
    return [
      VerificationType.OWNER,
      VerificationType.COMMUNITY_LEADER,
      VerificationType.GOVERNMENT_OFFICIAL,
      VerificationType.NEIGHBOR,
      VerificationType.NEIGHBOR, // Second neighbor
    ];
  }

  /**
   * Check if all required verifications are complete
   */
  static async isVerificationComplete(parcelId: string): Promise<boolean> {
    const verifications = await this.getParcelVerifications(parcelId);
    const requiredTypes = this.getRequiredVerifications();
    
    // Count completed verifications by type
    const completedByType = new Map<VerificationType, number>();
    verifications
      .filter(v => v.status === 'completed')
      .forEach(v => {
        const count = completedByType.get(v.type) || 0;
        completedByType.set(v.type, count + 1);
      });

    // Check if we have enough of each type
    const neighborCount = completedByType.get(VerificationType.NEIGHBOR) || 0;
    const hasOwner = completedByType.has(VerificationType.OWNER);
    const hasCommunityLeader = completedByType.has(VerificationType.COMMUNITY_LEADER);
    const hasGovernmentOfficial = completedByType.has(VerificationType.GOVERNMENT_OFFICIAL);
    
    return hasOwner && hasCommunityLeader && hasGovernmentOfficial && neighborCount >= 2;
  }

  /**
   * Create a new verification request
   */
  static async createVerification(
    parcelId: string,
    type: VerificationType,
    signatory: VerificationSignatory
  ): Promise<Verification> {
    const isOffline = await OfflineSyncService.isOffline();
    
    // Get current location
    const location = await LocationService.getCurrentLocation();
    
    const verification: Verification = {
      id: isOffline ? `local_${uuidv4()}` : uuidv4(),
      parcelId,
      type,
      signatory,
      timestamp: new Date().toISOString(),
      location,
      status: 'pending',
    };

    if (isOffline) {
      // Save to local database
      await DatabaseService.saveVerification(verification);
      
      // Add to pending operations
      await DatabaseService.addPendingOperation({
        type: 'CREATE',
        entityType: 'verification',
        entityId: verification.id,
        payload: verification,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
      
      return verification;
    } else {
      // Create on server
      try {
        const serverVerification = await ApiService.createVerification(verification);
        // Save to local database for offline access
        await DatabaseService.saveVerification(serverVerification);
        return serverVerification;
      } catch (error) {
        // Fall back to offline mode
        console.error('Failed to create verification on server:', error);
        await DatabaseService.saveVerification(verification);
        await DatabaseService.addPendingOperation({
          type: 'CREATE',
          entityType: 'verification',
          entityId: verification.id,
          payload: verification,
          timestamp: new Date().toISOString(),
          retryCount: 0,
        });
        return verification;
      }
    }
  }

  /**
   * Capture signature for verification
   */
  static async captureSignature(
    verificationId: string,
    signatureData: string
  ): Promise<void> {
    const verification = await this.getVerification(verificationId);
    if (!verification) {
      throw new Error('Verification not found');
    }

    // Generate cryptographic hash of signature
    const signatureHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      signatureData
    );

    verification.signature = signatureHash;
    
    await this.updateVerification(verificationId, { signature: signatureHash });
  }

  /**
   * Capture biometric data for verification
   */
  static async captureBiometric(
    verificationId: string,
    type: 'fingerprint' | 'face'
  ): Promise<void> {
    const verification = await this.getVerification(verificationId);
    if (!verification) {
      throw new Error('Verification not found');
    }

    // Authenticate with biometrics
    const authenticated = await BiometricService.authenticate(
      `Verify your identity for ${verification.signatory.name}`
    );

    if (!authenticated) {
      throw new Error(ERROR_MESSAGES.BIOMETRIC_FAILED);
    }

    // In a real app, we would capture actual biometric template
    // For now, we'll store a hash representing successful capture
    const biometricData: BiometricData = {
      type,
      captured: true,
      capturedAt: new Date().toISOString(),
      template: await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${type}_${verificationId}_${Date.now()}`
      ),
    };

    await this.updateVerification(verificationId, { biometricData });
  }

  /**
   * Complete a verification
   */
  static async completeVerification(
    verificationId: string,
    notes?: string
  ): Promise<Verification> {
    const verification = await this.getVerification(verificationId);
    if (!verification) {
      throw new Error('Verification not found');
    }

    // Validate verification requirements
    if (!verification.signature && !verification.biometricData) {
      throw new Error('Signature or biometric data required');
    }

    // Check location proximity (must be within 1km of parcel)
    const currentLocation = await LocationService.getCurrentLocation();
    const distance = LocationService.calculateDistance(
      { latitude: currentLocation.latitude, longitude: currentLocation.longitude, order: 0 },
      { latitude: verification.location.latitude, longitude: verification.location.longitude, order: 0 }
    );

    if (distance > VERIFICATION_REQUIREMENTS.MAX_VERIFICATION_DISTANCE) {
      throw new Error(ERROR_MESSAGES.INVALID_COORDINATES);
    }

    // Update verification status
    const updates = {
      status: 'completed' as const,
      notes,
      timestamp: new Date().toISOString(),
    };

    return await this.updateVerification(verificationId, updates);
  }

  /**
   * Update a verification
   */
  private static async updateVerification(
    id: string,
    updates: Partial<Verification>
  ): Promise<Verification> {
    const isOffline = await OfflineSyncService.isOffline();
    
    // Get existing verification
    let verification = await this.getVerification(id);
    if (!verification) {
      throw new Error('Verification not found');
    }

    // Apply updates
    verification = {
      ...verification,
      ...updates,
    };

    if (isOffline) {
      // Save to local database
      await DatabaseService.saveVerification(verification);
      
      // Add to pending operations
      await DatabaseService.addPendingOperation({
        type: 'UPDATE',
        entityType: 'verification',
        entityId: id,
        payload: updates,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
      
      return verification;
    } else {
      // Update on server
      try {
        const serverVerification = await ApiService.updateVerification(id, updates);
        // Update local database
        await DatabaseService.saveVerification(serverVerification);
        return serverVerification;
      } catch (error) {
        // Fall back to offline mode
        console.error('Failed to update verification on server:', error);
        await DatabaseService.saveVerification(verification);
        await DatabaseService.addPendingOperation({
          type: 'UPDATE',
          entityType: 'verification',
          entityId: id,
          payload: updates,
          timestamp: new Date().toISOString(),
          retryCount: 0,
        });
        return verification;
      }
    }
  }

  /**
   * Get a single verification
   */
  private static async getVerification(id: string): Promise<Verification | null> {
    // For now, get from local database
    // In a real app, this would check server first if online
    const verifications = await DatabaseService.getVerificationsByParcel('');
    return verifications.find(v => v.id === id) || null;
  }

  /**
   * Get all verifications for a parcel
   */
  static async getParcelVerifications(parcelId: string): Promise<Verification[]> {
    const isOffline = await OfflineSyncService.isOffline();
    
    if (isOffline) {
      return await DatabaseService.getVerificationsByParcel(parcelId);
    } else {
      try {
        const verifications = await ApiService.getVerificationsByParcel(parcelId);
        // Update local database
        for (const verification of verifications) {
          await DatabaseService.saveVerification(verification);
        }
        return verifications;
      } catch (error) {
        // Fall back to local database
        console.error('Failed to fetch verifications from server:', error);
        return await DatabaseService.getVerificationsByParcel(parcelId);
      }
    }
  }

  /**
   * Generate verification QR code data
   */
  static generateVerificationQR(
    parcelId: string,
    verificationType: VerificationType
  ): string {
    const data = {
      parcelId,
      type: verificationType,
      timestamp: Date.now(),
      appUrl: 'landmarking://verify',
    };
    
    return JSON.stringify(data);
  }

  /**
   * Parse verification QR code
   */
  static parseVerificationQR(qrData: string): {
    parcelId: string;
    type: VerificationType;
  } | null {
    try {
      const data = JSON.parse(qrData);
      if (data.parcelId && data.type) {
        return {
          parcelId: data.parcelId,
          type: data.type,
        };
      }
      return null;
    } catch (error) {
      console.error('Invalid QR code:', error);
      return null;
    }
  }
}
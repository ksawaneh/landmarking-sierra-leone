/**
 * Biometric verification service
 * Integrates with external biometric verification providers
 */

import { BiometricData } from '../../../services/verification/types';
import { AppConfig } from './config';

export interface BiometricVerificationResult {
  verified: boolean;
  confidence: number;
  matchedBiometricTypes: string[];
  issues?: string[];
}

export class BiometricService {
  constructor(private config: AppConfig) {}

  /**
   * Verify biometric data against stored templates
   * In production, this calls real biometric verification APIs
   */
  async verifyBiometric(
    biometricData: BiometricData,
    storedTemplateId: string,
    userId: string
  ): Promise<BiometricVerificationResult> {
    // In mock mode, simulate verification
    if (this.config.mockMode) {
      return this.mockVerification(biometricData);
    }

    // Production implementation would call actual biometric service
    try {
      const response = await fetch(`${this.config.biometric.serviceUrl}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.biometric.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          templateId: storedTemplateId,
          biometricData: {
            fingerprint: biometricData.fingerprint?.data,
            face: biometricData.face?.data,
            voice: biometricData.voice?.data
          },
          captureTimestamp: biometricData.captureTimestamp,
          captureLocation: biometricData.captureLocation
        })
      });

      if (!response.ok) {
        throw new Error(`Biometric verification failed: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        verified: result.verified,
        confidence: result.confidence,
        matchedBiometricTypes: result.matchedTypes,
        issues: result.issues
      };
    } catch (error) {
      console.error('Biometric verification error:', error);
      throw new Error('Unable to verify biometric data');
    }
  }

  /**
   * Register new biometric template
   */
  async registerBiometric(
    biometricData: BiometricData,
    userId: string
  ): Promise<string> {
    if (this.config.mockMode) {
      // Return mock template ID
      return `TEMPLATE-${userId}-${Date.now()}`;
    }

    // Production implementation
    const response = await fetch(`${this.config.biometric.serviceUrl}/register`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.biometric.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        biometricData
      })
    });

    if (!response.ok) {
      throw new Error(`Biometric registration failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.templateId;
  }

  /**
   * Mock verification for development
   */
  private mockVerification(biometricData: BiometricData): BiometricVerificationResult {
    const matchedTypes: string[] = [];
    let totalConfidence = 0;
    let biometricCount = 0;

    // Check fingerprint quality
    if (biometricData.fingerprint) {
      if (biometricData.fingerprint.quality >= this.config.biometric.minQualityThreshold) {
        matchedTypes.push('fingerprint');
        totalConfidence += biometricData.fingerprint.quality;
        biometricCount++;
      }
    }

    // Check face confidence
    if (biometricData.face) {
      if (biometricData.face.confidence >= 70) {
        matchedTypes.push('face');
        totalConfidence += biometricData.face.confidence;
        biometricCount++;
      }
    }

    // Check voice duration
    if (biometricData.voice) {
      if (biometricData.voice.duration >= 3) {
        matchedTypes.push('voice');
        totalConfidence += 80; // Mock confidence for voice
        biometricCount++;
      }
    }

    const avgConfidence = biometricCount > 0 ? totalConfidence / biometricCount : 0;
    const verified = matchedTypes.length > 0 && avgConfidence >= 60;

    return {
      verified,
      confidence: avgConfidence,
      matchedBiometricTypes: matchedTypes,
      issues: verified ? undefined : ['Biometric quality below threshold']
    };
  }

  /**
   * Validate biometric data quality before processing
   */
  validateBiometricQuality(biometricData: BiometricData): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (!biometricData.fingerprint && !biometricData.face && !biometricData.voice) {
      issues.push('At least one biometric type required');
    }

    if (biometricData.fingerprint && biometricData.fingerprint.quality < this.config.biometric.minQualityThreshold) {
      issues.push(`Fingerprint quality too low (minimum ${this.config.biometric.minQualityThreshold}%)`);
    }

    if (biometricData.face && biometricData.face.confidence < 70) {
      issues.push('Face confidence too low (minimum 70%)');
    }

    if (biometricData.voice && biometricData.voice.duration < 3) {
      issues.push('Voice sample too short (minimum 3 seconds)');
    }

    if (biometricData.captureLocation && biometricData.captureLocation.accuracy > 100) {
      issues.push('Location accuracy too low (maximum 100m)');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}
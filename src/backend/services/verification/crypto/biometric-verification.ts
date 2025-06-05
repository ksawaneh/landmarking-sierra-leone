/**
 * Biometric Verification System
 * Handles fingerprint, face, and voice verification for party identification
 * Stores only hashes, not raw biometric data, for privacy
 */

import * as crypto from 'crypto';
import { BiometricData } from '../types';

/**
 * Biometric hash storage format
 */
interface BiometricHash {
  type: 'fingerprint' | 'face' | 'voice';
  hash: string;
  algorithm: string;
  salt: string;
  metadata: {
    quality?: number;
    confidence?: number;
    captureDevice?: string;
    timestamp: Date;
  };
}

/**
 * Biometric matching result
 */
interface BiometricMatch {
  isMatch: boolean;
  confidence: number; // 0-100
  type: string;
  details?: string;
}

/**
 * Privacy-preserving biometric verification
 */
export class BiometricVerifier {
  private readonly HASH_ALGORITHM = 'sha3-512';
  private readonly SALT_LENGTH = 32;
  private readonly MIN_QUALITY_THRESHOLD = 60; // Minimum quality score
  
  /**
   * Processes and hashes biometric data for storage
   */
  async processBiometricData(
    biometricData: BiometricData,
    userId: string
  ): Promise<BiometricHash[]> {
    const hashes: BiometricHash[] = [];
    
    // Process fingerprint
    if (biometricData.fingerprint) {
      const fingerprintHash = await this.hashBiometric(
        biometricData.fingerprint.data,
        userId,
        'fingerprint'
      );
      
      hashes.push({
        type: 'fingerprint',
        ...fingerprintHash,
        metadata: {
          quality: biometricData.fingerprint.quality,
          captureDevice: biometricData.fingerprint.captureDevice,
          timestamp: biometricData.captureTimestamp
        }
      });
    }
    
    // Process face
    if (biometricData.face) {
      const faceHash = await this.hashBiometric(
        biometricData.face.data,
        userId,
        'face'
      );
      
      hashes.push({
        type: 'face',
        ...faceHash,
        metadata: {
          confidence: biometricData.face.confidence,
          captureDevice: biometricData.face.captureDevice,
          timestamp: biometricData.captureTimestamp
        }
      });
    }
    
    // Process voice
    if (biometricData.voice) {
      const voiceHash = await this.hashBiometric(
        biometricData.voice.data,
        userId,
        'voice'
      );
      
      hashes.push({
        type: 'voice',
        ...voiceHash,
        metadata: {
          timestamp: biometricData.captureTimestamp
        }
      });
    }
    
    return hashes;
  }
  
  /**
   * Verifies biometric data against stored hashes
   */
  async verifyBiometric(
    providedBiometric: BiometricData,
    storedHashes: BiometricHash[],
    userId: string
  ): Promise<BiometricMatch> {
    let bestMatch: BiometricMatch = {
      isMatch: false,
      confidence: 0,
      type: 'none'
    };
    
    // Check each biometric type
    if (providedBiometric.fingerprint) {
      const fingerprintMatch = await this.verifyFingerprint(
        providedBiometric.fingerprint,
        storedHashes.filter(h => h.type === 'fingerprint'),
        userId
      );
      
      if (fingerprintMatch.confidence > bestMatch.confidence) {
        bestMatch = fingerprintMatch;
      }
    }
    
    if (providedBiometric.face) {
      const faceMatch = await this.verifyFace(
        providedBiometric.face,
        storedHashes.filter(h => h.type === 'face'),
        userId
      );
      
      if (faceMatch.confidence > bestMatch.confidence) {
        bestMatch = faceMatch;
      }
    }
    
    if (providedBiometric.voice) {
      const voiceMatch = await this.verifyVoice(
        providedBiometric.voice,
        storedHashes.filter(h => h.type === 'voice'),
        userId
      );
      
      if (voiceMatch.confidence > bestMatch.confidence) {
        bestMatch = voiceMatch;
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Creates a privacy-preserving hash of biometric data
   */
  private async hashBiometric(
    biometricData: string,
    userId: string,
    type: string
  ): Promise<{ hash: string; algorithm: string; salt: string }> {
    // Generate unique salt for this biometric
    const salt = crypto.randomBytes(this.SALT_LENGTH).toString('hex');
    
    // Create hash with user ID and type for additional entropy
    const dataToHash = `${userId}:${type}:${biometricData}:${salt}`;
    const hash = crypto.createHash(this.HASH_ALGORITHM)
      .update(dataToHash)
      .digest('hex');
    
    return {
      hash,
      algorithm: this.HASH_ALGORITHM,
      salt
    };
  }
  
  /**
   * Verifies fingerprint data
   */
  private async verifyFingerprint(
    fingerprint: NonNullable<BiometricData['fingerprint']>,
    storedHashes: BiometricHash[],
    userId: string
  ): Promise<BiometricMatch> {
    // Check quality threshold
    if (fingerprint.quality < this.MIN_QUALITY_THRESHOLD) {
      return {
        isMatch: false,
        confidence: 0,
        type: 'fingerprint',
        details: 'Fingerprint quality too low'
      };
    }
    
    // Verify against stored hashes
    for (const stored of storedHashes) {
      const testHash = crypto.createHash(stored.algorithm)
        .update(`${userId}:fingerprint:${fingerprint.data}:${stored.salt}`)
        .digest('hex');
      
      if (testHash === stored.hash) {
        return {
          isMatch: true,
          confidence: Math.min(fingerprint.quality, 95), // Cap at 95%
          type: 'fingerprint'
        };
      }
    }
    
    return {
      isMatch: false,
      confidence: 0,
      type: 'fingerprint',
      details: 'No matching fingerprint found'
    };
  }
  
  /**
   * Verifies face data
   */
  private async verifyFace(
    face: NonNullable<BiometricData['face']>,
    storedHashes: BiometricHash[],
    userId: string
  ): Promise<BiometricMatch> {
    // In production, this would use facial recognition algorithms
    // For now, we use hash comparison with confidence adjustment
    
    for (const stored of storedHashes) {
      const testHash = crypto.createHash(stored.algorithm)
        .update(`${userId}:face:${face.data}:${stored.salt}`)
        .digest('hex');
      
      if (testHash === stored.hash) {
        return {
          isMatch: true,
          confidence: Math.min(face.confidence * 0.9, 90), // Face less reliable than fingerprint
          type: 'face'
        };
      }
    }
    
    return {
      isMatch: false,
      confidence: 0,
      type: 'face',
      details: 'No matching face found'
    };
  }
  
  /**
   * Verifies voice data
   */
  private async verifyVoice(
    voice: NonNullable<BiometricData['voice']>,
    storedHashes: BiometricHash[],
    userId: string
  ): Promise<BiometricMatch> {
    // Voice verification would use voice print analysis
    // Simplified for demonstration
    
    for (const stored of storedHashes) {
      const testHash = crypto.createHash(stored.algorithm)
        .update(`${userId}:voice:${voice.data}:${stored.salt}`)
        .digest('hex');
      
      if (testHash === stored.hash) {
        return {
          isMatch: true,
          confidence: 85, // Voice has moderate confidence
          type: 'voice'
        };
      }
    }
    
    return {
      isMatch: false,
      confidence: 0,
      type: 'voice',
      details: 'No matching voice print found'
    };
  }
  
  /**
   * Generates a secure biometric template for zero-knowledge proofs
   */
  async generateBiometricTemplate(
    biometricData: BiometricData
  ): Promise<{
    template: string;
    commitments: string[];
  }> {
    const commitments: string[] = [];
    
    // Create commitments for each biometric type
    if (biometricData.fingerprint) {
      const commitment = this.createCommitment(
        biometricData.fingerprint.data,
        'fingerprint'
      );
      commitments.push(commitment);
    }
    
    if (biometricData.face) {
      const commitment = this.createCommitment(
        biometricData.face.data,
        'face'
      );
      commitments.push(commitment);
    }
    
    if (biometricData.voice) {
      const commitment = this.createCommitment(
        biometricData.voice.data,
        'voice'
      );
      commitments.push(commitment);
    }
    
    // Combine commitments into a template
    const template = crypto.createHash('sha256')
      .update(commitments.join(':'))
      .digest('hex');
    
    return { template, commitments };
  }
  
  /**
   * Creates a cryptographic commitment for zero-knowledge proofs
   */
  private createCommitment(data: string, type: string): string {
    const nonce = crypto.randomBytes(32).toString('hex');
    return crypto.createHash('sha256')
      .update(`${type}:${data}:${nonce}`)
      .digest('hex');
  }
  
  /**
   * Validates biometric data quality
   */
  validateBiometricQuality(biometricData: BiometricData): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    if (biometricData.fingerprint) {
      if (biometricData.fingerprint.quality < this.MIN_QUALITY_THRESHOLD) {
        issues.push(`Fingerprint quality too low: ${biometricData.fingerprint.quality}%`);
      }
    }
    
    if (biometricData.face) {
      if (biometricData.face.confidence < 70) {
        issues.push(`Face confidence too low: ${biometricData.face.confidence}%`);
      }
    }
    
    if (biometricData.voice) {
      if (biometricData.voice.duration < 3) {
        issues.push('Voice sample too short (minimum 3 seconds)');
      }
    }
    
    // Check location if provided
    if (biometricData.captureLocation) {
      if (biometricData.captureLocation.accuracy > 100) {
        issues.push('Location accuracy too low (>100m)');
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

/**
 * Biometric anti-spoofing checks
 */
export class AntiSpoofingChecker {
  /**
   * Checks for liveness in biometric data
   */
  async checkLiveness(biometricData: BiometricData): Promise<{
    isLive: boolean;
    confidence: number;
    checks: string[];
  }> {
    const checks: string[] = [];
    let totalScore = 0;
    let checkCount = 0;
    
    // Fingerprint liveness (would use hardware sensors in production)
    if (biometricData.fingerprint) {
      if (biometricData.fingerprint.quality > 80) {
        checks.push('Fingerprint quality indicates live capture');
        totalScore += 85;
      }
      checkCount++;
    }
    
    // Face liveness (would use challenge-response in production)
    if (biometricData.face) {
      if (biometricData.face.confidence > 85) {
        checks.push('Face detection confidence indicates live person');
        totalScore += 80;
      }
      checkCount++;
    }
    
    // Voice liveness
    if (biometricData.voice) {
      if (biometricData.voice.transcript) {
        checks.push('Voice includes random phrase verification');
        totalScore += 90;
      }
      checkCount++;
    }
    
    // Location and timing checks
    if (biometricData.captureLocation) {
      checks.push('Location data present');
      totalScore += 10;
    }
    
    const avgScore = checkCount > 0 ? totalScore / checkCount : 0;
    
    return {
      isLive: avgScore > 70,
      confidence: Math.min(avgScore, 100),
      checks
    };
  }
}
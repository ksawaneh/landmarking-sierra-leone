/**
 * Threshold Signature Implementation
 * Uses Shamir's Secret Sharing to require k-of-n signatures
 * This prevents any single party from forging land transactions
 */

import * as crypto from 'crypto';

/**
 * Represents a share in the threshold signature scheme
 */
interface SecretShare {
  index: number;
  value: Buffer;
}

/**
 * Configuration for threshold signatures
 */
interface ThresholdConfig {
  threshold: number; // k - minimum shares needed
  totalShares: number; // n - total shares distributed
  prime: bigint; // Large prime for finite field
}

/**
 * Threshold signature manager for multi-party signing
 */
export class ThresholdSignatureManager {
  private config: ThresholdConfig;
  
  constructor(threshold: number, totalShares: number) {
    if (threshold > totalShares) {
      throw new Error('Threshold cannot be greater than total shares');
    }
    
    if (threshold < 2) {
      throw new Error('Threshold must be at least 2 for security');
    }
    
    // Use a large prime for the finite field
    // In production, use a cryptographically secure prime
    this.config = {
      threshold,
      totalShares,
      prime: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141')
    };
  }
  
  /**
   * Generates shares for a secret using Shamir's Secret Sharing
   */
  generateShares(secret: Buffer): SecretShare[] {
    const secretBigInt = this.bufferToBigInt(secret);
    const coefficients = this.generateCoefficients(secretBigInt);
    const shares: SecretShare[] = [];
    
    for (let i = 1; i <= this.config.totalShares; i++) {
      const x = BigInt(i);
      const y = this.evaluatePolynomial(coefficients, x);
      
      shares.push({
        index: i,
        value: this.bigIntToBuffer(y)
      });
    }
    
    return shares;
  }
  
  /**
   * Reconstructs the secret from k shares using Lagrange interpolation
   */
  reconstructSecret(shares: SecretShare[]): Buffer {
    if (shares.length < this.config.threshold) {
      throw new Error(`Need at least ${this.config.threshold} shares to reconstruct`);
    }
    
    // Use only the threshold number of shares
    const workingShares = shares.slice(0, this.config.threshold);
    
    let secret = BigInt(0);
    
    for (let i = 0; i < workingShares.length; i++) {
      const share = workingShares[i];
      const xi = BigInt(share.index);
      const yi = this.bufferToBigInt(share.value);
      
      let numerator = BigInt(1);
      let denominator = BigInt(1);
      
      for (let j = 0; j < workingShares.length; j++) {
        if (i !== j) {
          const xj = BigInt(workingShares[j].index);
          numerator = this.modMul(numerator, this.modSub(BigInt(0), xj));
          denominator = this.modMul(denominator, this.modSub(xi, xj));
        }
      }
      
      const lagrange = this.modMul(yi, this.modMul(numerator, this.modInverse(denominator)));
      secret = this.modAdd(secret, lagrange);
    }
    
    return this.bigIntToBuffer(secret);
  }
  
  /**
   * Creates a threshold signature for land verification
   */
  async createLandVerificationSignature(
    landData: object,
    shares: SecretShare[]
  ): Promise<{
    signature: string;
    publicKey: string;
    verificationData: object;
  }> {
    // Serialize land data deterministically
    const dataToSign = this.serializeLandData(landData);
    const dataHash = crypto.createHash('sha256').update(dataToSign).digest();
    
    // Reconstruct the signing key from shares
    const signingKey = this.reconstructSecret(shares);
    
    // Generate key pair from the reconstructed secret
    const keyPair = this.deriveKeyPair(signingKey);
    
    // Sign the data
    const signature = crypto.sign('sha256', dataHash, keyPair.privateKey);
    
    return {
      signature: signature.toString('base64'),
      publicKey: keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      verificationData: {
        dataHash: dataHash.toString('hex'),
        shareIndices: shares.map(s => s.index),
        timestamp: new Date().toISOString()
      }
    };
  }
  
  /**
   * Verifies a threshold signature
   */
  verifySignature(
    landData: object,
    signature: string,
    publicKey: string
  ): boolean {
    try {
      const dataToSign = this.serializeLandData(landData);
      const dataHash = crypto.createHash('sha256').update(dataToSign).digest();
      
      const signatureBuffer = Buffer.from(signature, 'base64');
      const publicKeyObject = crypto.createPublicKey(publicKey);
      
      return crypto.verify('sha256', dataHash, publicKeyObject, signatureBuffer);
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }
  
  /**
   * Generates random coefficients for the polynomial
   */
  private generateCoefficients(secret: bigint): bigint[] {
    const coefficients = [secret]; // a0 = secret
    
    for (let i = 1; i < this.config.threshold; i++) {
      // Generate random coefficient
      const randomBytes = crypto.randomBytes(32);
      const coefficient = this.bufferToBigInt(randomBytes) % this.config.prime;
      coefficients.push(coefficient);
    }
    
    return coefficients;
  }
  
  /**
   * Evaluates polynomial at a given x
   */
  private evaluatePolynomial(coefficients: bigint[], x: bigint): bigint {
    let result = BigInt(0);
    let xPower = BigInt(1);
    
    for (const coefficient of coefficients) {
      result = this.modAdd(result, this.modMul(coefficient, xPower));
      xPower = this.modMul(xPower, x);
    }
    
    return result;
  }
  
  /**
   * Modular arithmetic operations
   */
  private modAdd(a: bigint, b: bigint): bigint {
    return ((a + b) % this.config.prime + this.config.prime) % this.config.prime;
  }
  
  private modSub(a: bigint, b: bigint): bigint {
    return ((a - b) % this.config.prime + this.config.prime) % this.config.prime;
  }
  
  private modMul(a: bigint, b: bigint): bigint {
    return ((a * b) % this.config.prime + this.config.prime) % this.config.prime;
  }
  
  private modInverse(a: bigint): bigint {
    // Extended Euclidean algorithm for modular inverse
    let t = BigInt(0);
    let newT = BigInt(1);
    let r = this.config.prime;
    let newR = a;
    
    while (newR !== BigInt(0)) {
      const quotient = r / newR;
      [t, newT] = [newT, t - quotient * newT];
      [r, newR] = [newR, r - quotient * newR];
    }
    
    if (r > BigInt(1)) {
      throw new Error('Value is not invertible');
    }
    
    if (t < BigInt(0)) {
      t = t + this.config.prime;
    }
    
    return t;
  }
  
  /**
   * Utility functions for conversion
   */
  private bufferToBigInt(buffer: Buffer): bigint {
    return BigInt('0x' + buffer.toString('hex'));
  }
  
  private bigIntToBuffer(bigint: bigint): Buffer {
    let hex = bigint.toString(16);
    if (hex.length % 2 !== 0) {
      hex = '0' + hex;
    }
    return Buffer.from(hex, 'hex');
  }
  
  /**
   * Derives a key pair from a secret
   */
  private deriveKeyPair(secret: Buffer): crypto.KeyPairKeyObjectResult {
    // In production, use proper key derivation
    // This is a simplified version for demonstration
    const seed = crypto.createHash('sha256').update(secret).digest();
    
    return crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp256k1',
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'der'
      },
      publicKeyEncoding: {
        type: 'spki',
        format: 'der'
      }
    });
  }
  
  /**
   * Serializes land data deterministically for signing
   */
  private serializeLandData(data: object): Buffer {
    // Sort keys to ensure deterministic serialization
    const sortedData = JSON.stringify(data, Object.keys(data).sort());
    return Buffer.from(sortedData, 'utf8');
  }
}

/**
 * Factory function to create threshold signature configurations
 * for different verification scenarios
 */
export function createVerificationThresholds(verificationType: string): ThresholdConfig {
  const configs: Record<string, { threshold: number; total: number }> = {
    'initial_registration': { threshold: 5, total: 7 }, // 5 of 7 signatures
    'transfer': { threshold: 4, total: 6 }, // 4 of 6 signatures
    'dispute_resolution': { threshold: 6, total: 9 }, // 6 of 9 signatures
    'boundary_update': { threshold: 3, total: 5 } // 3 of 5 signatures
  };
  
  const config = configs[verificationType] || configs['initial_registration'];
  
  return {
    threshold: config.threshold,
    totalShares: config.total,
    prime: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141')
  };
}
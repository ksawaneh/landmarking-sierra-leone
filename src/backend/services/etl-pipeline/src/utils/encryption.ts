/**
 * Encryption utilities for PII data
 */

import crypto from 'crypto';
import { logger } from './logger';

export class EncryptionService {
  private algorithm: string;
  private key: Buffer;
  private saltLength = 16;
  private tagLength = 16;
  private ivLength = 16;

  constructor() {
    // Get encryption key from environment
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    if (encryptionKey.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be exactly 32 characters');
    }

    this.algorithm = process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm';
    this.key = Buffer.from(encryptionKey, 'utf8');
  }

  /**
   * Encrypt a string value
   */
  encrypt(text: string): string {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      // Encrypt the text
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get the authentication tag (for GCM mode)
      const tag = cipher.getAuthTag();
      
      // Combine iv + tag + encrypted data
      const combined = Buffer.concat([
        iv,
        tag,
        Buffer.from(encrypted, 'hex')
      ]);
      
      // Return base64 encoded string
      return combined.toString('base64');
    } catch (error) {
      logger.error('Encryption failed', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt a string value
   */
  decrypt(encryptedText: string): string {
    try {
      // Decode from base64
      const combined = Buffer.from(encryptedText, 'base64');
      
      // Extract components
      const iv = combined.slice(0, this.ivLength);
      const tag = combined.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.slice(this.ivLength + this.tagLength);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(tag);
      
      // Decrypt
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash a value (one-way, for indexing)
   */
  hash(text: string): string {
    return crypto
      .createHash('sha256')
      .update(text)
      .digest('hex');
  }

  /**
   * Encrypt PII fields in an object
   */
  encryptPII(data: any): any {
    const piiFields = [
      'nationalId',
      'phoneNumber',
      'email',
      'owner.nationalId',
      'owner.phoneNumber', 
      'owner.email'
    ];

    const encrypted = { ...data };

    for (const field of piiFields) {
      const value = this.getNestedValue(encrypted, field);
      if (value && typeof value === 'string') {
        this.setNestedValue(encrypted, field, this.encrypt(value));
      }
    }

    return encrypted;
  }

  /**
   * Decrypt PII fields in an object
   */
  decryptPII(data: any): any {
    const piiFields = [
      'nationalId',
      'phoneNumber',
      'email',
      'owner.nationalId',
      'owner.phoneNumber',
      'owner.email'
    ];

    const decrypted = { ...data };

    for (const field of piiFields) {
      const value = this.getNestedValue(decrypted, field);
      if (value && typeof value === 'string' && this.isEncrypted(value)) {
        try {
          this.setNestedValue(decrypted, field, this.decrypt(value));
        } catch (error) {
          logger.warn(`Failed to decrypt field ${field}`, { error });
        }
      }
    }

    return decrypted;
  }

  /**
   * Check if a value appears to be encrypted
   */
  private isEncrypted(value: string): boolean {
    // Check if it's a valid base64 string with expected length
    try {
      const decoded = Buffer.from(value, 'base64');
      return decoded.length >= this.ivLength + this.tagLength;
    } catch {
      return false;
    }
  }

  /**
   * Get nested object value
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set nested object value
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();
/**
 * Session manager for handling user sessions and PIN management
 */

import { createClient, RedisClientType } from 'redis';
import { UserSession, SMSError } from '../types';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export class SessionManager {
  private redis: RedisClientType;
  private sessionTimeout: number;
  private maxAttempts: number;
  private pinExpiry: number;

  constructor(
    redisUrl: string,
    sessionTimeout: number = 300, // 5 minutes
    maxAttempts: number = 3,
    pinExpiry: number = 86400 // 24 hours
  ) {
    this.sessionTimeout = sessionTimeout;
    this.maxAttempts = maxAttempts;
    this.pinExpiry = pinExpiry;

    // Initialize Redis client
    this.redis = createClient({
      url: redisUrl
    });

    this.redis.on('error', (err) => {
      logger.error('Redis client error', err);
    });

    this.redis.on('connect', () => {
      logger.info('Redis client connected');
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    await this.redis.connect();
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }

  /**
   * Create a new session for user
   */
  async createSession(msisdn: string, pin: string): Promise<UserSession> {
    const session: UserSession = {
      msisdn,
      authenticated: true,
      pin: this.hashPIN(pin),
      lastActivity: new Date(),
      attempts: 0
    };

    const key = this.getSessionKey(msisdn);
    await this.redis.setEx(
      key,
      this.pinExpiry,
      JSON.stringify(session)
    );

    logger.info('Session created', { msisdn });
    return session;
  }

  /**
   * Get user session
   */
  async getSession(msisdn: string): Promise<UserSession | null> {
    const key = this.getSessionKey(msisdn);
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    const session = JSON.parse(data) as UserSession;
    session.lastActivity = new Date(session.lastActivity);

    // Check if session is expired
    const now = new Date();
    const lastActivity = session.lastActivity;
    const timeDiff = (now.getTime() - lastActivity.getTime()) / 1000;

    if (timeDiff > this.sessionTimeout) {
      logger.info('Session expired', { msisdn });
      await this.redis.del(key);
      return null;
    }

    return session;
  }

  /**
   * Update session activity
   */
  async updateActivity(msisdn: string): Promise<void> {
    const session = await this.getSession(msisdn);
    if (!session) {
      return;
    }

    session.lastActivity = new Date();
    const key = this.getSessionKey(msisdn);
    await this.redis.setEx(
      key,
      this.pinExpiry,
      JSON.stringify(session)
    );
  }

  /**
   * Validate PIN
   */
  async validatePIN(msisdn: string, pin: string): Promise<UserSession | null> {
    const session = await this.getSession(msisdn);
    if (!session) {
      return null;
    }

    // Check if account is locked
    if (session.attempts >= this.maxAttempts) {
      throw new SMSError('Account locked due to too many attempts', 'ACCOUNT_LOCKED');
    }

    const hashedPin = this.hashPIN(pin);
    if (session.pin !== hashedPin) {
      // Increment attempts
      session.attempts++;
      const key = this.getSessionKey(msisdn);
      await this.redis.setEx(
        key,
        this.pinExpiry,
        JSON.stringify(session)
      );

      if (session.attempts >= this.maxAttempts) {
        logger.warn('Account locked', { msisdn });
        throw new SMSError('Account locked due to too many attempts', 'ACCOUNT_LOCKED');
      }

      logger.warn('Invalid PIN attempt', { msisdn, attempts: session.attempts });
      return null;
    }

    // Reset attempts on successful validation
    session.attempts = 0;
    session.authenticated = true;
    session.lastActivity = new Date();

    const key = this.getSessionKey(msisdn);
    await this.redis.setEx(
      key,
      this.pinExpiry,
      JSON.stringify(session)
    );

    logger.info('PIN validated successfully', { msisdn });
    return session;
  }

  /**
   * Change user PIN
   */
  async changePIN(msisdn: string, oldPin: string, newPin: string): Promise<boolean> {
    const session = await this.validatePIN(msisdn, oldPin);
    if (!session) {
      return false;
    }

    session.pin = this.hashPIN(newPin);
    session.lastActivity = new Date();

    const key = this.getSessionKey(msisdn);
    await this.redis.setEx(
      key,
      this.pinExpiry,
      JSON.stringify(session)
    );

    logger.info('PIN changed successfully', { msisdn });
    return true;
  }

  /**
   * Reset user PIN (admin function)
   */
  async resetPIN(msisdn: string, newPin: string): Promise<void> {
    const session = await this.getSession(msisdn);
    if (!session) {
      throw new SMSError('User not found', 'USER_NOT_FOUND');
    }

    session.pin = this.hashPIN(newPin);
    session.attempts = 0;
    session.lastActivity = new Date();

    const key = this.getSessionKey(msisdn);
    await this.redis.setEx(
      key,
      this.pinExpiry,
      JSON.stringify(session)
    );

    logger.info('PIN reset successfully', { msisdn });
  }

  /**
   * Delete session
   */
  async deleteSession(msisdn: string): Promise<void> {
    const key = this.getSessionKey(msisdn);
    await this.redis.del(key);
    logger.info('Session deleted', { msisdn });
  }

  /**
   * Check if user exists
   */
  async userExists(msisdn: string): Promise<boolean> {
    const session = await this.getSession(msisdn);
    return session !== null;
  }

  /**
   * Store temporary data for session
   */
  async setTempData(msisdn: string, key: string, value: any, ttl: number = 300): Promise<void> {
    const tempKey = `temp:${msisdn}:${key}`;
    await this.redis.setEx(tempKey, ttl, JSON.stringify(value));
  }

  /**
   * Get temporary data for session
   */
  async getTempData<T>(msisdn: string, key: string): Promise<T | null> {
    const tempKey = `temp:${msisdn}:${key}`;
    const data = await this.redis.get(tempKey);
    return data ? JSON.parse(data) as T : null;
  }

  /**
   * Delete temporary data
   */
  async deleteTempData(msisdn: string, key: string): Promise<void> {
    const tempKey = `temp:${msisdn}:${key}`;
    await this.redis.del(tempKey);
  }

  /**
   * Hash PIN using SHA256
   */
  private hashPIN(pin: string): string {
    return crypto
      .createHash('sha256')
      .update(pin + process.env.PIN_SALT || 'landmarking-sl')
      .digest('hex');
  }

  /**
   * Get Redis key for session
   */
  private getSessionKey(msisdn: string): string {
    return `session:${msisdn}`;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const pattern = 'session:*';
      const keys = await this.redis.keys(pattern);
      
      let cleaned = 0;
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const session = JSON.parse(data) as UserSession;
          const lastActivity = new Date(session.lastActivity);
          const now = new Date();
          const timeDiff = (now.getTime() - lastActivity.getTime()) / 1000;
          
          if (timeDiff > this.sessionTimeout) {
            await this.redis.del(key);
            cleaned++;
          }
        }
      }
      
      logger.info('Cleaned up expired sessions', { count: cleaned });
    } catch (error) {
      logger.error('Error cleaning up sessions', error);
    }
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    lockedAccounts: number;
  }> {
    const pattern = 'session:*';
    const keys = await this.redis.keys(pattern);
    
    let activeSessions = 0;
    let lockedAccounts = 0;
    
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const session = JSON.parse(data) as UserSession;
        const lastActivity = new Date(session.lastActivity);
        const now = new Date();
        const timeDiff = (now.getTime() - lastActivity.getTime()) / 1000;
        
        if (timeDiff <= this.sessionTimeout) {
          activeSessions++;
        }
        
        if (session.attempts >= this.maxAttempts) {
          lockedAccounts++;
        }
      }
    }
    
    return {
      totalSessions: keys.length,
      activeSessions,
      lockedAccounts
    };
  }
}
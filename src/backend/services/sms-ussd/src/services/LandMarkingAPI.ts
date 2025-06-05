/**
 * LandMarking API wrapper for backend integration
 */

import axios, { AxiosInstance } from 'axios';
import { ParcelInfo, VerificationRequest, SMSError } from '../types';
import { logger } from '../utils/logger';
import NodeCache from 'node-cache';

interface APIResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface UserVerification {
  parcelId: string;
  status: string;
  date: string;
}

interface RegisterUserRequest {
  msisdn: string;
  pin: string;
}

export class LandMarkingAPI {
  private client: AxiosInstance;
  private cache: NodeCache;
  private apiKey: string;

  constructor(baseURL: string, apiKey: string) {
    this.apiKey = apiKey;
    
    // Initialize cache with 5 minute TTL
    this.cache = new NodeCache({ stdTTL: 300 });

    // Create HTTP client
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      }
    });

    // Request interceptor
    this.client.interceptors.request.use(
      request => {
        logger.debug('API request', {
          method: request.method,
          url: request.url,
          data: request.data
        });
        return request;
      },
      error => {
        logger.error('API request error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      response => {
        logger.debug('API response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      error => {
        logger.error('API response error', {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get parcel information
   */
  async getParcelInfo(parcelId: string): Promise<ParcelInfo | null> {
    // Check cache first
    const cacheKey = `parcel:${parcelId}`;
    const cached = this.cache.get<ParcelInfo>(cacheKey);
    if (cached) {
      logger.debug('Parcel info from cache', { parcelId });
      return cached;
    }

    try {
      const response = await this.client.get<APIResponse<ParcelInfo>>(`/parcels/${parcelId}`);
      
      if (!response.data.success || !response.data.data) {
        return null;
      }

      const parcelInfo = response.data.data;
      
      // Cache the result
      this.cache.set(cacheKey, parcelInfo);
      
      return parcelInfo;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return null;
        }
        throw new SMSError('Failed to fetch parcel info', 'API_ERROR');
      }
      throw error;
    }
  }

  /**
   * Submit verification
   */
  async submitVerification(request: VerificationRequest): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await this.client.post<APIResponse<any>>('/verification/submit', {
        parcelId: request.parcelId,
        msisdn: request.msisdn,
        timestamp: request.timestamp.toISOString(),
        verificationType: 'sms',
        metadata: {
          pin: request.pin,
          source: 'sms'
        }
      });

      return {
        success: response.data.success,
        message: response.data.message || 'Verification submitted'
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || 'Verification failed';
        return {
          success: false,
          message
        };
      }
      throw new SMSError('Failed to submit verification', 'API_ERROR');
    }
  }

  /**
   * Register user
   */
  async registerUser(request: RegisterUserRequest): Promise<{
    success: boolean;
    userId?: string;
  }> {
    try {
      const response = await this.client.post<APIResponse<{ userId: string }>>('/users/register-sms', {
        phoneNumber: request.msisdn,
        pin: request.pin,
        registrationMethod: 'sms'
      });

      return {
        success: response.data.success,
        userId: response.data.data?.userId
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 409) {
          // User already exists
          return {
            success: true,
            userId: 'existing'
          };
        }
      }
      logger.error('Failed to register user', error);
      return {
        success: false
      };
    }
  }

  /**
   * Get user verifications
   */
  async getUserVerifications(msisdn: string): Promise<UserVerification[]> {
    // Check cache
    const cacheKey = `verifications:${msisdn}`;
    const cached = this.cache.get<UserVerification[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.client.get<APIResponse<UserVerification[]>>(
        `/users/verifications`,
        {
          params: { msisdn }
        }
      );

      const verifications = response.data.data || [];
      
      // Cache the result
      this.cache.set(cacheKey, verifications);
      
      return verifications;
    } catch (error) {
      logger.error('Failed to get user verifications', error);
      return [];
    }
  }

  /**
   * Search parcels by owner phone
   */
  async searchParcelsByPhone(msisdn: string): Promise<ParcelInfo[]> {
    try {
      const response = await this.client.get<APIResponse<ParcelInfo[]>>(
        `/parcels/search`,
        {
          params: {
            ownerPhone: msisdn
          }
        }
      );

      return response.data.data || [];
    } catch (error) {
      logger.error('Failed to search parcels', error);
      return [];
    }
  }

  /**
   * Get verification request details
   */
  async getVerificationRequest(parcelId: string): Promise<{
    requiredParties: string[];
    completedParties: string[];
    deadline?: Date;
  } | null> {
    try {
      const response = await this.client.get<APIResponse<any>>(
        `/verification/request/${parcelId}`
      );

      if (!response.data.success || !response.data.data) {
        return null;
      }

      return {
        requiredParties: response.data.data.requiredParties || [],
        completedParties: response.data.data.completedParties || [],
        deadline: response.data.data.deadline ? new Date(response.data.data.deadline) : undefined
      };
    } catch (error) {
      logger.error('Failed to get verification request', error);
      return null;
    }
  }

  /**
   * Validate parcel access
   */
  async validateParcelAccess(msisdn: string, parcelId: string): Promise<boolean> {
    try {
      const response = await this.client.post<APIResponse<{ hasAccess: boolean }>>(
        '/parcels/validate-access',
        {
          msisdn,
          parcelId
        }
      );

      return response.data.data?.hasAccess || false;
    } catch (error) {
      logger.error('Failed to validate parcel access', error);
      return false;
    }
  }

  /**
   * Get district and chiefdom information
   */
  async getLocationInfo(district: string, chiefdom?: string): Promise<{
    district: string;
    chiefdoms: string[];
    totalParcels: number;
  } | null> {
    const cacheKey = `location:${district}:${chiefdom || 'all'}`;
    const cached = this.cache.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.client.get<APIResponse<any>>(
        '/locations/info',
        {
          params: { district, chiefdom }
        }
      );

      if (!response.data.success || !response.data.data) {
        return null;
      }

      const locationInfo = response.data.data;
      
      // Cache for longer (1 hour) as location data doesn't change often
      this.cache.set(cacheKey, locationInfo, 3600);
      
      return locationInfo;
    } catch (error) {
      logger.error('Failed to get location info', error);
      return null;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.flushAll();
    logger.info('API cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    keys: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const keys = this.cache.keys().length;
    const stats = this.cache.getStats();
    const hitRate = stats.hits > 0 ? stats.hits / (stats.hits + stats.misses) : 0;

    return {
      keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }
}
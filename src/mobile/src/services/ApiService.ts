/**
 * API service for communicating with the backend
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, STORAGE_KEYS } from '../constants';
import { ApiResponse, Parcel, Verification, Document } from '../types';
import { OfflineSyncService } from './OfflineSyncService';
import { DatabaseService } from './DatabaseService';

export class ApiService {
  private static instance: AxiosInstance;

  /**
   * Initialize the API service
   */
  static init(): void {
    this.instance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.instance.interceptors.request.use(
      async (config) => {
        const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors and offline mode
    this.instance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Handle token refresh
          await this.refreshToken();
        } else if (!error.response && error.code === 'ECONNABORTED') {
          // Network timeout - switch to offline mode
          console.log('Network timeout - operating in offline mode');
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Refresh authentication token
   */
  private static async refreshToken(): Promise<void> {
    try {
      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) throw new Error('No refresh token');

      const response = await this.instance.post('/auth/refresh', { refreshToken });
      const { token } = response.data;

      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    } catch (error) {
      // Redirect to login
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Make an API request with offline fallback
   */
  private static async request<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data?: any,
    offlineHandler?: () => Promise<T>
  ): Promise<ApiResponse<T>> {
    try {
      const isOffline = await OfflineSyncService.isOffline();
      
      if (isOffline && offlineHandler) {
        const offlineData = await offlineHandler();
        return { success: true, data: offlineData };
      }

      const response = await this.instance[method](url, data);
      return { success: true, data: response.data };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: {
            code: error.code || 'UNKNOWN',
            message: error.message,
            details: error.response?.data,
          },
        };
      }
      throw error;
    }
  }

  // Authentication endpoints
  static async login(nationalId: string, password: string): Promise<any> {
    const response = await this.request('post', '/auth/login', { nationalId, password });
    if (!response.success) throw new Error(response.error?.message);
    return response.data;
  }

  static async register(userData: any): Promise<any> {
    const response = await this.request('post', '/auth/register', userData);
    if (!response.success) throw new Error(response.error?.message);
    return response.data;
  }

  static async logout(): Promise<void> {
    await this.request('post', '/auth/logout');
  }

  // Parcel endpoints
  static async createParcel(parcelData: Partial<Parcel>): Promise<Parcel> {
    const response = await this.request<Parcel>('post', '/parcels', parcelData);
    if (!response.success) throw new Error(response.error?.message);
    return response.data!;
  }

  static async updateParcel(id: string, parcelData: Partial<Parcel>): Promise<Parcel> {
    const response = await this.request<Parcel>('put', `/parcels/${id}`, parcelData);
    if (!response.success) throw new Error(response.error?.message);
    return response.data!;
  }

  static async getParcel(id: string): Promise<Parcel> {
    const response = await this.request<Parcel>(
      'get',
      `/parcels/${id}`,
      undefined,
      async () => {
        const parcel = await DatabaseService.getParcel(id);
        if (!parcel) throw new Error('Parcel not found');
        return parcel;
      }
    );
    if (!response.success) throw new Error(response.error?.message);
    return response.data!;
  }

  static async getParcels(filters?: any): Promise<Parcel[]> {
    const response = await this.request<Parcel[]>(
      'get',
      '/parcels',
      { params: filters },
      async () => {
        return await DatabaseService.getAllParcels();
      }
    );
    if (!response.success) throw new Error(response.error?.message);
    return response.data!;
  }

  static async deleteParcel(id: string): Promise<void> {
    const response = await this.request('delete', `/parcels/${id}`);
    if (!response.success) throw new Error(response.error?.message);
  }

  // Verification endpoints
  static async createVerification(verificationData: Partial<Verification>): Promise<Verification> {
    const response = await this.request<Verification>('post', '/verifications', verificationData);
    if (!response.success) throw new Error(response.error?.message);
    return response.data!;
  }

  static async updateVerification(id: string, verificationData: Partial<Verification>): Promise<Verification> {
    const response = await this.request<Verification>('put', `/verifications/${id}`, verificationData);
    if (!response.success) throw new Error(response.error?.message);
    return response.data!;
  }

  static async getVerificationsByParcel(parcelId: string): Promise<Verification[]> {
    const response = await this.request<Verification[]>(
      'get',
      `/parcels/${parcelId}/verifications`,
      undefined,
      async () => {
        return await DatabaseService.getVerificationsByParcel(parcelId);
      }
    );
    if (!response.success) throw new Error(response.error?.message);
    return response.data!;
  }

  // Document endpoints
  static async uploadDocument(localUri: string, type: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      type: 'image/jpeg', // This should be dynamic based on file type
      name: `document_${Date.now()}.jpg`,
    } as any);
    formData.append('type', type);

    const response = await this.instance.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.url;
  }

  static async createDocument(documentData: Partial<Document>): Promise<Document> {
    const response = await this.request<Document>('post', '/documents', documentData);
    if (!response.success) throw new Error(response.error?.message);
    return response.data!;
  }

  static async deleteDocument(id: string): Promise<void> {
    const response = await this.request('delete', `/documents/${id}`);
    if (!response.success) throw new Error(response.error?.message);
  }

  // Government data endpoints
  static async searchGovernmentRecords(searchParams: any): Promise<any> {
    const response = await this.request('post', '/government/search', searchParams);
    if (!response.success) throw new Error(response.error?.message);
    return response.data;
  }

  static async validateNationalId(nationalId: string): Promise<boolean> {
    const response = await this.request<{ valid: boolean }>('get', `/government/validate-id/${nationalId}`);
    if (!response.success) throw new Error(response.error?.message);
    return response.data!.valid;
  }

  // AI endpoints
  static async detectBoundaries(imageUri: string): Promise<any> {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'boundary_image.jpg',
    } as any);

    const response = await this.instance.post('/ai/detect-boundaries', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  static async analyzeLandUse(coordinates: number[][]): Promise<string> {
    const response = await this.request<{ landUse: string }>('post', '/ai/analyze-land-use', { coordinates });
    if (!response.success) throw new Error(response.error?.message);
    return response.data!.landUse;
  }
}
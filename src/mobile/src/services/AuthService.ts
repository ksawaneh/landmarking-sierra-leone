/**
 * Authentication service for managing user authentication
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiService } from './ApiService';
import { BiometricService } from './BiometricService';
import { DatabaseService } from './DatabaseService';
import { STORAGE_KEYS } from '../constants';
import { User } from '../types';

export class AuthService {
  /**
   * Login with national ID and password
   */
  static async login(nationalId: string, password: string): Promise<{ user: User; token: string }> {
    try {
      // Try online login first
      const response = await ApiService.login(nationalId, password);
      
      // Store credentials for offline access
      await this.storeAuthData(response.user, response.token);
      
      return response;
    } catch (error) {
      // If offline, try local authentication
      const isOffline = await OfflineSyncService.isOffline();
      if (isOffline) {
        return await this.offlineLogin(nationalId, password);
      }
      throw error;
    }
  }

  /**
   * Offline login using cached credentials
   */
  private static async offlineLogin(nationalId: string, password: string): Promise<{ user: User; token: string }> {
    // In a real app, you'd hash and compare passwords
    // For now, we'll check if user exists in local storage
    const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    
    if (storedUser) {
      const user = JSON.parse(storedUser);
      if (user.nationalId === nationalId) {
        // Generate a local token for offline use
        const token = `offline_${Date.now()}`;
        return { user, token };
      }
    }
    
    throw new Error('Invalid credentials for offline login');
  }

  /**
   * Register a new user
   */
  static async register(userData: any): Promise<{ user: User; token: string }> {
    const response = await ApiService.register(userData);
    
    // Store credentials for offline access
    await this.storeAuthData(response.user, response.token);
    
    return response;
  }

  /**
   * Logout the user
   */
  static async logout(): Promise<void> {
    try {
      // Try to logout from server
      await ApiService.logout();
    } catch (error) {
      console.error('Server logout failed:', error);
    }
    
    // Clear local data
    await this.clearAuthData();
    
    // Clear biometric credentials
    await BiometricService.clearCredentials();
  }

  /**
   * Store authentication data locally
   */
  private static async storeAuthData(user: User, token: string): Promise<void> {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.AUTH_TOKEN, token],
      [STORAGE_KEYS.USER_DATA, JSON.stringify(user)],
    ]);
  }

  /**
   * Clear authentication data
   */
  private static async clearAuthData(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.USER_DATA,
    ]);
  }

  /**
   * Get current user
   */
  static async getCurrentUser(): Promise<User | null> {
    try {
      const userStr = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  static async isAuthenticated(): Promise<boolean> {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    return !!token;
  }

  /**
   * Setup biometric authentication
   */
  static async setupBiometric(nationalId: string, password: string): Promise<boolean> {
    return await BiometricService.enableBiometric(nationalId, password);
  }
}

// Import at the end to avoid circular dependency
import { OfflineSyncService } from './OfflineSyncService';
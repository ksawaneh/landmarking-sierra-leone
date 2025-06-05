/**
 * Unit tests for BiometricService
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { BiometricService } from '../BiometricService';
import { STORAGE_KEYS } from '../../constants';

// Mock the modules
jest.mock('expo-local-authentication');
jest.mock('expo-secure-store');

describe('BiometricService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('should return true when hardware exists and user is enrolled', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);

      const result = await BiometricService.isAvailable();
      
      expect(result).toBe(true);
      expect(LocalAuthentication.hasHardwareAsync).toHaveBeenCalled();
      expect(LocalAuthentication.isEnrolledAsync).toHaveBeenCalled();
    });

    it('should return false when no hardware exists', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false);

      const result = await BiometricService.isAvailable();
      
      expect(result).toBe(false);
      expect(LocalAuthentication.hasHardwareAsync).toHaveBeenCalled();
      expect(LocalAuthentication.isEnrolledAsync).not.toHaveBeenCalled();
    });

    it('should return false when user is not enrolled', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false);

      const result = await BiometricService.isAvailable();
      
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockRejectedValue(new Error('Hardware check failed'));

      const result = await BiometricService.isAvailable();
      
      expect(result).toBe(false);
    });
  });

  describe('getSupportedTypes', () => {
    it('should return supported authentication types', async () => {
      const mockTypes = [
        LocalAuthentication.AuthenticationType.FINGERPRINT,
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      ];
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue(mockTypes);

      const result = await BiometricService.getSupportedTypes();
      
      expect(result).toEqual(mockTypes);
    });

    it('should return empty array on error', async () => {
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockRejectedValue(new Error('Failed'));

      const result = await BiometricService.getSupportedTypes();
      
      expect(result).toEqual([]);
    });
  });

  describe('authenticate', () => {
    it('should return true on successful authentication', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });

      const result = await BiometricService.authenticate('Test prompt');
      
      expect(result).toBe(true);
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Test prompt',
        fallbackLabel: 'Use password',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
    });

    it('should use default prompt message', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });

      await BiometricService.authenticate();
      
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Authenticate to access LandMarking',
        fallbackLabel: 'Use password',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
    });

    it('should return false on failed authentication', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ 
        success: false,
        error: 'UserCancel',
      });

      const result = await BiometricService.authenticate();
      
      expect(result).toBe(false);
    });

    it('should handle authentication errors', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockRejectedValue(new Error('Auth failed'));

      const result = await BiometricService.authenticate();
      
      expect(result).toBe(false);
    });
  });

  describe('storeCredentials', () => {
    it('should store credentials securely', async () => {
      const nationalId = 'SL123456';
      const password = 'testPassword';

      await BiometricService.storeCredentials(nationalId, password);
      
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.BIOMETRIC_CREDENTIALS,
        JSON.stringify({ nationalId, password })
      );
    });

    it('should throw error if storage fails', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage failed'));

      await expect(
        BiometricService.storeCredentials('id', 'pass')
      ).rejects.toThrow('Storage failed');
    });
  });

  describe('getStoredCredentials', () => {
    it('should retrieve stored credentials', async () => {
      const credentials = { nationalId: 'SL123456', password: 'testPassword' };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(credentials));

      const result = await BiometricService.getStoredCredentials();
      
      expect(result).toEqual(credentials);
    });

    it('should return null if no credentials stored', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await BiometricService.getStoredCredentials();
      
      expect(result).toBeNull();
    });

    it('should handle retrieval errors', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Retrieval failed'));

      const result = await BiometricService.getStoredCredentials();
      
      expect(result).toBeNull();
    });
  });

  describe('clearCredentials', () => {
    it('should clear stored credentials', async () => {
      await BiometricService.clearCredentials();
      
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.BIOMETRIC_CREDENTIALS);
    });
  });

  describe('enableBiometric', () => {
    it('should enable biometric authentication successfully', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });

      const result = await BiometricService.enableBiometric('SL123456', 'password');
      
      expect(result).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.BIOMETRIC_CREDENTIALS,
        JSON.stringify({ nationalId: 'SL123456', password: 'password' })
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.BIOMETRIC_ENABLED,
        'true'
      );
    });

    it('should return false if biometric is not available', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false);

      const result = await BiometricService.enableBiometric('SL123456', 'password');
      
      expect(result).toBe(false);
    });

    it('should return false if authentication fails', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: false });

      const result = await BiometricService.enableBiometric('SL123456', 'password');
      
      expect(result).toBe(false);
    });
  });

  describe('disableBiometric', () => {
    it('should disable biometric authentication', async () => {
      await BiometricService.disableBiometric();
      
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.BIOMETRIC_CREDENTIALS);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.BIOMETRIC_ENABLED);
    });
  });

  describe('isBiometricEnabled', () => {
    it('should return true when biometric is enabled', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');

      const result = await BiometricService.isBiometricEnabled();
      
      expect(result).toBe(true);
    });

    it('should return false when biometric is not enabled', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('false');

      const result = await BiometricService.isBiometricEnabled();
      
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Failed'));

      const result = await BiometricService.isBiometricEnabled();
      
      expect(result).toBe(false);
    });
  });
});
/**
 * Authentication context provider for managing user authentication state
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthState, User } from '../types';
import { AuthService } from '../services/AuthService';
import { BiometricService } from '../services/BiometricService';

interface AuthContextType extends AuthState {
  login: (nationalId: string, password: string) => Promise<void>;
  biometricLogin: () => Promise<boolean>;
  register: (userData: any) => Promise<void>;
  logout: () => Promise<void>;
  updateBiometricEnabled: (enabled: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    biometricEnabled: false,
  });

  useEffect(() => {
    loadAuthState();
  }, []);

  const loadAuthState = async () => {
    try {
      const [token, userStr, biometricEnabled] = await Promise.all([
        AsyncStorage.getItem('auth_token'),
        AsyncStorage.getItem('user'),
        AsyncStorage.getItem('biometric_enabled'),
      ]);

      if (token && userStr) {
        const user = JSON.parse(userStr);
        setAuthState({
          isAuthenticated: true,
          user,
          token,
          biometricEnabled: biometricEnabled === 'true',
        });
      }
    } catch (error) {
      console.error('Failed to load auth state:', error);
    }
  };

  const login = async (nationalId: string, password: string) => {
    try {
      const response = await AuthService.login(nationalId, password);
      
      await Promise.all([
        AsyncStorage.setItem('auth_token', response.token),
        AsyncStorage.setItem('user', JSON.stringify(response.user)),
      ]);

      setAuthState({
        isAuthenticated: true,
        user: response.user,
        token: response.token,
        biometricEnabled: authState.biometricEnabled,
      });
    } catch (error) {
      throw error;
    }
  };

  const biometricLogin = async (): Promise<boolean> => {
    try {
      if (!authState.biometricEnabled) {
        return false;
      }

      const authenticated = await BiometricService.authenticate(
        'Authenticate to access LandMarking'
      );

      if (authenticated) {
        const storedToken = await AsyncStorage.getItem('auth_token');
        const storedUser = await AsyncStorage.getItem('user');
        
        if (storedToken && storedUser) {
          setAuthState({
            ...authState,
            isAuthenticated: true,
            user: JSON.parse(storedUser),
            token: storedToken,
          });
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Biometric login failed:', error);
      return false;
    }
  };

  const register = async (userData: any) => {
    try {
      const response = await AuthService.register(userData);
      
      await Promise.all([
        AsyncStorage.setItem('auth_token', response.token),
        AsyncStorage.setItem('user', JSON.stringify(response.user)),
      ]);

      setAuthState({
        isAuthenticated: true,
        user: response.user,
        token: response.token,
        biometricEnabled: false,
      });
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AuthService.logout();
      await AsyncStorage.multiRemove(['auth_token', 'user']);
      
      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        biometricEnabled: false,
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const updateBiometricEnabled = async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem('biometric_enabled', enabled.toString());
      setAuthState({
        ...authState,
        biometricEnabled: enabled,
      });
    } catch (error) {
      console.error('Failed to update biometric setting:', error);
    }
  };

  return (
    <AuthContext.Provider 
      value={{
        ...authState,
        login,
        biometricLogin,
        register,
        logout,
        updateBiometricEnabled,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
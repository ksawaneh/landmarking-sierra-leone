/**
 * Test utilities and helpers
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from '../contexts/AuthContext';
import { User, UserRole } from '../types';

// Mock user for tests
export const mockUser: User = {
  id: 'test-user-1',
  username: 'testuser',
  email: 'test@example.com',
  phoneNumber: '+23276123456',
  role: UserRole.CITIZEN,
  permissions: ['read', 'write'],
  biometricEnabled: false,
  nationalId: 'SL123456',
  district: 'Western Area',
  chiefdom: 'Freetown',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

// Mock auth context value
export const mockAuthContextValue = {
  isAuthenticated: true,
  user: mockUser,
  token: 'test-token',
  biometricEnabled: false,
  login: jest.fn(),
  biometricLogin: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  updateBiometricEnabled: jest.fn(),
};

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authValue?: any;
  initialRouteName?: string;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    authValue = mockAuthContextValue,
    initialRouteName = 'Test',
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <NavigationContainer>
        <AuthProvider value={authValue}>
          {children}
        </AuthProvider>
      </NavigationContainer>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Test data generators
export const generateParcel = (overrides = {}) => ({
  id: `parcel-${Date.now()}`,
  parcelNumber: `P${Math.floor(Math.random() * 100000)}`,
  ownerId: mockUser.id,
  ownerName: mockUser.username,
  location: {
    latitude: 8.484 + Math.random() * 0.1,
    longitude: -13.2299 + Math.random() * 0.1,
    district: 'Western Area',
    chiefdom: 'Freetown',
  },
  boundaries: [
    {
      id: 'boundary-1',
      points: [
        { latitude: 8.484, longitude: -13.2299, order: 0 },
        { latitude: 8.485, longitude: -13.2299, order: 1 },
        { latitude: 8.485, longitude: -13.2289, order: 2 },
        { latitude: 8.484, longitude: -13.2289, order: 3 },
      ],
      type: 'gps' as const,
      createdAt: new Date().toISOString(),
      createdBy: mockUser.id,
    },
  ],
  area: 1000 + Math.random() * 1000,
  landUse: 'RESIDENTIAL' as const,
  documents: [],
  verificationStatus: 'DRAFT' as const,
  verifications: [],
  registrationDate: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  ...overrides,
});

export const generateVerification = (parcelId: string, type: string, overrides = {}) => ({
  id: `verification-${Date.now()}`,
  parcelId,
  type,
  signatory: {
    id: `signatory-${Date.now()}`,
    name: 'Test Signatory',
    role: type,
    phoneNumber: '+23276123456',
  },
  timestamp: new Date().toISOString(),
  location: {
    latitude: 8.484,
    longitude: -13.2299,
    district: 'Western Area',
    chiefdom: 'Freetown',
  },
  status: 'pending' as const,
  ...overrides,
});

// Async test helpers
export const waitForAsync = (ms: number = 100) => 
  new Promise(resolve => setTimeout(resolve, ms));

// Mock navigation helpers
export const createMockNavigation = () => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  canGoBack: jest.fn(() => true),
  isFocused: jest.fn(() => true),
  dispatch: jest.fn(),
  reset: jest.fn(),
  setParams: jest.fn(),
});

// Mock location data
export const mockLocationData = {
  coords: {
    latitude: 8.484,
    longitude: -13.2299,
    accuracy: 10,
    altitude: 100,
    altitudeAccuracy: 5,
    heading: 0,
    speed: 0,
  },
  timestamp: Date.now(),
};

// Mock network states
export const mockNetworkStates = {
  online: {
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  },
  offline: {
    isConnected: false,
    isInternetReachable: false,
    type: 'none',
  },
};

// Test IDs for E2E tests
export const testIDs = {
  // Login screen
  nationalIdInput: 'nationalIdInput',
  passwordInput: 'passwordInput',
  loginButton: 'loginButton',
  biometricLoginButton: 'biometricLoginButton',
  
  // Registration screen
  parcelNumberInput: 'parcelNumberInput',
  landUsePicker: 'landUsePicker',
  descriptionInput: 'descriptionInput',
  startBoundaryButton: 'startBoundaryButton',
  capturePointButton: 'capturePointButton',
  finishCaptureButton: 'finishCaptureButton',
  saveParcelButton: 'saveParcelButton',
  
  // Verification screen
  signatoryNameInput: 'signatoryNameInput',
  signatoryPhoneInput: 'signatoryPhoneInput',
  signatoryNationalIdInput: 'signatoryNationalIdInput',
  signatureCanvas: 'signatureCanvas',
  qrCodeView: 'qrCodeView',
  
  // Navigation
  dashboardTab: 'dashboardTab',
  parcelsTab: 'parcelsTab',
  verificationTab: 'verificationTab',
  profileTab: 'profileTab',
};
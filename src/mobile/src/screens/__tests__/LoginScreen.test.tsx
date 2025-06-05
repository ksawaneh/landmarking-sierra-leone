/**
 * Unit tests for LoginScreen component
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { LoginScreen } from '../auth/LoginScreen';
import { useAuth } from '../../contexts/AuthContext';
import { BiometricService } from '../../services/BiometricService';
import { OfflineService } from '../../services/OfflineService';

// Mock dependencies
jest.mock('../../contexts/AuthContext');
jest.mock('../../services/BiometricService');
jest.mock('../../services/OfflineService');

const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
}));

describe('LoginScreen', () => {
  const mockLogin = jest.fn();
  const mockBiometricLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      biometricLogin: mockBiometricLogin,
    });
    
    (BiometricService.isAvailable as jest.Mock).mockResolvedValue(false);
    (OfflineService.isOffline as jest.Mock).mockResolvedValue(false);
  });

  it('should render login form correctly', () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    
    expect(getByText('LandMarking')).toBeTruthy();
    expect(getByText('Sierra Leone Land Registry')).toBeTruthy();
    expect(getByPlaceholderText('National ID')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
    expect(getByText('Login')).toBeTruthy();
    expect(getByText("Don't have an account? Register")).toBeTruthy();
  });

  it('should show offline banner when offline', async () => {
    (OfflineService.isOffline as jest.Mock).mockResolvedValue(true);
    
    const { getByText } = render(<LoginScreen />);
    
    await waitFor(() => {
      expect(getByText('Offline Mode')).toBeTruthy();
    });
  });

  it('should show biometric login button when available', async () => {
    (BiometricService.isAvailable as jest.Mock).mockResolvedValue(true);
    
    const { getByText } = render(<LoginScreen />);
    
    await waitFor(() => {
      expect(getByText('Login with Biometrics')).toBeTruthy();
    });
  });

  it('should validate required fields', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    
    const { getByText } = render(<LoginScreen />);
    
    const loginButton = getByText('Login');
    fireEvent.press(loginButton);
    
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        'Please enter your National ID and password'
      );
    });
  });

  it('should handle successful login', async () => {
    mockLogin.mockResolvedValue(undefined);
    
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    
    fireEvent.changeText(getByPlaceholderText('National ID'), 'SL123456');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Login'));
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('SL123456', 'password123');
      expect(mockNavigation.replace).toHaveBeenCalledWith('Dashboard');
    });
  });

  it('should handle login failure', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    const alertSpy = jest.spyOn(Alert, 'alert');
    
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    
    fireEvent.changeText(getByPlaceholderText('National ID'), 'SL123456');
    fireEvent.changeText(getByPlaceholderText('Password'), 'wrongpassword');
    fireEvent.press(getByText('Login'));
    
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Login Failed',
        'Invalid credentials. Please try again.'
      );
    });
  });

  it('should handle offline login', async () => {
    (OfflineService.isOffline as jest.Mock).mockResolvedValue(true);
    mockLogin.mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert');
    
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    
    fireEvent.changeText(getByPlaceholderText('National ID'), 'SL123456');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Login'));
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
      expect(mockNavigation.replace).toHaveBeenCalledWith('Dashboard');
    });
  });

  it('should handle biometric login success', async () => {
    (BiometricService.isAvailable as jest.Mock).mockResolvedValue(true);
    mockBiometricLogin.mockResolvedValue(true);
    
    const { getByText } = render(<LoginScreen />);
    
    await waitFor(() => {
      const biometricButton = getByText('Login with Biometrics');
      fireEvent.press(biometricButton);
    });
    
    await waitFor(() => {
      expect(mockBiometricLogin).toHaveBeenCalled();
      expect(mockNavigation.replace).toHaveBeenCalledWith('Dashboard');
    });
  });

  it('should handle biometric login failure', async () => {
    (BiometricService.isAvailable as jest.Mock).mockResolvedValue(true);
    mockBiometricLogin.mockResolvedValue(false);
    const alertSpy = jest.spyOn(Alert, 'alert');
    
    const { getByText } = render(<LoginScreen />);
    
    await waitFor(() => {
      const biometricButton = getByText('Login with Biometrics');
      fireEvent.press(biometricButton);
    });
    
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Biometric Login Failed',
        'Please use your National ID and password.'
      );
    });
  });

  it('should navigate to register screen', () => {
    const { getByText } = render(<LoginScreen />);
    
    fireEvent.press(getByText("Don't have an account? Register"));
    
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Register');
  });

  it('should show loading state during login', async () => {
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    const { getByPlaceholderText, getByText, getByTestId, queryByText } = render(<LoginScreen />);
    
    fireEvent.changeText(getByPlaceholderText('National ID'), 'SL123456');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Login'));
    
    // Should show loading indicator
    await waitFor(() => {
      expect(queryByText('Login')).toBeFalsy();
    });
  });

  it('should mask password input', () => {
    const { getByPlaceholderText } = render(<LoginScreen />);
    
    const passwordInput = getByPlaceholderText('Password');
    expect(passwordInput.props.secureTextEntry).toBe(true);
  });
});
/**
 * Unit tests for VerificationWorkflowScreen
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { VerificationWorkflowScreen } from '../VerificationWorkflowScreen';
import { ParcelService } from '../../services/ParcelService';
import { VerificationService } from '../../services/VerificationService';
import { LocationService } from '../../services/LocationService';
import { useAuth } from '../../contexts/AuthContext';
import { VerificationType, VerificationStatus } from '../../types';

// Mock dependencies
jest.mock('../../services/ParcelService');
jest.mock('../../services/VerificationService');
jest.mock('../../services/LocationService');
jest.mock('../../contexts/AuthContext');
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  },
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

const mockRoute = {
  params: { parcelId: 'test-parcel-id' },
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));

describe('VerificationWorkflowScreen', () => {
  const mockParcel = {
    id: 'test-parcel-id',
    parcelNumber: 'P12345',
    ownerName: 'John Doe',
    area: 1000,
    location: {
      latitude: 8.484,
      longitude: -13.2299,
      district: 'Western Area',
      chiefdom: 'Freetown',
    },
    verificationStatus: VerificationStatus.PENDING_VERIFICATION,
  };

  const mockVerifications = [
    {
      id: 'ver-1',
      parcelId: 'test-parcel-id',
      type: VerificationType.OWNER,
      status: 'completed',
      signatory: {
        id: 'sig-1',
        name: 'John Doe',
        role: VerificationType.OWNER,
      },
      timestamp: '2024-01-01T00:00:00Z',
      location: mockParcel.location,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-1', username: 'testuser' },
    });
    
    (ParcelService.getParcel as jest.Mock).mockResolvedValue(mockParcel);
    (VerificationService.getParcelVerifications as jest.Mock).mockResolvedValue(mockVerifications);
    (LocationService.requestPermissions as jest.Mock).mockResolvedValue(true);
  });

  it('should render parcel information and verification steps', async () => {
    const { getByText } = render(<VerificationWorkflowScreen />);
    
    await waitFor(() => {
      expect(getByText('P12345')).toBeTruthy();
      expect(getByText('John Doe')).toBeTruthy();
      expect(getByText('1000.00 m²')).toBeTruthy();
      expect(getByText('Western Area')).toBeTruthy();
      
      // Verification steps
      expect(getByText('Property Owner')).toBeTruthy();
      expect(getByText('Community Leader')).toBeTruthy();
      expect(getByText('Government Official')).toBeTruthy();
      expect(getByText('Neighbor 1')).toBeTruthy();
      expect(getByText('Neighbor 2')).toBeTruthy();
    });
  });

  it('should show verification progress', async () => {
    const { getByText } = render(<VerificationWorkflowScreen />);
    
    await waitFor(() => {
      expect(getByText('1 of 5 completed')).toBeTruthy();
    });
  });

  it('should mark completed verifications', async () => {
    const { getByText, getAllByText } = render(<VerificationWorkflowScreen />);
    
    await waitFor(() => {
      const verifiedElements = getAllByText('Verified');
      expect(verifiedElements.length).toBeGreaterThan(0);
    });
  });

  it('should start verification when step is clicked', async () => {
    (LocationService.requestPermissions as jest.Mock).mockResolvedValue(true);
    
    const { getByText } = render(<VerificationWorkflowScreen />);
    
    await waitFor(() => {
      const communityLeaderStep = getByText('Community Leader');
      fireEvent.press(communityLeaderStep.parent.parent);
    });
    
    // Should show signatory form modal
    await waitFor(() => {
      expect(getByText('Signatory Information')).toBeTruthy();
    });
  });

  it('should validate signatory form', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    
    const { getByText, getByPlaceholderText } = render(<VerificationWorkflowScreen />);
    
    await waitFor(() => {
      const communityLeaderStep = getByText('Community Leader');
      fireEvent.press(communityLeaderStep.parent.parent);
    });
    
    await waitFor(() => {
      const continueButton = getByText('Continue');
      fireEvent.press(continueButton);
    });
    
    expect(alertSpy).toHaveBeenCalledWith('Error', 'Please fill in all required fields');
  });

  it('should create verification with signatory details', async () => {
    const mockVerification = {
      id: 'new-ver-1',
      parcelId: 'test-parcel-id',
      type: VerificationType.COMMUNITY_LEADER,
      status: 'pending',
    };
    
    (VerificationService.createVerification as jest.Mock).mockResolvedValue(mockVerification);
    const alertSpy = jest.spyOn(Alert, 'alert');
    
    const { getByText, getByPlaceholderText } = render(<VerificationWorkflowScreen />);
    
    await waitFor(() => {
      const communityLeaderStep = getByText('Community Leader');
      fireEvent.press(communityLeaderStep.parent.parent);
    });
    
    await waitFor(() => {
      fireEvent.changeText(getByPlaceholderText('Full Name *'), 'Chief Smith');
      fireEvent.changeText(getByPlaceholderText('Phone Number *'), '+23276123456');
      fireEvent.changeText(getByPlaceholderText('National ID (Optional)'), 'SL123456');
      
      const continueButton = getByText('Continue');
      fireEvent.press(continueButton);
    });
    
    await waitFor(() => {
      expect(VerificationService.createVerification).toHaveBeenCalledWith(
        'test-parcel-id',
        VerificationType.COMMUNITY_LEADER,
        expect.objectContaining({
          name: 'Chief Smith',
          phoneNumber: '+23276123456',
          nationalId: 'SL123456',
        })
      );
      
      expect(alertSpy).toHaveBeenCalledWith(
        'Capture Method',
        'How would you like to capture the verification?',
        expect.any(Array)
      );
    });
  });

  it('should handle signature capture', async () => {
    const mockVerification = {
      id: 'new-ver-1',
      parcelId: 'test-parcel-id',
      type: VerificationType.COMMUNITY_LEADER,
      status: 'pending',
    };
    
    (VerificationService.createVerification as jest.Mock).mockResolvedValue(mockVerification);
    (VerificationService.captureSignature as jest.Mock).mockResolvedValue(undefined);
    (VerificationService.completeVerification as jest.Mock).mockResolvedValue(mockVerification);
    
    const { getByText, getByPlaceholderText } = render(<VerificationWorkflowScreen />);
    
    // Start verification
    await waitFor(() => {
      const communityLeaderStep = getByText('Community Leader');
      fireEvent.press(communityLeaderStep.parent.parent);
    });
    
    // Fill form
    await waitFor(() => {
      fireEvent.changeText(getByPlaceholderText('Full Name *'), 'Chief Smith');
      fireEvent.changeText(getByPlaceholderText('Phone Number *'), '+23276123456');
      fireEvent.press(getByText('Continue'));
    });
    
    // Mock selecting signature option from alert
    const alertCalls = Alert.alert.mock.calls;
    const captureMethodAlert = alertCalls[alertCalls.length - 1];
    const signatureOption = captureMethodAlert[2].find(opt => opt.text === 'Digital Signature');
    signatureOption.onPress();
    
    // Should show signature modal
    await waitFor(() => {
      expect(getByText('Capture Signature')).toBeTruthy();
    });
  });

  it('should handle biometric capture', async () => {
    const mockVerification = {
      id: 'new-ver-1',
      parcelId: 'test-parcel-id',
      type: VerificationType.COMMUNITY_LEADER,
      status: 'pending',
    };
    
    (VerificationService.createVerification as jest.Mock).mockResolvedValue(mockVerification);
    (VerificationService.captureBiometric as jest.Mock).mockResolvedValue(undefined);
    (VerificationService.completeVerification as jest.Mock).mockResolvedValue(mockVerification);
    
    const alertSpy = jest.spyOn(Alert, 'alert');
    
    const { getByText, getByPlaceholderText } = render(<VerificationWorkflowScreen />);
    
    // Start verification
    await waitFor(() => {
      const communityLeaderStep = getByText('Community Leader');
      fireEvent.press(communityLeaderStep.parent.parent);
    });
    
    // Fill form
    await waitFor(() => {
      fireEvent.changeText(getByPlaceholderText('Full Name *'), 'Chief Smith');
      fireEvent.changeText(getByPlaceholderText('Phone Number *'), '+23276123456');
      fireEvent.press(getByText('Continue'));
    });
    
    // Mock selecting biometric option from alert
    const alertCalls = Alert.alert.mock.calls;
    const captureMethodAlert = alertCalls[alertCalls.length - 1];
    const biometricOption = captureMethodAlert[2].find(opt => opt.text === 'Biometric');
    biometricOption.onPress();
    
    await waitFor(() => {
      expect(VerificationService.captureBiometric).toHaveBeenCalledWith('new-ver-1', 'fingerprint');
      expect(VerificationService.completeVerification).toHaveBeenCalled();
    });
  });

  it('should handle location permission denial', async () => {
    (LocationService.requestPermissions as jest.Mock).mockResolvedValue(false);
    const alertSpy = jest.spyOn(Alert, 'alert');
    
    const { getByText } = render(<VerificationWorkflowScreen />);
    
    await waitFor(() => {
      const communityLeaderStep = getByText('Community Leader');
      fireEvent.press(communityLeaderStep.parent.parent);
    });
    
    expect(alertSpy).toHaveBeenCalledWith(
      'Permission Required',
      expect.stringContaining('Location permission')
    );
  });

  it('should show QR code modal', async () => {
    const mockVerification = {
      id: 'new-ver-1',
      parcelId: 'test-parcel-id',
      type: VerificationType.COMMUNITY_LEADER,
      status: 'pending',
    };
    
    (VerificationService.createVerification as jest.Mock).mockResolvedValue(mockVerification);
    (VerificationService.generateVerificationQR as jest.Mock).mockReturnValue('qr-data');
    
    const { getByText, getByPlaceholderText } = render(<VerificationWorkflowScreen />);
    
    // Start verification and create
    await waitFor(() => {
      const communityLeaderStep = getByText('Community Leader');
      fireEvent.press(communityLeaderStep.parent.parent);
    });
    
    await waitFor(() => {
      fireEvent.changeText(getByPlaceholderText('Full Name *'), 'Chief Smith');
      fireEvent.changeText(getByPlaceholderText('Phone Number *'), '+23276123456');
      fireEvent.press(getByText('Continue'));
    });
    
    // Mock selecting QR option
    const alertCalls = Alert.alert.mock.calls;
    const captureMethodAlert = alertCalls[alertCalls.length - 1];
    const qrOption = captureMethodAlert[2].find(opt => opt.text === 'QR Code');
    qrOption.onPress();
    
    await waitFor(() => {
      expect(getByText('Verification QR Code')).toBeTruthy();
      expect(getByText('Show this code to the verifier or scan their code')).toBeTruthy();
    });
  });

  it('should handle verification completion', async () => {
    const mockVerification = {
      id: 'new-ver-1',
      parcelId: 'test-parcel-id',
      type: VerificationType.COMMUNITY_LEADER,
      status: 'pending',
    };
    
    (VerificationService.createVerification as jest.Mock).mockResolvedValue(mockVerification);
    (VerificationService.captureBiometric as jest.Mock).mockResolvedValue(undefined);
    (VerificationService.completeVerification as jest.Mock).mockResolvedValue({
      ...mockVerification,
      status: 'completed',
    });
    
    const alertSpy = jest.spyOn(Alert, 'alert');
    
    const { getByText, getByPlaceholderText } = render(<VerificationWorkflowScreen />);
    
    // Complete verification flow
    await waitFor(() => {
      const communityLeaderStep = getByText('Community Leader');
      fireEvent.press(communityLeaderStep.parent.parent);
    });
    
    await waitFor(() => {
      fireEvent.changeText(getByPlaceholderText('Full Name *'), 'Chief Smith');
      fireEvent.changeText(getByPlaceholderText('Phone Number *'), '+23276123456');
      fireEvent.press(getByText('Continue'));
    });
    
    // Mock selecting biometric option
    const alertCalls = Alert.alert.mock.calls;
    const captureMethodAlert = alertCalls[alertCalls.length - 1];
    const biometricOption = captureMethodAlert[2].find(opt => opt.text === 'Biometric');
    biometricOption.onPress();
    
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Success',
        expect.stringContaining('Verification completed successfully'),
        expect.any(Array)
      );
    });
    
    // Mock pressing OK on success alert
    const successAlert = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    const okButton = successAlert[2][0];
    okButton.onPress();
    
    // Should reload data
    await waitFor(() => {
      expect(ParcelService.getParcel).toHaveBeenCalledTimes(2);
      expect(VerificationService.getParcelVerifications).toHaveBeenCalledTimes(2);
    });
  });

  it('should disable completed verification steps', async () => {
    const { getByText } = render(<VerificationWorkflowScreen />);
    
    await waitFor(() => {
      const ownerStep = getByText('Property Owner');
      const stepContainer = ownerStep.parent.parent;
      
      // Should not trigger onPress for completed step
      fireEvent.press(stepContainer);
      
      // Should not show modal
      expect(() => getByText('Signatory Information')).toThrow();
    });
  });
});
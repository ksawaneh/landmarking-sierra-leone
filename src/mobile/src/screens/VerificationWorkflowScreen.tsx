/**
 * Screen for multi-party verification workflow with signature and biometric capture
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SignatureCanvas } from '../components/SignatureCanvas';
import QRCode from 'react-native-qrcode-svg';
import { Camera } from 'expo-camera';
import { 
  ParcelStackParamList, 
  Parcel, 
  Verification, 
  VerificationType,
  VerificationSignatory 
} from '../types';
import { ParcelService } from '../services/ParcelService';
import { VerificationService } from '../services/VerificationService';
import { LocationService } from '../services/LocationService';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../styles/theme';
import { VERIFICATION_REQUIREMENTS, SUCCESS_MESSAGES, ERROR_MESSAGES } from '../constants';

type VerificationWorkflowNavigationProp = StackNavigationProp<ParcelStackParamList, 'ParcelDetails'>;
type VerificationWorkflowRouteProp = RouteProp<ParcelStackParamList, 'ParcelDetails'>;

const SCREEN_WIDTH = Dimensions.get('window').width;

interface VerificationStep {
  type: VerificationType;
  label: string;
  icon: string;
  description: string;
}

const VERIFICATION_STEPS: VerificationStep[] = [
  {
    type: VerificationType.OWNER,
    label: 'Property Owner',
    icon: 'person',
    description: 'Owner must verify the parcel details and boundaries',
  },
  {
    type: VerificationType.COMMUNITY_LEADER,
    label: 'Community Leader',
    icon: 'groups',
    description: 'Local chief or community leader verification',
  },
  {
    type: VerificationType.GOVERNMENT_OFFICIAL,
    label: 'Government Official',
    icon: 'account-balance',
    description: 'District land officer verification',
  },
  {
    type: VerificationType.NEIGHBOR,
    label: 'Neighbor 1',
    icon: 'home',
    description: 'Adjacent property owner verification',
  },
  {
    type: VerificationType.NEIGHBOR,
    label: 'Neighbor 2',
    icon: 'home',
    description: 'Second adjacent property owner verification',
  },
];

export const VerificationWorkflowScreen: React.FC = () => {
  const navigation = useNavigation<VerificationWorkflowNavigationProp>();
  const route = useRoute<VerificationWorkflowRouteProp>();
  const { user } = useAuth();
  const signatureRef = useRef<any>(null);

  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  
  // Form state
  const [signatoryForm, setSignatoryForm] = useState<VerificationSignatory>({
    id: '',
    name: '',
    role: VerificationType.OWNER,
    phoneNumber: '',
    nationalId: '',
  });
  
  const [currentVerification, setCurrentVerification] = useState<Verification | null>(null);
  const [signature, setSignature] = useState<string>('');
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);

  useEffect(() => {
    loadData();
    requestPermissions();
  }, [route.params.parcelId]);

  const loadData = async () => {
    try {
      const parcelData = await ParcelService.getParcel(route.params.parcelId);
      if (parcelData) {
        setParcel(parcelData);
        const verificationsData = await VerificationService.getParcelVerifications(parcelData.id);
        setVerifications(verificationsData);
        
        // Find current step based on completed verifications
        const completedSteps = VERIFICATION_STEPS.filter(step =>
          verificationsData.some(v => v.type === step.type && v.status === 'completed')
        );
        setCurrentStep(Math.min(completedSteps.length, VERIFICATION_STEPS.length - 1));
      }
    } catch (error) {
      console.error('Failed to load verification data:', error);
      Alert.alert('Error', 'Failed to load parcel data');
    } finally {
      setLoading(false);
    }
  };

  const requestPermissions = async () => {
    const locationPermission = await LocationService.requestPermissions();
    setHasLocationPermission(locationPermission);
    
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasCameraPermission(status === 'granted');
  };

  const startVerification = async (step: VerificationStep) => {
    if (!hasLocationPermission) {
      Alert.alert('Permission Required', ERROR_MESSAGES.LOCATION_PERMISSION_DENIED);
      return;
    }

    // Reset form
    setSignatoryForm({
      id: `signatory_${Date.now()}`,
      name: '',
      role: step.type,
      phoneNumber: '',
      nationalId: '',
    });
    
    setCurrentStep(VERIFICATION_STEPS.indexOf(step));
    setShowSignatureModal(true);
  };

  const createVerification = async () => {
    if (!signatoryForm.name || !signatoryForm.phoneNumber) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const verification = await VerificationService.createVerification(
        parcel!.id,
        VERIFICATION_STEPS[currentStep].type,
        signatoryForm
      );
      
      setCurrentVerification(verification);
      setShowSignatureModal(false);
      
      // Show options for signature capture
      Alert.alert(
        'Capture Method',
        'How would you like to capture the verification?',
        [
          { text: 'Digital Signature', onPress: () => setShowSignatureModal(true) },
          { text: 'Biometric', onPress: () => captureBiometric() },
          { text: 'QR Code', onPress: () => setShowQRModal(true) },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create verification');
    }
  };

  const handleSignature = async (signature: string) => {
    if (!currentVerification) return;
    
    try {
      await VerificationService.captureSignature(currentVerification.id, signature);
      setSignature(signature);
      setShowSignatureModal(false);
      
      // Complete verification
      await completeVerification();
    } catch (error) {
      Alert.alert('Error', 'Failed to capture signature');
    }
  };

  const captureBiometric = async () => {
    if (!currentVerification) return;
    
    try {
      await VerificationService.captureBiometric(currentVerification.id, 'fingerprint');
      
      // Complete verification
      await completeVerification();
    } catch (error) {
      Alert.alert('Error', ERROR_MESSAGES.BIOMETRIC_FAILED);
    }
  };

  const completeVerification = async () => {
    if (!currentVerification) return;
    
    try {
      await VerificationService.completeVerification(currentVerification.id);
      
      Alert.alert(
        'Success',
        SUCCESS_MESSAGES.VERIFICATION_COMPLETED,
        [
          {
            text: 'OK',
            onPress: () => {
              loadData(); // Reload verifications
              setCurrentVerification(null);
              setSignature('');
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to complete verification');
    }
  };

  const handleQRCodeScanned = ({ data }: { data: string }) => {
    const qrData = VerificationService.parseVerificationQR(data);
    if (qrData && qrData.parcelId === parcel?.id) {
      setShowScanModal(false);
      Alert.alert('Success', 'Valid QR code scanned');
      // Continue with verification
    } else {
      Alert.alert('Error', 'Invalid QR code');
    }
  };

  const getStepStatus = (step: VerificationStep, index: number): 'completed' | 'current' | 'pending' => {
    const stepVerification = verifications.find(
      v => v.type === step.type && v.status === 'completed'
    );
    
    if (stepVerification) return 'completed';
    if (index === currentStep) return 'current';
    return 'pending';
  };

  const renderVerificationStep = (step: VerificationStep, index: number) => {
    const status = getStepStatus(step, index);
    const isCompleted = status === 'completed';
    const isCurrent = status === 'current';
    
    return (
      <TouchableOpacity
        key={`${step.type}_${index}`}
        style={[
          styles.stepCard,
          isCompleted && styles.stepCardCompleted,
          isCurrent && styles.stepCardCurrent,
        ]}
        onPress={() => !isCompleted && startVerification(step)}
        disabled={isCompleted || loading}
      >
        <View style={styles.stepHeader}>
          <View style={[
            styles.stepIcon,
            isCompleted && styles.stepIconCompleted,
            isCurrent && styles.stepIconCurrent,
          ]}>
            <Icon 
              name={isCompleted ? 'check-circle' : step.icon} 
              size={24} 
              color={isCompleted ? theme.colors.success : 
                     isCurrent ? theme.colors.primary : 
                     theme.colors.text.secondary} 
            />
          </View>
          <View style={styles.stepContent}>
            <Text style={[
              styles.stepLabel,
              isCompleted && styles.stepLabelCompleted,
            ]}>{step.label}</Text>
            <Text style={styles.stepDescription}>{step.description}</Text>
          </View>
        </View>
        
        {isCompleted && (
          <View style={styles.completedInfo}>
            <Icon name="verified-user" size={16} color={theme.colors.success} />
            <Text style={styles.completedText}>Verified</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const progress = (verifications.filter(v => v.status === 'completed').length / VERIFICATION_STEPS.length) * 100;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Parcel Info */}
        <View style={styles.parcelInfo}>
          <Text style={styles.parcelNumber}>{parcel?.parcelNumber}</Text>
          <Text style={styles.parcelOwner}>{parcel?.ownerName}</Text>
          <View style={styles.parcelDetails}>
            <View style={styles.detailItem}>
              <Icon name="landscape" size={16} color={theme.colors.text.secondary} />
              <Text style={styles.detailText}>{parcel?.area.toFixed(2)} m²</Text>
            </View>
            <View style={styles.detailItem}>
              <Icon name="location-on" size={16} color={theme.colors.text.secondary} />
              <Text style={styles.detailText}>{parcel?.location.district}</Text>
            </View>
          </View>
        </View>

        {/* Progress */}
        <View style={styles.progressSection}>
          <Text style={styles.progressTitle}>Verification Progress</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {verifications.filter(v => v.status === 'completed').length} of {VERIFICATION_STEPS.length} completed
          </Text>
        </View>

        {/* Verification Steps */}
        <View style={styles.stepsSection}>
          <Text style={styles.sectionTitle}>Required Verifications</Text>
          {VERIFICATION_STEPS.map((step, index) => renderVerificationStep(step, index))}
        </View>
      </ScrollView>

      {/* Signatory Form Modal */}
      <Modal
        visible={showSignatureModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSignatureModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Signatory Information</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Full Name *"
              value={signatoryForm.name}
              onChangeText={(text) => setSignatoryForm({ ...signatoryForm, name: text })}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Phone Number *"
              value={signatoryForm.phoneNumber}
              onChangeText={(text) => setSignatoryForm({ ...signatoryForm, phoneNumber: text })}
              keyboardType="phone-pad"
            />
            
            <TextInput
              style={styles.input}
              placeholder="National ID (Optional)"
              value={signatoryForm.nationalId}
              onChangeText={(text) => setSignatoryForm({ ...signatoryForm, nationalId: text })}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => setShowSignatureModal(false)}
              >
                <Text style={styles.buttonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={createVerification}
              >
                <Text style={styles.buttonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Signature Capture Modal */}
      <Modal
        visible={showSignatureModal && !!currentVerification}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSignatureModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, styles.signatureModal]}>
            <Text style={styles.modalTitle}>Capture Signature</Text>
            
            <SignatureCanvas
              onSave={handleSignature}
              height={200}
            />
          </View>
        </View>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        visible={showQRModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verification QR Code</Text>
            <Text style={styles.modalSubtitle}>
              Show this code to the verifier or scan their code
            </Text>
            
            <View style={styles.qrContainer}>
              <QRCode
                value={VerificationService.generateVerificationQR(
                  parcel?.id || '',
                  VERIFICATION_STEPS[currentStep].type
                )}
                size={200}
              />
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => {
                  setShowQRModal(false);
                  setShowScanModal(true);
                }}
              >
                <Icon name="qr-code-scanner" size={20} color={theme.colors.primary} />
                <Text style={styles.buttonSecondaryText}>Scan Code</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={() => setShowQRModal(false)}
              >
                <Text style={styles.buttonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  parcelInfo: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  parcelNumber: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
  },
  parcelOwner: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  parcelDetails: {
    flexDirection: 'row',
    marginTop: theme.spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.lg,
  },
  detailText: {
    marginLeft: theme.spacing.xs,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
  },
  progressSection: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  progressTitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.colors.border.light,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
  },
  progressText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
  },
  stepsSection: {
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  stepCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
  },
  stepCardCompleted: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.success + '10',
  },
  stepCardCurrent: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  stepIconCompleted: {
    backgroundColor: theme.colors.success + '20',
  },
  stepIconCurrent: {
    backgroundColor: theme.colors.primary + '20',
  },
  stepContent: {
    flex: 1,
  },
  stepLabel: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.text.primary,
  },
  stepLabelCompleted: {
    color: theme.colors.success,
  },
  stepDescription: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  completedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  completedText: {
    marginLeft: theme.spacing.xs,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.success,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  signatureModal: {
    maxWidth: SCREEN_WIDTH - theme.spacing.lg * 2,
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
  },
  signatureContainer: {
    height: 200,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  qrContainer: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginHorizontal: theme.spacing.xs,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  buttonText: {
    color: theme.colors.accent,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.medium,
    marginLeft: theme.spacing.xs,
  },
  buttonSecondaryText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.medium,
    marginLeft: theme.spacing.xs,
  },
});
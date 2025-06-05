/**
 * Type definitions for the multi-party verification system
 */

import { DistrictName } from '../government/schemas/government-data.types';

/**
 * Party roles in the verification process
 */
export enum PartyRole {
  PROPERTY_OWNER = 'property_owner',
  COMMUNITY_LEADER = 'community_leader',
  CHIEF = 'chief',
  GOVERNMENT_OFFICIAL = 'government_official',
  NEIGHBOR = 'neighbor',
  WITNESS = 'witness',
  SURVEYOR = 'surveyor',
  LAWYER = 'lawyer'
}

/**
 * Biometric data types captured during verification
 */
export interface BiometricData {
  fingerprint?: {
    data: string; // Base64 encoded
    quality: number; // 0-100
    captureDevice: string;
  };
  face?: {
    data: string; // Base64 encoded
    confidence: number; // 0-100
    captureDevice: string;
  };
  voice?: {
    data: string; // Base64 encoded audio
    duration: number; // seconds
    language: 'en' | 'krio' | 'temne' | 'mende';
    transcript?: string;
  };
  captureTimestamp: Date;
  captureLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number; // meters
  };
}

/**
 * Individual party in the verification process
 */
export interface VerificationParty {
  id: string;
  role: PartyRole;
  name: string;
  nationalId?: string;
  phoneNumber?: string;
  address: string;
  district: DistrictName;
  biometrics?: BiometricData;
  trustScore?: number; // 0-100 based on past verifications
  isVerified: boolean;
  verifiedAt?: Date;
}

/**
 * Digital signature from a party
 */
export interface PartySignature {
  partyId: string;
  signature: string; // Cryptographic signature
  signedData: string; // What was signed
  timestamp: Date;
  publicKey: string;
  signatureType: 'ECDSA' | 'RSA' | 'THRESHOLD';
  deviceInfo?: {
    deviceId: string;
    deviceType: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

/**
 * Threshold signature scheme for multi-party signing
 */
export interface ThresholdSignature {
  threshold: number; // k of n required
  totalParties: number; // n total parties
  shares: Array<{
    partyId: string;
    shareIndex: number;
    share: string; // Encrypted share
  }>;
  combinedSignature?: string; // Final signature when threshold met
  isComplete: boolean;
}

/**
 * Verification requirements for different scenarios
 */
export interface VerificationRequirements {
  landType: 'residential' | 'commercial' | 'agricultural' | 'industrial';
  district: DistrictName;
  requiredRoles: Array<{
    role: PartyRole;
    count: number;
    mandatory: boolean;
  }>;
  minimumSignatures: number;
  biometricRequired: boolean;
  governmentApprovalRequired: boolean;
  customRequirements?: string[];
}

/**
 * Complete verification record
 */
export interface VerificationRecord {
  id: string;
  parcelId: string;
  verificationType: 'initial_registration' | 'transfer' | 'dispute_resolution' | 'update';
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'expired';
  
  // Parties involved
  parties: VerificationParty[];
  signatures: PartySignature[];
  thresholdSignature?: ThresholdSignature;
  
  // Requirements and progress
  requirements: VerificationRequirements;
  currentSignatures: number;
  requiredSignatures: number;
  
  // Evidence and documentation
  evidence: Array<{
    type: 'photo' | 'video' | 'document' | 'audio';
    url: string;
    hash: string; // SHA-256 of file
    uploadedBy: string;
    uploadedAt: Date;
    description?: string;
  }>;
  
  // Timeline
  initiatedAt: Date;
  initiatedBy: string;
  completedAt?: Date;
  expiresAt: Date; // Verifications expire if not completed
  
  // Audit trail
  history: Array<{
    action: string;
    performedBy: string;
    timestamp: Date;
    details?: any;
  }>;
  
  // Rejection details if applicable
  rejectionReason?: string;
  rejectedBy?: string;
  
  // Blockchain reference when recorded
  blockchainTxId?: string;
  blockNumber?: number;
}

/**
 * Verification session for collecting signatures
 */
export interface VerificationSession {
  id: string;
  verificationId: string;
  sessionType: 'in_person' | 'remote' | 'hybrid';
  location?: {
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  scheduledAt?: Date;
  startedAt?: Date;
  endedAt?: Date;
  attendees: string[]; // Party IDs
  facilitator?: {
    id: string;
    name: string;
    role: 'field_agent' | 'government_official' | 'community_clerk';
  };
  notes?: string;
  recordingUrl?: string; // If session was recorded
}

/**
 * Verification statistics for trust scoring
 */
export interface VerificationStats {
  partyId: string;
  totalVerifications: number;
  successfulVerifications: number;
  rejectedVerifications: number;
  disputesInvolved: number;
  avgResponseTime: number; // hours
  lastActiveDate: Date;
  trustScore: number; // Calculated based on history
}

/**
 * Configuration for verification rules by district/area
 */
export interface VerificationConfig {
  district: DistrictName;
  landType: string;
  rules: {
    minimumParties: number;
    requiredRoles: PartyRole[];
    optionalRoles: PartyRole[];
    biometricMandatory: boolean;
    expirationDays: number;
    allowRemoteSignatures: boolean;
    requirePhysicalMeeting: boolean;
  };
  customValidations?: Array<{
    name: string;
    description: string;
    validator: (record: VerificationRecord) => boolean;
  }>;
}

/**
 * Fraud detection signals
 */
export interface FraudSignal {
  type: 'duplicate_signature' | 'velocity_anomaly' | 'biometric_mismatch' | 'location_anomaly' | 'pattern_detection';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: any;
  detectedAt: Date;
  recommendedAction: string;
}
/**
 * Core type definitions for the LandMarking mobile app
 */

// User types
export interface User {
  id: string;
  username: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  permissions: string[];
  biometricEnabled: boolean;
  nationalId?: string;
  district?: string;
  chiefdom?: string;
  createdAt: string;
  updatedAt: string;
}

// Auth types
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  biometricEnabled: boolean;
}

export enum UserRole {
  CITIZEN = 'citizen',
  GOVERNMENT_OFFICIAL = 'government_official',
  COMMUNITY_LEADER = 'community_leader',
  SURVEYOR = 'surveyor',
  ADMIN = 'admin'
}

// Parcel types
export interface Parcel {
  id: string;
  parcelNumber: string;
  ownerId: string;
  ownerName: string;
  location: Location;
  boundaries: Boundary[];
  area: number; // in square meters
  landUse: LandUse;
  documents: Document[];
  verificationStatus: VerificationStatus;
  verifications: Verification[];
  registrationDate: string;
  lastUpdated: string;
  localChanges?: boolean; // For offline sync tracking
  syncStatus?: SyncStatus;
}

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  district: string;
  chiefdom: string;
  village?: string;
  address?: string;
}

export interface Boundary {
  id: string;
  points: BoundaryPoint[];
  type: 'manual' | 'gps' | 'ai_detected';
  createdAt: string;
  createdBy: string;
}

export interface BoundaryPoint {
  latitude: number;
  longitude: number;
  order: number;
}

export enum LandUse {
  RESIDENTIAL = 'residential',
  AGRICULTURAL = 'agricultural',
  COMMERCIAL = 'commercial',
  INDUSTRIAL = 'industrial',
  MIXED = 'mixed',
  VACANT = 'vacant'
}

// Document types
export interface Document {
  id: string;
  type: DocumentType;
  uri: string;
  localUri?: string; // For offline storage
  hash: string; // For integrity verification
  uploadedAt: string;
  uploadedBy: string;
  verified: boolean;
  metadata?: Record<string, any>;
}

export enum DocumentType {
  DEED = 'deed',
  SURVEY_PLAN = 'survey_plan',
  TAX_RECEIPT = 'tax_receipt',
  ID_CARD = 'id_card',
  PHOTO = 'photo',
  OTHER = 'other'
}

// Verification types
export interface Verification {
  id: string;
  parcelId: string;
  type: VerificationType;
  signatory: VerificationSignatory;
  signature?: string;
  biometricData?: BiometricData;
  timestamp: string;
  location: Location;
  status: 'pending' | 'completed' | 'rejected';
  notes?: string;
}

export enum VerificationType {
  OWNER = 'owner',
  NEIGHBOR = 'neighbor',
  COMMUNITY_LEADER = 'community_leader',
  GOVERNMENT_OFFICIAL = 'government_official'
}

export interface VerificationSignatory {
  id: string;
  name: string;
  role: VerificationType;
  phoneNumber?: string;
  nationalId?: string;
}

export interface BiometricData {
  type: 'fingerprint' | 'face';
  template?: string; // Encrypted biometric template
  captured: boolean;
  capturedAt?: string;
}

export enum VerificationStatus {
  DRAFT = 'draft',
  PENDING_VERIFICATION = 'pending_verification',
  PARTIALLY_VERIFIED = 'partially_verified',
  FULLY_VERIFIED = 'fully_verified',
  REJECTED = 'rejected'
}

// Offline sync types
export interface SyncStatus {
  lastSyncedAt?: string;
  pendingChanges: number;
  syncInProgress: boolean;
  lastError?: string;
}

export interface PendingOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: 'parcel' | 'verification' | 'document';
  entityId: string;
  payload: any;
  timestamp: string;
  retryCount: number;
  lastError?: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: {
    page?: number;
    totalPages?: number;
    totalItems?: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Login: undefined;
  Register: undefined;
  BiometricSetup: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Parcels: undefined;
  Verification: undefined;
  Profile: undefined;
};

export type ParcelStackParamList = {
  ParcelList: undefined;
  ParcelDetails: { parcelId: string };
  ParcelRegistration: undefined;
  BoundaryCapture: { parcelId?: string };
  DocumentCapture: { parcelId: string };
};
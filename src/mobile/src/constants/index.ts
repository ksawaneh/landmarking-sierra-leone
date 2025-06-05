/**
 * Application constants for LandMarking mobile app
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'https://api.landmarking.sl',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  OFFLINE_RETRY_DELAY: 5000, // 5 seconds
};

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: '@landmarking:auth_token',
  REFRESH_TOKEN: '@landmarking:refresh_token',
  USER_DATA: '@landmarking:user_data',
  BIOMETRIC_ENABLED: '@landmarking:biometric_enabled',
  BIOMETRIC_CREDENTIALS: '@landmarking:biometric_credentials',
  PENDING_OPERATIONS: '@landmarking:pending_operations',
  CACHED_PARCELS: '@landmarking:cached_parcels',
  LAST_SYNC: '@landmarking:last_sync',
  APP_SETTINGS: '@landmarking:app_settings',
};

// Database Configuration
export const DATABASE_CONFIG = {
  NAME: 'landmarking.db',
  VERSION: 1,
};

// Offline Configuration
export const OFFLINE_CONFIG = {
  MAX_OFFLINE_DAYS: 60,
  SYNC_INTERVAL: 300000, // 5 minutes
  MAX_PENDING_OPERATIONS: 1000,
  CACHE_SIZE_LIMIT: 100 * 1024 * 1024, // 100 MB
  MAX_RETRY_ATTEMPTS: 3,
};

// Location Configuration
export const LOCATION_CONFIG = {
  HIGH_ACCURACY: {
    accuracy: 'high',
    timeInterval: 5000,
    distanceInterval: 5,
  },
  BALANCED: {
    accuracy: 'balanced',
    timeInterval: 10000,
    distanceInterval: 10,
  },
  LOW_POWER: {
    accuracy: 'low',
    timeInterval: 30000,
    distanceInterval: 50,
  },
};

// Map Configuration
export const MAP_CONFIG = {
  DEFAULT_REGION: {
    latitude: 8.484,
    longitude: -13.2299,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  },
  MIN_ZOOM_LEVEL: 5,
  MAX_ZOOM_LEVEL: 20,
  CLUSTER_RADIUS: 50,
};

// Verification Requirements
export const VERIFICATION_REQUIREMENTS = {
  MIN_SIGNATURES: 5,
  REQUIRED_PARTIES: ['owner', 'community_leader', 'government_official', 'neighbor_1', 'neighbor_2'],
  SIGNATURE_EXPIRY_DAYS: 30,
  MAX_VERIFICATION_DISTANCE: 1000, // meters
};

// Document Configuration
export const DOCUMENT_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
  IMAGE_QUALITY: 0.8,
  THUMBNAIL_SIZE: { width: 200, height: 200 },
};

// Sierra Leone Administrative Data
export const SIERRA_LEONE = {
  DISTRICTS: [
    'Bo',
    'Bombali',
    'Bonthe',
    'Falaba',
    'Kailahun',
    'Kambia',
    'Karene',
    'Kenema',
    'Koinadugu',
    'Kono',
    'Moyamba',
    'Port Loko',
    'Pujehun',
    'Tonkolili',
    'Western Area Rural',
    'Western Area Urban',
  ],
  // Note: Chiefdoms vary by district and should be loaded dynamically
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'No internet connection. Your changes will be saved and synced when online.',
  AUTH_FAILED: 'Authentication failed. Please login again.',
  BIOMETRIC_FAILED: 'Biometric authentication failed. Please try again.',
  LOCATION_PERMISSION_DENIED: 'Location permission is required to use this feature.',
  CAMERA_PERMISSION_DENIED: 'Camera permission is required to capture documents.',
  SYNC_FAILED: 'Failed to sync data. Will retry automatically.',
  INVALID_COORDINATES: 'Invalid GPS coordinates. Please ensure location services are enabled.',
  VERIFICATION_INCOMPLETE: 'All required verifications must be completed.',
  MAX_OFFLINE_EXCEEDED: 'Maximum offline period exceeded. Please connect to sync.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  PARCEL_CREATED: 'Parcel registered successfully!',
  PARCEL_UPDATED: 'Parcel updated successfully!',
  VERIFICATION_COMPLETED: 'Verification completed successfully!',
  SYNC_COMPLETED: 'Data synchronized successfully!',
  DOCUMENT_UPLOADED: 'Document uploaded successfully!',
  BIOMETRIC_ENROLLED: 'Biometric authentication enabled!',
};

// App Configuration
export const APP_CONFIG = {
  APP_NAME: 'LandMarking Sierra Leone',
  VERSION: '1.0.0',
  BUILD_NUMBER: 1,
  SUPPORT_EMAIL: 'support@landmarking.sl',
  SUPPORT_PHONE: '+232 76 123 456',
  PRIVACY_URL: 'https://landmarking.sl/privacy',
  TERMS_URL: 'https://landmarking.sl/terms',
};
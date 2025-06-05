/**
 * Type definitions for SMS/USSD service
 */

// SMS Types
export interface SMSMessage {
  id: string;
  from: string;
  to: string;
  message: string;
  timestamp: Date;
  provider: TelcoProvider;
  status: MessageStatus;
}

export interface SMSResponse {
  to: string;
  message: string;
  priority?: 'high' | 'normal';
}

export enum MessageStatus {
  RECEIVED = 'received',
  PROCESSING = 'processing',
  SENT = 'sent',
  FAILED = 'failed',
  DELIVERED = 'delivered'
}

// USSD Types
export interface USSDSession {
  sessionId: string;
  msisdn: string;
  state: USSDState;
  data: Record<string, any>;
  lastActivity: Date;
  provider: TelcoProvider;
}

export interface USSDRequest {
  sessionId: string;
  msisdn: string;
  input: string;
  newSession: boolean;
  provider: TelcoProvider;
}

export interface USSDResponse {
  message: string;
  continueSession: boolean;
}

export enum USSDState {
  MAIN_MENU = 'main_menu',
  CHECK_PARCEL = 'check_parcel',
  VERIFY_PARCEL = 'verify_parcel',
  VERIFY_PIN = 'verify_pin',
  REGISTER_PARCEL = 'register_parcel',
  MY_PARCELS = 'my_parcels',
  VERIFICATION_STATUS = 'verification_status',
  HELP = 'help'
}

// Provider Types
export enum TelcoProvider {
  ORANGE = 'orange',
  AFRICELL = 'africell',
  QCELL = 'qcell'
}

export interface TelcoConfig {
  provider: TelcoProvider;
  apiUrl: string;
  apiKey: string;
  apiSecret: string;
  senderId: string;
}

// Command Types
export enum SMSCommand {
  CHECK = 'CHECK',
  VERIFY = 'VERIFY',
  REGISTER = 'REGISTER',
  STATUS = 'STATUS',
  HELP = 'HELP'
}

export interface CommandHandler {
  command: SMSCommand;
  pattern: RegExp;
  handler: (message: SMSMessage, matches: RegExpMatchArray) => Promise<SMSResponse>;
}

// User Session
export interface UserSession {
  msisdn: string;
  authenticated: boolean;
  pin?: string;
  lastActivity: Date;
  attempts: number;
}

// API Integration Types
export interface ParcelInfo {
  id: string;
  parcelNumber: string;
  ownerName: string;
  area: number;
  location: {
    district: string;
    chiefdom: string;
  };
  verificationStatus: string;
  verificationCount: number;
  requiredVerifications: number;
}

export interface VerificationRequest {
  parcelId: string;
  msisdn: string;
  pin: string;
  timestamp: Date;
}

// Service Configuration
export interface ServiceConfig {
  providers: TelcoConfig[];
  ussdShortCode: string;
  sessionTimeout: number;
  maxAttempts: number;
  rateLimits: {
    sms: {
      points: number;
      duration: number;
    };
    ussd: {
      points: number;
      duration: number;
    };
  };
}

// Error Types
export class SMSError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'SMSError';
  }
}

export class USSDError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'USSDError';
  }
}
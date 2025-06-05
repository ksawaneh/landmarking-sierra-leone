/**
 * USSD service for handling menu-based interactions
 */

import {
  USSDSession,
  USSDRequest,
  USSDResponse,
  USSDState,
  TelcoProvider,
  USSDError
} from '../types';
import { SessionManager } from './SessionManager';
import { LandMarkingAPI } from './LandMarkingAPI';
import { logger } from '../utils/logger';
import NodeCache from 'node-cache';

interface MenuOption {
  key: string;
  label: string;
  nextState?: USSDState;
  action?: (session: USSDSession, input: string) => Promise<void>;
}

export class USSDService {
  private sessionManager: SessionManager;
  private api: LandMarkingAPI;
  private sessionCache: NodeCache;
  private readonly sessionTimeout = 300; // 5 minutes

  constructor(sessionManager: SessionManager, api: LandMarkingAPI) {
    this.sessionManager = sessionManager;
    this.api = api;
    this.sessionCache = new NodeCache({ stdTTL: this.sessionTimeout });
  }

  /**
   * Process USSD request
   */
  async processRequest(request: USSDRequest): Promise<USSDResponse> {
    try {
      logger.info('Processing USSD request', {
        sessionId: request.sessionId,
        msisdn: request.msisdn,
        newSession: request.newSession
      });

      let session: USSDSession;

      if (request.newSession) {
        // Create new session
        session = await this.createSession(request);
      } else {
        // Get existing session
        session = await this.getSession(request.sessionId);
        if (!session) {
          // Session expired, restart
          return {
            message: 'Session expired. Please dial *384# again.',
            continueSession: false
          };
        }
      }

      // Process input based on current state
      const response = await this.handleState(session, request.input);

      // Save session if continuing
      if (response.continueSession) {
        this.saveSession(session);
      } else {
        this.endSession(session.sessionId);
      }

      return response;
    } catch (error) {
      logger.error('Error processing USSD request', error);
      return {
        message: 'Service temporarily unavailable. Please try again later.',
        continueSession: false
      };
    }
  }

  /**
   * Create new USSD session
   */
  private async createSession(request: USSDRequest): Promise<USSDSession> {
    const session: USSDSession = {
      sessionId: request.sessionId,
      msisdn: request.msisdn,
      state: USSDState.MAIN_MENU,
      data: {},
      lastActivity: new Date(),
      provider: request.provider
    };

    // Check if user is registered
    const userExists = await this.sessionManager.userExists(request.msisdn);
    session.data.registered = userExists;

    this.saveSession(session);
    return session;
  }

  /**
   * Get session from cache
   */
  private async getSession(sessionId: string): Promise<USSDSession | null> {
    const session = this.sessionCache.get<USSDSession>(sessionId);
    if (!session) {
      return null;
    }

    // Update last activity
    session.lastActivity = new Date();
    return session;
  }

  /**
   * Save session to cache
   */
  private saveSession(session: USSDSession): void {
    this.sessionCache.set(session.sessionId, session);
  }

  /**
   * End session
   */
  private endSession(sessionId: string): void {
    this.sessionCache.del(sessionId);
  }

  /**
   * Handle state logic
   */
  private async handleState(session: USSDSession, input: string): Promise<USSDResponse> {
    switch (session.state) {
      case USSDState.MAIN_MENU:
        return this.handleMainMenu(session, input);

      case USSDState.CHECK_PARCEL:
        return this.handleCheckParcel(session, input);

      case USSDState.VERIFY_PARCEL:
        return this.handleVerifyParcel(session, input);

      case USSDState.VERIFY_PIN:
        return this.handleVerifyPIN(session, input);

      case USSDState.REGISTER_PARCEL:
        return this.handleRegisterParcel(session, input);

      case USSDState.MY_PARCELS:
        return this.handleMyParcels(session, input);

      case USSDState.VERIFICATION_STATUS:
        return this.handleVerificationStatus(session, input);

      case USSDState.HELP:
        return this.handleHelp(session, input);

      default:
        return {
          message: 'Invalid option. Please try again.',
          continueSession: false
        };
    }
  }

  /**
   * Handle main menu
   */
  private async handleMainMenu(session: USSDSession, input: string): Promise<USSDResponse> {
    if (input === '') {
      // Display main menu
      const menu = `Welcome to LandMarking
1. Check Parcel
2. Verify Parcel
3. Register${session.data.registered ? '' : ' (Not registered)'}
4. My Parcels
5. Verification Status
6. Help`;

      return {
        message: menu,
        continueSession: true
      };
    }

    // Process menu selection
    switch (input) {
      case '1':
        session.state = USSDState.CHECK_PARCEL;
        return {
          message: 'Enter Parcel ID:',
          continueSession: true
        };

      case '2':
        if (!session.data.registered) {
          return {
            message: 'You need to register first. Send REGISTER to 1234.',
            continueSession: false
          };
        }
        session.state = USSDState.VERIFY_PARCEL;
        return {
          message: 'Enter Parcel ID:',
          continueSession: true
        };

      case '3':
        session.state = USSDState.REGISTER_PARCEL;
        return {
          message: 'To register, send REGISTER to 1234. You will receive a PIN.',
          continueSession: false
        };

      case '4':
        session.state = USSDState.MY_PARCELS;
        return this.handleMyParcels(session, '');

      case '5':
        session.state = USSDState.VERIFICATION_STATUS;
        return this.handleVerificationStatus(session, '');

      case '6':
        session.state = USSDState.HELP;
        return this.handleHelp(session, '');

      default:
        return {
          message: 'Invalid option. Please select 1-6.',
          continueSession: true
        };
    }
  }

  /**
   * Handle check parcel
   */
  private async handleCheckParcel(session: USSDSession, input: string): Promise<USSDResponse> {
    if (input === '') {
      return {
        message: 'Enter Parcel ID:',
        continueSession: true
      };
    }

    try {
      const parcel = await this.api.getParcelInfo(input.toUpperCase());

      if (!parcel) {
        return {
          message: `Parcel ${input} not found.\n\n0. Main Menu`,
          continueSession: true
        };
      }

      const message = `Parcel: ${parcel.parcelNumber}
Owner: ${this.truncateName(parcel.ownerName)}
Area: ${parcel.area}m²
${parcel.location.chiefdom}, ${parcel.location.district}
Status: ${parcel.verificationStatus}

0. Main Menu`;

      session.state = USSDState.MAIN_MENU;
      return {
        message,
        continueSession: true
      };
    } catch (error) {
      logger.error('Error checking parcel', error);
      return {
        message: 'Error checking parcel. Please try again.\n\n0. Main Menu',
        continueSession: true
      };
    }
  }

  /**
   * Handle verify parcel
   */
  private async handleVerifyParcel(session: USSDSession, input: string): Promise<USSDResponse> {
    if (input === '0') {
      session.state = USSDState.MAIN_MENU;
      return this.handleMainMenu(session, '');
    }

    if (!session.data.parcelId) {
      // First input - parcel ID
      session.data.parcelId = input.toUpperCase();
      session.state = USSDState.VERIFY_PIN;
      return {
        message: 'Enter your PIN:',
        continueSession: true
      };
    }

    return {
      message: 'Invalid input.',
      continueSession: false
    };
  }

  /**
   * Handle verify PIN
   */
  private async handleVerifyPIN(session: USSDSession, input: string): Promise<USSDResponse> {
    if (input === '0') {
      session.state = USSDState.MAIN_MENU;
      return this.handleMainMenu(session, '');
    }

    try {
      // Validate PIN
      const userSession = await this.sessionManager.validatePIN(session.msisdn, input);
      if (!userSession) {
        return {
          message: 'Invalid PIN. Please try again or send HELP to 1234.',
          continueSession: false
        };
      }

      // Submit verification
      const result = await this.api.submitVerification({
        parcelId: session.data.parcelId,
        msisdn: session.msisdn,
        pin: input,
        timestamp: new Date()
      });

      const message = result.success
        ? `Verification submitted for ${session.data.parcelId}.\n${result.message}`
        : `Verification failed: ${result.message}`;

      // Clear sensitive data
      delete session.data.parcelId;
      session.state = USSDState.MAIN_MENU;

      return {
        message: message + '\n\n0. Main Menu',
        continueSession: true
      };
    } catch (error) {
      logger.error('Error verifying parcel', error);
      return {
        message: 'Error processing verification. Please try again.',
        continueSession: false
      };
    }
  }

  /**
   * Handle register parcel
   */
  private async handleRegisterParcel(session: USSDSession, input: string): Promise<USSDResponse> {
    return {
      message: 'To register a parcel:\n1. Send REGISTER to 1234\n2. Visit landmarking.gov.sl\n3. Call 117',
      continueSession: false
    };
  }

  /**
   * Handle my parcels
   */
  private async handleMyParcels(session: USSDSession, input: string): Promise<USSDResponse> {
    if (input === '0') {
      session.state = USSDState.MAIN_MENU;
      return this.handleMainMenu(session, '');
    }

    try {
      const parcels = await this.api.searchParcelsByPhone(session.msisdn);

      if (parcels.length === 0) {
        return {
          message: 'No parcels found.\n\n0. Main Menu',
          continueSession: true
        };
      }

      const parcelList = parcels.slice(0, 3).map((p, i) => 
        `${i + 1}. ${p.parcelNumber} (${p.location.chiefdom})`
      ).join('\n');

      const message = `Your Parcels:\n${parcelList}\n\n0. Main Menu`;

      session.state = USSDState.MAIN_MENU;
      return {
        message,
        continueSession: true
      };
    } catch (error) {
      logger.error('Error fetching parcels', error);
      return {
        message: 'Error fetching parcels. Please try again.\n\n0. Main Menu',
        continueSession: true
      };
    }
  }

  /**
   * Handle verification status
   */
  private async handleVerificationStatus(session: USSDSession, input: string): Promise<USSDResponse> {
    if (input === '0') {
      session.state = USSDState.MAIN_MENU;
      return this.handleMainMenu(session, '');
    }

    try {
      const verifications = await this.api.getUserVerifications(session.msisdn);

      if (verifications.length === 0) {
        return {
          message: 'No verification requests.\n\n0. Main Menu',
          continueSession: true
        };
      }

      const verList = verifications.slice(0, 3).map(v => 
        `${v.parcelId}: ${v.status}`
      ).join('\n');

      const message = `Your Verifications:\n${verList}\n\n0. Main Menu`;

      session.state = USSDState.MAIN_MENU;
      return {
        message,
        continueSession: true
      };
    } catch (error) {
      logger.error('Error fetching verifications', error);
      return {
        message: 'Error fetching status. Please try again.\n\n0. Main Menu',
        continueSession: true
      };
    }
  }

  /**
   * Handle help
   */
  private async handleHelp(session: USSDSession, input: string): Promise<USSDResponse> {
    const helpText = `LandMarking Help:
- Check ownership
- Verify parcels
- View your parcels
SMS: Send HELP to 1234
Call: 117
Web: landmarking.gov.sl

0. Main Menu`;

    session.state = USSDState.MAIN_MENU;
    return {
      message: helpText,
      continueSession: true
    };
  }

  /**
   * Truncate name for USSD display
   */
  private truncateName(name: string, maxLength: number = 20): string {
    if (name.length <= maxLength) {
      return name;
    }
    return name.substring(0, maxLength - 3) + '...';
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    activeSessions: number;
    totalRequests: number;
  }> {
    const keys = this.sessionCache.keys();
    return {
      activeSessions: keys.length,
      totalRequests: 0 // Would need to track this separately
    };
  }
}
/**
 * SMS service for handling text message commands
 */

import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { SMSMessage, SMSResponse, SMSCommand, CommandHandler, SMSError, TelcoProvider } from '../types';
import { TelcoGateway } from './TelcoGateway';
import { SessionManager } from './SessionManager';
import { LandMarkingAPI } from './LandMarkingAPI';
import { logger } from '../utils/logger';

export class SMSService {
  private commands: Map<SMSCommand, CommandHandler>;
  private telcoGateway: TelcoGateway;
  private sessionManager: SessionManager;
  private api: LandMarkingAPI;

  constructor(
    telcoGateway: TelcoGateway,
    sessionManager: SessionManager,
    api: LandMarkingAPI
  ) {
    this.telcoGateway = telcoGateway;
    this.sessionManager = sessionManager;
    this.api = api;
    this.commands = new Map();
    this.initializeCommands();
  }

  /**
   * Initialize SMS command handlers
   */
  private initializeCommands(): void {
    // CHECK command: CHECK PARCEL123
    this.commands.set(SMSCommand.CHECK, {
      command: SMSCommand.CHECK,
      pattern: /^CHECK\s+([A-Z0-9]+)$/i,
      handler: this.handleCheckCommand.bind(this)
    });

    // VERIFY command: VERIFY PARCEL123 1234
    this.commands.set(SMSCommand.VERIFY, {
      command: SMSCommand.VERIFY,
      pattern: /^VERIFY\s+([A-Z0-9]+)\s+(\d{4})$/i,
      handler: this.handleVerifyCommand.bind(this)
    });

    // REGISTER command: REGISTER
    this.commands.set(SMSCommand.REGISTER, {
      command: SMSCommand.REGISTER,
      pattern: /^REGISTER$/i,
      handler: this.handleRegisterCommand.bind(this)
    });

    // STATUS command: STATUS
    this.commands.set(SMSCommand.STATUS, {
      command: SMSCommand.STATUS,
      pattern: /^STATUS$/i,
      handler: this.handleStatusCommand.bind(this)
    });

    // HELP command: HELP
    this.commands.set(SMSCommand.HELP, {
      command: SMSCommand.HELP,
      pattern: /^HELP$/i,
      handler: this.handleHelpCommand.bind(this)
    });
  }

  /**
   * Process incoming SMS message
   */
  async processMessage(message: SMSMessage): Promise<void> {
    try {
      logger.info('Processing SMS message', {
        from: message.from,
        message: message.message,
        provider: message.provider
      });

      // Validate phone number
      if (!this.isValidSierraLeoneNumber(message.from)) {
        throw new SMSError('Invalid phone number', 'INVALID_PHONE');
      }

      // Parse command
      const response = await this.parseAndExecuteCommand(message);

      // Send response
      await this.telcoGateway.sendSMS({
        to: message.from,
        message: response.message,
        provider: message.provider
      });

      logger.info('SMS response sent', {
        to: message.from,
        message: response.message
      });
    } catch (error) {
      logger.error('Error processing SMS', error);
      
      // Send error message
      await this.telcoGateway.sendSMS({
        to: message.from,
        message: 'Error processing your request. Please try again or call support.',
        provider: message.provider
      });
    }
  }

  /**
   * Parse and execute SMS command
   */
  private async parseAndExecuteCommand(message: SMSMessage): Promise<SMSResponse> {
    const text = message.message.trim().toUpperCase();

    // Check each command pattern
    for (const [_, handler] of this.commands) {
      const matches = text.match(handler.pattern);
      if (matches) {
        return await handler.handler(message, matches);
      }
    }

    // No matching command
    return {
      to: message.from,
      message: 'Invalid command. Send HELP for available commands.'
    };
  }

  /**
   * Handle CHECK command
   */
  private async handleCheckCommand(
    message: SMSMessage,
    matches: RegExpMatchArray
  ): Promise<SMSResponse> {
    const parcelId = matches[1];

    try {
      const parcel = await this.api.getParcelInfo(parcelId);
      
      if (!parcel) {
        return {
          to: message.from,
          message: `Parcel ${parcelId} not found.`
        };
      }

      const response = `Parcel: ${parcel.parcelNumber}
Owner: ${parcel.ownerName}
Area: ${parcel.area}m²
Location: ${parcel.location.chiefdom}, ${parcel.location.district}
Status: ${parcel.verificationStatus} (${parcel.verificationCount}/${parcel.requiredVerifications})`;

      return {
        to: message.from,
        message: this.truncateMessage(response)
      };
    } catch (error) {
      logger.error('Error checking parcel', error);
      return {
        to: message.from,
        message: 'Error checking parcel. Please try again.'
      };
    }
  }

  /**
   * Handle VERIFY command
   */
  private async handleVerifyCommand(
    message: SMSMessage,
    matches: RegExpMatchArray
  ): Promise<SMSResponse> {
    const parcelId = matches[1];
    const pin = matches[2];

    try {
      // Validate PIN
      const session = await this.sessionManager.validatePIN(message.from, pin);
      if (!session) {
        return {
          to: message.from,
          message: 'Invalid PIN. Please register first or check your PIN.'
        };
      }

      // Submit verification
      const result = await this.api.submitVerification({
        parcelId,
        msisdn: message.from,
        pin,
        timestamp: new Date()
      });

      if (result.success) {
        return {
          to: message.from,
          message: `Verification added for parcel ${parcelId}. ${result.message}`
        };
      } else {
        return {
          to: message.from,
          message: `Verification failed: ${result.message}`
        };
      }
    } catch (error) {
      logger.error('Error verifying parcel', error);
      return {
        to: message.from,
        message: 'Error processing verification. Please try again.'
      };
    }
  }

  /**
   * Handle REGISTER command
   */
  private async handleRegisterCommand(
    message: SMSMessage,
    matches: RegExpMatchArray
  ): Promise<SMSResponse> {
    try {
      // Generate PIN
      const pin = this.generatePIN();
      
      // Create session
      await this.sessionManager.createSession(message.from, pin);

      // Register user
      const result = await this.api.registerUser({
        msisdn: message.from,
        pin
      });

      if (result.success) {
        return {
          to: message.from,
          message: `Registration successful! Your PIN is ${pin}. Keep it safe for verifications.`,
          priority: 'high'
        };
      } else {
        return {
          to: message.from,
          message: 'Registration failed. Please contact support.'
        };
      }
    } catch (error) {
      logger.error('Error registering user', error);
      return {
        to: message.from,
        message: 'Error during registration. Please try again.'
      };
    }
  }

  /**
   * Handle STATUS command
   */
  private async handleStatusCommand(
    message: SMSMessage,
    matches: RegExpMatchArray
  ): Promise<SMSResponse> {
    try {
      const verifications = await this.api.getUserVerifications(message.from);
      
      if (verifications.length === 0) {
        return {
          to: message.from,
          message: 'No verification requests found.'
        };
      }

      const response = `Your verifications:
${verifications.slice(0, 3).map(v => 
  `${v.parcelId}: ${v.status} (${v.date})`
).join('\n')}`;

      return {
        to: message.from,
        message: this.truncateMessage(response)
      };
    } catch (error) {
      logger.error('Error getting status', error);
      return {
        to: message.from,
        message: 'Error retrieving status. Please try again.'
      };
    }
  }

  /**
   * Handle HELP command
   */
  private async handleHelpCommand(
    message: SMSMessage,
    matches: RegExpMatchArray
  ): Promise<SMSResponse> {
    const helpText = `LandMarking SMS Commands:
CHECK <ID> - Check parcel info
VERIFY <ID> <PIN> - Verify parcel
REGISTER - Get PIN
STATUS - Your verifications
HELP - This message`;

    return {
      to: message.from,
      message: helpText
    };
  }

  /**
   * Validate Sierra Leone phone number
   */
  private isValidSierraLeoneNumber(phoneNumber: string): boolean {
    try {
      if (!isValidPhoneNumber(phoneNumber, 'SL')) {
        return false;
      }

      const parsed = parsePhoneNumber(phoneNumber, 'SL');
      // Check if it's a valid SL mobile number
      const validPrefixes = ['76', '77', '78', '88', '99', '30', '31', '32', '33', '34'];
      const nationalNumber = parsed.nationalNumber;
      
      return validPrefixes.some(prefix => nationalNumber.startsWith(prefix));
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate 4-digit PIN
   */
  private generatePIN(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Truncate message to SMS length limit
   */
  private truncateMessage(message: string, maxLength: number = 160): string {
    if (message.length <= maxLength) {
      return message;
    }
    return message.substring(0, maxLength - 3) + '...';
  }
}
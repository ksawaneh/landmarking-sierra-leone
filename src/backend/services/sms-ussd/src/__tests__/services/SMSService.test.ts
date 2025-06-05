/**
 * SMS Service tests
 */

import { SMSService } from '../../services/SMSService';
import { TelcoGateway } from '../../services/TelcoGateway';
import { SessionManager } from '../../services/SessionManager';
import { LandMarkingAPI } from '../../services/LandMarkingAPI';
import { SMSMessage, TelcoProvider, SMSError } from '../../types';

// Mock dependencies
jest.mock('../../services/TelcoGateway');
jest.mock('../../services/SessionManager');
jest.mock('../../services/LandMarkingAPI');

describe('SMSService', () => {
  let smsService: SMSService;
  let mockTelcoGateway: jest.Mocked<TelcoGateway>;
  let mockSessionManager: jest.Mocked<SessionManager>;
  let mockAPI: jest.Mocked<LandMarkingAPI>;

  beforeEach(() => {
    mockTelcoGateway = new TelcoGateway([]) as jest.Mocked<TelcoGateway>;
    mockSessionManager = new SessionManager('redis://localhost') as jest.Mocked<SessionManager>;
    mockAPI = new LandMarkingAPI('http://localhost', 'key') as jest.Mocked<LandMarkingAPI>;

    smsService = new SMSService(mockTelcoGateway, mockSessionManager, mockAPI);
  });

  describe('processMessage', () => {
    const validMessage: SMSMessage = {
      id: 'test-123',
      from: '+23276123456',
      to: '1234',
      message: 'HELP',
      timestamp: new Date(),
      provider: TelcoProvider.ORANGE,
      status: 'received' as any
    };

    it('should process valid HELP command', async () => {
      mockTelcoGateway.sendSMS.mockResolvedValue('msg-123');

      await smsService.processMessage(validMessage);

      expect(mockTelcoGateway.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          to: validMessage.from,
          message: expect.stringContaining('LandMarking SMS Commands'),
          provider: validMessage.provider
        })
      );
    });

    it('should reject invalid phone numbers', async () => {
      const invalidMessage = {
        ...validMessage,
        from: '123' // Invalid number
      };

      await smsService.processMessage(invalidMessage);

      expect(mockTelcoGateway.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Error processing your request. Please try again or call support.'
        })
      );
    });

    it('should handle CHECK command', async () => {
      const checkMessage = {
        ...validMessage,
        message: 'CHECK PARCEL123'
      };

      mockAPI.getParcelInfo.mockResolvedValue({
        id: 'PARCEL123',
        parcelNumber: 'PARCEL123',
        ownerName: 'John Doe',
        area: 1000,
        location: {
          district: 'Western Area',
          chiefdom: 'Freetown'
        },
        verificationStatus: 'Verified',
        verificationCount: 5,
        requiredVerifications: 5
      });

      await smsService.processMessage(checkMessage);

      expect(mockAPI.getParcelInfo).toHaveBeenCalledWith('PARCEL123');
      expect(mockTelcoGateway.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Parcel: PARCEL123')
        })
      );
    });

    it('should handle VERIFY command with valid PIN', async () => {
      const verifyMessage = {
        ...validMessage,
        message: 'VERIFY PARCEL123 1234'
      };

      mockSessionManager.validatePIN.mockResolvedValue({
        msisdn: validMessage.from,
        authenticated: true,
        pin: 'hashed-pin',
        lastActivity: new Date(),
        attempts: 0
      });

      mockAPI.submitVerification.mockResolvedValue({
        success: true,
        message: 'Verification successful'
      });

      await smsService.processMessage(verifyMessage);

      expect(mockSessionManager.validatePIN).toHaveBeenCalledWith(validMessage.from, '1234');
      expect(mockAPI.submitVerification).toHaveBeenCalledWith(
        expect.objectContaining({
          parcelId: 'PARCEL123',
          msisdn: validMessage.from,
          pin: '1234'
        })
      );
    });

    it('should handle REGISTER command', async () => {
      const registerMessage = {
        ...validMessage,
        message: 'REGISTER'
      };

      mockSessionManager.createSession.mockResolvedValue({
        msisdn: validMessage.from,
        authenticated: true,
        pin: 'hashed-pin',
        lastActivity: new Date(),
        attempts: 0
      });

      mockAPI.registerUser.mockResolvedValue({
        success: true,
        userId: 'user-123'
      });

      await smsService.processMessage(registerMessage);

      expect(mockSessionManager.createSession).toHaveBeenCalled();
      expect(mockAPI.registerUser).toHaveBeenCalled();
      expect(mockTelcoGateway.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Registration successful'),
          priority: 'high'
        })
      );
    });

    it('should handle STATUS command', async () => {
      const statusMessage = {
        ...validMessage,
        message: 'STATUS'
      };

      mockAPI.getUserVerifications.mockResolvedValue([
        {
          parcelId: 'PARCEL123',
          status: 'Pending',
          date: '2024-01-01'
        },
        {
          parcelId: 'PARCEL456',
          status: 'Completed',
          date: '2024-01-02'
        }
      ]);

      await smsService.processMessage(statusMessage);

      expect(mockAPI.getUserVerifications).toHaveBeenCalledWith(validMessage.from);
      expect(mockTelcoGateway.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Your verifications')
        })
      );
    });

    it('should handle unknown commands', async () => {
      const unknownMessage = {
        ...validMessage,
        message: 'UNKNOWN COMMAND'
      };

      await smsService.processMessage(unknownMessage);

      expect(mockTelcoGateway.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid command. Send HELP for available commands.'
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockTelcoGateway.sendSMS
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('error-msg');

      await smsService.processMessage(validMessage);

      expect(mockTelcoGateway.sendSMS).toHaveBeenCalledTimes(2);
      expect(mockTelcoGateway.sendSMS).toHaveBeenLastCalledWith(
        expect.objectContaining({
          message: 'Error processing your request. Please try again or call support.'
        })
      );
    });
  });

  describe('Phone number validation', () => {
    it('should validate Sierra Leone mobile numbers', async () => {
      const validNumbers = [
        '+23276123456',
        '+23277123456',
        '+23278123456',
        '+23288123456',
        '+23299123456',
        '+23230123456',
        '+23231123456',
        '+23232123456',
        '+23233123456',
        '+23234123456'
      ];

      for (const number of validNumbers) {
        const message = {
          id: 'test',
          from: number,
          to: '1234',
          message: 'HELP',
          timestamp: new Date(),
          provider: TelcoProvider.ORANGE,
          status: 'received' as any
        };

        mockTelcoGateway.sendSMS.mockResolvedValue('msg-123');
        await smsService.processMessage(message);

        expect(mockTelcoGateway.sendSMS).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('LandMarking SMS Commands')
          })
        );
      }
    });

    it('should reject invalid phone numbers', async () => {
      const invalidNumbers = [
        '123456',
        '+1234567890',
        '+23275123456', // Invalid prefix
        'not-a-number'
      ];

      for (const number of invalidNumbers) {
        const message = {
          id: 'test',
          from: number,
          to: '1234',
          message: 'HELP',
          timestamp: new Date(),
          provider: TelcoProvider.ORANGE,
          status: 'received' as any
        };

        mockTelcoGateway.sendSMS.mockResolvedValue('msg-123');
        await smsService.processMessage(message);

        expect(mockTelcoGateway.sendSMS).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Error processing your request. Please try again or call support.'
          })
        );
      }
    });
  });

  describe('Message truncation', () => {
    it('should truncate long messages', async () => {
      const checkMessage = {
        id: 'test',
        from: '+23276123456',
        to: '1234',
        message: 'CHECK PARCEL123',
        timestamp: new Date(),
        provider: TelcoProvider.ORANGE,
        status: 'received' as any
      };

      mockAPI.getParcelInfo.mockResolvedValue({
        id: 'PARCEL123',
        parcelNumber: 'PARCEL123',
        ownerName: 'A very long name that exceeds the normal character limit for SMS messages',
        area: 1000,
        location: {
          district: 'Western Area Rural District with a very long name',
          chiefdom: 'Mountain Rural District Chiefdom'
        },
        verificationStatus: 'Verified',
        verificationCount: 5,
        requiredVerifications: 5
      });

      await smsService.processMessage(checkMessage);

      const sentMessage = mockTelcoGateway.sendSMS.mock.calls[0][0];
      expect(sentMessage.message.length).toBeLessThanOrEqual(160);
      expect(sentMessage.message).toContain('...');
    });
  });
});
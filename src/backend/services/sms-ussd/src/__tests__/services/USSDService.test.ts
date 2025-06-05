/**
 * USSD Service tests
 */

import { USSDService } from '../../services/USSDService';
import { SessionManager } from '../../services/SessionManager';
import { LandMarkingAPI } from '../../services/LandMarkingAPI';
import { USSDRequest, USSDState, TelcoProvider } from '../../types';

jest.mock('../../services/SessionManager');
jest.mock('../../services/LandMarkingAPI');

describe('USSDService', () => {
  let ussdService: USSDService;
  let mockSessionManager: jest.Mocked<SessionManager>;
  let mockAPI: jest.Mocked<LandMarkingAPI>;

  beforeEach(() => {
    mockSessionManager = new SessionManager('redis://localhost') as jest.Mocked<SessionManager>;
    mockAPI = new LandMarkingAPI('http://localhost', 'key') as jest.Mocked<LandMarkingAPI>;
    
    ussdService = new USSDService(mockSessionManager, mockAPI);
  });

  describe('processRequest', () => {
    const baseRequest: USSDRequest = {
      sessionId: 'session-123',
      msisdn: '+23276123456',
      input: '',
      newSession: true,
      provider: TelcoProvider.ORANGE
    };

    it('should display main menu for new session', async () => {
      mockSessionManager.userExists.mockResolvedValue(true);

      const response = await ussdService.processRequest(baseRequest);

      expect(response.continueSession).toBe(true);
      expect(response.message).toContain('Welcome to LandMarking');
      expect(response.message).toContain('1. Check Parcel');
      expect(response.message).toContain('2. Verify Parcel');
    });

    it('should indicate when user is not registered', async () => {
      mockSessionManager.userExists.mockResolvedValue(false);

      const response = await ussdService.processRequest(baseRequest);

      expect(response.message).toContain('3. Register (Not registered)');
    });

    it('should handle menu navigation', async () => {
      mockSessionManager.userExists.mockResolvedValue(true);

      // First, create session
      await ussdService.processRequest(baseRequest);

      // Then select option 1 (Check Parcel)
      const response = await ussdService.processRequest({
        ...baseRequest,
        newSession: false,
        input: '1'
      });

      expect(response.continueSession).toBe(true);
      expect(response.message).toBe('Enter Parcel ID:');
    });

    it('should handle check parcel flow', async () => {
      mockSessionManager.userExists.mockResolvedValue(true);
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

      // Create session
      await ussdService.processRequest(baseRequest);

      // Select Check Parcel
      await ussdService.processRequest({
        ...baseRequest,
        newSession: false,
        input: '1'
      });

      // Enter parcel ID
      const response = await ussdService.processRequest({
        ...baseRequest,
        newSession: false,
        input: 'PARCEL123'
      });

      expect(mockAPI.getParcelInfo).toHaveBeenCalledWith('PARCEL123');
      expect(response.message).toContain('Parcel: PARCEL123');
      expect(response.message).toContain('Owner: John Doe');
      expect(response.message).toContain('Area: 1000m²');
    });

    it('should handle verify parcel flow', async () => {
      mockSessionManager.userExists.mockResolvedValue(true);
      mockSessionManager.validatePIN.mockResolvedValue({
        msisdn: baseRequest.msisdn,
        authenticated: true,
        pin: 'hashed',
        lastActivity: new Date(),
        attempts: 0
      });
      mockAPI.submitVerification.mockResolvedValue({
        success: true,
        message: 'Verification added'
      });

      // Create session
      await ussdService.processRequest(baseRequest);

      // Select Verify Parcel
      await ussdService.processRequest({
        ...baseRequest,
        newSession: false,
        input: '2'
      });

      // Enter parcel ID
      const response1 = await ussdService.processRequest({
        ...baseRequest,
        newSession: false,
        input: 'PARCEL123'
      });

      expect(response1.message).toBe('Enter your PIN:');

      // Enter PIN
      const response2 = await ussdService.processRequest({
        ...baseRequest,
        newSession: false,
        input: '1234'
      });

      expect(mockSessionManager.validatePIN).toHaveBeenCalledWith(baseRequest.msisdn, '1234');
      expect(response2.message).toContain('Verification submitted');
    });

    it('should handle my parcels option', async () => {
      mockSessionManager.userExists.mockResolvedValue(true);
      mockAPI.searchParcelsByPhone.mockResolvedValue([
        {
          id: 'P1',
          parcelNumber: 'P1',
          ownerName: 'John Doe',
          area: 1000,
          location: { district: 'Western', chiefdom: 'Freetown' },
          verificationStatus: 'Verified',
          verificationCount: 5,
          requiredVerifications: 5
        },
        {
          id: 'P2',
          parcelNumber: 'P2',
          ownerName: 'John Doe',
          area: 2000,
          location: { district: 'Eastern', chiefdom: 'Kenema' },
          verificationStatus: 'Pending',
          verificationCount: 3,
          requiredVerifications: 5
        }
      ]);

      // Create session and select My Parcels
      await ussdService.processRequest(baseRequest);
      const response = await ussdService.processRequest({
        ...baseRequest,
        newSession: false,
        input: '4'
      });

      expect(mockAPI.searchParcelsByPhone).toHaveBeenCalledWith(baseRequest.msisdn);
      expect(response.message).toContain('Your Parcels:');
      expect(response.message).toContain('1. P1 (Freetown)');
      expect(response.message).toContain('2. P2 (Kenema)');
    });

    it('should handle verification status option', async () => {
      mockSessionManager.userExists.mockResolvedValue(true);
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

      // Create session and select Verification Status
      await ussdService.processRequest(baseRequest);
      const response = await ussdService.processRequest({
        ...baseRequest,
        newSession: false,
        input: '5'
      });

      expect(mockAPI.getUserVerifications).toHaveBeenCalledWith(baseRequest.msisdn);
      expect(response.message).toContain('Your Verifications:');
      expect(response.message).toContain('PARCEL123: Pending');
      expect(response.message).toContain('PARCEL456: Completed');
    });

    it('should handle help option', async () => {
      mockSessionManager.userExists.mockResolvedValue(true);

      // Create session and select Help
      await ussdService.processRequest(baseRequest);
      const response = await ussdService.processRequest({
        ...baseRequest,
        newSession: false,
        input: '6'
      });

      expect(response.message).toContain('LandMarking Help');
      expect(response.message).toContain('SMS: Send HELP to 1234');
      expect(response.message).toContain('Call: 117');
    });

    it('should handle invalid menu options', async () => {
      mockSessionManager.userExists.mockResolvedValue(true);

      // Create session and enter invalid option
      await ussdService.processRequest(baseRequest);
      const response = await ussdService.processRequest({
        ...baseRequest,
        newSession: false,
        input: '9'
      });

      expect(response.message).toBe('Invalid option. Please select 1-6.');
      expect(response.continueSession).toBe(true);
    });

    it('should handle session expiry', async () => {
      const response = await ussdService.processRequest({
        ...baseRequest,
        newSession: false,
        sessionId: 'expired-session'
      });

      expect(response.message).toBe('Session expired. Please dial *384# again.');
      expect(response.continueSession).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockSessionManager.userExists.mockRejectedValue(new Error('Database error'));

      const response = await ussdService.processRequest(baseRequest);

      expect(response.message).toBe('Service temporarily unavailable. Please try again later.');
      expect(response.continueSession).toBe(false);
    });

    it('should handle navigation back to main menu', async () => {
      mockSessionManager.userExists.mockResolvedValue(true);

      // Create session
      await ussdService.processRequest(baseRequest);

      // Go to Check Parcel
      await ussdService.processRequest({
        ...baseRequest,
        newSession: false,
        input: '1'
      });

      // Go back to main menu
      const response = await ussdService.processRequest({
        ...baseRequest,
        newSession: false,
        input: '0'
      });

      expect(response.message).toContain('Welcome to LandMarking');
    });

    it('should require registration for verify parcel', async () => {
      mockSessionManager.userExists.mockResolvedValue(false);

      // Create session
      await ussdService.processRequest(baseRequest);

      // Try to verify parcel without registration
      const response = await ussdService.processRequest({
        ...baseRequest,
        newSession: false,
        input: '2'
      });

      expect(response.message).toBe('You need to register first. Send REGISTER to 1234.');
      expect(response.continueSession).toBe(false);
    });
  });

  describe('Session management', () => {
    it('should create and maintain session state', async () => {
      mockSessionManager.userExists.mockResolvedValue(true);

      // Create session
      const response1 = await ussdService.processRequest({
        sessionId: 'test-session',
        msisdn: '+23276123456',
        input: '',
        newSession: true,
        provider: TelcoProvider.ORANGE
      });

      expect(response1.continueSession).toBe(true);

      // Continue with same session
      const response2 = await ussdService.processRequest({
        sessionId: 'test-session',
        msisdn: '+23276123456',
        input: '1',
        newSession: false,
        provider: TelcoProvider.ORANGE
      });

      expect(response2.continueSession).toBe(true);
      expect(response2.message).toBe('Enter Parcel ID:');
    });
  });
});
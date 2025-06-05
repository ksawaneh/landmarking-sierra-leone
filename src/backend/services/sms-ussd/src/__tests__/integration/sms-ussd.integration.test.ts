/**
 * SMS/USSD integration tests
 */

import request from 'supertest';
import express from 'express';
import { createClient } from 'redis';
import { SMSService } from '../../services/SMSService';
import { USSDService } from '../../services/USSDService';
import { TelcoGateway } from '../../services/TelcoGateway';
import { SessionManager } from '../../services/SessionManager';
import { LandMarkingAPI } from '../../services/LandMarkingAPI';
import { TelcoProvider, ServiceConfig } from '../../types';
import { setupRoutes } from '../../routes';
import { errorHandler } from '../../middleware/errorHandler';
import { requestLogger } from '../../middleware/requestLogger';

// Mock external dependencies
jest.mock('axios');
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    setEx: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(() => []),
    on: jest.fn()
  }))
}));

describe('SMS/USSD Integration Tests', () => {
  let app: express.Express;
  let redisClient: any;

  const config: ServiceConfig = {
    providers: [
      {
        provider: TelcoProvider.ORANGE,
        apiUrl: 'https://api.orange.sl',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        senderId: 'TEST'
      }
    ],
    ussdShortCode: '*384#',
    sessionTimeout: 300,
    maxAttempts: 3,
    rateLimits: {
      sms: { points: 10, duration: 3600 },
      ussd: { points: 50, duration: 3600 }
    }
  };

  beforeAll(async () => {
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use(requestLogger);

    // Initialize services
    const sessionManager = new SessionManager('redis://localhost', 300, 3);
    const api = new LandMarkingAPI('http://localhost:8787', 'test-key');
    const telcoGateway = new TelcoGateway(config.providers);
    const smsService = new SMSService(telcoGateway, sessionManager, api);
    const ussdService = new USSDService(sessionManager, api);

    // Setup routes
    setupRoutes(app, {
      smsService,
      ussdService,
      telcoGateway,
      sessionManager,
      api,
      config
    });

    app.use(errorHandler);

    // Connect to Redis mock
    await sessionManager.connect();
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('SMS Webhook', () => {
    const authToken = 'test-webhook-token';
    process.env.ORANGE_WEBHOOK_TOKEN = authToken;

    it('should process incoming SMS with valid authentication', async () => {
      const smsData = {
        from: '+23276123456',
        to: '1234',
        message: 'HELP',
        messageId: 'msg-123'
      };

      const response = await request(app)
        .post('/api/sms/webhook/orange')
        .set('Authorization', `Bearer ${authToken}`)
        .send(smsData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        messageId: expect.any(String)
      });
    });

    it('should reject SMS with invalid authentication', async () => {
      const response = await request(app)
        .post('/api/sms/webhook/orange')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          from: '+23276123456',
          to: '1234',
          message: 'HELP'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should validate SMS data', async () => {
      const response = await request(app)
        .post('/api/sms/webhook/orange')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required fields
          message: 'HELP'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('USSD Webhook', () => {
    const authToken = 'test-webhook-token';
    process.env.ORANGE_WEBHOOK_TOKEN = authToken;

    it('should handle new USSD session', async () => {
      const ussdData = {
        sessionId: 'session-123',
        msisdn: '+23276123456',
        input: '',
        newSession: true
      };

      const response = await request(app)
        .post('/api/ussd/webhook/orange')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ussdData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Welcome to LandMarking');
      expect(response.body.continueSession).toBe(true);
    });

    it('should handle USSD menu navigation', async () => {
      // First, create a session
      await request(app)
        .post('/api/ussd/webhook/orange')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId: 'nav-session',
          msisdn: '+23276123456',
          input: '',
          newSession: true
        });

      // Then navigate to option 1
      const response = await request(app)
        .post('/api/ussd/webhook/orange')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId: 'nav-session',
          msisdn: '+23276123456',
          input: '1',
          newSession: false
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Enter Parcel ID:');
      expect(response.body.continueSession).toBe(true);
    });

    it('should handle USSD errors gracefully', async () => {
      const response = await request(app)
        .post('/api/ussd/webhook/orange')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId: 'error-session',
          msisdn: 'invalid-number',
          input: '',
          newSession: true
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Service temporarily unavailable. Please try again later.');
      expect(response.body.continueSession).toBe(false);
    });
  });

  describe('Admin Endpoints', () => {
    const adminToken = 'test-admin-key';
    process.env.ADMIN_API_KEY = adminToken;

    it('should get service statistics', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats).toHaveProperty('sessions');
      expect(response.body.stats).toHaveProperty('ussd');
      expect(response.body.stats).toHaveProperty('cache');
    });

    it('should reset user PIN', async () => {
      const response = await request(app)
        .post('/api/admin/users/+23276123456/reset-pin')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ pin: '1234' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('PIN reset successfully');
    });

    it('should clear cache', async () => {
      const response = await request(app)
        .post('/api/admin/cache/clear')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Cache cleared successfully');
    });

    it('should reject admin requests without authentication', async () => {
      const response = await request(app)
        .get('/api/admin/stats');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        service: 'sms-ussd-gateway',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits for SMS', async () => {
      const authToken = 'test-webhook-token';
      const smsData = {
        from: '+23276999999',
        to: '1234',
        message: 'TEST',
        messageId: 'rate-limit-test'
      };

      // Make multiple requests to trigger rate limit
      const requests = Array(15).fill(null).map(() =>
        request(app)
          .post('/api/sms/webhook/orange')
          .set('Authorization', `Bearer ${authToken}`)
          .send(smsData)
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
      expect(rateLimited[0].body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('End-to-End SMS Flow', () => {
    it('should handle complete CHECK command flow', async () => {
      const authToken = 'test-webhook-token';
      process.env.ORANGE_WEBHOOK_TOKEN = authToken;

      // Mock API response
      const mockParcelInfo = {
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
      };

      // Send CHECK command
      const response = await request(app)
        .post('/api/sms/webhook/orange')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          from: '+23276123456',
          to: '1234',
          message: 'CHECK PARCEL123',
          messageId: 'check-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
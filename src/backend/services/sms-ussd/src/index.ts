/**
 * SMS/USSD Gateway Service Entry Point
 */

import express, { Express } from 'express';
import dotenv from 'dotenv';
import { SMSService } from './services/SMSService';
import { USSDService } from './services/USSDService';
import { TelcoGateway } from './services/TelcoGateway';
import { SessionManager } from './services/SessionManager';
import { LandMarkingAPI } from './services/LandMarkingAPI';
import { TelcoProvider, TelcoConfig, ServiceConfig } from './types';
import { logger } from './utils/logger';
import { setupRoutes } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { rateLimiter } from './middleware/rateLimiter';

// Load environment variables
dotenv.config();

// Service configuration
const config: ServiceConfig = {
  providers: [
    {
      provider: TelcoProvider.ORANGE,
      apiUrl: process.env.ORANGE_API_URL || 'https://api.orange.sl',
      apiKey: process.env.ORANGE_API_KEY || '',
      apiSecret: process.env.ORANGE_API_SECRET || '',
      senderId: process.env.SMS_SENDER_ID || 'LANDMARK'
    },
    {
      provider: TelcoProvider.AFRICELL,
      apiUrl: process.env.AFRICELL_API_URL || 'https://api.africell.sl',
      apiKey: process.env.AFRICELL_API_KEY || '',
      apiSecret: process.env.AFRICELL_API_SECRET || '',
      senderId: process.env.SMS_SENDER_ID || 'LANDMARK'
    },
    {
      provider: TelcoProvider.QCELL,
      apiUrl: process.env.QCELL_API_URL || 'https://api.qcell.sl',
      apiKey: process.env.QCELL_API_KEY || '',
      apiSecret: process.env.QCELL_API_SECRET || '',
      senderId: process.env.SMS_SENDER_ID || 'LANDMARK'
    }
  ],
  ussdShortCode: process.env.USSD_SHORT_CODE || '*384#',
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '300'),
  maxAttempts: parseInt(process.env.MAX_ATTEMPTS || '3'),
  rateLimits: {
    sms: {
      points: parseInt(process.env.SMS_RATE_LIMIT_POINTS || '10'),
      duration: parseInt(process.env.SMS_RATE_LIMIT_DURATION || '3600')
    },
    ussd: {
      points: parseInt(process.env.USSD_RATE_LIMIT_POINTS || '50'),
      duration: parseInt(process.env.USSD_RATE_LIMIT_DURATION || '3600')
    }
  }
};

class SMSUSSDGateway {
  private app: Express;
  private smsService: SMSService;
  private ussdService: USSDService;
  private telcoGateway: TelcoGateway;
  private sessionManager: SessionManager;
  private api: LandMarkingAPI;

  constructor() {
    this.app = express();
    
    // Initialize services
    this.sessionManager = new SessionManager(
      process.env.REDIS_URL || 'redis://localhost:6379',
      config.sessionTimeout,
      config.maxAttempts
    );
    
    this.api = new LandMarkingAPI(
      process.env.LANDMARKING_API_URL || 'http://localhost:8787',
      process.env.LANDMARKING_API_KEY || ''
    );
    
    this.telcoGateway = new TelcoGateway(config.providers);
    
    this.smsService = new SMSService(
      this.telcoGateway,
      this.sessionManager,
      this.api
    );
    
    this.ussdService = new USSDService(
      this.sessionManager,
      this.api
    );

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(requestLogger);
    this.app.use('/api', rateLimiter(config.rateLimits));
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    setupRoutes(this.app, {
      smsService: this.smsService,
      ussdService: this.ussdService,
      telcoGateway: this.telcoGateway,
      sessionManager: this.sessionManager,
      api: this.api,
      config
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  /**
   * Start the service
   */
  async start(): Promise<void> {
    try {
      // Connect to Redis
      await this.sessionManager.connect();
      logger.info('Connected to Redis');

      // Start cleanup job for expired sessions
      setInterval(() => {
        this.sessionManager.cleanupExpiredSessions().catch(error => {
          logger.error('Session cleanup error', error);
        });
      }, 60000); // Every minute

      // Start Express server
      const port = process.env.PORT || 3001;
      this.app.listen(port, () => {
        logger.info(`SMS/USSD Gateway listening on port ${port}`);
        logger.info(`USSD short code: ${config.ussdShortCode}`);
        logger.info(`SMS sender ID: ${config.providers[0].senderId}`);
      });

      // Graceful shutdown
      process.on('SIGTERM', this.shutdown.bind(this));
      process.on('SIGINT', this.shutdown.bind(this));
    } catch (error) {
      logger.error('Failed to start service', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(): Promise<void> {
    logger.info('Shutting down SMS/USSD Gateway...');
    
    try {
      await this.sessionManager.disconnect();
      logger.info('Disconnected from Redis');
      
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  }
}

// Start the service
const gateway = new SMSUSSDGateway();
gateway.start().catch(error => {
  logger.error('Fatal error', error);
  process.exit(1);
});
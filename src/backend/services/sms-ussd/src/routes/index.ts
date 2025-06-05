/**
 * API routes for SMS/USSD gateway
 */

import { Express, Request, Response, Router } from 'express';
import { SMSService } from '../services/SMSService';
import { USSDService } from '../services/USSDService';
import { TelcoGateway } from '../services/TelcoGateway';
import { SessionManager } from '../services/SessionManager';
import { LandMarkingAPI } from '../services/LandMarkingAPI';
import { ServiceConfig, SMSMessage, USSDRequest, TelcoProvider } from '../types';
import { authenticate } from '../middleware/authenticate';
import Joi from 'joi';

interface RouteServices {
  smsService: SMSService;
  ussdService: USSDService;
  telcoGateway: TelcoGateway;
  sessionManager: SessionManager;
  api: LandMarkingAPI;
  config: ServiceConfig;
}

// Validation schemas
const smsSchema = Joi.object({
  from: Joi.string().required(),
  to: Joi.string().required(),
  message: Joi.string().required(),
  provider: Joi.string().valid(...Object.values(TelcoProvider)).required(),
  messageId: Joi.string().optional()
});

const ussdSchema = Joi.object({
  sessionId: Joi.string().required(),
  msisdn: Joi.string().required(),
  input: Joi.string().allow('').required(),
  newSession: Joi.boolean().required(),
  provider: Joi.string().valid(...Object.values(TelcoProvider)).required()
});

export const setupRoutes = (app: Express, services: RouteServices): void => {
  const router = Router();

  /**
   * Health check endpoint
   */
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      service: 'sms-ussd-gateway',
      timestamp: new Date().toISOString()
    });
  });

  /**
   * SMS webhook endpoint - receives SMS from telcos
   */
  router.post('/sms/webhook/:provider', authenticate, async (req: Request, res: Response) => {
    try {
      const provider = req.params.provider as TelcoProvider;
      
      // Validate provider
      if (!Object.values(TelcoProvider).includes(provider)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid provider'
        });
      }

      // Validate request body
      const { error, value } = smsSchema.validate({
        ...req.body,
        provider
      });

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const message: SMSMessage = {
        id: value.messageId || `sms_${Date.now()}`,
        from: value.from,
        to: value.to,
        message: value.message,
        timestamp: new Date(),
        provider: value.provider,
        status: 'received' as any
      };

      // Process SMS asynchronously
      services.smsService.processMessage(message).catch(err => {
        req.logger.error('Failed to process SMS', err);
      });

      res.json({
        success: true,
        messageId: message.id
      });
    } catch (error) {
      req.logger.error('SMS webhook error', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * USSD webhook endpoint - receives USSD from telcos
   */
  router.post('/ussd/webhook/:provider', authenticate, async (req: Request, res: Response) => {
    try {
      const provider = req.params.provider as TelcoProvider;
      
      // Validate provider
      if (!Object.values(TelcoProvider).includes(provider)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid provider'
        });
      }

      // Validate request body
      const { error, value } = ussdSchema.validate({
        ...req.body,
        provider
      });

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const request: USSDRequest = value;

      // Process USSD request
      const response = await services.ussdService.processRequest(request);

      res.json({
        success: true,
        ...response
      });
    } catch (error) {
      req.logger.error('USSD webhook error', error);
      res.status(500).json({
        success: false,
        message: 'Service temporarily unavailable',
        continueSession: false
      });
    }
  });

  /**
   * Delivery report webhook
   */
  router.post('/delivery-report/:provider', authenticate, async (req: Request, res: Response) => {
    try {
      const provider = req.params.provider as TelcoProvider;
      
      await services.telcoGateway.handleDeliveryReport(provider, req.body);
      
      res.json({ success: true });
    } catch (error) {
      req.logger.error('Delivery report error', error);
      res.status(500).json({ success: false });
    }
  });

  /**
   * Admin endpoints
   */
  const adminRouter = Router();
  adminRouter.use(authenticate);

  // Get service statistics
  adminRouter.get('/stats', async (req: Request, res: Response) => {
    try {
      const [sessionStats, ussdStats, cacheStats] = await Promise.all([
        services.sessionManager.getStats(),
        services.ussdService.getStats(),
        Promise.resolve(services.api.getCacheStats())
      ]);

      res.json({
        success: true,
        stats: {
          sessions: sessionStats,
          ussd: ussdStats,
          cache: cacheStats
        }
      });
    } catch (error) {
      req.logger.error('Stats error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get statistics'
      });
    }
  });

  // Reset user PIN
  adminRouter.post('/users/:msisdn/reset-pin', async (req: Request, res: Response) => {
    try {
      const { msisdn } = req.params;
      const { pin } = req.body;

      if (!pin || pin.length !== 4) {
        return res.status(400).json({
          success: false,
          error: 'PIN must be 4 digits'
        });
      }

      await services.sessionManager.resetPIN(msisdn, pin);

      res.json({
        success: true,
        message: 'PIN reset successfully'
      });
    } catch (error) {
      req.logger.error('PIN reset error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset PIN'
      });
    }
  });

  // Clear cache
  adminRouter.post('/cache/clear', async (req: Request, res: Response) => {
    try {
      services.api.clearCache();
      res.json({
        success: true,
        message: 'Cache cleared successfully'
      });
    } catch (error) {
      req.logger.error('Cache clear error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear cache'
      });
    }
  });

  // Test SMS sending
  adminRouter.post('/test/sms', async (req: Request, res: Response) => {
    try {
      const { to, message } = req.body;

      if (!to || !message) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: to, message'
        });
      }

      const provider = await services.telcoGateway.getBestProvider(to);
      const messageId = await services.telcoGateway.sendSMS({
        to,
        message,
        provider
      });

      res.json({
        success: true,
        messageId,
        provider
      });
    } catch (error) {
      req.logger.error('Test SMS error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send test SMS'
      });
    }
  });

  // Mount routers
  app.use('/api', router);
  app.use('/api/admin', adminRouter);

  // Default 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found'
    });
  });
};
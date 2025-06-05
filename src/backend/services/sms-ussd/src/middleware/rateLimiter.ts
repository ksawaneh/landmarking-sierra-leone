/**
 * Rate limiting middleware
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { SMSError } from '../types';

interface RateLimitConfig {
  sms: {
    points: number;
    duration: number;
  };
  ussd: {
    points: number;
    duration: number;
  };
}

export const rateLimiter = (config: RateLimitConfig) => {
  const smsLimiter = new RateLimiterMemory({
    points: config.sms.points,
    duration: config.sms.duration,
    keyPrefix: 'sms'
  });

  const ussdLimiter = new RateLimiterMemory({
    points: config.ussd.points,
    duration: config.ussd.duration,
    keyPrefix: 'ussd'
  });

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Determine which limiter to use
      const limiter = req.path.includes('/ussd') ? ussdLimiter : smsLimiter;
      
      // Use phone number as key
      const key = req.body.msisdn || req.body.from || req.ip;
      
      await limiter.consume(key);
      next();
    } catch (error) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.'
        }
      });
    }
  };
};
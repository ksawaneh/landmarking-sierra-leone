/**
 * Authentication middleware for webhook endpoints
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      telcoProvider?: string;
    }
  }
}

/**
 * Authenticate webhook requests from telco providers
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const provider = req.params.provider;
  
  // Get auth token based on provider
  const authTokens: Record<string, string> = {
    orange: process.env.ORANGE_WEBHOOK_TOKEN || '',
    africell: process.env.AFRICELL_WEBHOOK_TOKEN || '',
    qcell: process.env.QCELL_WEBHOOK_TOKEN || ''
  };

  const expectedToken = authTokens[provider];
  
  // Check authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: 'Missing authorization header'
    });
    return;
  }

  // Verify token
  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer' || !token) {
    res.status(401).json({
      success: false,
      error: 'Invalid authorization format'
    });
    return;
  }

  // For admin endpoints, use admin token
  if (req.path.startsWith('/api/admin')) {
    const adminToken = process.env.ADMIN_API_KEY || '';
    if (token !== adminToken) {
      res.status(401).json({
        success: false,
        error: 'Invalid admin token'
      });
      return;
    }
  } else if (token !== expectedToken) {
    // For webhook endpoints, verify provider token
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
    return;
  }

  // Verify signature if provided
  const signature = req.headers['x-webhook-signature'];
  if (signature && typeof signature === 'string') {
    const payload = JSON.stringify(req.body);
    const secret = process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`] || '';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      res.status(401).json({
        success: false,
        error: 'Invalid signature'
      });
      return;
    }
  }

  req.telcoProvider = provider;
  next();
};
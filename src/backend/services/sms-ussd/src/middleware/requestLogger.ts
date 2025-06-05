/**
 * Request logging middleware
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { addRequestId } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      id: string;
      logger: ReturnType<typeof addRequestId>;
    }
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Generate request ID
  req.id = uuidv4();
  
  // Add request logger with ID
  req.logger = addRequestId(req.id);
  
  // Log request
  req.logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Log response
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    req.logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });
  
  next();
};
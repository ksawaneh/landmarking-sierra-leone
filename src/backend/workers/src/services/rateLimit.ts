/**
 * Rate limiting service using Cloudflare Durable Objects
 * Prevents abuse and ensures fair usage
 */

import { DurableObject } from 'cloudflare:workers';

export class RateLimiterDO extends DurableObject {
  private readonly WINDOW_SIZE = 60000; // 1 minute in milliseconds

  /**
   * Check if request is allowed under rate limit
   */
  async checkLimit(key: string, limit: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  }> {
    const now = Date.now();
    const windowStart = now - this.WINDOW_SIZE;
    
    // Get current window data
    const storageKey = `ratelimit:${key}`;
    const requests = await this.ctx.storage.get<number[]>(storageKey) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= limit) {
      // Rate limit exceeded
      const oldestRequest = Math.min(...validRequests);
      const resetAt = new Date(oldestRequest + this.WINDOW_SIZE);
      
      return {
        allowed: false,
        remaining: 0,
        resetAt
      };
    }
    
    // Add current request
    validRequests.push(now);
    await this.ctx.storage.put(storageKey, validRequests);
    
    return {
      allowed: true,
      remaining: limit - validRequests.length,
      resetAt: new Date(now + this.WINDOW_SIZE)
    };
  }

  /**
   * Reset rate limit for a key (admin function)
   */
  async resetLimit(key: string): Promise<void> {
    const storageKey = `ratelimit:${key}`;
    await this.ctx.storage.delete(storageKey);
  }

  /**
   * Get current usage for a key
   */
  async getUsage(key: string): Promise<{
    count: number;
    windowStart: Date;
    windowEnd: Date;
  }> {
    const now = Date.now();
    const windowStart = now - this.WINDOW_SIZE;
    const storageKey = `ratelimit:${key}`;
    const requests = await this.ctx.storage.get<number[]>(storageKey) || [];
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    return {
      count: validRequests.length,
      windowStart: new Date(windowStart),
      windowEnd: new Date(now)
    };
  }
}

/**
 * Rate limit middleware helper
 */
export async function checkRateLimit(
  request: Request,
  env: any,
  limitType: 'authenticated' | 'unauthenticated' | 'governmentQueries'
): Promise<Response | null> {
  const config = {
    authenticated: parseInt(env.RATE_LIMIT_AUTH || '100'),
    unauthenticated: parseInt(env.RATE_LIMIT_UNAUTH || '20'),
    governmentQueries: parseInt(env.RATE_LIMIT_GOV || '50')
  };

  const limit = config[limitType];
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `${limitType}:${ip}`;

  // Get rate limiter Durable Object
  const id = env.RATE_LIMITER.idFromName(key);
  const limiter = env.RATE_LIMITER.get(id);

  const result = await limiter.checkLimit(key, limit);

  if (!result.allowed) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Rate limit exceeded',
      retryAfter: result.resetAt.toISOString()
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': result.resetAt.toISOString(),
        'Retry-After': Math.ceil((result.resetAt.getTime() - Date.now()) / 1000).toString()
      }
    });
  }

  // Add rate limit headers to help clients
  return new Response(null, {
    headers: {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetAt.toISOString()
    }
  });
}
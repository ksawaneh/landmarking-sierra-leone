/**
 * AuthSessionDO is a Durable Object for managing authentication sessions
 * It provides a mechanism for tracking user sessions, token blacklisting,
 * and rate limiting for authentication requests.
 */
export class AuthSessionDO {
  private state: DurableObjectState;
  private sessions: Map<string, any>;
  private blacklist: Set<string>;
  private rateLimits: Map<string, { count: number, resetAt: number }>;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.sessions = new Map();
    this.blacklist = new Set();
    this.rateLimits = new Map();
    
    // Load stored data on initialization
    this.state.blockConcurrencyWhile(async () => {
      const storedSessions = await this.state.storage.get('sessions');
      if (storedSessions) {
        this.sessions = new Map(storedSessions);
      }
      
      const storedBlacklist = await this.state.storage.get('blacklist');
      if (storedBlacklist) {
        this.blacklist = new Set(storedBlacklist);
      }
      
      const storedRateLimits = await this.state.storage.get('rateLimits');
      if (storedRateLimits) {
        this.rateLimits = new Map(storedRateLimits);
      }
    });
  }

  // Handle requests to the Durable Object
  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname.split('/').pop();

    try {
      switch (path) {
        case 'create-session':
          return await this.createSession(request);
        case 'validate-session':
          return await this.validateSession(request);
        case 'revoke-session':
          return await this.revokeSession(request);
        case 'blacklist-token':
          return await this.blacklistToken(request);
        case 'check-token':
          return await this.checkToken(request);
        case 'rate-limit':
          return await this.checkRateLimit(request);
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Create a new session
  private async createSession(request: Request) {
    const data = await request.json();
    const { userId, sessionId, expiresAt } = data;
    
    if (!userId || !sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Create session
    const session = {
      userId,
      sessionId,
      createdAt: Date.now(),
      expiresAt: expiresAt || Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      lastActive: Date.now(),
    };
    
    // Store the session
    this.sessions.set(sessionId, session);
    await this.state.storage.put('sessions', [...this.sessions.entries()]);
    
    return new Response(
      JSON.stringify({ success: true, session }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Validate a session
  private async validateSession(request: Request) {
    const data = await request.json();
    const { sessionId } = data;
    
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing sessionId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get the session
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Session not found' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if the session has expired
    if (session.expiresAt < Date.now()) {
      // Remove expired session
      this.sessions.delete(sessionId);
      await this.state.storage.put('sessions', [...this.sessions.entries()]);
      
      return new Response(
        JSON.stringify({ valid: false, error: 'Session expired' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Update the last active timestamp
    session.lastActive = Date.now();
    this.sessions.set(sessionId, session);
    await this.state.storage.put('sessions', [...this.sessions.entries()]);
    
    return new Response(
      JSON.stringify({ valid: true, session }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Revoke a session
  private async revokeSession(request: Request) {
    const data = await request.json();
    const { sessionId } = data;
    
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing sessionId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Remove the session
    this.sessions.delete(sessionId);
    await this.state.storage.put('sessions', [...this.sessions.entries()]);
    
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Blacklist a token
  private async blacklistToken(request: Request) {
    const data = await request.json();
    const { token } = data;
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing token' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Add the token to the blacklist
    this.blacklist.add(token);
    await this.state.storage.put('blacklist', [...this.blacklist.values()]);
    
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Check if a token is blacklisted
  private async checkToken(request: Request) {
    const data = await request.json();
    const { token } = data;
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing token' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if the token is blacklisted
    const blacklisted = this.blacklist.has(token);
    
    return new Response(
      JSON.stringify({ blacklisted }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Check rate limit
  private async checkRateLimit(request: Request) {
    const data = await request.json();
    const { key, limit, window } = data;
    
    if (!key || !limit || !window) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const now = Date.now();
    const rateLimit = this.rateLimits.get(key) || { count: 0, resetAt: now + window };
    
    // Reset the rate limit if the window has passed
    if (rateLimit.resetAt <= now) {
      rateLimit.count = 0;
      rateLimit.resetAt = now + window;
    }
    
    // Check if the rate limit has been exceeded
    const limited = rateLimit.count >= limit;
    
    if (!limited) {
      // Increment the counter
      rateLimit.count++;
      this.rateLimits.set(key, rateLimit);
      await this.state.storage.put('rateLimits', [...this.rateLimits.entries()]);
    }
    
    return new Response(
      JSON.stringify({
        limited,
        remaining: Math.max(0, limit - rateLimit.count),
        resetAt: rateLimit.resetAt,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
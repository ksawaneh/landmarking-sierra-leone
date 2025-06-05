import { verify } from '@tsndr/cloudflare-worker-jwt';
import { Env } from '../index';

/**
 * Auth middleware for protecting routes that require authentication
 * This middleware verifies the JWT token in the Authorization header
 */
export const authMiddleware = async (request: Request, env: Env) => {
  // Get the authorization header
  const authHeader = request.headers.get('Authorization');
  
  // If no auth header or doesn't start with 'Bearer ', return 401
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return Response.json(
      { error: 'Unauthorized', message: 'Missing or invalid authorization token' },
      { status: 401 }
    );
  }
  
  // Extract the token from the header
  const token = authHeader.split(' ')[1];
  
  try {
    // Verify the token
    const isValid = await verify(token, env.JWT_SECRET);
    
    if (!isValid) {
      return Response.json(
        { error: 'Unauthorized', message: 'Invalid token' },
        { status: 401 }
      );
    }
    
    // Decode the token payload
    const decoded = JSON.parse(atob(token.split('.')[1]));
    
    // Add the user to the request for later use
    request.user = decoded;
    
    // Check for token expiration
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return Response.json(
        { error: 'Unauthorized', message: 'Token expired' },
        { status: 401 }
      );
    }
    
    // Continue to the next middleware or route handler
  } catch (error) {
    return Response.json(
      { error: 'Unauthorized', message: 'Invalid token' },
      { status: 401 }
    );
  }
};
/**
 * CORS middleware for handling cross-origin requests
 * This middleware adds CORS headers to responses and handles OPTIONS requests
 */
export const corsMiddleware = async (request: Request, env: any) => {
  // Define allowed origins
  const allowedOrigins = [
    'http://localhost:3000',  // Local development
    'https://landmarking.vercel.app',  // Production frontend
  ];

  // Get the origin from the request
  const origin = request.headers.get('Origin');
  
  // Determine if the origin is allowed
  const isAllowedOrigin = origin && 
    (env.ENVIRONMENT === 'development' || allowedOrigins.includes(origin));
  
  // Set CORS headers for the preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0],
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  
  // Add CORS headers to the request for future response handling
  request.corsHeaders = {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  };
};
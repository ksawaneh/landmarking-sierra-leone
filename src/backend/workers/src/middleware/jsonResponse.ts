/**
 * JSON response middleware for formatting responses as JSON
 * Also handles the application of CORS headers set by the CORS middleware
 */
export const jsonResponseMiddleware = async (request: Request) => {
  // Extend the Response prototype to allow JSON responses
  const originalJson = Response.json;
  Response.json = function (body: any, init: ResponseInit = {}) {
    // Merge CORS headers with any other headers
    const headers = {
      'Content-Type': 'application/json',
      ...(request.corsHeaders || {}),
      ...(init.headers || {}),
    };
    
    return originalJson(body, {
      ...init,
      headers,
    });
  };
};
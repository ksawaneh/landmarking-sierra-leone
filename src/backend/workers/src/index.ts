import { Router } from 'itty-router';
import { corsMiddleware } from './middleware/cors';
import { jsonResponseMiddleware } from './middleware/jsonResponse';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { authHandler } from './handlers/auth';
import { usersHandler } from './handlers/users';
import { parcelsHandler } from './handlers/parcels';
import { AuthSessionDO } from './models/AuthSession';

// Create a new router
const router = Router();

// CORS and response formatting middleware
router.all('*', corsMiddleware);
router.all('*', jsonResponseMiddleware);

// Routes
router.get('/', () => {
  return { message: 'LandMarking API', version: '0.1.0', status: 'healthy' };
});

// Auth routes - no auth required
router.post('/api/v1/auth/login', authHandler.login);
router.post('/api/v1/auth/register', authHandler.register);
router.post('/api/v1/auth/refresh', authHandler.refresh);
router.post('/api/v1/auth/forgot-password', authHandler.forgotPassword);
router.post('/api/v1/auth/reset-password', authHandler.resetPassword);

// Protected routes - auth required
router.all('/api/v1/*', authMiddleware);

// User routes
router.get('/api/v1/users', usersHandler.listUsers);
router.get('/api/v1/users/:id', usersHandler.getUser);
router.get('/api/v1/users/me', usersHandler.getCurrentUser);
router.put('/api/v1/users/:id', usersHandler.updateUser);
router.delete('/api/v1/users/:id', usersHandler.deleteUser);

// Land parcel routes
router.get('/api/v1/parcels', parcelsHandler.listParcels);
router.post('/api/v1/parcels', parcelsHandler.createParcel);
router.get('/api/v1/parcels/:id', parcelsHandler.getParcel);
router.put('/api/v1/parcels/:id', parcelsHandler.updateParcel);
router.delete('/api/v1/parcels/:id', parcelsHandler.deleteParcel);

// Fallback for 404
router.all('*', () => new Response('Not Found', { status: 404 }));

// Define the worker
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Route the request
      const response = await router.handle(request, env, ctx);
      return response;
    } catch (error) {
      // Handle any uncaught errors
      return errorHandler(error);
    }
  },
};

// Export Durable Object class
export { AuthSessionDO };

// Environment interface
export interface Env {
  JWT_SECRET: string;
  ENVIRONMENT: string;
  USERS_KV: KVNamespace;
  AUTH_SESSIONS: DurableObjectNamespace;
  // Add other bindings as needed
}
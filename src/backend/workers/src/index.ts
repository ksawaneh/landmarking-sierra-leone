import { Router } from 'itty-router';
import { corsMiddleware } from './middleware/cors';
import { jsonResponseMiddleware } from './middleware/jsonResponse';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { authHandler } from './handlers/auth';
import { usersHandler } from './handlers/users';
import { parcelsHandler } from './handlers/parcels';
import { AuthSessionDO } from './models/AuthSession';
import { VerificationDO } from './models/VerificationDO';
import { RateLimiterDO } from './services/rateLimit';
import * as verificationHandler from './handlers/verification';
import * as governmentHandler from './handlers/government';

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

// Verification routes
router.post('/api/v1/verifications', verificationHandler.createVerification);
router.get('/api/v1/verifications', verificationHandler.listVerifications);
router.get('/api/v1/verifications/:id', verificationHandler.getVerification);
router.post('/api/v1/verifications/:id/parties', verificationHandler.addParty);
router.post('/api/v1/verifications/:id/verify-party/:partyId', verificationHandler.verifyParty);
router.post('/api/v1/verifications/:id/signatures', verificationHandler.collectSignature);
router.post('/api/v1/verifications/:id/advance', verificationHandler.advanceWorkflow);
router.get('/api/v1/verifications/:id/validate', verificationHandler.validateVerification);

// Government integration routes
router.get('/api/v1/government/mlhcp/search', governmentHandler.searchMLHCP);
router.get('/api/v1/government/mlhcp/:landId', governmentHandler.getMLHCPRecord);
router.get('/api/v1/government/nra/search', governmentHandler.searchNRA);
router.get('/api/v1/government/nra/:taxId', governmentHandler.getNRARecord);
router.get('/api/v1/government/nra/:taxId/compliance', governmentHandler.checkTaxCompliance);
router.post('/api/v1/government/reconcile', governmentHandler.reconcileRecords);
router.get('/api/v1/government/search/unified', governmentHandler.unifiedSearch);
router.get('/api/v1/government/health', governmentHandler.checkHealth);
router.get('/api/v1/government/districts', governmentHandler.getDistricts);

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

// Export Durable Object classes
export { AuthSessionDO, VerificationDO, RateLimiterDO };

// Environment interface
export interface Env {
  JWT_SECRET: string;
  ENVIRONMENT: string;
  API_VERSION: string;
  CORS_ORIGINS: string;
  MOCK_MODE: string;
  
  // KV Namespaces
  USERS_KV: KVNamespace;
  CONFIG_KV: KVNamespace;
  CACHE: KVNamespace;
  
  // Durable Object Namespaces
  AUTH_SESSIONS: DurableObjectNamespace;
  PARCEL_DATA: DurableObjectNamespace;
  VERIFICATION_DO: DurableObjectNamespace;
  RATE_LIMITER: DurableObjectNamespace;
  
  // R2 Bucket
  DOCUMENTS_BUCKET: R2Bucket;
  
  // Government API Configuration
  MLHCP_BASE_URL: string;
  MLHCP_API_KEY: string;
  MLHCP_TIMEOUT: string;
  NRA_BASE_URL: string;
  NRA_API_KEY: string;
  NRA_TIMEOUT: string;
  OARG_BASE_URL: string;
  OARG_API_KEY: string;
  OARG_TIMEOUT: string;
  
  // Biometric Service Configuration
  BIOMETRIC_SERVICE_URL: string;
  BIOMETRIC_API_KEY: string;
  BIOMETRIC_MIN_QUALITY: string;
  
  // Rate Limiting Configuration
  RATE_LIMIT_AUTH: string;
  RATE_LIMIT_UNAUTH: string;
  RATE_LIMIT_GOV: string;
}
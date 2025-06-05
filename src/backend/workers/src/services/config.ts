/**
 * Configuration service for environment-based settings
 * Handles development vs production configurations
 */

export interface AppConfig {
  environment: 'development' | 'staging' | 'production';
  mockMode: boolean;
  government: {
    mlhcp: {
      baseUrl: string;
      apiKey: string;
      timeout: number;
    };
    nra: {
      baseUrl: string;
      apiKey: string;
      timeout: number;
    };
    oarg: {
      baseUrl: string;
      apiKey: string;
      timeout: number;
    };
  };
  biometric: {
    serviceUrl: string;
    apiKey: string;
    minQualityThreshold: number;
  };
  rateLimit: {
    authenticated: number;
    unauthenticated: number;
    governmentQueries: number;
  };
}

export function getConfig(env: any): AppConfig {
  const environment = env.ENVIRONMENT || 'development';
  const isDevelopment = environment === 'development';

  return {
    environment,
    mockMode: isDevelopment || env.MOCK_MODE === 'true',
    government: {
      mlhcp: {
        baseUrl: env.MLHCP_BASE_URL || 'mock',
        apiKey: env.MLHCP_API_KEY || 'mock',
        timeout: parseInt(env.MLHCP_TIMEOUT || '30000')
      },
      nra: {
        baseUrl: env.NRA_BASE_URL || 'mock',
        apiKey: env.NRA_API_KEY || 'mock',
        timeout: parseInt(env.NRA_TIMEOUT || '30000')
      },
      oarg: {
        baseUrl: env.OARG_BASE_URL || 'mock',
        apiKey: env.OARG_API_KEY || 'mock',
        timeout: parseInt(env.OARG_TIMEOUT || '30000')
      }
    },
    biometric: {
      serviceUrl: env.BIOMETRIC_SERVICE_URL || 'mock',
      apiKey: env.BIOMETRIC_API_KEY || 'mock',
      minQualityThreshold: parseInt(env.BIOMETRIC_MIN_QUALITY || '60')
    },
    rateLimit: {
      authenticated: parseInt(env.RATE_LIMIT_AUTH || '100'),
      unauthenticated: parseInt(env.RATE_LIMIT_UNAUTH || '20'),
      governmentQueries: parseInt(env.RATE_LIMIT_GOV || '50')
    }
  };
}
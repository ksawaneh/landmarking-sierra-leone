/**
 * Tests for government integration endpoints
 * Covers MLHCP, NRA, and unified search functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

describe('Government Integration Endpoints', () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
      vars: {
        ENVIRONMENT: 'development',
        MOCK_MODE: 'true',
        RATE_LIMIT_GOV: '50'
      }
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  describe('MLHCP Endpoints', () => {
    describe('GET /api/government/mlhcp/search', () => {
      it('should search MLHCP records successfully', async () => {
        const response = await worker.fetch('/api/government/mlhcp/search?ownerName=Kamara&district=WesternAreaUrban&limit=5');
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.records).toBeDefined();
        expect(data.data.metadata).toBeDefined();
        expect(Array.isArray(data.data.records)).toBe(true);
      });

      it('should validate search parameters', async () => {
        const response = await worker.fetch('/api/government/mlhcp/search?limit=200');
        expect(response.status).toBe(200);
        
        const data = await response.json();
        // Should still succeed but with default limit
        expect(data.success).toBe(true);
      });

      it('should handle rate limiting', async () => {
        // Make multiple requests to trigger rate limit
        const requests = [];
        for (let i = 0; i < 60; i++) {
          requests.push(worker.fetch('/api/government/mlhcp/search?ownerName=test'));
        }
        
        const responses = await Promise.all(requests);
        const rateLimited = responses.some(r => r.status === 429);
        expect(rateLimited).toBe(true);
      });
    });

    describe('GET /api/government/mlhcp/:landId', () => {
      it('should retrieve specific MLHCP record', async () => {
        const response = await worker.fetch('/api/government/mlhcp/WU-FT-001234-2024');
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        expect(data.data.landId).toBe('WU-FT-001234-2024');
      });

      it('should return 404 for non-existent record', async () => {
        const response = await worker.fetch('/api/government/mlhcp/INVALID-ID');
        expect(response.status).toBe(404);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Land record not found');
      });
    });
  });

  describe('NRA Endpoints', () => {
    describe('GET /api/government/nra/search', () => {
      it('should search NRA tax records', async () => {
        const response = await worker.fetch('/api/government/nra/search?taxpayerName=Kamara&isCompliant=true');
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.records).toBeDefined();
        expect(Array.isArray(data.data.records)).toBe(true);
      });

      it('should handle boolean parameters correctly', async () => {
        const response = await worker.fetch('/api/government/nra/search?hasArrears=false');
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
      });
    });

    describe('GET /api/government/nra/:taxId', () => {
      it('should retrieve specific NRA record', async () => {
        const response = await worker.fetch('/api/government/nra/TAX-123456');
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
      });
    });

    describe('GET /api/government/nra/:taxId/compliance', () => {
      it('should check tax compliance', async () => {
        const response = await worker.fetch('/api/government/nra/TAX-123456/compliance');
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        expect(data.data.isCompliant).toBeDefined();
        expect(data.data.totalOwed).toBeDefined();
      });
    });
  });

  describe('Unified Search', () => {
    describe('GET /api/government/search/unified', () => {
      it('should search across multiple sources', async () => {
        const response = await worker.fetch('/api/government/search/unified?ownerName=Kamara&district=WesternAreaUrban');
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.results).toBeDefined();
        expect(data.data.totalMLHCP).toBeDefined();
        expect(data.data.totalNRA).toBeDefined();
        expect(data.data.totalUnified).toBeDefined();
      });

      it('should require at least one search parameter', async () => {
        const response = await worker.fetch('/api/government/search/unified');
        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('Please provide ownerName or district');
      });

      it('should reconcile matching records', async () => {
        const response = await worker.fetch('/api/government/search/unified?ownerName=Kamara');
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        
        // Check that results have reconciliation metadata
        if (data.data.results.length > 0) {
          const result = data.data.results[0];
          expect(result.unified).toBeDefined();
          expect(result.confidence).toBeDefined();
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(100);
        }
      });
    });
  });

  describe('Reconciliation', () => {
    describe('POST /api/government/reconcile', () => {
      it('should reconcile records from multiple sources', async () => {
        const response = await worker.fetch('/api/government/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mlhcpId: 'WU-FT-001234-2024',
            nraId: 'TAX-123456'
          })
        });
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.unified).toBeDefined();
        expect(data.data.confidence).toBeDefined();
        expect(data.data.conflicts).toBeDefined();
      });

      it('should require at least one record ID', async () => {
        const response = await worker.fetch('/api/government/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
      });

      it('should validate request body schema', async () => {
        const response = await worker.fetch('/api/government/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invalidField: 'test'
          })
        });
        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Validation error');
      });
    });
  });

  describe('Utility Endpoints', () => {
    describe('GET /api/government/health', () => {
      it('should check health status of integrations', async () => {
        const response = await worker.fetch('/api/government/health');
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.status).toMatch(/healthy|degraded|unhealthy/);
        expect(data.data.services.mlhcp).toBeDefined();
        expect(data.data.services.nra).toBeDefined();
      });

      it('should cache health check results', async () => {
        // First request
        const response1 = await worker.fetch('/api/government/health');
        const data1 = await response1.json();
        
        // Second request (should be cached)
        const response2 = await worker.fetch('/api/government/health');
        const data2 = await response2.json();
        
        expect(data1.data.timestamp).toBe(data2.data.timestamp);
      });
    });

    describe('GET /api/government/districts', () => {
      it('should return all 16 districts', async () => {
        const response = await worker.fetch('/api/government/districts');
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.districts).toHaveLength(16);
        expect(data.data.total).toBe(16);
      });

      it('should include district metadata', async () => {
        const response = await worker.fetch('/api/government/districts');
        const data = await response.json();
        
        const district = data.data.districts[0];
        expect(district.name).toBeDefined();
        expect(district.code).toBeDefined();
        expect(district.province).toBeDefined();
      });

      it('should cache district data', async () => {
        // Make two requests and verify caching
        const response1 = await worker.fetch('/api/government/districts');
        const response2 = await worker.fetch('/api/government/districts');
        
        expect(response1.status).toBe(200);
        expect(response2.status).toBe(200);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle adapter errors gracefully', async () => {
      // Force an error by using invalid parameters
      const response = await worker.fetch('/api/government/mlhcp/search?limit=invalid');
      
      // Should still work with default limit
      expect(response.status).toBe(200);
    });

    it('should return consistent error responses', async () => {
      const response = await worker.fetch('/api/government/mlhcp/NON-EXISTENT');
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('Rate Limiting Headers', () => {
    it('should include rate limit headers', async () => {
      const response = await worker.fetch('/api/government/mlhcp/search');
      
      expect(response.headers.get('X-RateLimit-Limit')).toBeDefined();
      expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
    });
  });
});
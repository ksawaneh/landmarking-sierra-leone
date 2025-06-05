/**
 * API endpoints for government database integration
 * Uses configuration-based adapters for production readiness
 */

import { Request as IttyRequest } from 'itty-router';
import { z } from 'zod';
import { MLHCPAdapter } from '../../../services/government/adapters/mlhcp-adapter';
import { NRAAdapter } from '../../../services/government/adapters/nra-adapter';
import { DataReconciler } from '../../../services/government/reconciliation/data-reconciler';
import { DistrictName } from '../../../services/government/schemas/government-data.types';
import { jsonResponse } from '../middleware/jsonResponse';
import { getConfig } from '../services/config';
import { checkRateLimit } from '../services/rateLimit';

// SearchSchema removed - using direct parameter validation instead

/**
 * Reconcile records schema
 */
const ReconcileSchema = z.object({
  mlhcpId: z.string().optional(),
  nraId: z.string().optional(),
  oargId: z.string().optional()
});

/**
 * Get adapter instances with caching
 */
const adapterCache = new Map<string, any>();

function getMLHCPAdapter(env: any): MLHCPAdapter {
  if (!adapterCache.has('mlhcp')) {
    const config = getConfig(env);
    adapterCache.set('mlhcp', new MLHCPAdapter({
      mockMode: config.mockMode,
      baseUrl: config.government.mlhcp.baseUrl,
      apiKey: config.government.mlhcp.apiKey,
      timeout: config.government.mlhcp.timeout
    }));
  }
  return adapterCache.get('mlhcp');
}

function getNRAAdapter(env: any): NRAAdapter {
  if (!adapterCache.has('nra')) {
    const config = getConfig(env);
    adapterCache.set('nra', new NRAAdapter({
      mockMode: config.mockMode,
      baseUrl: config.government.nra.baseUrl,
      apiKey: config.government.nra.apiKey,
      timeout: config.government.nra.timeout
    }));
  }
  return adapterCache.get('nra');
}

/**
 * GET /api/government/mlhcp/search
 * Search MLHCP land records
 */
export async function searchMLHCP(request: IttyRequest, env: any): Promise<Response> {
  // Check rate limit for government queries
  const rateLimitResponse = await checkRateLimit(request, env, 'governmentQueries');
  if (rateLimitResponse && rateLimitResponse.status === 429) {
    return rateLimitResponse;
  }

  try {
    const { searchParams } = new URL(request.url);
    const params = {
      ownerName: searchParams.get('ownerName') || undefined,
      landId: searchParams.get('landId') || undefined,
      district: searchParams.get('district') as DistrictName | undefined,
      landType: searchParams.get('landType') as any,
    };
    
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Get adapter and search
    const mlhcpAdapter = getMLHCPAdapter(env);
    const result = await mlhcpAdapter.query(params, { limit, offset });
    
    return jsonResponse({
      success: true,
      data: {
        records: result.data,
        metadata: result.metadata,
        warnings: result.warnings
      }
    });
  } catch (error) {
    console.error('MLHCP search error:', error);
    return jsonResponse({
      success: false,
      error: 'Failed to search MLHCP records',
      message: error instanceof Error ? error.message : undefined
    }, 500);
  }
}

/**
 * GET /api/government/mlhcp/:landId
 * Get specific MLHCP record
 */
export async function getMLHCPRecord(request: IttyRequest, env: any): Promise<Response> {
  const rateLimitResponse = await checkRateLimit(request, env, 'governmentQueries');
  if (rateLimitResponse && rateLimitResponse.status === 429) {
    return rateLimitResponse;
  }

  try {
    const { landId } = request.params;
    const mlhcpAdapter = getMLHCPAdapter(env);
    const result = await mlhcpAdapter.getById(landId);
    
    if (!result.data) {
      return jsonResponse({
        success: false,
        error: 'Land record not found'
      }, 404);
    }
    
    return jsonResponse({
      success: true,
      data: result.data,
      warnings: result.warnings
    });
  } catch (error) {
    console.error('Get MLHCP record error:', error);
    return jsonResponse({
      success: false,
      error: 'Failed to retrieve MLHCP record'
    }, 500);
  }
}

/**
 * GET /api/government/nra/search
 * Search NRA tax records
 */
export async function searchNRA(request: IttyRequest, env: any): Promise<Response> {
  const rateLimitResponse = await checkRateLimit(request, env, 'governmentQueries');
  if (rateLimitResponse && rateLimitResponse.status === 429) {
    return rateLimitResponse;
  }

  try {
    const { searchParams } = new URL(request.url);
    const params = {
      taxpayerName: searchParams.get('taxpayerName') || undefined,
      taxId: searchParams.get('taxId') || undefined,
      propertyAddress: searchParams.get('propertyAddress') || undefined,
      isCompliant: searchParams.get('isCompliant') === 'true' ? true : 
                   searchParams.get('isCompliant') === 'false' ? false : undefined,
      hasArrears: searchParams.get('hasArrears') === 'true' ? true :
                  searchParams.get('hasArrears') === 'false' ? false : undefined
    };
    
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const nraAdapter = getNRAAdapter(env);
    const result = await nraAdapter.query(params, { limit, offset });
    
    return jsonResponse({
      success: true,
      data: {
        records: result.data,
        metadata: result.metadata,
        warnings: result.warnings
      }
    });
  } catch (error) {
    console.error('NRA search error:', error);
    return jsonResponse({
      success: false,
      error: 'Failed to search NRA records'
    }, 500);
  }
}

/**
 * GET /api/government/nra/:taxId
 * Get specific NRA record
 */
export async function getNRARecord(request: IttyRequest, env: any): Promise<Response> {
  const rateLimitResponse = await checkRateLimit(request, env, 'governmentQueries');
  if (rateLimitResponse && rateLimitResponse.status === 429) {
    return rateLimitResponse;
  }

  try {
    const { taxId } = request.params;
    const nraAdapter = getNRAAdapter(env);
    const result = await nraAdapter.getById(taxId);
    
    if (!result.data) {
      return jsonResponse({
        success: false,
        error: 'Tax record not found'
      }, 404);
    }
    
    return jsonResponse({
      success: true,
      data: result.data,
      warnings: result.warnings
    });
  } catch (error) {
    console.error('Get NRA record error:', error);
    return jsonResponse({
      success: false,
      error: 'Failed to retrieve NRA record'
    }, 500);
  }
}

/**
 * GET /api/government/nra/:taxId/compliance
 * Check tax compliance for a property
 */
export async function checkTaxCompliance(request: IttyRequest, env: any): Promise<Response> {
  const rateLimitResponse = await checkRateLimit(request, env, 'governmentQueries');
  if (rateLimitResponse && rateLimitResponse.status === 429) {
    return rateLimitResponse;
  }

  try {
    const { taxId } = request.params;
    const nraAdapter = getNRAAdapter(env);
    const compliance = await nraAdapter.calculateCompliance(taxId);
    
    return jsonResponse({
      success: true,
      data: compliance
    });
  } catch (error) {
    console.error('Tax compliance check error:', error);
    return jsonResponse({
      success: false,
      error: 'Failed to check tax compliance'
    }, 500);
  }
}

/**
 * POST /api/government/reconcile
 * Reconcile records from multiple government sources
 */
export async function reconcileRecords(request: IttyRequest, env: any): Promise<Response> {
  const rateLimitResponse = await checkRateLimit(request, env, 'governmentQueries');
  if (rateLimitResponse && rateLimitResponse.status === 429) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const validated = ReconcileSchema.parse(body);
    
    // Fetch records from each source
    let mlhcpRecord = null;
    let nraRecord = null;
    
    if (validated.mlhcpId) {
      const mlhcpAdapter = getMLHCPAdapter(env);
      const mlhcpResult = await mlhcpAdapter.getById(validated.mlhcpId);
      mlhcpRecord = mlhcpResult.data;
    }
    
    if (validated.nraId) {
      const nraAdapter = getNRAAdapter(env);
      const nraResult = await nraAdapter.getById(validated.nraId);
      nraRecord = nraResult.data;
    }
    
    // At least one record must be provided
    if (!mlhcpRecord && !nraRecord) {
      return jsonResponse({
        success: false,
        error: 'At least one record ID must be provided'
      }, 400);
    }
    
    // Reconcile the records
    const reconciler = new DataReconciler();
    const result = await reconciler.reconcile(mlhcpRecord, nraRecord);
    
    return jsonResponse({
      success: true,
      data: {
        unified: result.unified,
        confidence: result.confidence,
        conflicts: result.conflicts,
        suggestions: result.suggestions
      }
    });
  } catch (error) {
    console.error('Reconcile records error:', error);
    
    if (error instanceof z.ZodError) {
      return jsonResponse({
        success: false,
        error: 'Validation error',
        details: error.errors
      }, 400);
    }
    
    return jsonResponse({
      success: false,
      error: 'Failed to reconcile records'
    }, 500);
  }
}

/**
 * Process search results from multiple sources
 * Extracted to reduce function size
 */
async function processUnifiedSearchResults(
  mlhcpResult: any,
  nraResult: any,
  reconciler: DataReconciler,
  limit: number
): Promise<any[]> {
  const unifiedResults = [];
  const processedNraIds = new Set();
  
  // Process MLHCP records
  for (const mlhcp of mlhcpResult.data) {
    const nraMatch = findNRAMatch(mlhcp, nraResult.data, processedNraIds);
    
    if (nraMatch) {
      processedNraIds.add(nraMatch.taxId);
    }
    
    const reconciled = await reconciler.reconcile(mlhcp, nraMatch || undefined);
    unifiedResults.push(reconciled);
  }
  
  // Add NRA records without MLHCP matches
  for (const nra of nraResult.data) {
    if (!processedNraIds.has(nra.taxId)) {
      const reconciled = await reconciler.reconcile(undefined, nra);
      unifiedResults.push(reconciled);
    }
  }
  
  return unifiedResults.slice(0, limit);
}

/**
 * Find matching NRA record for MLHCP record
 * Extracted to reduce function size
 */
function findNRAMatch(mlhcp: any, nraRecords: any[], processedIds: Set<string>): any {
  return nraRecords.find(nra => {
    if (processedIds.has(nra.taxId)) return false;
    
    // Name matching
    const nameMatch = nra.taxpayerName.toLowerCase().includes(mlhcp.ownerName.toLowerCase()) ||
                     mlhcp.ownerName.toLowerCase().includes(nra.taxpayerName.toLowerCase());
    
    // Reference matching
    const refMatch = nra.propertyRef === mlhcp.landId;
    
    return nameMatch || refMatch;
  });
}

/**
 * GET /api/government/search/unified
 * Search across all government sources and return unified results
 */
export async function unifiedSearch(request: IttyRequest, env: any): Promise<Response> {
  const rateLimitResponse = await checkRateLimit(request, env, 'governmentQueries');
  if (rateLimitResponse && rateLimitResponse.status === 429) {
    return rateLimitResponse;
  }

  try {
    const { searchParams } = new URL(request.url);
    const ownerName = searchParams.get('ownerName');
    const district = searchParams.get('district') as DistrictName | undefined;
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    if (!ownerName && !district) {
      return jsonResponse({
        success: false,
        error: 'Please provide ownerName or district to search'
      }, 400);
    }
    
    // Get adapters
    const mlhcpAdapter = getMLHCPAdapter(env);
    const nraAdapter = getNRAAdapter(env);
    
    // Search both sources in parallel
    const [mlhcpResult, nraResult] = await Promise.all([
      mlhcpAdapter.query({ ownerName, district }, { limit, offset }),
      nraAdapter.query({ taxpayerName: ownerName }, { limit, offset })
    ]);
    
    // Process and reconcile results
    const reconciler = new DataReconciler();
    const unifiedResults = await processUnifiedSearchResults(
      mlhcpResult,
      nraResult,
      reconciler,
      limit
    );
    
    return jsonResponse({
      success: true,
      data: {
        results: unifiedResults,
        totalMLHCP: mlhcpResult.metadata.recordCount,
        totalNRA: nraResult.metadata.recordCount,
        totalUnified: unifiedResults.length,
        warnings: [...(mlhcpResult.warnings || []), ...(nraResult.warnings || [])]
      },
      metadata: {
        searchParams: { ownerName, district },
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('Unified search error:', error);
    return jsonResponse({
      success: false,
      error: 'Failed to perform unified search'
    }, 500);
  }
}

/**
 * GET /api/government/health
 * Check health status of government integrations
 */
export async function checkHealth(request: IttyRequest, env: any): Promise<Response> {
  // Cache health check results for 60 seconds
  const cacheKey = 'government:health';
  const cached = await env.CACHE.get(cacheKey);
  
  if (cached) {
    return jsonResponse(JSON.parse(cached));
  }

  try {
    const mlhcpAdapter = getMLHCPAdapter(env);
    const nraAdapter = getNRAAdapter(env);
    
    const [mlhcpHealth, nraHealth] = await Promise.all([
      mlhcpAdapter.checkHealth(),
      nraAdapter.checkHealth()
    ]);
    
    const overall = mlhcpHealth.status === 'healthy' && nraHealth.status === 'healthy' 
      ? 'healthy' 
      : mlhcpHealth.status === 'unhealthy' || nraHealth.status === 'unhealthy'
      ? 'unhealthy'
      : 'degraded';
    
    const response = {
      success: true,
      data: {
        status: overall,
        services: {
          mlhcp: mlhcpHealth,
          nra: nraHealth
        },
        timestamp: new Date()
      }
    };
    
    // Cache for 60 seconds
    await env.CACHE.put(cacheKey, JSON.stringify(response), { expirationTtl: 60 });
    
    return jsonResponse(response);
  } catch (error) {
    console.error('Health check error:', error);
    return jsonResponse({
      success: false,
      error: 'Failed to check health status'
    }, 500);
  }
}

/**
 * GET /api/government/districts
 * Get list of valid districts with caching
 */
export async function getDistricts(request: IttyRequest, env: any): Promise<Response> {
  // Cache districts data for 24 hours
  const cacheKey = 'government:districts';
  const cached = await env.CACHE.get(cacheKey);
  
  if (cached) {
    return jsonResponse(JSON.parse(cached));
  }

  const districts = [
    // Eastern Province
    { name: 'Kailahun', code: 'KL', province: 'Eastern' },
    { name: 'Kenema', code: 'KN', province: 'Eastern' },
    { name: 'Kono', code: 'KO', province: 'Eastern' },
    
    // Northern Province
    { name: 'Bombali', code: 'BM', province: 'Northern' },
    { name: 'Falaba', code: 'FL', province: 'Northern' },
    { name: 'Koinadugu', code: 'KD', province: 'Northern' },
    { name: 'Tonkolili', code: 'TN', province: 'Northern' },
    
    // North West Province
    { name: 'Kambia', code: 'KM', province: 'North West' },
    { name: 'Karene', code: 'KR', province: 'North West' },
    { name: 'Port Loko', code: 'PT', province: 'North West' },
    
    // Southern Province
    { name: 'Bo', code: 'BO', province: 'Southern' },
    { name: 'Bonthe', code: 'BN', province: 'Southern' },
    { name: 'Moyamba', code: 'MO', province: 'Southern' },
    { name: 'Pujehun', code: 'PU', province: 'Southern' },
    
    // Western Area
    { name: 'Western Area Rural', code: 'WR', province: 'Western Area' },
    { name: 'Western Area Urban', code: 'WU', province: 'Western Area' }
  ];
  
  const response = {
    success: true,
    data: {
      districts,
      total: districts.length
    }
  };
  
  // Cache for 24 hours
  await env.CACHE.put(cacheKey, JSON.stringify(response), { expirationTtl: 86400 });
  
  return jsonResponse(response);
}
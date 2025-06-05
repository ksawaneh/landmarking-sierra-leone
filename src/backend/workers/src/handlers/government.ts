/**
 * API endpoints for government database integration
 */

import { Request as IttyRequest } from 'itty-router';
import { z } from 'zod';
import { MLHCPAdapter } from '../../services/government/adapters/mlhcp-adapter';
import { NRAAdapter } from '../../services/government/adapters/nra-adapter';
import { DataReconciler } from '../../services/government/reconciliation/data-reconciler';
import { DistrictName } from '../../services/government/schemas/government-data.types';
import { jsonResponse } from '../middleware/jsonResponse';

/**
 * Search schema for government records
 */
const SearchSchema = z.object({
  ownerName: z.string().optional(),
  nationalId: z.string().optional(),
  landId: z.string().optional(),
  district: z.string().optional(),
  landType: z.enum(['residential', 'commercial', 'agricultural', 'industrial', 'mixed']).optional(),
  limit: z.number().min(1).max(100).default(10),
  offset: z.number().min(0).default(0)
});

/**
 * Reconcile records schema
 */
const ReconcileSchema = z.object({
  mlhcpId: z.string().optional(),
  nraId: z.string().optional(),
  oargId: z.string().optional()
});

/**
 * Initialize adapters (in production, these would be singletons)
 */
const mlhcpAdapter = new MLHCPAdapter({ mockMode: true });
const nraAdapter = new NRAAdapter({ mockMode: true });
const reconciler = new DataReconciler();

/**
 * GET /api/government/mlhcp/search
 * Search MLHCP land records
 */
export async function searchMLHCP(request: IttyRequest): Promise<Response> {
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
    
    // Search MLHCP records
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
    return jsonResponse({
      success: false,
      error: 'Failed to search MLHCP records'
    }, 500);
  }
}

/**
 * GET /api/government/mlhcp/:landId
 * Get specific MLHCP record
 */
export async function getMLHCPRecord(request: IttyRequest): Promise<Response> {
  try {
    const { landId } = request.params;
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
export async function searchNRA(request: IttyRequest): Promise<Response> {
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
    
    // Search NRA records
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
export async function getNRARecord(request: IttyRequest): Promise<Response> {
  try {
    const { taxId } = request.params;
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
export async function checkTaxCompliance(request: IttyRequest): Promise<Response> {
  try {
    const { taxId } = request.params;
    const compliance = await nraAdapter.calculateCompliance(taxId);
    
    return jsonResponse({
      success: true,
      data: compliance
    });
  } catch (error) {
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
export async function reconcileRecords(request: IttyRequest): Promise<Response> {
  try {
    const body = await request.json();
    const validated = ReconcileSchema.parse(body);
    
    // Fetch records from each source
    let mlhcpRecord = null;
    let nraRecord = null;
    
    if (validated.mlhcpId) {
      const mlhcpResult = await mlhcpAdapter.getById(validated.mlhcpId);
      mlhcpRecord = mlhcpResult.data;
    }
    
    if (validated.nraId) {
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
 * GET /api/government/search/unified
 * Search across all government sources and return unified results
 */
export async function unifiedSearch(request: IttyRequest): Promise<Response> {
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
    
    // Search both sources in parallel
    const [mlhcpResult, nraResult] = await Promise.all([
      mlhcpAdapter.query({ ownerName, district }, { limit, offset }),
      nraAdapter.query({ taxpayerName: ownerName }, { limit, offset })
    ]);
    
    // Group by likely matches and reconcile
    const unifiedResults = [];
    const processedNraIds = new Set();
    
    // Process MLHCP records
    for (const mlhcp of mlhcpResult.data) {
      // Find potential NRA match
      const nraMatch = nraResult.data.find(nra => {
        if (processedNraIds.has(nra.taxId)) return false;
        
        // Simple matching logic (in production, use fuzzy matching)
        const nameMatch = nra.taxpayerName.toLowerCase().includes(mlhcp.ownerName.toLowerCase()) ||
                         mlhcp.ownerName.toLowerCase().includes(nra.taxpayerName.toLowerCase());
        const refMatch = nra.propertyRef === mlhcp.landId;
        
        return nameMatch || refMatch;
      });
      
      if (nraMatch) {
        processedNraIds.add(nraMatch.taxId);
      }
      
      // Reconcile if match found
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
    
    return jsonResponse({
      success: true,
      data: {
        results: unifiedResults.slice(0, limit),
        totalMLHCP: mlhcpResult.metadata.recordCount,
        totalNRA: nraResult.metadata.recordCount,
        totalUnified: unifiedResults.length,
        warnings: [...(mlhcpResult.warnings || []), ...(nraResult.warnings || [])]
      }
    });
  } catch (error) {
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
export async function checkHealth(request: IttyRequest): Promise<Response> {
  try {
    const [mlhcpHealth, nraHealth] = await Promise.all([
      mlhcpAdapter.checkHealth(),
      nraAdapter.checkHealth()
    ]);
    
    const overall = mlhcpHealth.status === 'healthy' && nraHealth.status === 'healthy' 
      ? 'healthy' 
      : mlhcpHealth.status === 'unhealthy' || nraHealth.status === 'unhealthy'
      ? 'unhealthy'
      : 'degraded';
    
    return jsonResponse({
      success: true,
      data: {
        status: overall,
        services: {
          mlhcp: mlhcpHealth,
          nra: nraHealth
        },
        timestamp: new Date()
      }
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: 'Failed to check health status'
    }, 500);
  }
}

/**
 * GET /api/government/districts
 * Get list of valid districts
 */
export async function getDistricts(request: IttyRequest): Promise<Response> {
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
  
  return jsonResponse({
    success: true,
    data: {
      districts,
      total: districts.length
    }
  });
}
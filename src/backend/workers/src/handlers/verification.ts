/**
 * API endpoints for multi-party verification system
 */

import { Request as IttyRequest } from 'itty-router';
import { z } from 'zod';
import { 
  VerificationWorkflow,
  VerificationRequirementsFactory 
} from '../../services/verification/workflows/verification-workflow';
import {
  VerificationRecord,
  VerificationParty,
  PartyRole,
  BiometricData
} from '../../services/verification/types';
import { jsonResponse } from '../middleware/jsonResponse';

/**
 * Create verification request schema
 */
const CreateVerificationSchema = z.object({
  parcelId: z.string(),
  verificationType: z.enum(['initial_registration', 'transfer', 'dispute_resolution', 'update']),
  landType: z.enum(['residential', 'commercial', 'agricultural', 'industrial']),
  district: z.string(),
  initiatedBy: z.string()
});

/**
 * Add party request schema
 */
const AddPartySchema = z.object({
  role: z.nativeEnum(PartyRole),
  name: z.string(),
  nationalId: z.string().optional(),
  phoneNumber: z.string().optional(),
  address: z.string(),
  district: z.string(),
  biometrics: z.object({
    fingerprint: z.object({
      data: z.string(),
      quality: z.number(),
      captureDevice: z.string()
    }).optional(),
    face: z.object({
      data: z.string(),
      confidence: z.number(),
      captureDevice: z.string()
    }).optional(),
    voice: z.object({
      data: z.string(),
      duration: z.number(),
      language: z.enum(['en', 'krio', 'temne', 'mende']),
      transcript: z.string().optional()
    }).optional(),
    captureTimestamp: z.string().transform(str => new Date(str)),
    captureLocation: z.object({
      latitude: z.number(),
      longitude: z.number(),
      accuracy: z.number()
    }).optional()
  }).optional()
});

/**
 * Collect signature request schema
 */
const CollectSignatureSchema = z.object({
  partyId: z.string(),
  signature: z.string(),
  signedData: z.string(),
  deviceInfo: z.object({
    deviceId: z.string(),
    deviceType: z.string(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional()
  }).optional()
});

/**
 * In-memory storage for development
 * In production, use Durable Objects or database
 */
const verificationStore = new Map<string, VerificationRecord>();
const workflowStore = new Map<string, VerificationWorkflow>();

/**
 * POST /api/verifications
 * Create a new verification request
 */
export async function createVerification(request: IttyRequest): Promise<Response> {
  try {
    const body = await request.json();
    const validated = CreateVerificationSchema.parse(body);
    
    // Generate requirements based on type and location
    const requirements = VerificationRequirementsFactory.create(
      validated.landType,
      validated.district as any,
      validated.verificationType
    );
    
    // Create verification record
    const record: VerificationRecord = {
      id: `VER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      parcelId: validated.parcelId,
      verificationType: validated.verificationType,
      status: 'pending',
      parties: [],
      signatures: [],
      requirements,
      currentSignatures: 0,
      requiredSignatures: requirements.minimumSignatures,
      evidence: [],
      initiatedAt: new Date(),
      initiatedBy: validated.initiatedBy,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      history: [{
        action: 'Verification initiated',
        performedBy: validated.initiatedBy,
        timestamp: new Date()
      }]
    };
    
    // Create workflow
    const workflow = new VerificationWorkflow(record);
    
    // Store in memory (use database in production)
    verificationStore.set(record.id, record);
    workflowStore.set(record.id, workflow);
    
    return jsonResponse({
      success: true,
      data: {
        verificationId: record.id,
        status: record.status,
        requirements: {
          minimumSignatures: requirements.minimumSignatures,
          requiredRoles: requirements.requiredRoles,
          biometricRequired: requirements.biometricRequired
        },
        expiresAt: record.expiresAt
      }
    }, 201);
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
      error: 'Failed to create verification'
    }, 500);
  }
}

/**
 * GET /api/verifications/:id
 * Get verification details
 */
export async function getVerification(request: IttyRequest): Promise<Response> {
  try {
    const { id } = request.params;
    const record = verificationStore.get(id);
    
    if (!record) {
      return jsonResponse({
        success: false,
        error: 'Verification not found'
      }, 404);
    }
    
    // Remove sensitive data
    const sanitized = {
      ...record,
      parties: record.parties.map(p => ({
        ...p,
        biometrics: p.biometrics ? { captured: true } : undefined
      })),
      signatures: record.signatures.map(s => ({
        partyId: s.partyId,
        timestamp: s.timestamp,
        signatureType: s.signatureType
      }))
    };
    
    return jsonResponse({
      success: true,
      data: sanitized
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: 'Failed to retrieve verification'
    }, 500);
  }
}

/**
 * POST /api/verifications/:id/parties
 * Add a party to the verification
 */
export async function addParty(request: IttyRequest): Promise<Response> {
  try {
    const { id } = request.params;
    const workflow = workflowStore.get(id);
    
    if (!workflow) {
      return jsonResponse({
        success: false,
        error: 'Verification not found'
      }, 404);
    }
    
    const body = await request.json();
    const validated = AddPartySchema.parse(body);
    
    // Create party record
    const party: VerificationParty = {
      id: `PARTY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...validated,
      isVerified: false,
      biometrics: validated.biometrics as BiometricData | undefined
    };
    
    // Add party through workflow
    const result = await workflow.addParty(party);
    
    if (!result.success) {
      return jsonResponse({
        success: false,
        error: result.message
      }, 400);
    }
    
    // Update stored record
    const record = verificationStore.get(id);
    if (record) {
      verificationStore.set(id, record);
    }
    
    return jsonResponse({
      success: true,
      data: {
        partyId: party.id,
        message: result.message
      }
    }, 201);
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
      error: 'Failed to add party'
    }, 500);
  }
}

/**
 * POST /api/verifications/:id/verify-party/:partyId
 * Verify a party's identity (after biometric verification)
 */
export async function verifyParty(request: IttyRequest): Promise<Response> {
  try {
    const { id, partyId } = request.params;
    const record = verificationStore.get(id);
    
    if (!record) {
      return jsonResponse({
        success: false,
        error: 'Verification not found'
      }, 404);
    }
    
    const party = record.parties.find(p => p.id === partyId);
    if (!party) {
      return jsonResponse({
        success: false,
        error: 'Party not found'
      }, 404);
    }
    
    // In production, this would verify biometrics against stored data
    // For now, we'll mark as verified if biometrics exist
    if (!party.biometrics) {
      return jsonResponse({
        success: false,
        error: 'Biometric data required for verification'
      }, 400);
    }
    
    party.isVerified = true;
    party.verifiedAt = new Date();
    
    // Update record
    verificationStore.set(id, record);
    
    return jsonResponse({
      success: true,
      data: {
        partyId,
        verified: true,
        verifiedAt: party.verifiedAt
      }
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: 'Failed to verify party'
    }, 500);
  }
}

/**
 * POST /api/verifications/:id/signatures
 * Collect a signature from a verified party
 */
export async function collectSignature(request: IttyRequest): Promise<Response> {
  try {
    const { id } = request.params;
    const workflow = workflowStore.get(id);
    
    if (!workflow) {
      return jsonResponse({
        success: false,
        error: 'Verification not found'
      }, 404);
    }
    
    const body = await request.json();
    const validated = CollectSignatureSchema.parse(body);
    
    // Collect signature through workflow
    const result = await workflow.collectSignature(
      validated.partyId,
      validated.signature,
      validated.signedData,
      validated.deviceInfo
    );
    
    if (!result.success) {
      return jsonResponse({
        success: false,
        error: result.message,
        fraudSignals: result.fraudSignals
      }, 400);
    }
    
    // Update stored record
    const record = verificationStore.get(id);
    if (record) {
      verificationStore.set(id, record);
    }
    
    return jsonResponse({
      success: true,
      data: {
        message: result.message,
        fraudSignals: result.fraudSignals
      }
    }, 201);
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
      error: 'Failed to collect signature'
    }, 500);
  }
}

/**
 * POST /api/verifications/:id/advance
 * Advance the verification workflow
 */
export async function advanceWorkflow(request: IttyRequest): Promise<Response> {
  try {
    const { id } = request.params;
    const workflow = workflowStore.get(id);
    
    if (!workflow) {
      return jsonResponse({
        success: false,
        error: 'Verification not found'
      }, 404);
    }
    
    // Advance workflow to next state
    const result = await workflow.advance();
    
    // Update stored record
    const record = verificationStore.get(id);
    if (record) {
      verificationStore.set(id, record);
    }
    
    return jsonResponse({
      success: true,
      data: result
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: 'Failed to advance workflow'
    }, 500);
  }
}

/**
 * GET /api/verifications/:id/validate
 * Validate the verification status
 */
export async function validateVerification(request: IttyRequest): Promise<Response> {
  try {
    const { id } = request.params;
    const workflow = workflowStore.get(id);
    
    if (!workflow) {
      return jsonResponse({
        success: false,
        error: 'Verification not found'
      }, 404);
    }
    
    // Validate current state
    const validation = await workflow.validateVerification();
    
    return jsonResponse({
      success: true,
      data: validation
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: 'Failed to validate verification'
    }, 500);
  }
}

/**
 * GET /api/verifications
 * List verifications with filters
 */
export async function listVerifications(request: IttyRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const parcelId = searchParams.get('parcelId');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let verifications = Array.from(verificationStore.values());
    
    // Apply filters
    if (status) {
      verifications = verifications.filter(v => v.status === status);
    }
    if (parcelId) {
      verifications = verifications.filter(v => v.parcelId === parcelId);
    }
    
    // Sort by creation date (newest first)
    verifications.sort((a, b) => b.initiatedAt.getTime() - a.initiatedAt.getTime());
    
    // Paginate
    const total = verifications.length;
    const paginated = verifications.slice(offset, offset + limit);
    
    return jsonResponse({
      success: true,
      data: {
        verifications: paginated.map(v => ({
          id: v.id,
          parcelId: v.parcelId,
          verificationType: v.verificationType,
          status: v.status,
          currentSignatures: v.currentSignatures,
          requiredSignatures: v.requiredSignatures,
          initiatedAt: v.initiatedAt,
          expiresAt: v.expiresAt
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: 'Failed to list verifications'
    }, 500);
  }
}
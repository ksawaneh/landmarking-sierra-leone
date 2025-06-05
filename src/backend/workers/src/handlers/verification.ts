/**
 * API endpoints for multi-party verification system
 * Uses Durable Objects for persistent storage
 */

import { Request as IttyRequest } from 'itty-router';
import { z } from 'zod';
import { 
  VerificationWorkflow,
  VerificationRequirementsFactory 
} from '../../../services/verification/workflows/verification-workflow';
import {
  VerificationRecord,
  VerificationParty,
  PartyRole,
  BiometricData
} from '../../../services/verification/types';
import { jsonResponse } from '../middleware/jsonResponse';
import { BiometricService } from '../services/biometric';
import { getConfig } from '../services/config';

/**
 * Sierra Leone specific validation schemas
 */
const ParcelIdSchema = z.string().regex(
  /^[A-Z]{2}\/[A-Z]{2}\/\d{6}\/\d{4}$/,
  'Invalid parcel ID format (e.g., WU/FT/001234/2024)'
);

const NationalIdSchema = z.string().regex(
  /^SL\d{9}$/,
  'Invalid national ID format (e.g., SL123456789)'
);

const PhoneNumberSchema = z.string().regex(
  /^\+232\d{8}$/,
  'Invalid phone number format (e.g., +23276123456)'
);

/**
 * Create verification request schema
 */
const CreateVerificationSchema = z.object({
  parcelId: ParcelIdSchema,
  verificationType: z.enum(['initial_registration', 'transfer', 'dispute_resolution', 'update']),
  landType: z.enum(['residential', 'commercial', 'agricultural', 'industrial']),
  district: z.string(),
  initiatedBy: z.string()
});

/**
 * Add party request schema with stricter validation
 */
const AddPartySchema = z.object({
  role: z.nativeEnum(PartyRole),
  name: z.string().min(3).max(100),
  nationalId: NationalIdSchema.optional(),
  phoneNumber: PhoneNumberSchema.optional(),
  address: z.string().min(10).max(200),
  district: z.string(),
  biometrics: z.object({
    fingerprint: z.object({
      data: z.string(),
      quality: z.number().min(0).max(100),
      captureDevice: z.string()
    }).optional(),
    face: z.object({
      data: z.string(),
      confidence: z.number().min(0).max(100),
      captureDevice: z.string()
    }).optional(),
    voice: z.object({
      data: z.string(),
      duration: z.number().min(3),
      language: z.enum(['en', 'krio', 'temne', 'mende']),
      transcript: z.string().optional()
    }).optional(),
    captureTimestamp: z.string().transform(str => new Date(str)),
    captureLocation: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().min(0)
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
 * Helper to get Durable Object stub
 */
function getVerificationDO(env: any, verificationId: string) {
  const id = env.VERIFICATION_DO.idFromName(verificationId);
  return env.VERIFICATION_DO.get(id);
}

/**
 * POST /api/verifications
 * Create a new verification request
 */
export async function createVerification(request: IttyRequest, env: any): Promise<Response> {
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
    
    // Store in Durable Object
    const verificationDO = getVerificationDO(env, record.id);
    await verificationDO.storeVerification(record);
    
    // Log for monitoring
    console.log('Verification created:', {
      id: record.id,
      type: validated.verificationType,
      district: validated.district
    });
    
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
    console.error('Create verification error:', error);
    
    if (error instanceof z.ZodError) {
      return jsonResponse({
        success: false,
        error: 'Validation error',
        details: error.errors
      }, 400);
    }
    
    return jsonResponse({
      success: false,
      error: 'Failed to create verification',
      message: error instanceof Error ? error.message : undefined
    }, 500);
  }
}

/**
 * GET /api/verifications/:id
 * Get verification details
 */
export async function getVerification(request: IttyRequest, env: any): Promise<Response> {
  try {
    const { id } = request.params;
    const verificationDO = getVerificationDO(env, id);
    const record = await verificationDO.getVerification(id);
    
    if (!record) {
      return jsonResponse({
        success: false,
        error: 'Verification not found'
      }, 404);
    }
    
    // Remove sensitive biometric data
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
    console.error('Get verification error:', error);
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
export async function addParty(request: IttyRequest, env: any): Promise<Response> {
  try {
    const { id } = request.params;
    const body = await request.json();
    const validated = AddPartySchema.parse(body);
    
    // Get verification from Durable Object
    const verificationDO = getVerificationDO(env, id);
    const record = await verificationDO.getVerification(id);
    
    if (!record) {
      return jsonResponse({
        success: false,
        error: 'Verification not found'
      }, 404);
    }
    
    // Create workflow instance
    const workflow = new VerificationWorkflow(record);
    
    // Validate biometrics if provided
    if (validated.biometrics) {
      const config = getConfig(env);
      const biometricService = new BiometricService(config);
      
      const validation = biometricService.validateBiometricQuality(
        validated.biometrics as BiometricData
      );
      
      if (!validation.isValid) {
        return jsonResponse({
          success: false,
          error: 'Biometric validation failed',
          details: validation.issues
        }, 400);
      }
    }
    
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
    
    // Store updated record
    await verificationDO.addParty(id, party);
    
    return jsonResponse({
      success: true,
      data: {
        partyId: party.id,
        message: result.message
      }
    }, 201);
  } catch (error) {
    console.error('Add party error:', error);
    
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
 * Verify a party's identity using biometrics
 */
export async function verifyParty(request: IttyRequest, env: any): Promise<Response> {
  try {
    const { id, partyId } = request.params;
    const verificationDO = getVerificationDO(env, id);
    const record = await verificationDO.getVerification(id);
    
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
    
    if (!party.biometrics) {
      return jsonResponse({
        success: false,
        error: 'Biometric data required for verification'
      }, 400);
    }
    
    // Perform actual biometric verification
    const config = getConfig(env);
    const biometricService = new BiometricService(config);
    
    // In production, this would check against stored templates
    const templateId = `TEMPLATE-${party.id}`;
    const verificationResult = await biometricService.verifyBiometric(
      party.biometrics,
      templateId,
      party.id
    );
    
    if (!verificationResult.verified) {
      return jsonResponse({
        success: false,
        error: 'Biometric verification failed',
        details: verificationResult.issues
      }, 400);
    }
    
    // Update party verification status
    party.isVerified = true;
    party.verifiedAt = new Date();
    
    // Update in Durable Object
    await verificationDO.updateVerification(id, { parties: record.parties });
    
    // Log verification
    console.log('Party verified:', {
      verificationId: id,
      partyId,
      confidence: verificationResult.confidence
    });
    
    return jsonResponse({
      success: true,
      data: {
        partyId,
        verified: true,
        verifiedAt: party.verifiedAt,
        confidence: verificationResult.confidence,
        matchedBiometricTypes: verificationResult.matchedBiometricTypes
      }
    });
  } catch (error) {
    console.error('Verify party error:', error);
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
export async function collectSignature(request: IttyRequest, env: any): Promise<Response> {
  try {
    const { id } = request.params;
    const body = await request.json();
    const validated = CollectSignatureSchema.parse(body);
    
    // Get verification from Durable Object
    const verificationDO = getVerificationDO(env, id);
    const record = await verificationDO.getVerification(id);
    
    if (!record) {
      return jsonResponse({
        success: false,
        error: 'Verification not found'
      }, 404);
    }
    
    // Create workflow instance
    const workflow = new VerificationWorkflow(record);
    
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
    
    // Store signature in Durable Object
    const signature = record.signatures.find(s => s.partyId === validated.partyId);
    if (signature) {
      await verificationDO.addSignature(id, signature);
    }
    
    return jsonResponse({
      success: true,
      data: {
        message: result.message,
        fraudSignals: result.fraudSignals
      },
      metadata: {
        currentSignatures: record.currentSignatures,
        requiredSignatures: record.requiredSignatures
      }
    }, 201);
  } catch (error) {
    console.error('Collect signature error:', error);
    
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
export async function advanceWorkflow(request: IttyRequest, env: any): Promise<Response> {
  try {
    const { id } = request.params;
    const verificationDO = getVerificationDO(env, id);
    const record = await verificationDO.getVerification(id);
    
    if (!record) {
      return jsonResponse({
        success: false,
        error: 'Verification not found'
      }, 404);
    }
    
    const workflow = new VerificationWorkflow(record);
    const result = await workflow.advance();
    
    // Update record if state changed
    if (result.success) {
      await verificationDO.updateVerification(id, { status: record.status });
    }
    
    return jsonResponse({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Advance workflow error:', error);
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
export async function validateVerification(request: IttyRequest, env: any): Promise<Response> {
  try {
    const { id } = request.params;
    const verificationDO = getVerificationDO(env, id);
    const record = await verificationDO.getVerification(id);
    
    if (!record) {
      return jsonResponse({
        success: false,
        error: 'Verification not found'
      }, 404);
    }
    
    const workflow = new VerificationWorkflow(record);
    const validation = await workflow.validateVerification();
    
    return jsonResponse({
      success: true,
      data: validation
    });
  } catch (error) {
    console.error('Validate verification error:', error);
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
export async function listVerifications(request: IttyRequest, env: any): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const parcelId = searchParams.get('parcelId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Get from Durable Object (in production, use a separate index DO)
    const verificationDO = getVerificationDO(env, 'index');
    const { verifications, total } = await verificationDO.listVerifications({
      status: status || undefined,
      parcelId: parcelId || undefined,
      limit,
      offset
    });
    
    return jsonResponse({
      success: true,
      data: {
        verifications: verifications.map(v => ({
          id: v.id,
          parcelId: v.parcelId,
          verificationType: v.verificationType,
          status: v.status,
          currentSignatures: v.currentSignatures,
          requiredSignatures: v.requiredSignatures,
          initiatedAt: v.initiatedAt,
          expiresAt: v.expiresAt
        }))
      },
      metadata: {
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    });
  } catch (error) {
    console.error('List verifications error:', error);
    return jsonResponse({
      success: false,
      error: 'Failed to list verifications'
    }, 500);
  }
}
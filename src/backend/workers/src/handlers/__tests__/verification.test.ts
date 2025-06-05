/**
 * Tests for verification API endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request } from 'itty-router';
import * as verificationHandler from '../verification';

// Mock the verification workflow
vi.mock('../../services/verification/workflows/verification-workflow', () => ({
  VerificationWorkflow: vi.fn().mockImplementation(() => ({
    addParty: vi.fn().mockResolvedValue({ success: true, message: 'Party added' }),
    collectSignature: vi.fn().mockResolvedValue({ 
      success: true, 
      message: 'Signature collected (1/5)' 
    }),
    advance: vi.fn().mockResolvedValue({
      success: true,
      newState: 'collecting_parties',
      message: 'Ready to add parties'
    }),
    validateVerification: vi.fn().mockResolvedValue({
      isValid: false,
      issues: ['Need 5 more signatures'],
      recommendations: ['Add required parties']
    })
  })),
  VerificationRequirementsFactory: {
    create: vi.fn().mockReturnValue({
      landType: 'residential',
      district: 'Western Area Urban',
      requiredRoles: [
        { role: 'property_owner', count: 1, mandatory: true }
      ],
      minimumSignatures: 5,
      biometricRequired: true,
      governmentApprovalRequired: true
    })
  }
}));

describe('Verification API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('POST /api/v1/verifications', () => {
    it('should create a new verification', async () => {
      const request = new Request('http://localhost/api/v1/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcelId: 'WU/FT/001234/2024',
          verificationType: 'initial_registration',
          landType: 'residential',
          district: 'Western Area Urban',
          initiatedBy: 'AGENT-001'
        })
      });
      
      const response = await verificationHandler.createVerification(request as any);
      const body = await response.json();
      
      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.verificationId).toMatch(/^VER-/);
      expect(body.data.requirements.minimumSignatures).toBe(5);
    });
    
    it('should reject invalid verification type', async () => {
      const request = new Request('http://localhost/api/v1/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcelId: 'WU/FT/001234/2024',
          verificationType: 'invalid_type',
          landType: 'residential',
          district: 'Western Area Urban',
          initiatedBy: 'AGENT-001'
        })
      });
      
      const response = await verificationHandler.createVerification(request as any);
      const body = await response.json();
      
      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation error');
    });
  });
  
  describe('POST /api/v1/verifications/:id/parties', () => {
    it('should add a party to verification', async () => {
      // First create a verification
      const createReq = new Request('http://localhost/api/v1/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcelId: 'WU/FT/001234/2024',
          verificationType: 'initial_registration',
          landType: 'residential',
          district: 'Western Area Urban',
          initiatedBy: 'AGENT-001'
        })
      });
      
      const createRes = await verificationHandler.createVerification(createReq as any);
      const { data } = await createRes.json();
      
      // Add a party
      const request = {
        params: { id: data.verificationId },
        json: async () => ({
          role: 'property_owner',
          name: 'Mohamed Kamara',
          nationalId: 'SL123456789',
          address: 'Freetown',
          district: 'Western Area Urban'
        })
      };
      
      const response = await verificationHandler.addParty(request as any);
      const body = await response.json();
      
      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.partyId).toMatch(/^PARTY-/);
    });
  });
  
  describe('POST /api/v1/verifications/:id/signatures', () => {
    it('should collect signature from verified party', async () => {
      const request = {
        params: { id: 'VER-123' },
        json: async () => ({
          partyId: 'PARTY-001',
          signature: 'base64_signature',
          signedData: 'hash_of_data',
          deviceInfo: {
            deviceId: 'DEVICE-001',
            deviceType: 'mobile'
          }
        })
      };
      
      const response = await verificationHandler.collectSignature(request as any);
      const body = await response.json();
      
      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.message).toContain('Signature collected');
    });
  });
  
  describe('GET /api/v1/verifications', () => {
    it('should list verifications with pagination', async () => {
      const request = new Request('http://localhost/api/v1/verifications?limit=5&offset=0');
      
      const response = await verificationHandler.listVerifications(request as any);
      const body = await response.json();
      
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('verifications');
      expect(body.data).toHaveProperty('pagination');
    });
  });
});
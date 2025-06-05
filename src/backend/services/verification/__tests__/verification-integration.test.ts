/**
 * Integration tests for the multi-party verification system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  VerificationWorkflow, 
  VerificationRequirementsFactory 
} from '../workflows/verification-workflow';
import { ThresholdSignatureManager } from '../crypto/threshold-signatures';
import { BiometricVerifier } from '../crypto/biometric-verification';
import {
  VerificationRecord,
  VerificationParty,
  PartyRole,
  BiometricData
} from '../types';

describe('Multi-Party Verification System', () => {
  let verificationRecord: VerificationRecord;
  let workflow: VerificationWorkflow;
  
  beforeEach(() => {
    // Create a test verification record
    const requirements = VerificationRequirementsFactory.create(
      'residential',
      'Western Area Urban',
      'initial_registration'
    );
    
    verificationRecord = {
      id: 'VER-001',
      parcelId: 'WU/FT/001234/2024',
      verificationType: 'initial_registration',
      status: 'pending',
      parties: [],
      signatures: [],
      requirements,
      currentSignatures: 0,
      requiredSignatures: requirements.minimumSignatures,
      evidence: [],
      initiatedAt: new Date(),
      initiatedBy: 'AGENT-001',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      history: []
    };
    
    workflow = new VerificationWorkflow(verificationRecord);
  });
  
  describe('Workflow State Management', () => {
    it('should start in initiated state', async () => {
      const result = await workflow.advance();
      expect(result.newState).toBe('collecting_parties');
      expect(result.success).toBe(true);
    });
    
    it('should require minimum parties before proceeding', async () => {
      await workflow.advance(); // Move to collecting_parties
      
      const result = await workflow.advance();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Need 5 more parties');
    });
  });
  
  describe('Party Management', () => {
    it('should add valid parties', async () => {
      const owner: VerificationParty = {
        id: 'PARTY-001',
        role: PartyRole.PROPERTY_OWNER,
        name: 'Mohamed Kamara',
        nationalId: 'SL123456789',
        phoneNumber: '+23276123456',
        address: '123 Hill Station, Freetown',
        district: 'Western Area Urban',
        isVerified: false
      };
      
      const result = await workflow.addParty(owner);
      expect(result.success).toBe(true);
      expect(verificationRecord.parties).toHaveLength(1);
    });
    
    it('should enforce role limits', async () => {
      // Add maximum property owners (1)
      const owner1: VerificationParty = {
        id: 'PARTY-001',
        role: PartyRole.PROPERTY_OWNER,
        name: 'Mohamed Kamara',
        address: 'Freetown',
        district: 'Western Area Urban',
        isVerified: false
      };
      
      await workflow.addParty(owner1);
      
      // Try to add another property owner
      const owner2: VerificationParty = {
        id: 'PARTY-002',
        role: PartyRole.PROPERTY_OWNER,
        name: 'Fatmata Sesay',
        address: 'Freetown',
        district: 'Western Area Urban',
        isVerified: false
      };
      
      const result = await workflow.addParty(owner2);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Already have maximum');
    });
    
    it('should validate biometric quality', async () => {
      const partyWithBadBiometrics: VerificationParty = {
        id: 'PARTY-003',
        role: PartyRole.CHIEF,
        name: 'Chief Bai Bureh',
        address: 'Freetown',
        district: 'Western Area Urban',
        isVerified: false,
        biometrics: {
          fingerprint: {
            data: 'base64_fingerprint_data',
            quality: 30, // Below threshold
            captureDevice: 'TestDevice'
          },
          captureTimestamp: new Date()
        }
      };
      
      const result = await workflow.addParty(partyWithBadBiometrics);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Biometric validation failed');
    });
  });
  
  describe('Signature Collection', () => {
    beforeEach(async () => {
      // Add required parties
      const parties: VerificationParty[] = [
        {
          id: 'PARTY-001',
          role: PartyRole.PROPERTY_OWNER,
          name: 'Mohamed Kamara',
          address: 'Freetown',
          district: 'Western Area Urban',
          isVerified: true,
          biometrics: createValidBiometrics()
        },
        {
          id: 'PARTY-002',
          role: PartyRole.CHIEF,
          name: 'Chief Bai Bureh',
          address: 'Freetown',
          district: 'Western Area Urban',
          isVerified: true,
          biometrics: createValidBiometrics()
        },
        {
          id: 'PARTY-003',
          role: PartyRole.COMMUNITY_LEADER,
          name: 'Aminata Conteh',
          address: 'Freetown',
          district: 'Western Area Urban',
          isVerified: true,
          biometrics: createValidBiometrics()
        },
        {
          id: 'PARTY-004',
          role: PartyRole.COMMUNITY_LEADER,
          name: 'Ibrahim Jalloh',
          address: 'Freetown',
          district: 'Western Area Urban',
          isVerified: true,
          biometrics: createValidBiometrics()
        },
        {
          id: 'PARTY-005',
          role: PartyRole.NEIGHBOR,
          name: 'Isata Koroma',
          address: 'Freetown',
          district: 'Western Area Urban',
          isVerified: true,
          biometrics: createValidBiometrics()
        }
      ];
      
      for (const party of parties) {
        await workflow.addParty(party);
      }
    });
    
    it('should collect signatures from verified parties', async () => {
      const result = await workflow.collectSignature(
        'PARTY-001',
        'signature_data_base64',
        'land_data_hash',
        {
          deviceId: 'DEVICE-001',
          deviceType: 'mobile',
          ipAddress: '192.168.1.1'
        }
      );
      
      expect(result.success).toBe(true);
      expect(verificationRecord.currentSignatures).toBe(1);
    });
    
    it('should prevent duplicate signatures', async () => {
      // First signature
      await workflow.collectSignature(
        'PARTY-001',
        'signature_data_base64',
        'land_data_hash'
      );
      
      // Try to sign again
      const result = await workflow.collectSignature(
        'PARTY-001',
        'another_signature',
        'land_data_hash'
      );
      
      expect(result.success).toBe(false);
      expect(result.fraudSignals).toBeDefined();
      expect(result.fraudSignals![0].type).toBe('duplicate_signature');
    });
    
    it('should require party verification before signing', async () => {
      // Add unverified party
      const unverified: VerificationParty = {
        id: 'PARTY-006',
        role: PartyRole.NEIGHBOR,
        name: 'Abu Bangura',
        address: 'Freetown',
        district: 'Western Area Urban',
        isVerified: false // Not verified
      };
      
      await workflow.addParty(unverified);
      
      const result = await workflow.collectSignature(
        'PARTY-006',
        'signature_data',
        'land_data_hash'
      );
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('must be verified');
    });
  });
  
  describe('Threshold Signatures', () => {
    it('should generate and verify threshold signatures', async () => {
      const manager = new ThresholdSignatureManager(3, 5); // 3 of 5
      
      // Generate a secret (private key)
      const secret = Buffer.from('test_secret_key_for_land_verification');
      
      // Generate shares for 5 parties
      const shares = manager.generateShares(secret);
      expect(shares).toHaveLength(5);
      
      // Reconstruct with 3 shares
      const reconstructed = manager.reconstructSecret(shares.slice(0, 3));
      expect(reconstructed.toString()).toBe(secret.toString());
      
      // Create a land verification signature
      const landData = {
        parcelId: 'WU/FT/001234/2024',
        owner: 'Mohamed Kamara',
        size: '1.5 acres',
        district: 'Western Area Urban'
      };
      
      const signature = await manager.createLandVerificationSignature(
        landData,
        shares.slice(0, 3)
      );
      
      expect(signature.signature).toBeDefined();
      expect(signature.publicKey).toBeDefined();
      
      // Verify the signature
      const isValid = manager.verifySignature(
        landData,
        signature.signature,
        signature.publicKey
      );
      
      expect(isValid).toBe(true);
    });
  });
  
  describe('Verification Validation', () => {
    it('should validate complete verification', async () => {
      // Setup complete verification
      await setupCompleteVerification();
      
      const validation = await workflow.validateVerification();
      
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });
    
    it('should detect missing requirements', async () => {
      const validation = await workflow.validateVerification();
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Need 5 more signatures');
    });
  });
  
  describe('Requirements Factory', () => {
    it('should create appropriate requirements for different scenarios', () => {
      // Initial registration in urban area
      const urbanInitial = VerificationRequirementsFactory.create(
        'residential',
        'Western Area Urban',
        'initial_registration'
      );
      
      expect(urbanInitial.minimumSignatures).toBe(5);
      expect(urbanInitial.governmentApprovalRequired).toBe(true);
      expect(urbanInitial.requiredRoles).toHaveLength(5);
      
      // Transfer in rural area
      const ruralTransfer = VerificationRequirementsFactory.create(
        'agricultural',
        'Kailahun',
        'transfer'
      );
      
      expect(ruralTransfer.minimumSignatures).toBe(4);
      expect(ruralTransfer.requiredRoles.find(r => r.role === PartyRole.CHIEF)).toBeDefined();
      
      // Dispute resolution
      const dispute = VerificationRequirementsFactory.create(
        'commercial',
        'Bo',
        'dispute_resolution'
      );
      
      expect(dispute.minimumSignatures).toBe(6);
      expect(dispute.requiredRoles.find(r => r.role === PartyRole.CHIEF)?.count).toBe(2);
    });
  });
});

// Helper functions
function createValidBiometrics(): BiometricData {
  return {
    fingerprint: {
      data: 'base64_fingerprint_data',
      quality: 85,
      captureDevice: 'TestDevice'
    },
    face: {
      data: 'base64_face_data',
      confidence: 90,
      captureDevice: 'TestCamera'
    },
    captureTimestamp: new Date(),
    captureLocation: {
      latitude: 8.4657,
      longitude: -13.2317,
      accuracy: 10
    }
  };
}

async function setupCompleteVerification(): Promise<void> {
  // This would set up a complete verification scenario
  // with all parties, signatures, and requirements met
}
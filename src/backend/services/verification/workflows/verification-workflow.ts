/**
 * Verification Workflow Engine
 * Manages the complete multi-party verification process for land registration
 */

import { 
  VerificationRecord, 
  VerificationParty, 
  PartySignature, 
  VerificationRequirements,
  PartyRole,
  VerificationSession,
  FraudSignal
} from '../types';
import { ThresholdSignatureManager } from '../crypto/threshold-signatures';
import { BiometricVerifier, AntiSpoofingChecker } from '../crypto/biometric-verification';
import { DistrictName } from '../../government/schemas/government-data.types';

/**
 * Workflow state machine states
 */
enum WorkflowState {
  INITIATED = 'initiated',
  COLLECTING_PARTIES = 'collecting_parties',
  BIOMETRIC_CAPTURE = 'biometric_capture',
  SIGNATURE_COLLECTION = 'signature_collection',
  THRESHOLD_SIGNING = 'threshold_signing',
  VALIDATION = 'validation',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

/**
 * Main verification workflow manager
 */
export class VerificationWorkflow {
  private thresholdManager: ThresholdSignatureManager;
  private biometricVerifier: BiometricVerifier;
  private antiSpoofing: AntiSpoofingChecker;
  private currentState: WorkflowState;
  
  constructor(
    private record: VerificationRecord
  ) {
    // Initialize managers based on requirements
    this.thresholdManager = new ThresholdSignatureManager(
      record.requirements.minimumSignatures,
      record.parties.length
    );
    this.biometricVerifier = new BiometricVerifier();
    this.antiSpoofing = new AntiSpoofingChecker();
    this.currentState = this.determineCurrentState();
  }
  
  /**
   * Advances the workflow to the next stage
   */
  async advance(): Promise<{
    success: boolean;
    newState: WorkflowState;
    message: string;
    nextSteps?: string[];
  }> {
    // Check if verification has expired
    if (new Date() > this.record.expiresAt) {
      this.currentState = WorkflowState.EXPIRED;
      return {
        success: false,
        newState: this.currentState,
        message: 'Verification has expired'
      };
    }
    
    switch (this.currentState) {
      case WorkflowState.INITIATED:
        return this.handleInitiated();
        
      case WorkflowState.COLLECTING_PARTIES:
        return this.handleCollectingParties();
        
      case WorkflowState.BIOMETRIC_CAPTURE:
        return this.handleBiometricCapture();
        
      case WorkflowState.SIGNATURE_COLLECTION:
        return this.handleSignatureCollection();
        
      case WorkflowState.THRESHOLD_SIGNING:
        return this.handleThresholdSigning();
        
      case WorkflowState.VALIDATION:
        return this.handleValidation();
        
      default:
        return {
          success: false,
          newState: this.currentState,
          message: `Cannot advance from state: ${this.currentState}`
        };
    }
  }
  
  /**
   * Adds a party to the verification
   */
  async addParty(party: VerificationParty): Promise<{
    success: boolean;
    message: string;
  }> {
    // Validate party role is allowed
    const roleAllowed = this.isRoleAllowed(party.role);
    if (!roleAllowed) {
      return {
        success: false,
        message: `Role ${party.role} is not allowed for this verification type`
      };
    }
    
    // Check if we already have enough of this role
    const currentRoleCount = this.record.parties.filter(p => p.role === party.role).length;
    const maxForRole = this.getMaxPartiesForRole(party.role);
    
    if (currentRoleCount >= maxForRole) {
      return {
        success: false,
        message: `Already have maximum ${maxForRole} parties with role ${party.role}`
      };
    }
    
    // Validate biometrics if required
    if (this.record.requirements.biometricRequired && party.biometrics) {
      const biometricValidation = this.biometricVerifier.validateBiometricQuality(party.biometrics);
      if (!biometricValidation.isValid) {
        return {
          success: false,
          message: `Biometric validation failed: ${biometricValidation.issues.join(', ')}`
        };
      }
      
      // Check liveness
      const livenessCheck = await this.antiSpoofing.checkLiveness(party.biometrics);
      if (!livenessCheck.isLive) {
        return {
          success: false,
          message: 'Biometric liveness check failed'
        };
      }
    }
    
    // Add party to record
    this.record.parties.push(party);
    this.addToHistory(`Added party: ${party.name} (${party.role})`);
    
    return {
      success: true,
      message: `Successfully added ${party.name} as ${party.role}`
    };
  }
  
  /**
   * Collects a signature from a party
   */
  async collectSignature(
    partyId: string,
    signature: string,
    signedData: string,
    deviceInfo?: PartySignature['deviceInfo']
  ): Promise<{
    success: boolean;
    message: string;
    fraudSignals?: FraudSignal[];
  }> {
    // Find the party
    const party = this.record.parties.find(p => p.id === partyId);
    if (!party) {
      return {
        success: false,
        message: 'Party not found'
      };
    }
    
    // Check if party already signed
    if (this.record.signatures.some(s => s.partyId === partyId)) {
      return {
        success: false,
        message: 'Party has already signed',
        fraudSignals: [{
          type: 'duplicate_signature',
          severity: 'high',
          description: 'Attempt to sign multiple times',
          evidence: { partyId, timestamp: new Date() },
          detectedAt: new Date(),
          recommendedAction: 'Investigate potential fraud attempt'
        }]
      };
    }
    
    // Verify party is verified
    if (!party.isVerified) {
      return {
        success: false,
        message: 'Party must be verified before signing'
      };
    }
    
    // Check for fraud signals
    const fraudSignals = await this.detectFraudSignals(party, deviceInfo);
    if (fraudSignals.some(s => s.severity === 'critical')) {
      return {
        success: false,
        message: 'Critical fraud signals detected',
        fraudSignals
      };
    }
    
    // Create signature record
    const partySignature: PartySignature = {
      partyId,
      signature,
      signedData,
      timestamp: new Date(),
      publicKey: '', // Would be derived from party's key
      signatureType: 'THRESHOLD',
      deviceInfo
    };
    
    this.record.signatures.push(partySignature);
    this.record.currentSignatures++;
    this.addToHistory(`Collected signature from ${party.name}`);
    
    return {
      success: true,
      message: `Signature collected (${this.record.currentSignatures}/${this.record.requiredSignatures})`,
      fraudSignals: fraudSignals.length > 0 ? fraudSignals : undefined
    };
  }
  
  /**
   * Creates a verification session for in-person signing
   */
  async createSession(
    sessionType: VerificationSession['sessionType'],
    location?: VerificationSession['location'],
    scheduledAt?: Date
  ): Promise<VerificationSession> {
    const session: VerificationSession = {
      id: this.generateId(),
      verificationId: this.record.id,
      sessionType,
      location,
      scheduledAt,
      attendees: []
    };
    
    this.addToHistory(`Created ${sessionType} verification session`);
    
    return session;
  }
  
  /**
   * Validates the complete verification
   */
  async validateVerification(): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check minimum signatures
    if (this.record.currentSignatures < this.record.requiredSignatures) {
      issues.push(`Need ${this.record.requiredSignatures - this.record.currentSignatures} more signatures`);
    }
    
    // Check required roles
    for (const req of this.record.requirements.requiredRoles) {
      if (req.mandatory) {
        const count = this.record.parties.filter(p => p.role === req.role).length;
        if (count < req.count) {
          issues.push(`Need ${req.count - count} more ${req.role} parties`);
        }
      }
    }
    
    // Check biometrics if required
    if (this.record.requirements.biometricRequired) {
      const partiesWithoutBiometrics = this.record.parties.filter(p => !p.biometrics);
      if (partiesWithoutBiometrics.length > 0) {
        issues.push(`${partiesWithoutBiometrics.length} parties missing biometric data`);
        recommendations.push('Schedule biometric capture session');
      }
    }
    
    // Check government approval if required
    if (this.record.requirements.governmentApprovalRequired) {
      const hasGovOfficial = this.record.parties.some(p => 
        p.role === PartyRole.GOVERNMENT_OFFICIAL && p.isVerified
      );
      if (!hasGovOfficial) {
        issues.push('Government official approval required');
        recommendations.push('Contact district land office for approval');
      }
    }
    
    // Check for disputes
    if (this.record.evidence.some(e => e.type === 'document' && e.description?.includes('dispute'))) {
      issues.push('Unresolved disputes detected');
      recommendations.push('Resolve all disputes before proceeding');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }
  
  /**
   * Handles state transitions
   */
  private async handleInitiated(): Promise<any> {
    if (this.record.parties.length === 0) {
      return {
        success: true,
        newState: WorkflowState.COLLECTING_PARTIES,
        message: 'Ready to add verification parties',
        nextSteps: ['Add property owner', 'Add community leaders', 'Add neighbors']
      };
    }
    
    this.currentState = WorkflowState.COLLECTING_PARTIES;
    return this.advance();
  }
  
  private async handleCollectingParties(): Promise<any> {
    const minPartiesReached = this.record.parties.length >= this.record.requirements.minimumSignatures;
    const requiredRolesMet = this.checkRequiredRoles();
    
    if (minPartiesReached && requiredRolesMet) {
      this.currentState = WorkflowState.BIOMETRIC_CAPTURE;
      return {
        success: true,
        newState: this.currentState,
        message: 'All required parties added',
        nextSteps: ['Capture biometric data for each party']
      };
    }
    
    return {
      success: false,
      newState: this.currentState,
      message: `Need ${this.record.requirements.minimumSignatures - this.record.parties.length} more parties`,
      nextSteps: this.getMissingRoles()
    };
  }
  
  private async handleBiometricCapture(): Promise<any> {
    if (!this.record.requirements.biometricRequired) {
      this.currentState = WorkflowState.SIGNATURE_COLLECTION;
      return this.advance();
    }
    
    const allHaveBiometrics = this.record.parties.every(p => p.biometrics && p.isVerified);
    
    if (allHaveBiometrics) {
      this.currentState = WorkflowState.SIGNATURE_COLLECTION;
      return {
        success: true,
        newState: this.currentState,
        message: 'All biometric data captured',
        nextSteps: ['Begin signature collection']
      };
    }
    
    const missing = this.record.parties.filter(p => !p.biometrics).map(p => p.name);
    return {
      success: false,
      newState: this.currentState,
      message: 'Biometric capture incomplete',
      nextSteps: [`Capture biometrics for: ${missing.join(', ')}`]
    };
  }
  
  private async handleSignatureCollection(): Promise<any> {
    if (this.record.currentSignatures >= this.record.requiredSignatures) {
      this.currentState = WorkflowState.THRESHOLD_SIGNING;
      return {
        success: true,
        newState: this.currentState,
        message: 'All signatures collected',
        nextSteps: ['Generate threshold signature']
      };
    }
    
    return {
      success: false,
      newState: this.currentState,
      message: `${this.record.currentSignatures}/${this.record.requiredSignatures} signatures collected`,
      nextSteps: ['Continue collecting signatures']
    };
  }
  
  private async handleThresholdSigning(): Promise<any> {
    // Generate threshold signature from collected signatures
    try {
      // In production, this would combine the signature shares
      const thresholdComplete = true; // Simplified
      
      if (thresholdComplete) {
        this.currentState = WorkflowState.VALIDATION;
        return {
          success: true,
          newState: this.currentState,
          message: 'Threshold signature generated',
          nextSteps: ['Validate verification']
        };
      }
    } catch (error) {
      return {
        success: false,
        newState: this.currentState,
        message: 'Failed to generate threshold signature',
        nextSteps: ['Review signature data']
      };
    }
  }
  
  private async handleValidation(): Promise<any> {
    const validation = await this.validateVerification();
    
    if (validation.isValid) {
      this.currentState = WorkflowState.COMPLETED;
      this.record.status = 'completed';
      this.record.completedAt = new Date();
      
      return {
        success: true,
        newState: this.currentState,
        message: 'Verification completed successfully',
        nextSteps: ['Record on blockchain', 'Issue land certificate']
      };
    }
    
    return {
      success: false,
      newState: this.currentState,
      message: 'Validation failed',
      nextSteps: validation.recommendations
    };
  }
  
  /**
   * Helper methods
   */
  private determineCurrentState(): WorkflowState {
    if (this.record.status === 'completed') return WorkflowState.COMPLETED;
    if (this.record.status === 'rejected') return WorkflowState.REJECTED;
    if (new Date() > this.record.expiresAt) return WorkflowState.EXPIRED;
    
    if (this.record.parties.length === 0) return WorkflowState.INITIATED;
    if (!this.checkRequiredRoles()) return WorkflowState.COLLECTING_PARTIES;
    if (this.record.requirements.biometricRequired && 
        !this.record.parties.every(p => p.biometrics)) {
      return WorkflowState.BIOMETRIC_CAPTURE;
    }
    if (this.record.currentSignatures < this.record.requiredSignatures) {
      return WorkflowState.SIGNATURE_COLLECTION;
    }
    if (!this.record.thresholdSignature?.isComplete) {
      return WorkflowState.THRESHOLD_SIGNING;
    }
    
    return WorkflowState.VALIDATION;
  }
  
  private isRoleAllowed(role: PartyRole): boolean {
    return this.record.requirements.requiredRoles.some(r => r.role === role);
  }
  
  private getMaxPartiesForRole(role: PartyRole): number {
    const requirement = this.record.requirements.requiredRoles.find(r => r.role === role);
    return requirement?.count || 1;
  }
  
  private checkRequiredRoles(): boolean {
    for (const req of this.record.requirements.requiredRoles) {
      if (req.mandatory) {
        const count = this.record.parties.filter(p => p.role === req.role).length;
        if (count < req.count) return false;
      }
    }
    return true;
  }
  
  private getMissingRoles(): string[] {
    const missing: string[] = [];
    
    for (const req of this.record.requirements.requiredRoles) {
      const count = this.record.parties.filter(p => p.role === req.role).length;
      if (count < req.count) {
        missing.push(`Add ${req.count - count} ${req.role}`);
      }
    }
    
    return missing;
  }
  
  private async detectFraudSignals(
    party: VerificationParty,
    deviceInfo?: PartySignature['deviceInfo']
  ): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];
    
    // Check velocity - too many verifications in short time
    const recentVerifications = 5; // Would query from database
    if (recentVerifications > 3) {
      signals.push({
        type: 'velocity_anomaly',
        severity: 'medium',
        description: 'Unusual number of verifications',
        evidence: { count: recentVerifications, period: '24h' },
        detectedAt: new Date(),
        recommendedAction: 'Review recent verification history'
      });
    }
    
    // Check location anomaly
    if (party.biometrics?.captureLocation && deviceInfo) {
      // Would compare locations
      const distance = 50; // km, simplified
      if (distance > 30) {
        signals.push({
          type: 'location_anomaly',
          severity: 'medium',
          description: 'Signature location far from biometric capture',
          evidence: { distance },
          detectedAt: new Date(),
          recommendedAction: 'Verify party location'
        });
      }
    }
    
    return signals;
  }
  
  private addToHistory(action: string, details?: any): void {
    this.record.history.push({
      action,
      performedBy: 'system', // Would be actual user
      timestamp: new Date(),
      details
    });
  }
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory for creating verification requirements based on land type and location
 */
export class VerificationRequirementsFactory {
  static create(
    landType: string,
    district: DistrictName,
    verificationType: string
  ): VerificationRequirements {
    // Base requirements
    const base: VerificationRequirements = {
      landType: landType as any,
      district,
      requiredRoles: [],
      minimumSignatures: 5,
      biometricRequired: true,
      governmentApprovalRequired: true
    };
    
    // Adjust based on verification type
    switch (verificationType) {
      case 'initial_registration':
        base.requiredRoles = [
          { role: PartyRole.PROPERTY_OWNER, count: 1, mandatory: true },
          { role: PartyRole.CHIEF, count: 1, mandatory: true },
          { role: PartyRole.COMMUNITY_LEADER, count: 2, mandatory: true },
          { role: PartyRole.NEIGHBOR, count: 2, mandatory: true },
          { role: PartyRole.GOVERNMENT_OFFICIAL, count: 1, mandatory: true }
        ];
        base.minimumSignatures = 5;
        break;
        
      case 'transfer':
        base.requiredRoles = [
          { role: PartyRole.PROPERTY_OWNER, count: 2, mandatory: true }, // Seller and buyer
          { role: PartyRole.WITNESS, count: 2, mandatory: true },
          { role: PartyRole.GOVERNMENT_OFFICIAL, count: 1, mandatory: true },
          { role: PartyRole.LAWYER, count: 1, mandatory: false }
        ];
        base.minimumSignatures = 4;
        break;
        
      case 'dispute_resolution':
        base.requiredRoles = [
          { role: PartyRole.PROPERTY_OWNER, count: 2, mandatory: true }, // Disputing parties
          { role: PartyRole.CHIEF, count: 2, mandatory: true },
          { role: PartyRole.COMMUNITY_LEADER, count: 3, mandatory: true },
          { role: PartyRole.GOVERNMENT_OFFICIAL, count: 1, mandatory: true },
          { role: PartyRole.WITNESS, count: 3, mandatory: false }
        ];
        base.minimumSignatures = 6;
        break;
    }
    
    // Adjust for urban vs rural
    if (district === 'Western Area Urban' || district === 'Western Area Rural') {
      base.governmentApprovalRequired = true;
    } else {
      // Rural areas rely more on traditional authorities
      const chiefRole = base.requiredRoles.find(r => r.role === PartyRole.CHIEF);
      if (chiefRole) chiefRole.count = 2;
    }
    
    return base;
  }
}
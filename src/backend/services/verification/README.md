# Multi-Party Verification System

## Overview

This is the **core fraud prevention system** for LandMarking Sierra Leone. It implements cryptographic multi-party verification using threshold signatures, biometric authentication, and comprehensive workflow management to ensure land transactions cannot be forged or manipulated by any single party.

## Key Features

### 1. **Threshold Signatures (k-of-n)**
- Requires minimum k signatures from n total parties
- Uses Shamir's Secret Sharing for cryptographic security
- No single party can forge a transaction
- Configurable thresholds based on transaction type

### 2. **Biometric Verification**
- Fingerprint, face, and voice authentication
- Privacy-preserving (stores only hashes)
- Anti-spoofing and liveness detection
- Quality validation before acceptance

### 3. **Role-Based Requirements**
- Property Owner (mandatory)
- Chief/Traditional Leader (mandatory in rural areas)
- Community Leaders (2+ required)
- Neighbors (boundary witnesses)
- Government Official (final approval)
- Witnesses (for transfers)
- Lawyers (optional for complex transactions)

### 4. **Fraud Detection**
- Duplicate signature prevention
- Velocity checks (too many verifications)
- Location anomaly detection
- Biometric mismatch alerts
- Pattern recognition for suspicious activity

## Architecture

```
verification/
├── types.ts                    # TypeScript interfaces
├── crypto/
│   ├── threshold-signatures.ts # Shamir's Secret Sharing implementation
│   └── biometric-verification.ts # Biometric processing
├── workflows/
│   └── verification-workflow.ts # State machine for verification process
└── parties/
    └── party-registry.ts       # Party management (TODO)
```

## Verification Process

### 1. **Initiation**
```typescript
const requirements = VerificationRequirementsFactory.create(
  'residential',        // Land type
  'Western Area Urban', // District
  'initial_registration' // Verification type
);

const record: VerificationRecord = {
  id: generateId(),
  parcelId: 'WU/FT/001234/2024',
  verificationType: 'initial_registration',
  requirements,
  // ... other fields
};

const workflow = new VerificationWorkflow(record);
```

### 2. **Add Parties**
```typescript
// Add property owner
await workflow.addParty({
  id: 'PARTY-001',
  role: PartyRole.PROPERTY_OWNER,
  name: 'Mohamed Kamara',
  nationalId: 'SL123456789',
  district: 'Western Area Urban',
  biometrics: capturedBiometrics,
  isVerified: false
});

// Add chief
await workflow.addParty({
  id: 'PARTY-002',
  role: PartyRole.CHIEF,
  name: 'Chief Bai Bureh',
  // ...
});

// Continue adding required parties...
```

### 3. **Biometric Capture**
```typescript
const biometrics: BiometricData = {
  fingerprint: {
    data: 'base64_encoded_fingerprint',
    quality: 85, // 0-100
    captureDevice: 'BiometricScanner v2'
  },
  face: {
    data: 'base64_encoded_face',
    confidence: 90,
    captureDevice: 'FrontCamera'
  },
  voice: {
    data: 'base64_encoded_audio',
    duration: 5, // seconds
    language: 'krio',
    transcript: 'My name is Mohamed Kamara'
  },
  captureTimestamp: new Date(),
  captureLocation: {
    latitude: 8.4657,
    longitude: -13.2317,
    accuracy: 10 // meters
  }
};
```

### 4. **Signature Collection**
```typescript
// Each party signs the land data
const result = await workflow.collectSignature(
  'PARTY-001', // Party ID
  signatureData, // Cryptographic signature
  landDataHash, // What was signed
  {
    deviceId: 'DEVICE-001',
    deviceType: 'mobile',
    ipAddress: '192.168.1.1'
  }
);

// Check for fraud signals
if (result.fraudSignals) {
  console.warn('Fraud detected:', result.fraudSignals);
}
```

### 5. **Threshold Signature Generation**
Once minimum signatures are collected, the system generates a threshold signature that proves all parties agreed:

```typescript
// System automatically combines signatures when threshold is met
// This creates an unforgeable proof of multi-party agreement
```

### 6. **Validation & Completion**
```typescript
const validation = await workflow.validateVerification();

if (validation.isValid) {
  // Verification complete!
  // Record on blockchain
  // Issue land certificate
} else {
  console.log('Issues:', validation.issues);
  console.log('Recommendations:', validation.recommendations);
}
```

## Verification Requirements by Type

### Initial Registration
- **Minimum Signatures**: 5
- **Required Parties**:
  - 1 Property Owner
  - 1 Chief
  - 2 Community Leaders
  - 2 Neighbors
  - 1 Government Official
- **Biometrics**: Required
- **Government Approval**: Required

### Land Transfer
- **Minimum Signatures**: 4
- **Required Parties**:
  - 2 Property Owners (seller + buyer)
  - 2 Witnesses
  - 1 Government Official
  - 1 Lawyer (optional)
- **Biometrics**: Required
- **Government Approval**: Required

### Dispute Resolution
- **Minimum Signatures**: 6
- **Required Parties**:
  - 2 Property Owners (disputing parties)
  - 2 Chiefs
  - 3 Community Leaders
  - 1 Government Official
  - 3 Witnesses (optional)
- **Biometrics**: Required
- **Government Approval**: Required

## Security Features

### Cryptographic Security
- **ECDSA** signatures on secp256k1 curve
- **SHA3-512** for biometric hashing
- **Shamir's Secret Sharing** for threshold signatures
- **Zero-knowledge proofs** for privacy (future)

### Anti-Fraud Measures
1. **Duplicate Prevention**: Each party can only sign once
2. **Velocity Checks**: Limits on verifications per time period
3. **Biometric Liveness**: Prevents using photos/recordings
4. **Location Verification**: GPS cross-checking
5. **Time Limits**: Verifications expire after 30 days

### Privacy Protection
- Biometric data is never stored raw
- Only hashes with salt are kept
- Personal data encrypted at rest
- Audit logs for all access

## Testing

Run the verification tests:

```bash
cd src/backend/workers
npm test -- ../services/verification/__tests__/verification-integration.test.ts
```

## Production Considerations

### Biometric Hardware
- Integrate with actual fingerprint scanners
- Use device SDKs for quality scores
- Implement proper liveness detection

### Threshold Parameters
- Adjust k-of-n based on risk assessment
- Higher thresholds for valuable land
- Consider regional differences

### Performance
- Cache party data during sessions
- Batch signature verification
- Use edge servers for biometric processing

### Compliance
- Follow Sierra Leone data protection laws
- Regular security audits
- Biometric data retention policies

## Next Steps

1. Implement party registry with trust scoring
2. Add SMS/WhatsApp notifications
3. Build verification session management
4. Create admin dashboard for monitoring
5. Integrate with blockchain recording
6. Add voice verification in local languages
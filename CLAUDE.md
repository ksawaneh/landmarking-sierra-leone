# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚀 MISSION: Revolutionizing Land Documentation in Sierra Leone

We are building Sierra Leone's first comprehensive digital land registry that prevents fraud, resolves disputes, and empowers citizens. This is not just digitization - it's transformation.

## 🏗️ Development Philosophy

### Core Principles
- **NO FAKING OR WORKAROUNDS**: Always implement real solutions. Mock data is only for testing.
- **ALWAYS READ DOCUMENTATION**: Before using any library, API, or service, read its documentation thoroughly.
- **ALWAYS VERIFY FACTS**: Use WebSearch and WebFetch to verify country-specific information (districts, chiefdoms, laws, geography). Sierra Leone's administrative divisions have changed - always check current data.
- **ALWAYS DOCUMENT**: Every function, component, and API endpoint must have clear documentation.
- **ALWAYS TEST**: Every feature must have end-to-end tests before moving on. No exceptions.

### Development Workflow
1. **EXPLORE**: Understand the problem, read existing code, check documentation
2. **PLAN**: Design the solution, consider edge cases, plan tests
3. **CODE**: Implement with clean, maintainable code
4. **COMMIT**: Make atomic commits with clear messages

## Development Commands

### Frontend (Next.js)
```bash
cd src/frontend
yarn install
yarn dev              # Development server on port 3000
yarn build            # Production build
yarn test             # Run Jest tests
yarn test:watch       # Watch mode for tests
yarn test:e2e         # End-to-end tests
yarn lint             # ESLint check
yarn typecheck        # TypeScript validation
```

### Backend (Cloudflare Workers)
```bash
cd src/backend/workers
npm install
npm run dev           # Local development with Wrangler
npm run deploy        # Deploy to Cloudflare Workers
npm test              # Run Vitest tests
npm run test:e2e      # End-to-end API tests
npm run lint          # ESLint check
npm run typecheck     # TypeScript validation
```

### AI Service (FastAPI)
```bash
cd src/ai
pip install -r requirements.txt
python -m uvicorn api.main:app --reload  # Development server
docker-compose up                        # Run with Docker
pytest                                   # Run tests
pytest --cov                            # Run with coverage
black .                                 # Format code
mypy .                                  # Type checking
```

## 🎯 Complete System Vision

### What We're Building
A revolutionary land documentation system that combines:
- **Government Database Integration**: Connect existing MLHCP, NRA, and OARG records
- **Community Verification**: Multi-party cryptographic signatures
- **Blockchain Immutability**: Hyperledger Fabric for permanent records
- **AI-Powered Validation**: Satellite imagery analysis for boundaries
- **Offline-First Design**: Full functionality without internet
- **Multi-Interface Access**: Mobile app, web portal, SMS/USSD

### Key Problems We Solve
1. **Multiple Sales Fraud**: Cryptographic verification prevents selling to multiple buyers
2. **Land Disputes**: Complete evidence trail and transparent verification
3. **Connectivity Issues**: 30-60 day offline operation with smart sync
4. **Illiteracy**: Voice interface in local languages, visual symbols
5. **Technology Reluctance**: Human intermediaries, gradual adoption

## Architecture Overview

### Multi-Service Structure
- **Frontend**: Next.js web portal with offline-first PWA capabilities
- **Backend**: Cloudflare Workers with KV storage and Durable Objects for session management
- **AI Service**: FastAPI service for boundary detection and land use analysis
- **Mobile**: React Native app with GPS tracking and offline sync
- **Blockchain**: Hyperledger Fabric for immutable land records
- **Government Integration**: ETL pipeline for existing databases

### Critical Architectural Components

#### 1. Multi-Party Verification System
```typescript
interface VerificationRequirements {
  minimumSignatures: 5;
  requiredParties: [
    'property_owner',
    'community_leader',
    'government_official',
    'neighbor_1',
    'neighbor_2'
  ];
  cryptographicProof: ThresholdSignature;
  biometricCapture: ['fingerprint', 'face', 'voice'];
}
```

#### 2. Offline-First Architecture
- **30-60 day local operation**: Complete functionality without connectivity
- **Conflict Resolution**: CRDT-based sync with version vectors
- **Progressive Sync**: Prioritized data transfer for low bandwidth
- **Mesh Networking**: Device-to-device sync via Bluetooth/WiFi

#### 3. Government Integration Layer
```typescript
interface GovernmentIntegration {
  dataSources: {
    MLHCP: { type: 'database', sync: 'bidirectional' };
    NRA: { type: 'api', sync: 'read-write' };
    OARG: { type: 'database', sync: 'read-only' };
  };
  reconciliation: 'smart-merge';
  conflictResolution: 'confidence-scoring';
  audit: 'blockchain-backed';
}
```

#### 4. Accessibility Features
- **Voice-First**: Complete voice navigation in Krio, Temne, Mende
- **Visual Symbols**: Universal icons for illiterate users
- **SMS/USSD**: Basic phone support via *384#
- **Community Clerks**: Trained intermediaries for assistance

### Data Architecture
- **Spatial Data**: PostgreSQL with PostGIS for parcels and boundaries
- **Documents**: MongoDB for unstructured data (photos, documents)
- **Blockchain**: Hyperledger Fabric for immutable records
- **Local Storage**: SQLite for offline mobile storage
- **Session Data**: Cloudflare KV for distributed session management
- **Government Data**: ETL pipeline with data quality management

### Security Architecture
- **Identity**: Biometric + National ID integration
- **Cryptography**: Multi-party signatures, zero-knowledge proofs
- **Audit**: Tamper-evident logs, behavioral analytics
- **Privacy**: Field-level encryption, GDPR compliance

## 📋 Implementation Plan

### Phase 1: Foundation (Current - 6 months)
- [ ] Government database integration pipeline
- [ ] Core verification workflow with multi-party signatures
- [ ] Basic mobile app with GPS tracking
- [ ] Web portal for government officials
- [ ] Pilot deployment in 2 high-dispute districts

### Phase 2: Expansion (Months 7-12)
- [ ] AI boundary detection integration
- [ ] Full web portal for all stakeholders
- [ ] SMS/USSD system deployment
- [ ] Court system integration
- [ ] Expand to urban areas

### Phase 3: Scale (Months 13-18)
- [ ] National rollout
- [ ] Financial institution integration
- [ ] Advanced analytics dashboard
- [ ] Blockchain deployment
- [ ] Performance optimization

### Phase 4: Enhancement (Months 19-24)
- [ ] Predictive dispute prevention
- [ ] Automated valuation models
- [ ] Regional expansion preparation
- [ ] API ecosystem for third parties

## 🧪 Testing Requirements

### Test Coverage Requirements
- **Unit Tests**: Minimum 80% coverage
- **Integration Tests**: All API endpoints and service interactions
- **E2E Tests**: Complete user workflows
- **Load Tests**: Support 10,000 concurrent users
- **Offline Tests**: All offline scenarios

### Test Scenarios
```typescript
// Every feature must have these tests
interface RequiredTests {
  unitTests: string[];           // Component/function level
  integrationTests: string[];    // Service interactions
  e2eTests: string[];           // User workflows
  offlineTests: string[];       // Offline functionality
  securityTests: string[];      // Security validations
  performanceTests: string[];   // Load and stress tests
}
```

## 📝 Code Standards

### Clean Code Principles
- **Single Responsibility**: Each function/component does ONE thing
- **DRY**: Don't Repeat Yourself - extract common functionality
- **SOLID**: Follow SOLID principles for maintainable architecture
- **Meaningful Names**: Variables and functions clearly express intent
- **Small Functions**: Functions should be <20 lines ideally
- **No Magic Numbers**: Use named constants

### Documentation Standards
```typescript
/**
 * Verifies land ownership using multi-party cryptographic signatures
 * 
 * @param parcelId - Unique identifier for the land parcel
 * @param signatures - Array of cryptographic signatures from required parties
 * @returns Verification result with confidence score
 * @throws InvalidSignatureError if signatures don't meet threshold
 * 
 * @example
 * const result = await verifyOwnership('PARCEL-123', signatures);
 * console.log(result.isValid); // true
 */
```

### Commit Standards
- **Atomic Commits**: One feature/fix per commit
- **Clear Messages**: "Add multi-party verification to land registration"
- **Conventional Commits**: feat:, fix:, docs:, test:, refactor:

## 🚧 TODO - Features Not Yet Implemented

### High Priority
- [ ] Government database integration (ETL pipeline)
- [ ] Biometric capture integration
- [ ] SMS/USSD gateway setup
- [ ] Blockchain smart contracts
- [ ] AI model training for boundary detection

### Medium Priority
- [ ] Voice interface in local languages
- [ ] Offline mesh networking
- [ ] Court system API integration
- [ ] Advanced fraud detection ML models
- [ ] Real-time satellite imagery pipeline

### Low Priority
- [ ] AR visualization for boundaries
- [ ] Drone mapping integration
- [ ] Regional expansion features
- [ ] Third-party API ecosystem
- [ ] Advanced analytics dashboard

### Research Required
- [ ] Zero-knowledge proof implementation
- [ ] Quantum-resistant cryptography
- [ ] Satellite connectivity options
- [ ] Solar-powered edge servers
- [ ] Community incentive models

## 🎯 Success Metrics

### Technical Metrics
- **Uptime**: 99.9% availability
- **Response Time**: <200ms for API calls
- **Sync Time**: <30 seconds for full sync
- **Offline Duration**: 60 days minimum
- **Data Accuracy**: 99.99% verification accuracy

### Business Metrics
- **Fraud Reduction**: 90% within 2 years
- **Dispute Resolution**: 10x faster
- **User Adoption**: 100,000 parcels in year 1
- **Revenue Increase**: 50% tax collection improvement
- **User Satisfaction**: 95% across all demographics

## 🔧 Development Environment Setup

### Prerequisites
- Node.js 20.x
- Python 3.11+
- Docker & Docker Compose
- PostgreSQL with PostGIS
- Redis
- Git

### Initial Setup
```bash
# Clone repository
git clone [repo-url]
cd landmarking

# Install all dependencies
./scripts/setup-dev.sh

# Start all services
docker-compose up -d

# Run database migrations
./scripts/migrate-all.sh

# Seed test data
./scripts/seed-test-data.sh
```

## 🚨 Critical Reminders

1. **NEVER** compromise on security - this system handles legal documents
2. **ALWAYS** consider offline users - most areas have poor connectivity
3. **ALWAYS** test with real Sierra Leone data - names, places, coordinates
4. **NEVER** assume literacy - voice and visual interfaces are critical
5. **ALWAYS** validate against government data - we're enhancing, not replacing
6. **ALWAYS** document complex logic - future developers need to understand
7. **NEVER** skip tests - lives and livelihoods depend on this system

## 🌟 Vision Statement

We are not just building software. We are building trust, preventing conflicts, and empowering communities. Every line of code matters. Every test matters. Every commit moves Sierra Leone forward.

**This is revolutionary work. Let's build it right.**
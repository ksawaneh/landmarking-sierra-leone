# 🏛️ LandMarking Sierra Leone

> A revolutionary digital land registry system preventing fraud and empowering communities through blockchain, AI, and multi-party verification.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-13+-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)

## 🎯 Mission

To build Sierra Leone's first comprehensive digital land registry that **prevents fraud**, **resolves disputes**, and **empowers citizens** by combining government records, community verification, and cutting-edge technology.

## 🚀 Key Features

### 🔐 Fraud Prevention
- **Multi-Party Verification**: Requires 5+ cryptographic signatures (owner, chief, community leaders, neighbors, government)
- **Threshold Signatures**: Uses Shamir's Secret Sharing - no single party can forge transactions
- **Biometric Authentication**: Fingerprint, face, and voice verification
- **Real-Time Conflict Detection**: Prevents multiple sales of the same land

### 📱 Accessibility
- **Offline-First**: 30-60 day offline operation with smart sync
- **Multi-Language**: Voice interface in Krio, Temne, Mende, and English
- **SMS/USSD Support**: Works on basic phones via *384#
- **Visual Interface**: Icons and symbols for illiterate users

### 🤖 AI Integration
- **Boundary Detection**: Satellite imagery analysis
- **Data Reconciliation**: Smart merging of government records
- **Fraud Detection**: Pattern recognition and anomaly detection
- **Dispute Resolution**: AI-assisted mediation suggestions

### 🔗 Blockchain Security
- **Hyperledger Fabric**: Immutable land records
- **Smart Contracts**: Automated verification workflows
- **Tamper-Proof**: Complete audit trail
- **Decentralized**: No single point of failure

## 🏗️ Architecture

```
landmarking/
├── src/
│   ├── frontend/          # Next.js PWA
│   ├── backend/           # Cloudflare Workers API
│   │   └── services/
│   │       ├── government/    # Gov database integration
│   │       └── verification/  # Multi-party signatures
│   ├── ai/                # Python/FastAPI ML services
│   └── mobile/            # React Native app
├── infrastructure/        # IaC deployment configs
├── docs/                  # Documentation
└── scripts/              # Development tools
```

## 🚦 Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/landmarking-sierra-leone.git
cd landmarking-sierra-leone

# Run setup script
./scripts/setup-dev.sh

# Start all services
./scripts/start-all.sh
```

### Development URLs
- Frontend: http://localhost:3000
- Backend API: http://localhost:8787
- AI Service: http://localhost:8000

## 🔧 Development Workflow

We follow the **EXPLORE → PLAN → CODE → COMMIT** workflow:

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and test**
   ```bash
   npm test
   npm run lint
   ```

3. **Commit with meaningful messages**
   ```bash
   git add .
   git commit -m "feat: add biometric verification for rural areas"
   ```

4. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create PR on GitHub
   ```

## 📊 Project Status

### ✅ Phase 1: Foundation (Current)
- [x] Government database integration (MLHCP, NRA)
- [x] Multi-party verification system
- [x] Development environment setup
- [ ] Basic mobile app with GPS
- [ ] API endpoints
- [ ] Pilot in 2 districts

### 🔄 Phase 2: Expansion (Months 7-12)
- [ ] AI boundary detection
- [ ] SMS/USSD system
- [ ] Court integration
- [ ] Urban area rollout

### 📅 Phase 3: Scale (Months 13-18)
- [ ] National deployment
- [ ] Financial institution integration
- [ ] Advanced analytics
- [ ] Blockchain mainnet

## 🧪 Testing

```bash
# Run all tests
./scripts/run-tests.sh

# Run specific service tests
cd src/backend/workers && npm test
cd src/frontend && yarn test
cd src/ai && pytest
```

## 🤝 Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for our code of conduct and development process.

### Commit Convention
We use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `test:` Test additions/changes
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

## 📈 Impact Metrics

### Goals
- 90% reduction in land disputes within 2 years
- 100,000+ parcels registered in year 1
- Zero successful fraud cases post-registration
- 50% increase in property tax collection

### Success Indicators
- Fraud prevention rate
- Dispute resolution time
- User adoption across demographics
- Government revenue increase

## 🔒 Security

- **No raw biometric storage** - only hashes
- **End-to-end encryption** for sensitive data
- **Regular security audits**
- **Bug bounty program** (coming soon)

Report security vulnerabilities to: security@landmarking.sl

## 📜 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file.

## 🙏 Acknowledgments

- Ministry of Lands, Housing and Country Planning
- Sierra Leone communities providing feedback
- Open source contributors
- Anthropic for AI assistance

## 📞 Contact

- Project Lead: [Your Name]
- Email: contact@landmarking.sl
- Website: https://landmarking.sl (coming soon)

---

**Building trust, one land record at a time.** 🌍
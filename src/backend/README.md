# LandMarking Backend Services

## Overview

The LandMarking backend is built using a microservices architecture with Node.js. It provides APIs for the web and mobile frontends, handles data processing, and manages integrations with external systems.

## Architecture

The backend is organized into the following components:

- **API Gateway**: Routes requests to appropriate services
- **Authentication Service**: Handles user authentication and authorization
- **User Service**: Manages user profiles and permissions
- **Parcel Service**: Manages land parcel data and boundaries
- **Rights Service**: Handles land rights and ownership records
- **Verification Service**: Manages verification workflows
- **Document Service**: Handles document storage and management
- **Dispute Service**: Manages boundary disputes and resolution
- **Notification Service**: Sends notifications to users
- **Sync Service**: Handles mobile data synchronization
- **Blockchain Service**: Interfaces with Hyperledger Fabric
- **Analytics Service**: Generates reports and analytics

## Directory Structure

```
backend/
├── gateway/               # API Gateway
├── services/
│   ├── auth/              # Authentication Service
│   ├── users/             # User Service
│   ├── parcels/           # Parcel Service
│   ├── rights/            # Rights Service
│   ├── verification/      # Verification Service
│   ├── documents/         # Document Service
│   ├── disputes/          # Dispute Service
│   ├── notifications/     # Notification Service
│   ├── sync/              # Sync Service
│   ├── blockchain/        # Blockchain Service
│   └── analytics/         # Analytics Service
├── libs/
│   ├── common/            # Shared utilities and functions
│   ├── database/          # Database access layer
│   ├── messaging/         # Inter-service communication
│   ├── validation/        # Data validation
│   └── security/          # Security utilities
├── tests/                 # Automated tests
├── docs/                  # Service documentation
└── scripts/               # Build and deployment scripts
```

## Technical Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **API Framework**: Express.js
- **Database**: PostgreSQL with PostGIS
- **Document Storage**: MongoDB
- **Caching**: Redis
- **Message Broker**: Apache Kafka
- **Authentication**: JWT with OAuth 2.0
- **Blockchain**: Hyperledger Fabric
- **Deployment**: Docker containers on Kubernetes
- **API Documentation**: OpenAPI/Swagger
- **Testing**: Jest, Supertest, Testcontainers
- **Monitoring**: Prometheus, Grafana
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)

## Shared Libraries

### Common Library

Provides shared utilities and functions:

- Logging framework
- Error handling
- Monitoring
- Configuration management
- Date/time utilities
- String processing

### Database Library

Database access layer with:

- Connection pooling
- Query builders
- Transaction management
- Migration utilities
- Data models
- Repository pattern implementations

### Messaging Library

Inter-service communication:

- Message broker integration
- Event publishing/subscription
- Request/response patterns
- Circuit breakers
- Retry mechanisms

### Validation Library

Data validation utilities:

- Schema validation
- Input sanitization
- Business rule validation
- Error formatting

### Security Library

Security utilities:

- Authentication helpers
- Authorization utilities
- Encryption/decryption
- Hashing utilities
- Audit logging

## Service Details

### API Gateway

- Routes requests to appropriate services
- Handles authentication and authorization
- Rate limiting and throttling
- Request logging
- API documentation

### Authentication Service

- User login and session management
- Token issuance and validation
- Multi-factor authentication
- Password management
- Account recovery

### User Service

- User profile management
- Role and permission management
- User search and filtering
- User device management
- Activity logging

### Parcel Service

- Land parcel CRUD operations
- Boundary geometry processing
- Overlapping parcel detection
- Parcel history tracking
- GIS operations

### Rights Service

- Land rights management
- Right holder records
- Ownership transfers
- Rights validation
- Certificate generation

### Verification Service

- Verification workflow management
- Step management and assignment
- Approval/rejection handling
- Evidence collection
- Notification triggers

### Document Service

- Document upload and storage
- Document metadata management
- Version control
- Document search
- Content extraction

### Dispute Service

- Dispute creation and management
- Resolution workflow
- Comment and evidence management
- Notification integration
- History tracking

### Notification Service

- Multi-channel notifications (Email, SMS, Push)
- Notification templating
- Delivery tracking
- Notification preferences
- Scheduled notifications

### Sync Service

- Mobile data synchronization
- Conflict detection and resolution
- Change tracking
- Bandwidth-aware sync
- Selective sync

### Blockchain Service

- Hyperledger Fabric integration
- Smart contract interaction
- Transaction recording
- Certificate issuance
- Verification of records

### Analytics Service

- Report generation
- Usage statistics
- Data visualization
- Export functionality
- Dashboard metrics

## Database Integration

### PostgreSQL with PostGIS

- Spatial data storage
- Relational data storage
- Transaction support
- Complex queries
- Spatial indexing

### MongoDB

- Document storage
- Binary file storage
- Flexible schema
- Replication
- Sharding

### Redis

- Caching
- Session storage
- Pub/Sub messaging
- Rate limiting
- Distributed locks

## Development Setup

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env file with appropriate values

# Start development databases (requires Docker)
npm run db:start

# Run database migrations
npm run db:migrate

# Seed the database with test data
npm run db:seed

# Start the development server
npm run dev
```

## Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e

# Run linting
npm run lint
```

## API Documentation

API documentation is generated automatically using OpenAPI/Swagger. Once the server is running, you can access the documentation at:

```
http://localhost:3000/api-docs
```

## Deployment

The backend services are deployed as Docker containers on Kubernetes:

```bash
# Build all services
npm run build

# Build Docker images
npm run docker:build

# Push Docker images
npm run docker:push

# Deploy to Kubernetes
npm run k8s:deploy
```

## Monitoring

- Prometheus metrics exposed at `/metrics` endpoint
- Grafana dashboards for visualization
- Alerting based on predefined thresholds
- Distributed tracing with Jaeger

## Logging

- Structured logging in JSON format
- Log aggregation with ELK stack
- Log levels (debug, info, warn, error)
- Request ID tracking across services
- Sensitive data masking

## Security

- HTTPS for all communications
- JWT with short expiry and refresh tokens
- Role-based access control
- Input validation and sanitization
- Rate limiting
- OWASP security best practices
- Regular vulnerability scanning

## Contributing

See the [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
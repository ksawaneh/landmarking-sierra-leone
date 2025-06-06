# Government Database ETL Pipeline

## Overview

The ETL (Extract, Transform, Load) pipeline service orchestrates data synchronization between Sierra Leone government databases and the LandMarking system. It provides scheduled and real-time data integration with built-in data quality management, conflict resolution, and audit logging.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     MLHCP       │     │      NRA        │     │      OARG       │
│   (Ministry)    │     │   (Revenue)     │     │   (Registry)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                                 │
                        ┌────────▼────────┐
                        │  ETL Pipeline   │
                        │    Service      │
                        └────────┬────────┘
                                 │
                ┌────────────────┴────────────────┐
                │                                 │
         ┌──────▼──────┐                  ┌──────▼──────┐
         │  PostgreSQL │                  │  Blockchain │
         │  (Primary)  │                  │  (Audit)    │
         └─────────────┘                  └─────────────┘
```

## Key Features

### 1. Multi-Source Data Extraction
- Parallel extraction from MLHCP, NRA, and OARG
- Incremental and full sync modes
- Change Data Capture (CDC) support
- Automatic retry with exponential backoff

### 2. Advanced Data Transformation
- Name normalization and variation handling
- Address standardization
- Boundary coordinate validation
- Data quality scoring
- Duplicate detection and merging

### 3. Intelligent Loading
- Transaction-based loading with rollback
- Conflict resolution strategies
- Version control for all records
- Blockchain audit trail

### 4. Monitoring & Alerting
- Real-time pipeline metrics
- Data quality dashboards
- Anomaly detection
- Email/SMS alerts for issues

## Components

### Extractors
- `MLHCPExtractor`: Extracts land records from Ministry database
- `NRAExtractor`: Extracts tax and valuation data
- `OARGExtractor`: Extracts deed and registration data
- `CDCExtractor`: Monitors real-time changes

### Transformers
- `DataNormalizer`: Standardizes data formats
- `AddressGeocoder`: Converts addresses to coordinates
- `NameMatcher`: Handles name variations
- `BoundaryValidator`: Validates and corrects boundaries
- `QualityScorer`: Assigns data quality scores

### Loaders
- `PostgreSQLLoader`: Loads into primary database
- `BlockchainLoader`: Creates immutable audit records
- `CacheLoader`: Updates Redis cache
- `SearchIndexLoader`: Updates Elasticsearch

### Orchestrator
- `PipelineOrchestrator`: Manages pipeline execution
- `ScheduleManager`: Handles cron jobs
- `DependencyResolver`: Manages task dependencies
- `ErrorHandler`: Centralized error management

## Configuration

```yaml
# config/pipeline.yaml
pipeline:
  name: government-etl
  schedule: "0 2 * * *"  # Daily at 2 AM
  
sources:
  mlhcp:
    type: database
    connection: ${MLHCP_CONNECTION_STRING}
    batch_size: 1000
    parallel_workers: 4
    
  nra:
    type: api
    base_url: ${NRA_API_URL}
    rate_limit: 100/minute
    
  oarg:
    type: database
    connection: ${OARG_CONNECTION_STRING}
    cdc_enabled: true

transformations:
  - name_normalization
  - address_geocoding
  - boundary_validation
  - quality_scoring
  - duplicate_detection

destinations:
  postgresql:
    connection: ${DATABASE_URL}
    schema: land_registry
    
  blockchain:
    network: hyperledger
    channel: land-records
    
monitoring:
  metrics_port: 9090
  alerts:
    email: etl-alerts@landmarking.gov.sl
    sms: +23276100000
```

## Usage

### Running the Pipeline

```bash
# Full sync
npm run etl:full

# Incremental sync
npm run etl:incremental

# Real-time CDC
npm run etl:cdc

# Specific source
npm run etl:source -- --source=mlhcp
```

### Monitoring

```bash
# View pipeline status
npm run etl:status

# View metrics
npm run etl:metrics

# Check data quality
npm run etl:quality-report
```

## Data Quality Management

### Quality Checks
1. **Completeness**: All required fields present
2. **Accuracy**: Valid formats and ranges
3. **Consistency**: Cross-source validation
4. **Timeliness**: Recent verification dates
5. **Uniqueness**: No duplicate records

### Quality Scoring
```
Score = (Completeness * 0.3) + (Accuracy * 0.3) + 
        (Consistency * 0.2) + (Timeliness * 0.1) + 
        (Uniqueness * 0.1)
```

## Error Handling

### Retry Strategy
- Maximum 3 retries per task
- Exponential backoff: 1s, 2s, 4s
- Dead letter queue for failed records
- Manual intervention dashboard

### Recovery Procedures
1. **Partial Failure**: Continue with valid records
2. **Source Unavailable**: Use cached data with warning
3. **Transform Error**: Log and skip record
4. **Load Failure**: Rollback transaction

## Performance Optimization

### Techniques
- Parallel processing with worker threads
- Connection pooling
- Batch operations
- Query optimization
- Result caching

### Benchmarks
- Extract: 10,000 records/minute
- Transform: 5,000 records/minute
- Load: 8,000 records/minute
- End-to-end: ~100,000 records/hour

## Security

### Data Protection
- Encryption in transit (TLS 1.3)
- Encryption at rest (AES-256)
- Field-level encryption for PII
- Access control with API keys

### Audit Trail
- All operations logged
- User actions tracked
- Data lineage maintained
- Blockchain immutability

## Deployment

### Docker
```bash
docker build -t landmarking-etl .
docker run -d --name etl-pipeline landmarking-etl
```

### Kubernetes
```bash
kubectl apply -f k8s/etl-deployment.yaml
kubectl apply -f k8s/etl-cronjob.yaml
```

## Monitoring Dashboard

Access the monitoring dashboard at: http://localhost:9090

Features:
- Pipeline execution history
- Data quality trends
- Error rates and alerts
- Source system health
- Performance metrics
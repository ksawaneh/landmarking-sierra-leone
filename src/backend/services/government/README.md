# Government Data Integration Service

## Overview

This service provides integration with Sierra Leone government databases for land records, including:
- **MLHCP** (Ministry of Lands, Housing and Country Planning) - Primary land registry
- **NRA** (National Revenue Authority) - Tax records
- **OARG** (Office of Administrator and Registrar General) - Deed records

## Architecture

```
government/
├── adapters/              # Government system adapters
│   ├── base-adapter.ts    # Base class with common functionality
│   ├── mlhcp-adapter.ts   # MLHCP integration
│   ├── nra-adapter.ts     # NRA integration
│   └── oarg-adapter.ts    # OARG integration (TODO)
├── reconciliation/        # Data reconciliation engine
│   └── data-reconciler.ts # Merges data from multiple sources
├── schemas/               # TypeScript interfaces
│   └── government-data.types.ts
└── mock-data/             # Test data generator
    └── sierra-leone-data-generator.ts
```

## Key Features

### 1. Accurate Sierra Leone Data
- All 16 current districts (including Falaba and Karene added in 2017)
- Common Sierra Leonean names with variations (Mohamed/Mohammed/Muhammed)
- Realistic addresses and boundary descriptions
- Typical land sizes for different property types

### 2. Data Quality Management
- Detects and handles common issues:
  - Name spelling variations
  - Missing national IDs
  - Incomplete boundaries
  - Date format inconsistencies
  - Duplicate records

### 3. Smart Reconciliation
- Merges data from multiple government sources
- Confidence scoring based on data quality
- Conflict detection and resolution
- Actionable suggestions for data improvement

### 4. Mock Mode for Development
- Generates realistic test data
- Simulates real data quality issues
- Enables offline development

## Usage

### Initialize Adapters

```typescript
import { MLHCPAdapter } from './adapters/mlhcp-adapter';
import { NRAAdapter } from './adapters/nra-adapter';
import { DataReconciler } from './reconciliation/data-reconciler';

// Initialize in mock mode for development
const mlhcp = new MLHCPAdapter({ mockMode: true });
const nra = new NRAAdapter({ mockMode: true });
const reconciler = new DataReconciler();
```

### Query Land Records

```typescript
// Search by district
const westernAreaRecords = await mlhcp.query({
  district: 'Western Area Urban',
  landType: 'residential'
}, { limit: 10 });

// Search by owner name (handles variations)
const ownerRecords = await mlhcp.query({
  ownerName: 'Mohamed Kamara'
});

// Check tax compliance
const taxRecords = await nra.query({
  hasArrears: true,
  isCompliant: false
});
```

### Reconcile Multiple Sources

```typescript
// Get records from different sources
const mlhcpRecord = await mlhcp.getById('WA/FT/001234/2020');
const nraRecord = await nra.getById('NRA-123456');

// Reconcile into unified record
const result = await reconciler.reconcile(
  mlhcpRecord.data,
  nraRecord.data
);

console.log('Unified Owner:', result.unified.ownership.currentOwner.name);
console.log('Confidence:', result.unified.ownership.currentOwner.confidence);
console.log('Verification Required:', result.unified.ownership.verificationRequired);
console.log('Suggestions:', result.suggestions);
```

## Data Quality Warnings

The system automatically detects and reports data quality issues:

- Missing owner national IDs
- Incomplete boundary descriptions  
- Records not verified in 5+ years
- Properties with tax arrears
- Non-compliant tax status
- Properties needing reassessment

## Testing

Run the integration tests:

```bash
cd src/backend/workers
npm test -- ../services/government/__tests__/integration.test.ts
```

Run the demo:

```bash
npx ts-node src/backend/services/government/test-integration.ts
```

## Production Deployment

To connect to real government databases:

1. Configure environment variables:
   ```env
   MLHCP_BASE_URL=https://api.mlhcp.gov.sl
   MLHCP_API_KEY=your-api-key
   NRA_BASE_URL=https://api.nra.gov.sl
   NRA_API_KEY=your-api-key
   ```

2. Initialize adapters without mock mode:
   ```typescript
   const mlhcp = new MLHCPAdapter({
     baseUrl: process.env.MLHCP_BASE_URL,
     apiKey: process.env.MLHCP_API_KEY,
     mockMode: false
   });
   ```

3. Implement the actual API/database connections in each adapter

## Next Steps

1. Complete OARG adapter implementation
2. Add batch processing for large imports
3. Implement real-time sync with government systems
4. Add data export functionality
5. Build admin dashboard for monitoring data quality
6. Set up automated reconciliation jobs
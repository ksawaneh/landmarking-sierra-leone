# LandMarking Database Schema

## Overview

The LandMarking system uses a hybrid database approach:

1. **PostgreSQL with PostGIS**: For spatial data and relational data structures
2. **MongoDB**: For document storage (attachments, evidence, etc.)
3. **SQLite**: For local mobile device storage
4. **Hyperledger Fabric**: For immutable transaction records

This document outlines the core schema design for the primary PostgreSQL database.

## PostgreSQL Schema

### Users and Authentication

#### Table: `users`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| username | VARCHAR(255) | Unique username |
| email | VARCHAR(255) | Email address |
| phone_number | VARCHAR(20) | Phone number (primary contact method) |
| password_hash | VARCHAR(255) | Hashed password |
| full_name | VARCHAR(255) | Full name |
| role | VARCHAR(50) | User role (admin, field_agent, community_leader, etc.) |
| community_id | UUID | Reference to communities table |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |
| last_login | TIMESTAMP | Last login timestamp |
| status | VARCHAR(20) | Account status (active, inactive, suspended) |

#### Table: `user_roles`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(50) | Role name |
| description | TEXT | Role description |
| permissions | JSONB | Role permissions |

#### Table: `user_devices`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Reference to users table |
| device_id | VARCHAR(255) | Unique device identifier |
| device_name | VARCHAR(255) | Device name/model |
| last_sync | TIMESTAMP | Last synchronization timestamp |
| created_at | TIMESTAMP | Creation timestamp |

### Geographic Data

#### Table: `regions`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(255) | Region name |
| code | VARCHAR(20) | Region code |
| geometry | GEOMETRY(MULTIPOLYGON) | Region boundary |
| parent_id | UUID | Parent region (for hierarchical regions) |
| level | INTEGER | Administrative level |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

#### Table: `communities`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(255) | Community name |
| region_id | UUID | Reference to regions table |
| geometry | GEOMETRY(MULTIPOLYGON) | Community boundary |
| population | INTEGER | Estimated population |
| code | VARCHAR(20) | Community code |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### Land Management

#### Table: `land_parcels`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| parcel_number | VARCHAR(50) | Unique parcel identifier |
| geometry | GEOMETRY(MULTIPOLYGON) | Parcel boundary |
| area_sqm | NUMERIC | Area in square meters |
| community_id | UUID | Reference to communities table |
| status | VARCHAR(50) | Status (draft, verified, disputed, registered) |
| land_use | VARCHAR(50) | Land use type (residential, agricultural, etc.) |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |
| created_by | UUID | Reference to users table |
| coordinates_quality | NUMERIC | GPS accuracy metric |

#### Table: `land_rights`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| parcel_id | UUID | Reference to land_parcels table |
| right_type | VARCHAR(50) | Type of right (ownership, lease, customary, etc.) |
| description | TEXT | Description of right |
| valid_from | DATE | Start date of right |
| valid_to | DATE | End date of right (null for indefinite) |
| status | VARCHAR(50) | Status (pending, active, revoked, etc.) |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |
| blockchain_reference | VARCHAR(255) | Reference to blockchain record |

#### Table: `right_holders`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| right_id | UUID | Reference to land_rights table |
| holder_type | VARCHAR(50) | Type (individual, community, organization) |
| holder_name | VARCHAR(255) | Name of right holder |
| identifier | VARCHAR(255) | National ID or other identifier |
| user_id | UUID | Reference to users table (if applicable) |
| share_percentage | NUMERIC | Percentage of ownership/right |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### Verification Workflow

#### Table: `verification_processes`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| parcel_id | UUID | Reference to land_parcels table |
| status | VARCHAR(50) | Overall process status |
| initiated_by | UUID | Reference to users table |
| initiated_at | TIMESTAMP | Timestamp of initiation |
| completed_at | TIMESTAMP | Timestamp of completion |
| notes | TEXT | Process notes |

#### Table: `verification_steps`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| process_id | UUID | Reference to verification_processes table |
| step_type | VARCHAR(50) | Type of verification step |
| status | VARCHAR(50) | Step status |
| assigned_to | UUID | Reference to users table |
| completed_by | UUID | Reference to users table |
| completed_at | TIMESTAMP | Completion timestamp |
| due_date | DATE | Due date for step |
| comments | TEXT | Verifier comments |
| evidence_references | JSONB | References to evidence documents |

#### Table: `boundary_disputes`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| parcel_id | UUID | Reference to land_parcels table |
| disputed_by | UUID | Reference to users table |
| status | VARCHAR(50) | Dispute status |
| description | TEXT | Description of dispute |
| resolution | TEXT | Resolution details |
| disputed_boundary | GEOMETRY(LINESTRING) | Disputed boundary section |
| created_at | TIMESTAMP | Creation timestamp |
| resolved_at | TIMESTAMP | Resolution timestamp |

### Documents and Evidence

#### Table: `documents`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| title | VARCHAR(255) | Document title |
| document_type | VARCHAR(50) | Type of document |
| description | TEXT | Document description |
| file_reference | VARCHAR(255) | Reference to file in MongoDB |
| parcel_id | UUID | Reference to land_parcels table |
| uploaded_by | UUID | Reference to users table |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |
| verified | BOOLEAN | Document verification status |
| tags | TEXT[] | Document tags |

### Audit and Activity

#### Table: `activity_logs`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| action | VARCHAR(50) | Action performed |
| entity_type | VARCHAR(50) | Type of entity affected |
| entity_id | UUID | ID of affected entity |
| user_id | UUID | Reference to users table |
| ip_address | VARCHAR(45) | IP address of user |
| device_info | TEXT | Device information |
| timestamp | TIMESTAMP | Action timestamp |
| details | JSONB | Additional details |
| location | GEOMETRY(POINT) | GPS location of action |

## MongoDB Collections

### Collection: `attachments`

```json
{
  "_id": ObjectId,
  "document_id": "UUID",
  "file_name": "String",
  "content_type": "String",
  "size_bytes": "Number",
  "upload_date": "Date",
  "binary_data": "BinData",
  "metadata": {
    "gps_location": {
      "latitude": "Number",
      "longitude": "Number"
    },
    "device_info": "String",
    "tags": ["String"]
  }
}
```

### Collection: `evidence`

```json
{
  "_id": ObjectId,
  "verification_step_id": "UUID",
  "evidence_type": "String",
  "description": "String",
  "attachments": ["ObjectId"],
  "created_by": "UUID",
  "created_at": "Date",
  "metadata": {
    "location": {
      "latitude": "Number",
      "longitude": "Number"
    },
    "weather_conditions": "String",
    "tags": ["String"]
  }
}
```

## SQLite Schema (Mobile)

The mobile SQLite database will contain similar tables but optimized for offline use and synchronization:

- Local copies of needed reference data
- Queued operations for synchronization
- Locally captured data pending upload
- Conflict resolution information

Details of the SQLite schema will be in a separate document.

## Hyperledger Fabric Ledger

The blockchain ledger will store:

- Finalized land parcel records
- Verified transactions and ownership changes
- Digital signatures for official approvals
- Certificates and their verification status

The chaincode structure and data models will be detailed in a separate document.

## Database Relationships

![Database Relationships Diagram]

## Indexing Strategy

### PostgreSQL Indexes

- Spatial indexes on all geometry columns
- B-tree indexes on all foreign keys
- Hash indexes on frequently searched text fields
- GIN indexes on JSONB columns
- Unique constraints on natural keys

### MongoDB Indexes

- Indexes on document_id fields
- Geospatial indexes on location fields
- Text indexes for full-text search capabilities

## Data Migration

The system will support importing existing land records from:

- Legacy systems (where available)
- Paper records (via scanning and manual entry)
- Existing GIS data (shapefiles, GeoJSON)

Migration scripts and processes will be implemented as part of the Phase 1 development.

## Data Validation Rules

- All geometry data must be valid according to OGC standards
- Parcels must not overlap with previously verified parcels
- User roles must contain valid permissions
- Document references must point to existing files
- Land rights must have at least one right holder

## Security Considerations

- Encryption of sensitive data
- Row-level security policies for data access
- Audit logging for all data modifications
- Backup and recovery procedures
- Data partitioning for multi-tenant isolation

This schema design is subject to refinement during the development process.
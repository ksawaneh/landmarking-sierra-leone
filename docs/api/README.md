# LandMarking API Documentation

## Overview

The LandMarking API provides access to the land registration and mapping system. It is organized as a collection of microservices, each with its own API endpoints. This document provides a high-level overview of the available APIs.

## API Standards

- All APIs follow RESTful design principles
- Authentication is handled via OAuth 2.0 / JWT tokens
- All endpoints return JSON responses
- HTTP status codes are used to indicate success/failure
- Error responses include descriptive messages
- API versioning is included in the URL path (`/api/v1/...`)
- Rate limiting is applied to prevent abuse
- CORS is configured for frontend applications

## Authentication API

Base URL: `/api/v1/auth`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/login` | POST | Authenticate with username/password or phone/OTP |
| `/refresh` | POST | Refresh an expired access token |
| `/logout` | POST | Invalidate the current token |
| `/register` | POST | Register a new user |
| `/verify` | POST | Verify a user's email or phone |
| `/password/reset` | POST | Request a password reset |
| `/password/change` | POST | Change password with token |

## User Management API

Base URL: `/api/v1/users`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | List users (admin only, with pagination) |
| `/{id}` | GET | Get user details |
| `/{id}` | PUT | Update user details |
| `/{id}` | DELETE | Deactivate a user |
| `/{id}/role` | PUT | Update user role |
| `/{id}/devices` | GET | List user devices |
| `/me` | GET | Get current user's profile |
| `/search` | GET | Search for users by criteria |

## Land Parcel API

Base URL: `/api/v1/parcels`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | List parcels (with filtering and pagination) |
| `/` | POST | Create a new land parcel |
| `/{id}` | GET | Get parcel details |
| `/{id}` | PUT | Update parcel details |
| `/{id}` | DELETE | Mark a parcel as inactive |
| `/{id}/boundaries` | GET | Get parcel boundary geometry |
| `/{id}/boundaries` | PUT | Update parcel boundaries |
| `/{id}/rights` | GET | Get rights associated with parcel |
| `/{id}/documents` | GET | Get documents for a parcel |
| `/{id}/history` | GET | Get change history for a parcel |
| `/{id}/neighbors` | GET | Get neighboring parcels |
| `/nearby` | GET | Find parcels near a location |
| `/overlapping` | POST | Check for overlapping parcels |

## Land Rights API

Base URL: `/api/v1/rights`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | List rights (with filtering) |
| `/` | POST | Create a new land right |
| `/{id}` | GET | Get right details |
| `/{id}` | PUT | Update right details |
| `/{id}` | DELETE | Revoke a right |
| `/{id}/holders` | GET | Get right holders |
| `/{id}/holders` | POST | Add a right holder |
| `/{id}/holders/{holderId}` | DELETE | Remove a right holder |
| `/{id}/certificate` | GET | Generate certificate PDF |
| `/search` | GET | Search for rights by criteria |

## Verification API

Base URL: `/api/v1/verification`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/processes` | GET | List verification processes |
| `/processes` | POST | Start a new verification process |
| `/processes/{id}` | GET | Get process details |
| `/processes/{id}/steps` | GET | Get process steps |
| `/processes/{id}/complete` | POST | Complete a verification process |
| `/steps/{id}` | GET | Get step details |
| `/steps/{id}/complete` | POST | Complete a verification step |
| `/steps/{id}/reject` | POST | Reject a verification step |
| `/steps/{id}/assign` | PUT | Assign a step to a user |
| `/steps/{id}/evidence` | POST | Add evidence to a step |

## Document API

Base URL: `/api/v1/documents`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | List documents (with filtering) |
| `/` | POST | Upload a new document |
| `/{id}` | GET | Get document details |
| `/{id}` | PUT | Update document details |
| `/{id}` | DELETE | Delete a document |
| `/{id}/download` | GET | Download document file |
| `/{id}/verify` | POST | Mark a document as verified |
| `/types` | GET | Get document type definitions |
| `/search` | GET | Search for documents |

## Dispute API

Base URL: `/api/v1/disputes`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | List disputes |
| `/` | POST | Create a new dispute |
| `/{id}` | GET | Get dispute details |
| `/{id}/resolve` | POST | Resolve a dispute |
| `/{id}/comments` | GET | Get dispute comments |
| `/{id}/comments` | POST | Add a comment to a dispute |
| `/{id}/evidence` | POST | Add evidence to a dispute |

## Geographic API

Base URL: `/api/v1/geo`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/regions` | GET | List regions |
| `/regions/{id}` | GET | Get region details |
| `/communities` | GET | List communities |
| `/communities/{id}` | GET | Get community details |
| `/boundaries/validate` | POST | Validate a boundary geometry |
| `/search` | GET | Geographic search by location |
| `/tiles/{z}/{x}/{y}` | GET | Get map tiles for visualization |
| `/satellite/{id}` | GET | Get satellite imagery for area |

## AI API

Base URL: `/api/v1/ai`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/boundaries/detect` | POST | Detect boundaries from satellite imagery |
| `/boundaries/suggest` | POST | Suggest corrections to a boundary |
| `/boundaries/validate` | POST | Validate a drawn boundary against imagery |
| `/landuse/classify` | POST | Classify land use from imagery |
| `/document/ocr` | POST | Extract text from document images |

## Sync API

Base URL: `/api/v1/sync`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | Get sync status for device |
| `/pull` | GET | Pull updates from server |
| `/push` | POST | Push local changes to server |
| `/conflicts` | GET | Get list of sync conflicts |
| `/conflicts/{id}/resolve` | POST | Resolve a sync conflict |
| `/queue` | GET | Get queued operations |

## Blockchain API

Base URL: `/api/v1/blockchain`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/transactions` | GET | Get list of blockchain transactions |
| `/transactions/{id}` | GET | Get transaction details |
| `/verify` | POST | Verify a certificate against the blockchain |
| `/certificates` | GET | Get certificates for a user |
| `/certificates/{id}` | GET | Get certificate details |

## Analytics API

Base URL: `/api/v1/analytics`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dashboard` | GET | Get dashboard statistics |
| `/reports/parcels` | GET | Get parcel registration statistics |
| `/reports/users` | GET | Get user activity statistics |
| `/reports/verification` | GET | Get verification statistics |
| `/reports/disputes` | GET | Get dispute statistics |
| `/reports/export` | POST | Generate and export a custom report |

## API Request/Response Examples

### Example: Create a Land Parcel

**Request:**

```http
POST /api/v1/parcels
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "parcel_number": "SL-WA-FR-1234",
  "community_id": "550e8400-e29b-41d4-a716-446655440000",
  "land_use": "residential",
  "geometry": {
    "type": "MultiPolygon",
    "coordinates": [
      [
        [
          [13.2345, 8.4567],
          [13.2355, 8.4567],
          [13.2355, 8.4577],
          [13.2345, 8.4577],
          [13.2345, 8.4567]
        ]
      ]
    ]
  },
  "metadata": {
    "source": "field_mapping",
    "accuracy_meters": 2.5
  }
}
```

**Response:**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "parcel_number": "SL-WA-FR-1234",
  "community_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "draft",
  "land_use": "residential",
  "area_sqm": 12345.67,
  "created_at": "2025-03-05T10:30:45Z",
  "created_by": "987e6543-e21b-45d3-b456-426614174999",
  "geometry": {
    "type": "MultiPolygon",
    "coordinates": [
      [
        [
          [13.2345, 8.4567],
          [13.2355, 8.4567],
          [13.2355, 8.4577],
          [13.2345, 8.4577],
          [13.2345, 8.4567]
        ]
      ]
    ]
  },
  "coordinates_quality": 2.5,
  "_links": {
    "self": "/api/v1/parcels/123e4567-e89b-12d3-a456-426614174000",
    "rights": "/api/v1/parcels/123e4567-e89b-12d3-a456-426614174000/rights",
    "documents": "/api/v1/parcels/123e4567-e89b-12d3-a456-426614174000/documents",
    "verification": "/api/v1/verification/processes?parcel_id=123e4567-e89b-12d3-a456-426614174000"
  }
}
```

### Example: Get User Profile

**Request:**

```http
GET /api/v1/users/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "987e6543-e21b-45d3-b456-426614174999",
  "username": "john.doe",
  "email": "john.doe@example.com",
  "phone_number": "+23299123456",
  "full_name": "John Doe",
  "role": "field_agent",
  "community_id": "550e8400-e29b-41d4-a716-446655440000",
  "community_name": "Freetown East",
  "status": "active",
  "created_at": "2024-12-01T08:15:30Z",
  "last_login": "2025-03-05T09:45:22Z",
  "permissions": [
    "parcels.create",
    "parcels.view",
    "parcels.edit",
    "documents.upload",
    "verification.submit"
  ],
  "_links": {
    "devices": "/api/v1/users/987e6543-e21b-45d3-b456-426614174999/devices",
    "parcels": "/api/v1/parcels?created_by=987e6543-e21b-45d3-b456-426614174999"
  }
}
```

## Pagination, Filtering and Sorting

APIs that return collections support the following query parameters:

- `page`: Page number (1-based)
- `per_page`: Items per page (default: 20, max: 100)
- `sort`: Field to sort by (prefix with `-` for descending order)
- `filter[field_name]`: Filter by field value
- `q`: General search term

Example: `/api/v1/parcels?page=2&per_page=50&sort=-created_at&filter[status]=verified&filter[land_use]=residential`

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "validation_error",
    "message": "The request could not be processed",
    "details": [
      {
        "field": "geometry",
        "message": "Geometry must be a valid GeoJSON MultiPolygon"
      }
    ]
  }
}
```

Common error codes:

- `unauthorized`: Authentication required
- `forbidden`: Permission denied
- `not_found`: Resource not found
- `validation_error`: Invalid data provided
- `conflict`: Resource conflict
- `server_error`: Internal server error

## API Clients

Client SDKs are available for:

- JavaScript/TypeScript
- Python
- Java/Kotlin (Android)
- Swift (iOS)

See the [SDK documentation](../sdk/README.md) for details.

## Offline Support

The mobile application includes offline support through:

1. Local caching of frequently accessed data
2. Operation queueing for disconnected operations
3. Synchronization when connectivity is restored

The Sync API manages this process.

## API Security

All API requests must be authenticated using OAuth 2.0 / JWT tokens. Transport-level security (HTTPS) is required for all communications.

See the [Security Documentation](../security/api-security.md) for more details.
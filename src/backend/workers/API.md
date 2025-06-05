# LandMarking API Documentation

Base URL: `https://api.landmarking.sl` (production) or `http://localhost:8787` (development)

## Authentication

All endpoints except auth routes require JWT authentication:
```
Authorization: Bearer <token>
```

## API Endpoints

### 🔐 Authentication

#### POST /api/v1/auth/login
Login with email and password.

#### POST /api/v1/auth/register
Register a new user account.

#### POST /api/v1/auth/refresh
Refresh access token using refresh token.

---

### ✅ Verification System

#### POST /api/v1/verifications
Create a new land verification request.

**Request:**
```json
{
  "parcelId": "WU/FT/001234/2024",
  "verificationType": "initial_registration",
  "landType": "residential",
  "district": "Western Area Urban",
  "initiatedBy": "AGENT-001"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "verificationId": "VER-1234567890-abc",
    "status": "pending",
    "requirements": {
      "minimumSignatures": 5,
      "requiredRoles": [
        { "role": "property_owner", "count": 1, "mandatory": true },
        { "role": "chief", "count": 1, "mandatory": true },
        { "role": "community_leader", "count": 2, "mandatory": true },
        { "role": "neighbor", "count": 2, "mandatory": true },
        { "role": "government_official", "count": 1, "mandatory": true }
      ],
      "biometricRequired": true
    },
    "expiresAt": "2024-02-05T12:00:00Z"
  }
}
```

#### GET /api/v1/verifications
List all verifications with optional filters.

**Query Parameters:**
- `status` - Filter by status (pending, in_progress, completed, rejected)
- `parcelId` - Filter by parcel ID
- `limit` - Results per page (default: 10, max: 100)
- `offset` - Pagination offset

#### GET /api/v1/verifications/:id
Get detailed information about a specific verification.

#### POST /api/v1/verifications/:id/parties
Add a party to the verification process.

**Request:**
```json
{
  "role": "property_owner",
  "name": "Mohamed Kamara",
  "nationalId": "SL123456789",
  "phoneNumber": "+23276123456",
  "address": "123 Hill Station, Freetown",
  "district": "Western Area Urban",
  "biometrics": {
    "fingerprint": {
      "data": "base64_encoded_data",
      "quality": 85,
      "captureDevice": "BiometricScanner v2"
    },
    "captureTimestamp": "2024-01-06T10:00:00Z",
    "captureLocation": {
      "latitude": 8.4657,
      "longitude": -13.2317,
      "accuracy": 10
    }
  }
}
```

#### POST /api/v1/verifications/:id/verify-party/:partyId
Verify a party's identity after biometric capture.

#### POST /api/v1/verifications/:id/signatures
Collect a digital signature from a verified party.

**Request:**
```json
{
  "partyId": "PARTY-001",
  "signature": "base64_signature_data",
  "signedData": "hash_of_land_data",
  "deviceInfo": {
    "deviceId": "DEVICE-001",
    "deviceType": "mobile",
    "ipAddress": "192.168.1.1"
  }
}
```

#### POST /api/v1/verifications/:id/advance
Advance the verification workflow to the next stage.

#### GET /api/v1/verifications/:id/validate
Validate the current state of the verification.

---

### 🏛️ Government Integration

#### GET /api/v1/government/mlhcp/search
Search Ministry of Lands (MLHCP) records.

**Query Parameters:**
- `ownerName` - Owner's name (partial match supported)
- `landId` - Land ID
- `district` - District name
- `landType` - Land type (residential, commercial, agricultural)
- `limit` - Results per page
- `offset` - Pagination offset

#### GET /api/v1/government/mlhcp/:landId
Get a specific MLHCP land record.

#### GET /api/v1/government/nra/search
Search National Revenue Authority (NRA) tax records.

**Query Parameters:**
- `taxpayerName` - Taxpayer's name
- `taxId` - Tax ID
- `propertyAddress` - Property address
- `isCompliant` - Tax compliance status (true/false)
- `hasArrears` - Has tax arrears (true/false)

#### GET /api/v1/government/nra/:taxId
Get a specific NRA tax record.

#### GET /api/v1/government/nra/:taxId/compliance
Check tax compliance status for a property.

**Response:**
```json
{
  "success": true,
  "data": {
    "isCompliant": true,
    "arrears": 0,
    "lastPaymentDays": 45,
    "recommendations": []
  }
}
```

#### POST /api/v1/government/reconcile
Reconcile records from multiple government sources.

**Request:**
```json
{
  "mlhcpId": "WU/FT/001234/2024",
  "nraId": "NRA-123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "unified": {
      "unifiedId": "UNI-WU/FT/001234/2024",
      "ownership": {
        "currentOwner": {
          "name": "Mohamed Kamara",
          "nationalId": "SL123456789",
          "confidence": 0.85
        },
        "verificationRequired": false
      },
      "location": {
        "district": "Western Area Urban",
        "chiefdom": "Mountain Rural"
      },
      "status": {
        "isDisputed": false,
        "requiresFieldVerification": false,
        "dataQuality": "high"
      }
    },
    "confidence": 0.85,
    "conflicts": {
      "nameVariations": [],
      "missingFields": ["coordinates"]
    },
    "suggestions": [
      "Capture GPS coordinates through field mapping"
    ]
  }
}
```

#### GET /api/v1/government/search/unified
Search across all government sources and return unified results.

**Query Parameters:**
- `ownerName` - Owner's name (required if district not provided)
- `district` - District (required if ownerName not provided)
- `limit` - Results per page
- `offset` - Pagination offset

#### GET /api/v1/government/health
Check health status of all government integrations.

#### GET /api/v1/government/districts
Get list of all 16 districts in Sierra Leone.

---

### 📦 Land Parcels

#### GET /api/v1/parcels
List all land parcels.

#### POST /api/v1/parcels
Create a new land parcel.

#### GET /api/v1/parcels/:id
Get details of a specific parcel.

#### PUT /api/v1/parcels/:id
Update parcel information.

#### DELETE /api/v1/parcels/:id
Delete a parcel (admin only).

---

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": "Error message",
  "details": [] // Optional validation errors
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

- 100 requests per minute per IP for authenticated users
- 20 requests per minute per IP for unauthenticated users

## Pagination

List endpoints support pagination:
- `limit` - Number of results (max: 100)
- `offset` - Skip this many results

Response includes pagination metadata:
```json
{
  "pagination": {
    "total": 250,
    "limit": 10,
    "offset": 20,
    "hasMore": true
  }
}
```
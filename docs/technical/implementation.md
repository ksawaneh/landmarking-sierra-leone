# LandMarking - Technical Documentation

## System Architecture

The LandMarking system is built with the following technology stack:

- **Frontend**: Next.js with TypeScript, TailwindCSS
- **Backend**: Cloudflare Workers with TypeScript
- **Data Storage**: 
  - Primary: PostgreSQL with PostGIS (planned)
  - Client-side: IndexedDB (for offline support)
- **Authentication**: JWT-based authentication

The application is designed as a Progressive Web App (PWA) with offline capabilities to support use in areas with limited connectivity.

## Core Components

### Frontend

#### Pages
- **Dashboard**: Main landing page showing parcel listings
- **Parcel Detail**: Shows comprehensive information about a land parcel
- **Parcel Creation**: Multi-step form for registering new land parcels
- **Parcel Verification**: Community verification workflow
- **Document Management**: Upload and manage supporting documents
- **Login**: Authentication page

#### Components
- **MapComponent**: Map visualization using Leaflet (loaded dynamically)
- **DocumentUpload**: Document uploader with drag-and-drop functionality
- **AiBoundaryDetection**: AI-assisted boundary detection interface
- **OfflineIndicator**: Status indicator for offline mode
- **Layout**: Common layout wrapper with header and footer

#### Services
- **parcelService**: API client for parcel CRUD operations
- **syncService**: Synchronization service for offline-to-online data flow
- **offlineSync**: Offline data caching mechanism
- **aiService**: AI-assisted boundary detection and land analysis

### Backend

#### API Endpoints

```
GET    /parcels                  - List all parcels
POST   /parcels                  - Create a new parcel
GET    /parcels/:id              - Get parcel details
PATCH  /parcels/:id              - Update a parcel
DELETE /parcels/:id              - Delete a parcel
POST   /parcels/:id/verify       - Verify a parcel
GET    /parcels/:id/documents    - List documents for a parcel
POST   /parcels/:id/documents    - Upload document for a parcel
DELETE /parcels/:id/documents/:docId - Delete a document
```

#### Authentication

Authentication is handled using JWT tokens. When a user logs in, they receive a token that is stored in local storage and included in the `Authorization` header for API requests.

## Key Features Implementation

### 1. Offline Support

Offline support is implemented using a combination of:

- **Service Worker**: Caches static assets and API responses
- **IndexedDB**: Stores data locally when offline
- **Sync Queue**: Queues operations performed while offline
- **syncService**: Synchronizes local data with the server once back online

```typescript
// Simplified implementation of offline sync
export async function createParcelWithOfflineSupport(data: CreateParcelPayload) {
  if (!navigator.onLine) {
    // Store in local queue for syncing later
    await addToSyncQueue({
      type: 'CREATE_PARCEL',
      data
    });
    return generateLocalResponse(data);
  } else {
    // Regular online flow
    return api.post('/parcels', data);
  }
}
```

### 2. Community Verification Workflow

The verification workflow is a multi-step process:

1. **Review**: User reviews the parcel details
2. **Witnesses**: User adds witness information and digital signature
3. **Confirmation**: User confirms and submits the verification

The status of a parcel is updated based on the verification decision (approve or dispute). Witness information and signature data are stored as metadata.

```typescript
// Example verification data structure
const verificationData = {
  comments: string,
  verification_type: 'community' | 'authority' | 'government',
  status: 'verified' | 'disputed',
  metadata: {
    witness_names: string[],
    signature: string,
    verified_by: string,
    verification_date: string
  }
};
```

### 3. Document Upload

Document management allows users to upload evidence to support land claims:

- Support for multiple file formats (images, PDFs)
- Drag-and-drop interface
- Offline queuing of uploads
- Status tracking of documents (pending, verified, rejected)

The upload component has built-in validation for file types and sizes, with error messaging.

### 4. AI-Assisted Boundary Detection

AI boundary detection allows users to:

1. Detect land boundaries from coordinates
2. Improve existing boundaries
3. Analyze land use based on the geometry

The implementation simulates AI functionality with mock data, but is structured to integrate with actual AI services:

```typescript
// AI service for boundary detection
async detectBoundaries(latitude, longitude, radius) {
  // In a real implementation, this would call an external AI service API
  // Currently simulated with mock data
  return {
    geometry: { type: 'Polygon', coordinates: [...] },
    confidence: 0.87,
    processingTimeMs: 1243
  };
}
```

## Data Models

### Parcel

```typescript
type Parcel = {
  id: string;
  parcel_number: string;
  status: 'draft' | 'pending' | 'verified' | 'disputed' | 'rejected';
  land_use: string;
  area_sqm: number;
  created_at: string;
  created_by: string;
  geometry: {
    type: string;
    coordinates: any;
  };
  metadata?: Record<string, any>;
  documents?: Document[];
};
```

### Document

```typescript
type Document = {
  id: string;
  parcel_id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  upload_date: string;
  status: 'pending' | 'verified' | 'rejected';
  metadata?: Record<string, any>;
};
```

## State Management

The application uses React's built-in state management (useState, useEffect) for most components. Context API is used for global state such as authentication.

Authentication state is managed in `AuthContext.tsx`:

```typescript
// Sample of the AuthContext
export const AuthContext = createContext<{
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  login: async () => {},
  logout: () => {}
});
```

## Internationalization

Internationalization is implemented using `next-i18next`. Translation files are stored in `/public/locales/[lang]/common.json`.

## PWA Setup

The application is configured as a Progressive Web App with:

- **manifest.json**: App installation information
- **Service Worker**: For offline caching and background sync
- **IndexedDB**: For local data storage

## Future Developments

Planned technical improvements include:

1. **Real AI integration**: Replace mock AI services with actual AI APIs
2. **Authentication Enhancements**: Add role-based permissions
3. **Database Implementation**: Full PostgreSQL/PostGIS database integration
4. **Mobile App**: Native mobile app using React Native
5. **Blockchain Integration**: For immutable record-keeping of verified parcels
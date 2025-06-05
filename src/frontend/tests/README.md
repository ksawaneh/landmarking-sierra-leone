# LandMarking Application Testing Guide

This guide provides instructions for testing the LandMarking application's key components: offline synchronization, map functionality, verification workflow, and AI boundary detection.

## Prerequisites

- Node.js 16+ installed
- Yarn or npm installed
- Access to the project source code

## Setup

1. Install dependencies:
   ```bash
   yarn install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```

3. Edit `.env.local` to configure the test environment:
   ```
   # For testing offline functionality
   NEXT_PUBLIC_API_URL=http://localhost:8000
   
   # For testing AI with mock mode enabled
   NEXT_PUBLIC_AI_MOCK_MODE=true
   NEXT_PUBLIC_AI_API_URL=http://localhost:8001
   
   # For testing blockchain with mock mode
   NEXT_PUBLIC_BLOCKCHAIN_MOCK_MODE=true
   ```

## Running Tests

We have created test suites for the major components. Run them to verify functionality:

```bash
# Run all tests
yarn test

# Run specific test suites
yarn test offlineSync
yarn test syncService
yarn test MapComponent
yarn test AiBoundaryDetection
yarn test verification
```

## Manual Testing Plan

### 1. Testing Offline Synchronization

1. **Network Simulation Tool**

   Create a simple script to toggle the application between online and offline modes. Create a file called `network-toggle.js` in the public folder:

   ```javascript
   // public/network-toggle.js
   
   // Function to toggle network state
   function toggleNetwork() {
     const status = document.getElementById('network-status');
     
     if (navigator.onLine) {
       // Force offline
       (navigator as any).connection.dispatchEvent(new Event('offline'));
       window.dispatchEvent(new Event('offline'));
       status.innerText = 'OFFLINE (Simulated)';
       status.style.backgroundColor = '#FEE2E2';
     } else {
       // Force online
       (navigator as any).connection.dispatchEvent(new Event('online'));
       window.dispatchEvent(new Event('online'));
       status.innerText = 'ONLINE';
       status.style.backgroundColor = '#D1FAE5';
     }
   }
   
   // Add network status indicator and toggle button
   document.addEventListener('DOMContentLoaded', () => {
     const div = document.createElement('div');
     div.style.position = 'fixed';
     div.style.bottom = '20px';
     div.style.right = '20px';
     div.style.zIndex = '9999';
     div.style.display = 'flex';
     div.style.alignItems = 'center';
     div.style.gap = '10px';
     
     const status = document.createElement('div');
     status.id = 'network-status';
     status.innerText = navigator.onLine ? 'ONLINE' : 'OFFLINE';
     status.style.padding = '5px 10px';
     status.style.borderRadius = '5px';
     status.style.fontWeight = 'bold';
     status.style.backgroundColor = navigator.onLine ? '#D1FAE5' : '#FEE2E2';
     
     const button = document.createElement('button');
     button.innerText = 'Toggle Network';
     button.style.padding = '5px 10px';
     button.style.borderRadius = '5px';
     button.style.backgroundColor = '#E0E7FF';
     button.style.cursor = 'pointer';
     button.onclick = toggleNetwork;
     
     div.appendChild(status);
     div.appendChild(button);
     document.body.appendChild(div);
   });
   ```

   Include this script in your `_app.tsx` file:

   ```tsx
   // In _app.tsx
   useEffect(() => {
     if (process.env.NODE_ENV === 'development') {
       const script = document.createElement('script');
       script.src = '/network-toggle.js';
       script.async = true;
       document.body.appendChild(script);
     }
   }, []);
   ```

2. **Testing Scenarios**

   1. **Create a New Parcel While Offline**:
      - Use the network toggle to go offline
      - Create a new parcel with boundary and details
      - Check local storage for pending operations
      - Toggle back online and verify sync happens
      - Confirm the parcel appears on the server

   2. **Edit an Existing Parcel While Offline**:
      - View an existing parcel
      - Go offline using the toggle
      - Make changes to boundary or details
      - Check local storage for pending operations
      - Go back online and verify sync
      - Confirm changes appear on server

   3. **Verify a Parcel While Offline**:
      - Go to verification workflow for a parcel
      - Go offline
      - Complete verification with signatures
      - Check local storage for pending operations
      - Go back online and verify sync
      - Confirm verification status on server

   4. **Conflict Handling**:
      - Have two browsers open to the same parcel
      - Make Browser A go offline
      - Make changes in Browser A
      - Make different changes to the same parcel in Browser B
      - Bring Browser A back online
      - Verify conflict resolution preserves important data

### 2. Testing Map Component

1. **Testing GPS Integration**:
   - Enable browser location sharing
   - Go to map component
   - Click GPS tracking button
   - Verify current location is shown
   - Move around and verify tracking works

2. **Testing Boundary Creation**:
   - Use Sierra Leone coordinates (e.g., 8.4657, -13.2317)
   - Create a polygon boundary
   - Save and verify geometry is stored correctly

3. **Testing Satellite Imagery**:
   - Switch between map styles (standard, satellite, terrain)
   - Verify satellite imagery loads in Sierra Leone regions
   - Validate performance with different zoom levels

### 3. Testing AI Boundary Detection

1. **Testing with Mock Mode**:
   - Set `NEXT_PUBLIC_AI_MOCK_MODE=true`
   - Test boundary detection with coordinates
   - Verify mock response with polygon
   - Test boundary improvement function

2. **Testing Progress Reporting**:
   - Verify progress updates during processing
   - Check error handling when providing invalid input

### 4. Testing Document Management

1. **Testing Document Upload**:
   - Upload different document types (PDF, JPG, PNG, DOC)
   - Add metadata to documents
   - Verify storage and retrieval

2. **Testing Offline Document Handling**:
   - Go offline
   - Upload documents
   - Add metadata
   - Go online and verify sync
   - Confirm documents appear with correct metadata

### 5. Testing Blockchain Integration

1. **Testing Transaction Creation**:
   - Create a new parcel to trigger blockchain transaction
   - Verify transaction is recorded locally
   - Check transaction details and hash

2. **Testing Transaction Verification**:
   - Retrieve transaction history for a parcel
   - Verify transaction signatures and chain of custody
   - Test validation of transaction authenticity

## Testing Environment Variables

Create different environment configurations for testing:

1. **Full Mock Mode** (`.env.test.mock`):
   ```
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_AI_MOCK_MODE=true
   NEXT_PUBLIC_BLOCKCHAIN_MOCK_MODE=true
   ```

2. **Offline Testing** (`.env.test.offline`):
   ```
   NEXT_PUBLIC_OFFLINE_DEFAULT=true
   ```

3. **Integration Testing** (`.env.test.integration`):
   ```
   NEXT_PUBLIC_API_URL=https://dev-api.landmarking.org
   NEXT_PUBLIC_AI_API_URL=https://dev-ai.landmarking.org
   ```

## Performance Testing

Test application performance in various conditions:

1. **Bandwidth Throttling**:
   - Use browser dev tools to simulate slow connections
   - Verify application functions with 3G/Edge speeds

2. **Memory Usage Monitoring**:
   - Track memory usage with large datasets
   - Verify no memory leaks occur during prolonged use

3. **Offline Storage Limits**:
   - Test with large numbers of offline changes
   - Validate behavior when approaching local storage limits

## Bug Reporting

When encountering issues during testing, please provide:

1. Detailed steps to reproduce
2. Environment information (browser, OS, network conditions)
3. Screenshots or screen recordings if possible
4. Console logs and errors

Report bugs via the project's issue tracker with the tag `[TEST]`.
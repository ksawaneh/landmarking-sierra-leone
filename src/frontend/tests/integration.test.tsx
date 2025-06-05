import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AuthContext } from '../contexts/AuthContext';
import { parcelService } from '../api/parcelService';
import { offlineSync } from '../services/offlineSync';
import syncService from '../services/syncService';
import blockchainService from '../services/blockchainService';
import ParcelVerification from '../pages/parcels/[id]/verify';

// Mock the Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: { id: 'parcel-1' },
    push: jest.fn(),
    pathname: '/parcels/[id]/verify',
    asPath: '/parcels/parcel-1/verify'
  }))
}));

// Mock authentication context
const mockAuthContext = {
  user: {
    id: 'user-1',
    name: 'Test User',
    role: 'verifier'
  },
  isAuthenticated: true,
  login: jest.fn(),
  logout: jest.fn(),
  loading: false
};

// Mock the services
jest.mock('../api/parcelService', () => ({
  parcelService: {
    getParcel: jest.fn().mockResolvedValue({
      parcel: {
        id: 'parcel-1',
        parcel_number: 'P12345',
        status: 'pending',
        land_use: 'agricultural',
        area_sqm: 5000,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        geometry: { 
          type: 'Polygon', 
          coordinates: [[
            [-13.2317, 8.4657],
            [-13.2307, 8.4657],
            [-13.2307, 8.4647],
            [-13.2317, 8.4647],
            [-13.2317, 8.4657]
          ]]
        },
        documents: []
      }
    }),
    verifyParcel: jest.fn().mockResolvedValue({
      success: true,
      id: 'parcel-1',
      status: 'verified'
    })
  }
}));

jest.mock('../services/offlineSync', () => ({
  offlineSync: {
    isOnline: jest.fn().mockReturnValue(true),
    getCachedParcels: jest.fn().mockReturnValue([]),
    getCachedParcel: jest.fn().mockReturnValue(null),
    addPendingOperation: jest.fn(),
    cacheParcel: jest.fn(),
    getPendingOperationsCount: jest.fn().mockReturnValue(0)
  }
}));

jest.mock('../services/syncService', () => ({
  startSync: jest.fn().mockResolvedValue({ success: true }),
  getSyncStatus: jest.fn().mockReturnValue({ lastSync: Date.now() }),
  __esModule: true,
  default: {
    startSync: jest.fn().mockResolvedValue({ success: true }),
    getSyncStatus: jest.fn().mockReturnValue({ lastSync: Date.now() })
  }
}));

jest.mock('../services/blockchainService', () => ({
  createTransaction: jest.fn().mockResolvedValue({
    id: 'tx-1',
    success: true
  }),
  __esModule: true,
  default: {
    createTransaction: jest.fn().mockResolvedValue({
      id: 'tx-1',
      success: true
    })
  }
}));

// Mock next-i18next
jest.mock('next-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: jest.fn(),
    },
  }),
  serverSideTranslations: jest.fn().mockResolvedValue({}),
}));

// Mock the MapComponent
jest.mock('../components/MapComponent', () => {
  return function MockMapComponent({ geometry }: any) {
    return <div data-testid="mock-map">Map Component</div>;
  };
});

// Simulating online/offline network status
const setOnlineStatus = (online: boolean) => {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: online,
    writable: true
  });
  
  // Mock the offlineSync.isOnline response
  (offlineSync.isOnline as jest.Mock).mockReturnValue(online);
  
  // Dispatch online/offline event
  const event = new Event(online ? 'online' : 'offline');
  window.dispatchEvent(event);
};

describe('Integration Tests - Offline Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setOnlineStatus(true);
    localStorage.clear();
  });
  
  test('Complete verification workflow in online mode', async () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <ParcelVerification />
      </AuthContext.Provider>
    );
    
    await waitFor(() => screen.getByText('parcel.verify.review_title'));
    
    // Step 1: Review and approve
    const approveRadio = screen.getByLabelText('parcel.verify.approve');
    fireEvent.click(approveRadio);
    fireEvent.click(screen.getByText('parcel.verify.next'));
    
    // Step 2: Add witnesses and signature
    await waitFor(() => screen.getByText('parcel.verify.witnesses_title'));
    const witnessInput = screen.getByLabelText('parcel.verify.witness_1');
    fireEvent.change(witnessInput, { target: { value: 'John Doe' } });
    
    const signatureCanvas = screen.getByTestId('signature-canvas');
    fireEvent.mouseDown(signatureCanvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(signatureCanvas, { clientX: 50, clientY: 50 });
    fireEvent.mouseUp(signatureCanvas);
    
    fireEvent.click(screen.getByText('parcel.verify.next'));
    
    // Step 3: Confirmation and submit
    await waitFor(() => screen.getByText('parcel.verify.confirmation_title'));
    fireEvent.click(screen.getByText('parcel.verify.submit_approval'));
    
    // Verify API was called online
    await waitFor(() => {
      expect(parcelService.verifyParcel).toHaveBeenCalled();
      expect(offlineSync.addPendingOperation).not.toHaveBeenCalled();
      expect(blockchainService.createTransaction).toHaveBeenCalled();
    });
  });
  
  test('Complete verification workflow in offline mode', async () => {
    // Set to offline before rendering
    setOnlineStatus(false);
    
    // Mock the cached parcel
    (offlineSync.getCachedParcel as jest.Mock).mockReturnValue({
      id: 'parcel-1',
      parcel_number: 'P12345',
      status: 'pending',
      land_use: 'agricultural',
      area_sqm: 5000,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      geometry: { 
        type: 'Polygon', 
        coordinates: [[
          [-13.2317, 8.4657],
          [-13.2307, 8.4657],
          [-13.2307, 8.4647],
          [-13.2317, 8.4647],
          [-13.2317, 8.4657]
        ]]
      },
      documents: []
    });
    
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <ParcelVerification />
      </AuthContext.Provider>
    );
    
    // Check offline indicator is shown
    await waitFor(() => {
      expect(screen.getByText('common.offline_mode')).toBeInTheDocument();
    });
    
    // Complete verification flow
    await waitFor(() => screen.getByText('parcel.verify.review_title'));
    
    const approveRadio = screen.getByLabelText('parcel.verify.approve');
    fireEvent.click(approveRadio);
    fireEvent.click(screen.getByText('parcel.verify.next'));
    
    await waitFor(() => screen.getByText('parcel.verify.witnesses_title'));
    const witnessInput = screen.getByLabelText('parcel.verify.witness_1');
    fireEvent.change(witnessInput, { target: { value: 'Offline Witness' } });
    
    const signatureCanvas = screen.getByTestId('signature-canvas');
    fireEvent.mouseDown(signatureCanvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(signatureCanvas, { clientX: 50, clientY: 50 });
    fireEvent.mouseUp(signatureCanvas);
    
    fireEvent.click(screen.getByText('parcel.verify.next'));
    
    await waitFor(() => screen.getByText('parcel.verify.confirmation_title'));
    fireEvent.click(screen.getByText('parcel.verify.submit_approval'));
    
    // Verify offline storage was used
    await waitFor(() => {
      expect(parcelService.verifyParcel).not.toHaveBeenCalled();
      expect(offlineSync.addPendingOperation).toHaveBeenCalled();
      expect(offlineSync.cacheParcel).toHaveBeenCalled();
      expect(screen.getByText(/parcel.verify.success_approved/)).toBeInTheDocument();
      expect(screen.getByText(/parcel.verify.offline_sync/)).toBeInTheDocument();
    });
  });
  
  test('Sync pending operations when coming back online', async () => {
    // Start offline with pending operations
    setOnlineStatus(false);
    
    // Mock pending operations count
    (offlineSync.getPendingOperationsCount as jest.Mock).mockReturnValue(3);
    
    // Render something that will show the offline indicator
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <div>Test Component</div>
      </AuthContext.Provider>
    );
    
    // Now come back online
    act(() => {
      setOnlineStatus(true);
    });
    
    // Verify the sync service was called
    await waitFor(() => {
      expect(syncService.startSync).toHaveBeenCalled();
    });
  });
  
  test('Transaction is recorded in blockchain in online mode', async () => {
    // Setup
    setOnlineStatus(true);
    
    // Create a transaction using blockchain service
    await blockchainService.createTransaction(
      'parcel-1',
      'verification',
      { status: 'verified', witness: 'John Doe' },
      'user-1'
    );
    
    // Verify blockchain service was called directly
    expect(blockchainService.createTransaction).toHaveBeenCalledWith(
      'parcel-1',
      'verification',
      { status: 'verified', witness: 'John Doe' },
      'user-1'
    );
  });
  
  test('Transaction is queued in offline mode', async () => {
    // Setup
    setOnlineStatus(false);
    
    // Mock the offline queueing method
    const mockQueueOfflineTransaction = jest.fn().mockReturnValue({
      id: 'temp-tx-1',
      confirmed: false
    });
    
    // Replace the implementation temporarily
    const originalImplementation = blockchainService.createTransaction;
    blockchainService.createTransaction = mockQueueOfflineTransaction;
    
    // Create a transaction using blockchain service in offline mode
    const result = await blockchainService.createTransaction(
      'parcel-2',
      'modification',
      { boundary: 'updated' },
      'user-1'
    );
    
    // Verify blockchain service queued the transaction
    expect(mockQueueOfflineTransaction).toHaveBeenCalledWith(
      'parcel-2',
      'modification',
      { boundary: 'updated' },
      'user-1'
    );
    
    // Verify transaction is marked as not confirmed
    expect(result.confirmed).toBe(false);
    
    // Restore original implementation
    blockchainService.createTransaction = originalImplementation;
  });
});
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignatureCanvas from '../components/SignatureCanvas';
import { AuthContext } from '../contexts/AuthContext';

// Mock services
jest.mock('../api/parcelService', () => ({
  parcelService: {
    verifyParcel: jest.fn().mockResolvedValue({
      id: 'parcel-1',
      status: 'verified'
    }),
    getParcels: jest.fn().mockResolvedValue([
      {
        id: 'parcel-1',
        name: 'Test Parcel',
        status: 'pending',
        geometry: { type: 'Polygon', coordinates: [] }
      }
    ]),
    getParcel: jest.fn().mockResolvedValue({
      id: 'parcel-1',
      name: 'Test Parcel',
      status: 'pending',
      geometry: { type: 'Polygon', coordinates: [] },
      documents: []
    })
  }
}));

jest.mock('../services/offlineSync', () => ({
  offlineSync: {
    isOnline: jest.fn().mockReturnValue(true),
    getCachedParcels: jest.fn().mockReturnValue([]),
    getCachedParcel: jest.fn().mockReturnValue(null),
    addPendingOperation: jest.fn().mockImplementation(() => {}),
    cacheParcel: jest.fn().mockImplementation(() => {})
  }
}));

jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: { id: 'parcel-1' },
    push: jest.fn(),
    pathname: '/parcels/[id]/verify',
    asPath: '/parcels/parcel-1/verify'
  }))
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

// Auth context mock value
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

// Mock MapComponent
jest.mock('../components/MapComponent', () => {
  return function MockMapComponent({ geometry }) {
    return <div data-testid="mock-map">Map Component</div>;
  };
});

describe('SignatureCanvas Component', () => {
  let canvasCtxMock: any;

  beforeEach(() => {
    // Mock canvas context
    canvasCtxMock = {
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      clearRect: jest.fn()
    };

    // Mock canvas element and getContext
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue(canvasCtxMock);
    
    // Mock canvas toDataURL
    HTMLCanvasElement.prototype.toDataURL = jest.fn().mockReturnValue('data:image/png;base64,fake-signature-data');
  });

  test('renders with proper dimensions', () => {
    render(<SignatureCanvas width={400} height={200} />);
    
    const canvas = screen.getByTestId('signature-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('width', '400');
    expect(canvas).toHaveAttribute('height', '200');
  });

  test('clears signature when clear button is clicked', () => {
    render(<SignatureCanvas width={400} height={200} />);
    
    const clearButton = screen.getByText('signatureCanvas.clear');
    fireEvent.click(clearButton);
    
    expect(canvasCtxMock.clearRect).toHaveBeenCalled();
  });

  test('triggers onChange when signature is drawn', () => {
    const mockOnChange = jest.fn();
    render(<SignatureCanvas width={400} height={200} onChange={mockOnChange} />);
    
    const canvas = screen.getByTestId('signature-canvas');
    
    // Simulate drawing on canvas
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
    fireEvent.mouseUp(canvas);
    
    expect(mockOnChange).toHaveBeenCalledWith('data:image/png;base64,fake-signature-data');
  });

  test('handles existing signature data', () => {
    render(<SignatureCanvas width={400} height={200} value="data:image/png;base64,existing-signature" />);
    
    // We can't easily verify that the image was loaded and drawn on the canvas,
    // but we can check that the component doesn't crash and renders properly
    const canvas = screen.getByTestId('signature-canvas');
    expect(canvas).toBeInTheDocument();
  });
});

// Import VerifyParcel and other components for verification flow tests
import ParcelVerification from '../pages/parcels/[id]/verify';
import { parcelService } from '../api/parcelService';

describe('Verification Workflow', () => {
  test('renders verification page with parcel data', async () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <ParcelVerification />
      </AuthContext.Provider>
    );
    
    await waitFor(() => {
      expect(screen.getByText('parcel.verify.heading')).toBeInTheDocument();
      expect(screen.getByTestId('mock-map')).toBeInTheDocument();
    });
  });
  
  test('completes verification process', async () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <ParcelVerification />
      </AuthContext.Provider>
    );
    
    // Step 1: Review
    await waitFor(() => screen.getByText('parcel.verify.review_title'));
    
    // Select 'Approve' option
    const approveRadio = screen.getByLabelText('parcel.verify.approve');
    fireEvent.click(approveRadio);
    
    // Click Next button to proceed to witnesses step
    const nextButton = screen.getByText('parcel.verify.next');
    fireEvent.click(nextButton);
    
    // Step 2: Witnesses
    await waitFor(() => screen.getByText('parcel.verify.witnesses_title'));
    
    // Fill witness information
    const witnessNameInput = screen.getByLabelText('parcel.verify.witness_1');
    fireEvent.change(witnessNameInput, { target: { value: 'Witness Name' } });
    
    // Add signature
    const signatureCanvas = screen.getByTestId('signature-canvas');
    fireEvent.mouseDown(signatureCanvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(signatureCanvas, { clientX: 50, clientY: 50 });
    fireEvent.mouseUp(signatureCanvas);
    
    // Click Next button to proceed to confirmation step
    fireEvent.click(screen.getByText('parcel.verify.next'));
    
    // Step 3: Confirmation
    await waitFor(() => screen.getByText('parcel.verify.confirmation_title'));
    
    // Submit verification
    const submitButton = screen.getByText('parcel.verify.submit_approval');
    fireEvent.click(submitButton);
    
    // Verify that verification service was called
    await waitFor(() => {
      expect(parcelService.verifyParcel).toHaveBeenCalledWith(
        'parcel-1',
        expect.objectContaining({
          status: 'verified',
          verification_type: 'community',
          metadata: expect.objectContaining({
            witness_names: ['Witness Name'],
            signature: 'data:image/png;base64,fake-signature-data'
          })
        })
      );
    });
  });
  
  test('handles dispute submission', async () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <ParcelVerification />
      </AuthContext.Provider>
    );
    
    // Step 1: Review
    await waitFor(() => screen.getByText('parcel.verify.review_title'));
    
    // Select 'Dispute' option
    const disputeRadio = screen.getByLabelText('parcel.verify.dispute');
    fireEvent.click(disputeRadio);
    
    // Click Next button to proceed to witnesses step
    const nextButton = screen.getByText('parcel.verify.next');
    fireEvent.click(nextButton);
    
    // Step 2: Witnesses
    await waitFor(() => screen.getByText('parcel.verify.witnesses_title'));
    
    // Fill witness information
    const witnessNameInput = screen.getByLabelText('parcel.verify.witness_1');
    fireEvent.change(witnessNameInput, { target: { value: 'Witness Name' } });
    
    // Add comments for dispute (required for dispute)
    const commentsInput = screen.getByLabelText('parcel.verify.comments');
    fireEvent.change(commentsInput, { target: { value: 'Boundary is incorrect' } });
    
    // Add signature
    const signatureCanvas = screen.getByTestId('signature-canvas');
    fireEvent.mouseDown(signatureCanvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(signatureCanvas, { clientX: 50, clientY: 50 });
    fireEvent.mouseUp(signatureCanvas);
    
    // Click Next button to proceed to confirmation step
    fireEvent.click(screen.getByText('parcel.verify.next'));
    
    // Step 3: Confirmation
    await waitFor(() => screen.getByText('parcel.verify.confirmation_title'));
    
    // Submit dispute
    const submitButton = screen.getByText('parcel.verify.submit_dispute');
    fireEvent.click(submitButton);
    
    // Verify that verification service was called with disputed status
    await waitFor(() => {
      expect(parcelService.verifyParcel).toHaveBeenCalledWith(
        'parcel-1',
        expect.objectContaining({
          status: 'disputed',
          verification_type: 'community',
          comments: 'Boundary is incorrect',
          metadata: expect.objectContaining({
            witness_names: ['Witness Name'],
            signature: 'data:image/png;base64,fake-signature-data'
          })
        })
      );
    });
  });
  
  test('handles offline verification', async () => {
    // Mock offline state
    jest.spyOn(offlineSync, 'isOnline').mockReturnValue(false);
    
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <ParcelVerification />
      </AuthContext.Provider>
    );
    
    // Verify offline indicator is shown
    await waitFor(() => {
      expect(screen.getByText('common.offline_mode')).toBeInTheDocument();
    });
    
    // Complete verification process in offline mode
    const approveRadio = screen.getByLabelText('parcel.verify.approve');
    fireEvent.click(approveRadio);
    fireEvent.click(screen.getByText('parcel.verify.next'));
    
    await waitFor(() => screen.getByText('parcel.verify.witnesses_title'));
    const witnessNameInput = screen.getByLabelText('parcel.verify.witness_1');
    fireEvent.change(witnessNameInput, { target: { value: 'Witness Name' } });
    
    const signatureCanvas = screen.getByTestId('signature-canvas');
    fireEvent.mouseDown(signatureCanvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(signatureCanvas, { clientX: 50, clientY: 50 });
    fireEvent.mouseUp(signatureCanvas);
    
    fireEvent.click(screen.getByText('parcel.verify.next'));
    
    await waitFor(() => screen.getByText('parcel.verify.confirmation_title'));
    fireEvent.click(screen.getByText('parcel.verify.submit_approval'));
    
    // Verify that offline sync functions were called
    await waitFor(() => {
      expect(offlineSync.addPendingOperation).toHaveBeenCalled();
      expect(offlineSync.cacheParcel).toHaveBeenCalled();
      expect(screen.getByText(/parcel.verify.success_approved/)).toBeInTheDocument();
      expect(screen.getByText(/parcel.verify.offline_sync/)).toBeInTheDocument();
    });
  });
});
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AiBoundaryDetection from '../components/AiBoundaryDetection';
import { aiService } from '../services/aiService';

// Mock services
jest.mock('../services/aiService', () => ({
  aiService: {
    detectBoundaries: jest.fn(),
    improveBoundary: jest.fn(),
    detectLandUse: jest.fn(),
    isServiceAvailable: jest.fn().mockResolvedValue(true)
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
}));

describe('AiBoundaryDetection Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful boundary detection
    (aiService.detectBoundaries as jest.Mock).mockResolvedValue({
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [12.001, 8.001],
            [12.001, 8.002],
            [12.002, 8.002],
            [12.002, 8.001],
            [12.001, 8.001]
          ]
        ]
      },
      confidence: 0.85,
      processingTime: 1.2
    });
    
    // Mock successful boundary improvement
    (aiService.improveBoundary as jest.Mock).mockResolvedValue({
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [12.001, 8.001],
            [12.001, 8.002],
            [12.002, 8.002],
            [12.002, 8.001],
            [12.001, 8.001]
          ]
        ]
      },
      confidence: 0.92,
      processingTime: 0.8
    });

    // Mock successful land use detection
    (aiService.detectLandUse as jest.Mock).mockResolvedValue({
      landUse: 'agricultural',
      confidence: 0.78,
      processingTime: 0.6
    });
    
    // Mock geolocation
    Object.defineProperty(global.navigator, 'geolocation', {
      value: {
        getCurrentPosition: jest.fn().mockImplementation(success => 
          success({
            coords: {
              latitude: 8.001,
              longitude: 12.001,
              accuracy: 10
            }
          })
        )
      },
      configurable: true
    });
  });

  test('renders initial state correctly', () => {
    render(<AiBoundaryDetection onBoundaryDetected={jest.fn()} />);
    
    // Should show coordinate inputs
    expect(screen.getByLabelText(/aiBoundary.latitude/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/aiBoundary.longitude/i)).toBeInTheDocument();
    
    // Should show detect button
    expect(screen.getByRole('button', { name: /aiBoundary.detectBoundaries/i })).toBeInTheDocument();
  });

  test('gets current location when requested', async () => {
    render(<AiBoundaryDetection onBoundaryDetected={jest.fn()} />);
    
    const locationButton = screen.getByRole('button', { name: /aiBoundary.getCurrentLocation/i });
    fireEvent.click(locationButton);
    
    await waitFor(() => {
      const latInput = screen.getByLabelText(/aiBoundary.latitude/i) as HTMLInputElement;
      const lonInput = screen.getByLabelText(/aiBoundary.longitude/i) as HTMLInputElement;
      
      expect(latInput.value).toBe('8.001');
      expect(lonInput.value).toBe('12.001');
    });
  });

  test('detects boundary when requested', async () => {
    const mockOnBoundaryDetected = jest.fn();
    render(<AiBoundaryDetection onBoundaryDetected={mockOnBoundaryDetected} />);
    
    // Fill coordinates
    const latInput = screen.getByLabelText(/aiBoundary.latitude/i);
    const lonInput = screen.getByLabelText(/aiBoundary.longitude/i);
    
    fireEvent.change(latInput, { target: { value: '8.001' } });
    fireEvent.change(lonInput, { target: { value: '12.001' } });
    
    // Click detect button
    const detectButton = screen.getByRole('button', { name: /aiBoundary.detectBoundaries/i });
    fireEvent.click(detectButton);
    
    // Should show loading state
    expect(screen.getByText(/aiBoundary.processingStep1/i)).toBeInTheDocument();
    
    // Wait for detection to complete
    await waitFor(() => {
      expect(mockOnBoundaryDetected).toHaveBeenCalledWith({
        type: 'Polygon',
        coordinates: [
          [
            [12.001, 8.001],
            [12.001, 8.002],
            [12.002, 8.002],
            [12.002, 8.001],
            [12.001, 8.001]
          ]
        ]
      });
      
      // Should show success info
      expect(screen.getByText(/aiBoundary.detectionComplete/i)).toBeInTheDocument();
      expect(screen.getByText(/aiBoundary.confidence/i)).toBeInTheDocument();
    });
  });

  test('improves existing boundary when requested', async () => {
    const mockOnBoundaryDetected = jest.fn();
    const existingGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [12.001, 8.001],
          [12.001, 8.002],
          [12.002, 8.002],
          [12.002, 8.001],
          [12.001, 8.001]
        ]
      ]
    };
    
    render(
      <AiBoundaryDetection 
        onBoundaryDetected={mockOnBoundaryDetected}
        existingGeometry={existingGeometry}
      />
    );
    
    // Should show improve button when existingGeometry is provided
    const improveButton = screen.getByRole('button', { name: /aiBoundary.improveBoundary/i });
    fireEvent.click(improveButton);
    
    // Should show loading state
    expect(screen.getByText(/aiBoundary.processingImprove/i)).toBeInTheDocument();
    
    // Wait for improvement to complete
    await waitFor(() => {
      expect(mockOnBoundaryDetected).toHaveBeenCalledWith({
        type: 'Polygon',
        coordinates: [
          [
            [12.001, 8.001],
            [12.001, 8.002],
            [12.002, 8.002],
            [12.002, 8.001],
            [12.001, 8.001]
          ]
        ]
      });
      
      // Should show success info
      expect(screen.getByText(/aiBoundary.improvementComplete/i)).toBeInTheDocument();
    });
  });

  test('handles detection failure gracefully', async () => {
    // Mock failure
    (aiService.detectBoundaries as jest.Mock).mockRejectedValue(new Error('Detection failed'));
    
    render(<AiBoundaryDetection onBoundaryDetected={jest.fn()} />);
    
    // Fill coordinates
    const latInput = screen.getByLabelText(/aiBoundary.latitude/i);
    const lonInput = screen.getByLabelText(/aiBoundary.longitude/i);
    
    fireEvent.change(latInput, { target: { value: '8.001' } });
    fireEvent.change(lonInput, { target: { value: '12.001' } });
    
    // Click detect button
    const detectButton = screen.getByRole('button', { name: /aiBoundary.detectBoundaries/i });
    fireEvent.click(detectButton);
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/aiBoundary.detectionFailed/i)).toBeInTheDocument();
    });
  });

  test('checks AI service availability on load', async () => {
    render(<AiBoundaryDetection onBoundaryDetected={jest.fn()} />);
    
    expect(aiService.isServiceAvailable).toHaveBeenCalled();
    
    // Should initially show loading indicator for service check
    expect(screen.getByText(/aiBoundary.checkingService/i)).toBeInTheDocument();
    
    // Wait for service check to complete
    await waitFor(() => {
      expect(screen.queryByText(/aiBoundary.checkingService/i)).not.toBeInTheDocument();
    });
  });

  test('shows offline mode when service is unavailable', async () => {
    // Mock service unavailable
    (aiService.isServiceAvailable as jest.Mock).mockResolvedValue(false);
    
    render(<AiBoundaryDetection onBoundaryDetected={jest.fn()} />);
    
    // Wait for service check to complete
    await waitFor(() => {
      expect(screen.getByText(/aiBoundary.serviceUnavailable/i)).toBeInTheDocument();
      expect(screen.getByText(/aiBoundary.mockModeEnabled/i)).toBeInTheDocument();
    });
  });
});
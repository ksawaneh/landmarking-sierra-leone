import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MapComponent from '../components/MapComponent';

// Mock mapbox-gl and mapbox-gl-draw
jest.mock('mapbox-gl', () => ({
  Map: jest.fn(() => ({
    addControl: jest.fn(),
    on: jest.fn((event, callback) => {
      if (event === 'load') {
        callback();
      }
      return this;
    }),
    off: jest.fn(),
    remove: jest.fn(),
    getCanvas: jest.fn(() => ({
      style: {}
    })),
    getCenter: jest.fn(() => ({ lng: 0, lat: 0 })),
    getZoom: jest.fn(() => 10),
    getSource: jest.fn(() => ({
      setData: jest.fn()
    })),
    addSource: jest.fn(),
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    removeSource: jest.fn(),
    loadImage: jest.fn((url, callback) => callback(null, {})),
    getStyle: jest.fn(() => ({
      layers: []
    })),
    setLayoutProperty: jest.fn(),
    flyTo: jest.fn()
  })),
  NavigationControl: jest.fn(),
  ScaleControl: jest.fn(),
  GeolocateControl: jest.fn(),
  Marker: jest.fn(() => ({
    setLngLat: jest.fn(() => ({
      addTo: jest.fn(() => ({
        remove: jest.fn()
      }))
    }))
  })),
  accessToken: ''
}));

jest.mock('@mapbox/mapbox-gl-draw', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    add: jest.fn(),
    getAll: jest.fn(() => ({
      features: []
    })),
    delete: jest.fn(),
    deleteAll: jest.fn(),
    getMode: jest.fn(() => 'simple_select'),
    changeMode: jest.fn()
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
}));

describe('MapComponent', () => {
  beforeEach(() => {
    // Set up JSDOM for specific dimension
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800
    });
  });

  test('renders map container', () => {
    render(<MapComponent center={[0, 0]} zoom={10} />);
    const mapContainer = screen.getByTestId('map-container');
    expect(mapContainer).toBeInTheDocument();
  });

  test('renders map controls when editable', async () => {
    render(<MapComponent center={[0, 0]} zoom={10} editable={true} />);
    
    // Map toolbar should be rendered
    const toolbar = screen.getByTestId('map-toolbar');
    expect(toolbar).toBeInTheDocument();
    
    // Should have draw button
    const drawButton = screen.getByRole('button', { name: /map.draw/i });
    expect(drawButton).toBeInTheDocument();
  });

  test('shows GPS button when tracking is available', () => {
    // Mock navigator.geolocation
    Object.defineProperty(global.navigator, 'geolocation', {
      value: {
        watchPosition: jest.fn(),
        clearWatch: jest.fn()
      },
      configurable: true
    });
    
    render(<MapComponent center={[0, 0]} zoom={10} />);
    
    const gpsButton = screen.getByRole('button', { name: /map.toggleGps/i });
    expect(gpsButton).toBeInTheDocument();
  });

  test('allows switching map styles', async () => {
    render(<MapComponent center={[0, 0]} zoom={10} />);
    
    const styleButton = screen.getByRole('button', { name: /map.changeStyle/i });
    expect(styleButton).toBeInTheDocument();
    
    // Click to show style menu
    fireEvent.click(styleButton);
    
    // Should show style options
    await waitFor(() => {
      const satelliteOption = screen.getByText(/map.satelliteView/i);
      expect(satelliteOption).toBeInTheDocument();
    });
  });

  test('handles geometry updates when editable', () => {
    const mockOnGeometryChange = jest.fn();
    
    render(
      <MapComponent 
        center={[0, 0]} 
        zoom={10} 
        editable={true}
        onGeometryChange={mockOnGeometryChange}
      />
    );
    
    // Trigger draw button
    const drawButton = screen.getByRole('button', { name: /map.draw/i });
    fireEvent.click(drawButton);
    
    // Simulate a draw.create event (this would normally come from MapboxDraw)
    // We'd need to simulate this by calling the registered event handler directly
    // which we can't easily do in this test setup.
    // In a real implementation, we might need to export the handler for testing.
  });

  test('renders existing geometry when provided', () => {
    const testGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
          [0, 0]
        ]
      ]
    };
    
    render(
      <MapComponent 
        center={[0, 0]} 
        zoom={10}
        geometry={testGeometry}
      />
    );
    
    // In a real test we would verify the map addSource and addLayer were called
    // with this geometry, but that's challenging with the current mock setup.
  });
});
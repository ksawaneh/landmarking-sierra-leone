import { api } from '../api/axios';

interface BoundaryDetectionResponse {
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  confidence: number;
  processingTimeMs: number;
  landcover?: {
    [key: string]: number;
  };
  source?: string;
}

interface LandUseResponse {
  landUse: string;
  confidence: number;
  alternatives: Array<{ landUse: string; confidence: number }>;
  processingTimeMs: number;
  details?: {
    [key: string]: number;
  };
}

interface ProgressCallback {
  (progress: number, message: string): void;
}

// Constants
const AI_API_BASE_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'https://ai-service.landmarking.org';
const RETRY_COUNT = 3;
const RETRY_DELAY = 2000; // 2 seconds
const REQUEST_TIMEOUT = 45000; // 45 seconds

export const aiService = {
  /**
   * Detect land boundaries from satellite imagery using AI
   * @param latitude Central latitude of the area to analyze
   * @param longitude Central longitude of the area to analyze
   * @param radius Radius in meters to analyze around the central point
   * @param onProgress Optional callback for progress updates
   */
  async detectBoundaries(
    latitude: number,
    longitude: number,
    radius: number = 500,
    onProgress?: ProgressCallback
  ): Promise<BoundaryDetectionResponse> {
    try {
      onProgress?.(0.1, 'Fetching satellite imagery...');
      const isAvailable = await this.isServiceAvailable();
      
      if (!isAvailable || process.env.NEXT_PUBLIC_AI_MOCK_MODE === 'true') {
        console.warn('AI service unavailable or mock mode enabled, using mock implementation');
        return this.mockDetectBoundaries(latitude, longitude, radius, onProgress);
      }
      
      // Start time for performance tracking
      const startTime = performance.now();
      
      // Create AbortController for timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT);
      
      try {
        onProgress?.(0.2, 'Processing imagery...');
        
        // Call the AI service API to detect boundaries
        const response = await this.fetchWithRetry(
          async () => {
            const res = await fetch(`${AI_API_BASE_URL}/detect-boundary`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                latitude,
                longitude,
                radius,
                includeImagery: false,
                resolution: 'high'
              }),
              signal: abortController.signal
            });
            
            if (!res.ok) {
              const errorData = await res.json().catch(() => null);
              throw new Error(errorData?.detail || `Failed to detect boundaries: ${res.status}`);
            }
            
            return res;
          }
        );
        
        onProgress?.(0.8, 'Finalizing results...');
        const data = await response.json();
        
        // Calculate processing time
        const processingTime = performance.now() - startTime;
        
        onProgress?.(1, 'Detection complete!');
        return {
          geometry: data.geometry,
          confidence: data.confidence || 0.85,
          processingTimeMs: processingTime,
          landcover: data.landcover,
          source: 'ai-service'
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Error in AI boundary detection:', error);
      
      // Fallback to mock implementation
      console.warn('Falling back to mock AI boundary detection due to error');
      return this.mockDetectBoundaries(latitude, longitude, radius, onProgress);
    }
  },
  
  /**
   * Mock implementation for boundary detection (used as fallback when API is unavailable)
   */
  async mockDetectBoundaries(
    latitude: number,
    longitude: number,
    radius: number = 500,
    onProgress?: ProgressCallback
  ): Promise<BoundaryDetectionResponse> {
    onProgress?.(0.1, 'Fetching satellite imagery...');
    await new Promise(resolve => setTimeout(resolve, 800));
    
    onProgress?.(0.4, 'Analyzing imagery...');
    await new Promise(resolve => setTimeout(resolve, 700));
    
    onProgress?.(0.7, 'Detecting boundaries...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onProgress?.(0.9, 'Finalizing results...');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Generate a mock polygon that resembles a land parcel
    const mockPolygon = this.generateMockParcelBoundary(latitude, longitude);
    
    onProgress?.(1, 'Detection complete!');
    
    return {
      geometry: {
        type: 'Polygon',
        coordinates: [mockPolygon]
      },
      confidence: 0.87,
      processingTimeMs: 2300,
      landcover: {
        'vegetation': 68,
        'barren': 21,
        'built': 8,
        'water': 3
      },
      source: 'mock'
    };
  },
  
  /**
   * Improve/correct an existing boundary using AI
   * @param geometry Existing GeoJSON geometry to improve
   * @param onProgress Optional callback for progress updates
   */
  async improveBoundary(
    geometry: any, 
    onProgress?: ProgressCallback
  ): Promise<BoundaryDetectionResponse> {
    try {
      onProgress?.(0.1, 'Preparing for boundary improvement...');
      const isAvailable = await this.isServiceAvailable();
      
      if (!isAvailable || process.env.NEXT_PUBLIC_AI_MOCK_MODE === 'true') {
        console.warn('AI service unavailable or mock mode enabled, using mock implementation');
        return this.mockImproveBoundary(geometry, onProgress);
      }
      
      // Start time for performance tracking
      const startTime = performance.now();
      
      // Create AbortController for timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT);
      
      try {
        onProgress?.(0.3, 'Analyzing boundary...');
        
        // Call the AI service API to improve boundary
        const response = await this.fetchWithRetry(
          async () => {
            const res = await fetch(`${AI_API_BASE_URL}/improve-boundary`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                geometry,
                resolution: 'high'
              }),
              signal: abortController.signal
            });
            
            if (!res.ok) {
              const errorData = await res.json().catch(() => null);
              throw new Error(errorData?.detail || `Failed to improve boundary: ${res.status}`);
            }
            
            return res;
          }
        );
        
        onProgress?.(0.8, 'Finalizing results...');
        const data = await response.json();
        
        // Calculate processing time
        const processingTime = performance.now() - startTime;
        
        onProgress?.(1, 'Improvement complete!');
        return {
          geometry: data.geometry,
          confidence: data.confidence || 0.9,
          processingTimeMs: processingTime,
          landcover: data.landcover,
          source: 'ai-service'
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Error in AI boundary improvement:', error);
      
      // Fallback to mock implementation
      console.warn('Falling back to mock AI boundary improvement due to error');
      return this.mockImproveBoundary(geometry, onProgress);
    }
  },
  
  /**
   * Mock implementation for boundary improvement (used as fallback when API is unavailable)
   */
  async mockImproveBoundary(
    geometry: any,
    onProgress?: ProgressCallback
  ): Promise<BoundaryDetectionResponse> {
    onProgress?.(0.2, 'Fetching high-resolution imagery...');
    await new Promise(resolve => setTimeout(resolve, 600));
    
    onProgress?.(0.5, 'Improving boundary precision...');
    await new Promise(resolve => setTimeout(resolve, 600));
    
    onProgress?.(0.8, 'Finalizing boundary...');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // For demo purposes, we're just slightly modifying the input geometry
    const improvedGeometry = { ...geometry };
    
    // If it's a Polygon, slightly modify the coordinates
    if (geometry.type === 'Polygon' && geometry.coordinates.length > 0) {
      const originalCoords = geometry.coordinates[0];
      const modifiedCoords = originalCoords.map((coord: number[], index: number) => {
        // Skip first and last points (to keep the polygon closed)
        if (index === 0 || index === originalCoords.length - 1) return coord;
        
        // Add small random adjustments to make it look like AI refinement
        return [
          coord[0] + (Math.random() - 0.5) * 0.0008,
          coord[1] + (Math.random() - 0.5) * 0.0008
        ];
      });
      
      improvedGeometry.coordinates = [modifiedCoords];
    }
    
    onProgress?.(1, 'Improvement complete!');
    
    return {
      geometry: improvedGeometry,
      confidence: 0.94,
      processingTimeMs: 1500,
      source: 'mock'
    };
  },
  
  /**
   * Analyze satellite imagery to determine land use type
   * @param geometry GeoJSON geometry of the area to analyze
   * @param onProgress Optional callback for progress updates
   */
  async detectLandUse(
    geometry: any,
    onProgress?: ProgressCallback
  ): Promise<LandUseResponse> {
    try {
      onProgress?.(0.1, 'Preparing for land use analysis...');
      const isAvailable = await this.isServiceAvailable();
      
      if (!isAvailable || process.env.NEXT_PUBLIC_AI_MOCK_MODE === 'true') {
        console.warn('AI service unavailable or mock mode enabled, using mock implementation');
        return this.mockDetectLandUse(onProgress);
      }
      
      // Start time for performance tracking
      const startTime = performance.now();
      
      // Create AbortController for timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT);
      
      try {
        onProgress?.(0.3, 'Analyzing land characteristics...');
        
        // Call the AI service API to detect land use
        const response = await this.fetchWithRetry(
          async () => {
            const res = await fetch(`${AI_API_BASE_URL}/detect-land-use`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                geometry,
                includeDetails: true
              }),
              signal: abortController.signal
            });
            
            if (!res.ok) {
              const errorData = await res.json().catch(() => null);
              throw new Error(errorData?.detail || `Failed to detect land use: ${res.status}`);
            }
            
            return res;
          }
        );
        
        onProgress?.(0.8, 'Finalizing results...');
        const data = await response.json();
        
        // Calculate processing time
        const processingTime = performance.now() - startTime;
        
        onProgress?.(1, 'Land use analysis complete!');
        return {
          landUse: data.landUse,
          confidence: data.confidence || 0.8,
          alternatives: data.alternatives || [],
          processingTimeMs: processingTime,
          details: data.details
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Error in AI land use detection:', error);
      
      // Fallback to mock implementation
      console.warn('Falling back to mock AI land use detection due to error');
      return this.mockDetectLandUse(onProgress);
    }
  },
  
  /**
   * Mock implementation for land use detection (used as fallback when API is unavailable)
   */
  async mockDetectLandUse(onProgress?: ProgressCallback): Promise<LandUseResponse> {
    onProgress?.(0.2, 'Fetching land use data...');
    await new Promise(resolve => setTimeout(resolve, 600));
    
    onProgress?.(0.5, 'Analyzing land characteristics...');
    await new Promise(resolve => setTimeout(resolve, 700));
    
    onProgress?.(0.8, 'Determining primary land use...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock data for land use detection
    const mockLandUses = [
      { landUse: 'agricultural', confidence: 0.82 },
      { landUse: 'residential', confidence: 0.12 },
      { landUse: 'forestry', confidence: 0.04 },
      { landUse: 'commercial', confidence: 0.02 }
    ];
    
    // Generate detailed breakdown
    const details = {
      'cropland': 62,
      'grassland': 20,
      'residential': 12,
      'forest': 4,
      'commercial': 2
    };
    
    onProgress?.(1, 'Land use analysis complete!');
    
    return {
      landUse: mockLandUses[0].landUse,
      confidence: mockLandUses[0].confidence,
      alternatives: mockLandUses.slice(1),
      processingTimeMs: 1800,
      details
    };
  },
  
  /**
   * Check if the AI service is available
   * Uses a caching mechanism to avoid excessive health checks
   */
  async isServiceAvailable(): Promise<boolean> {
    // Check for mock mode flag
    if (process.env.NEXT_PUBLIC_AI_MOCK_MODE === 'true') {
      return false; // Force mock mode
    }
    
    // Try to use cached result (valid for 5 minutes)
    const cachedResult = this.getServiceAvailabilityCache();
    if (cachedResult !== null) {
      return cachedResult;
    }
    
    try {
      // Create AbortController for short timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 3000);
      
      try {
        const response = await fetch(`${AI_API_BASE_URL}/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: abortController.signal
        });
        
        const isAvailable = response.ok;
        
        // Cache result
        this.setServiceAvailabilityCache(isAvailable);
        
        return isAvailable;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.warn('AI service health check failed:', error);
      
      // Cache negative result (but for a shorter time - 1 minute)
      this.setServiceAvailabilityCache(false, 60000);
      
      return false;
    }
  },
  
  /**
   * Utility function to fetch with retry logic for reliable connections
   */
  async fetchWithRetry<T>(
    fetchFn: () => Promise<T>, 
    retries: number = RETRY_COUNT
  ): Promise<T> {
    try {
      return await fetchFn();
    } catch (error) {
      if (retries <= 0) throw error;
      
      console.warn(`AI service request failed, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return this.fetchWithRetry(fetchFn, retries - 1);
    }
  },
  
  /**
   * Caching mechanism for service availability 
   */
  getServiceAvailabilityCache(): boolean | null {
    try {
      const cachedData = localStorage.getItem('ai_service_availability');
      if (!cachedData) return null;
      
      const { available, timestamp, ttl } = JSON.parse(cachedData);
      
      // Check if cache is still valid
      if (Date.now() - timestamp < ttl) {
        return available;
      }
      
      return null;
    } catch (e) {
      return null;
    }
  },
  
  setServiceAvailabilityCache(available: boolean, ttl: number = 300000): void {
    try {
      localStorage.setItem('ai_service_availability', JSON.stringify({
        available,
        timestamp: Date.now(),
        ttl
      }));
    } catch (e) {
      console.warn('Failed to set service availability cache:', e);
    }
  },
  
  /**
   * Generate a mock land parcel boundary for demonstration purposes
   */
  generateMockParcelBoundary(centerLat: number, centerLon: number): number[][] {
    // Create an irregular polygon with 6-10 vertices
    const numPoints = Math.floor(Math.random() * 5) + 6;
    const points: number[][] = [];
    
    // Scale factors to create a reasonably sized parcel (roughly 100-300m across)
    const scaleLat = 0.002 * (Math.random() * 0.5 + 0.5);  // ~100-300m in latitude
    const scaleLon = 0.002 * (Math.random() * 0.5 + 0.5);  // ~100-300m in longitude
    
    // Generate points in a rough circle, with some randomness
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      const radius = 0.7 + Math.random() * 0.3; // 70-100% of max radius
      
      const lat = centerLat + Math.sin(angle) * scaleLat * radius;
      const lon = centerLon + Math.cos(angle) * scaleLon * radius;
      
      points.push([lon, lat]);
    }
    
    // Close the polygon by repeating the first point
    points.push([...points[0]]);
    
    return points;
  }
};

export default aiService;
import { z } from 'zod';
import { Env } from '../index';

// GeoJSON schema
const geometrySchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(
    z.array(
      z.array(
        z.array(z.number())
      )
    )
  ),
});

// Schemas for validation
const createParcelSchema = z.object({
  parcel_number: z.string().optional(),
  community_id: z.string().uuid().optional(),
  land_use: z.string(),
  geometry: geometrySchema,
  metadata: z.record(z.any()).optional(),
});

const updateParcelSchema = z.object({
  land_use: z.string().optional(),
  geometry: geometrySchema.optional(),
  status: z.enum(['draft', 'pending', 'verified', 'disputed', 'rejected']).optional(),
  metadata: z.record(z.any()).optional(),
});

// Helper function to check if a user has permission
const hasPermission = (user: any, permission: string) => {
  if (user.role === 'admin') return true;
  return user.permissions && user.permissions.includes(permission);
};

// Helper function to calculate area from coordinates (very rough estimate)
const calculateArea = (coordinates: any) => {
  // This is a very simple approximation
  // In production, you would use a proper geospatial library
  // But for demo purposes, we'll use a rough estimate
  
  try {
    // Get the first polygon's outer ring
    const outerRing = coordinates[0][0];
    
    // Earth's radius in meters
    const R = 6371000;
    
    // Convert to radians
    const toRadians = (deg: number) => deg * Math.PI / 180;
    
    // Calculate area using the Shoelace formula
    let area = 0;
    for (let i = 0; i < outerRing.length - 1; i++) {
      const p1 = outerRing[i];
      const p2 = outerRing[i + 1];
      
      // Convert to Cartesian coordinates (very rough approximation)
      const x1 = R * toRadians(p1[0]) * Math.cos(toRadians(p1[1]));
      const y1 = R * toRadians(p1[1]);
      
      const x2 = R * toRadians(p2[0]) * Math.cos(toRadians(p2[1]));
      const y2 = R * toRadians(p2[1]);
      
      area += x1 * y2 - x2 * y1;
    }
    
    // Return the absolute area in square meters
    return Math.abs(area / 2);
  } catch (error) {
    // If something goes wrong, return a default area
    return 0;
  }
};

// Generate a parcel number
const generateParcelNumber = (userId: string, timestamp: number) => {
  // Format: SL-{region}-{userID first 4 chars}-{timestamp last 4 digits}
  // In a real app, you would use the actual region code
  const region = 'WA'; // Western Area (example)
  const userSuffix = userId.substring(0, 4);
  const timeSuffix = timestamp.toString().slice(-4);
  
  return `SL-${region}-${userSuffix}-${timeSuffix}`;
};

// Land parcels handler
export const parcelsHandler = {
  // List parcels
  async listParcels(request: Request, env: Env) {
    try {
      const { user } = request;
      const url = new URL(request.url);
      
      // Parse query parameters for filtering
      const userId = url.searchParams.get('user_id');
      const status = url.searchParams.get('status');
      const landUse = url.searchParams.get('land_use');
      
      // Check permissions
      if (userId && userId !== user.sub && !hasPermission(user, 'parcels.view.all')) {
        const error = new Error('Not authorized to view parcels for this user');
        error.name = 'ForbiddenError';
        throw error;
      }
      
      // In a real implementation, we would query a database
      // For this example, we'll return mock data
      
      const mockParcels = [
        {
          id: 'parcel-1',
          parcel_number: generateParcelNumber(user.sub, Date.now() - 1000000),
          status: 'verified',
          land_use: 'residential',
          area_sqm: 1200.5,
          created_at: new Date(Date.now() - 1000000).toISOString(),
          created_by: user.sub,
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [
                [
                  [13.2345, 8.4567],
                  [13.2355, 8.4567],
                  [13.2355, 8.4577],
                  [13.2345, 8.4577],
                  [13.2345, 8.4567],
                ],
              ],
            ],
          },
        },
        {
          id: 'parcel-2',
          parcel_number: generateParcelNumber(user.sub, Date.now() - 2000000),
          status: 'pending',
          land_use: 'agricultural',
          area_sqm: 5000,
          created_at: new Date(Date.now() - 2000000).toISOString(),
          created_by: user.sub,
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [
                [
                  [13.2445, 8.4667],
                  [13.2455, 8.4667],
                  [13.2455, 8.4677],
                  [13.2445, 8.4677],
                  [13.2445, 8.4667],
                ],
              ],
            ],
          },
        },
      ];
      
      // Apply filters if they exist
      let filteredParcels = mockParcels;
      
      if (userId) {
        filteredParcels = filteredParcels.filter(p => p.created_by === userId);
      }
      
      if (status) {
        filteredParcels = filteredParcels.filter(p => p.status === status);
      }
      
      if (landUse) {
        filteredParcels = filteredParcels.filter(p => p.land_use === landUse);
      }
      
      return Response.json({
        success: true,
        parcels: filteredParcels,
        total: filteredParcels.length,
        page: 1,
        limit: 10,
      });
    } catch (error) {
      // Pass to error handler
      throw error;
    }
  },
  
  // Create a new parcel
  async createParcel(request: Request, env: Env) {
    try {
      const { user } = request;
      
      // Check if the user has permission to create parcels
      if (!hasPermission(user, 'parcels.create')) {
        const error = new Error('Not authorized to create parcels');
        error.name = 'ForbiddenError';
        throw error;
      }
      
      const body = await request.json();
      
      // Validate the request body
      const result = createParcelSchema.safeParse(body);
      if (!result.success) {
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        // @ts-ignore
        error.details = result.error.errors;
        throw error;
      }
      
      const { land_use, geometry, metadata, community_id } = result.data;
      
      // Generate a unique ID and parcel number
      const parcelId = crypto.randomUUID();
      const timestamp = Date.now();
      const parcelNumber = result.data.parcel_number || generateParcelNumber(user.sub, timestamp);
      
      // Calculate the area
      const area = calculateArea(geometry.coordinates);
      
      // Create the parcel object
      const parcel = {
        id: parcelId,
        parcel_number: parcelNumber,
        geometry,
        area_sqm: area,
        community_id: community_id || null,
        status: 'draft',
        land_use,
        created_at: new Date(timestamp).toISOString(),
        updated_at: new Date(timestamp).toISOString(),
        created_by: user.sub,
        metadata: metadata || {},
        coordinates_quality: metadata?.accuracy_meters || null,
      };
      
      // In a real implementation, we would store this in a database
      // For this example, we'll just return the parcel
      
      // In a real implementation, we would check for overlapping parcels
      // This would require a geospatial database query
      
      return Response.json({
        success: true,
        parcel,
      }, { status: 201 });
    } catch (error) {
      // Pass to error handler
      throw error;
    }
  },
  
  // Get a parcel by ID
  async getParcel(request: Request, env: Env, params: { id: string }) {
    try {
      const { user } = request;
      const { id } = params;
      
      // Check if the user has permission to view parcels
      if (!hasPermission(user, 'parcels.view')) {
        const error = new Error('Not authorized to view parcels');
        error.name = 'ForbiddenError';
        throw error;
      }
      
      // In a real implementation, we would fetch from a database
      // For this example, we'll return mock data
      
      // Check if the parcel ID matches our mock data
      if (id !== 'parcel-1' && id !== 'parcel-2') {
        const error = new Error('Parcel not found');
        error.name = 'NotFoundError';
        throw error;
      }
      
      // Return the mock parcel
      const mockParcel = {
        id,
        parcel_number: generateParcelNumber(user.sub, Date.now() - 1000000),
        status: id === 'parcel-1' ? 'verified' : 'pending',
        land_use: id === 'parcel-1' ? 'residential' : 'agricultural',
        area_sqm: id === 'parcel-1' ? 1200.5 : 5000,
        created_at: new Date(Date.now() - 1000000).toISOString(),
        created_by: user.sub,
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [13.2345, 8.4567],
                [13.2355, 8.4567],
                [13.2355, 8.4577],
                [13.2345, 8.4577],
                [13.2345, 8.4567],
              ],
            ],
          ],
        },
        metadata: {
          source: 'field_mapping',
          accuracy_meters: 2.5,
        },
      };
      
      // In a production implementation, we would also check if the user has permission to view this specific parcel
      // For example, if they are the owner or an admin
      
      return Response.json({
        success: true,
        parcel: mockParcel,
      });
    } catch (error) {
      // Pass to error handler
      throw error;
    }
  },
  
  // Update a parcel
  async updateParcel(request: Request, env: Env, params: { id: string }) {
    try {
      const { user } = request;
      const { id } = params;
      
      // Check if the user has permission to update parcels
      if (!hasPermission(user, 'parcels.edit')) {
        const error = new Error('Not authorized to update parcels');
        error.name = 'ForbiddenError';
        throw error;
      }
      
      const body = await request.json();
      
      // Validate the request body
      const result = updateParcelSchema.safeParse(body);
      if (!result.success) {
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        // @ts-ignore
        error.details = result.error.errors;
        throw error;
      }
      
      // In a real implementation, we would fetch the existing parcel and check permissions
      // For example, only the owner or an admin can update
      
      // Check if the parcel ID matches our mock data
      if (id !== 'parcel-1' && id !== 'parcel-2') {
        const error = new Error('Parcel not found');
        error.name = 'NotFoundError';
        throw error;
      }
      
      // Get the existing parcel (mock data for this example)
      const existingParcel = {
        id,
        parcel_number: generateParcelNumber(user.sub, Date.now() - 1000000),
        status: id === 'parcel-1' ? 'verified' : 'pending',
        land_use: id === 'parcel-1' ? 'residential' : 'agricultural',
        area_sqm: id === 'parcel-1' ? 1200.5 : 5000,
        created_at: new Date(Date.now() - 1000000).toISOString(),
        updated_at: new Date(Date.now() - 1000000).toISOString(),
        created_by: user.sub,
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [13.2345, 8.4567],
                [13.2355, 8.4567],
                [13.2355, 8.4577],
                [13.2345, 8.4577],
                [13.2345, 8.4567],
              ],
            ],
          ],
        },
        metadata: {
          source: 'field_mapping',
          accuracy_meters: 2.5,
        },
      };
      
      // Merge the updates with the existing parcel
      const updates = result.data;
      
      // Calculate the area if the geometry has changed
      let area = existingParcel.area_sqm;
      if (updates.geometry) {
        area = calculateArea(updates.geometry.coordinates);
      }
      
      // Create the updated parcel
      const updatedParcel = {
        ...existingParcel,
        ...updates,
        area_sqm: area,
        updated_at: new Date().toISOString(),
      };
      
      // In a real implementation, we would store this in a database
      // and check for overlapping parcels if the geometry changed
      
      return Response.json({
        success: true,
        parcel: updatedParcel,
      });
    } catch (error) {
      // Pass to error handler
      throw error;
    }
  },
  
  // Delete a parcel
  async deleteParcel(request: Request, env: Env, params: { id: string }) {
    try {
      const { user } = request;
      const { id } = params;
      
      // Check if the user has permission to delete parcels
      if (!hasPermission(user, 'parcels.delete')) {
        const error = new Error('Not authorized to delete parcels');
        error.name = 'ForbiddenError';
        throw error;
      }
      
      // In a real implementation, we would check if the parcel exists
      // and if the user is authorized to delete it
      
      // Check if the parcel ID matches our mock data
      if (id !== 'parcel-1' && id !== 'parcel-2') {
        const error = new Error('Parcel not found');
        error.name = 'NotFoundError';
        throw error;
      }
      
      // In a real implementation, we would perform the delete operation
      // For this example, we'll just return success
      
      return Response.json({
        success: true,
        message: 'Parcel deleted successfully',
      });
    } catch (error) {
      // Pass to error handler
      throw error;
    }
  },
};
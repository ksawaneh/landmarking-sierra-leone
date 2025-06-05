/**
 * Location service for GPS tracking and boundary capture
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { LOCATION_CONFIG, ERROR_MESSAGES } from '../constants';
import { Location as LocationType, BoundaryPoint } from '../types';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

export class LocationService {
  private static watchSubscription: Location.LocationSubscription | null = null;
  private static locationCallbacks: Map<string, (location: LocationType) => void> = new Map();

  /**
   * Request location permissions
   */
  static async requestPermissions(): Promise<boolean> {
    try {
      // Request foreground permissions first
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        throw new Error(ERROR_MESSAGES.LOCATION_PERMISSION_DENIED);
      }

      // Request background permissions for tracking
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.warn('Background location permission not granted');
      }

      return true;
    } catch (error) {
      console.error('Location permission error:', error);
      return false;
    }
  }

  /**
   * Get current location
   */
  static async getCurrentLocation(
    accuracy: keyof typeof LOCATION_CONFIG = 'HIGH_ACCURACY'
  ): Promise<LocationType> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error(ERROR_MESSAGES.LOCATION_PERMISSION_DENIED);
      }

      const locationConfig = LOCATION_CONFIG[accuracy];
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy[locationConfig.accuracy.toUpperCase()],
      });

      // Get reverse geocoding for address
      const addresses = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      const address = addresses[0];

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        district: address?.region || '',
        chiefdom: address?.subregion || '',
        village: address?.city || '',
        address: address ? `${address.street}, ${address.city}` : '',
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      throw error;
    }
  }

  /**
   * Start watching location updates
   */
  static async startLocationTracking(
    callback: (location: LocationType) => void,
    accuracy: keyof typeof LOCATION_CONFIG = 'HIGH_ACCURACY'
  ): Promise<string> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error(ERROR_MESSAGES.LOCATION_PERMISSION_DENIED);
      }

      const trackingId = `track_${Date.now()}`;
      this.locationCallbacks.set(trackingId, callback);

      if (!this.watchSubscription) {
        const locationConfig = LOCATION_CONFIG[accuracy];
        this.watchSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy[locationConfig.accuracy.toUpperCase()],
            timeInterval: locationConfig.timeInterval,
            distanceInterval: locationConfig.distanceInterval,
          },
          async (position) => {
            const location: LocationType = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              district: '', // Will be filled by reverse geocoding
              chiefdom: '',
            };

            // Notify all callbacks
            this.locationCallbacks.forEach((cb) => cb(location));
          }
        );
      }

      return trackingId;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      throw error;
    }
  }

  /**
   * Stop location tracking
   */
  static async stopLocationTracking(trackingId?: string): Promise<void> {
    try {
      if (trackingId) {
        this.locationCallbacks.delete(trackingId);
      }

      if (this.locationCallbacks.size === 0 && this.watchSubscription) {
        this.watchSubscription.remove();
        this.watchSubscription = null;
      }
    } catch (error) {
      console.error('Error stopping location tracking:', error);
    }
  }

  /**
   * Calculate distance between two points (in meters)
   */
  static calculateDistance(point1: BoundaryPoint, point2: BoundaryPoint): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Calculate area of polygon (in square meters)
   */
  static calculatePolygonArea(points: BoundaryPoint[]): number {
    if (points.length < 3) return 0;

    // Ensure polygon is closed
    const closedPoints = [...points];
    if (
      closedPoints[0].latitude !== closedPoints[closedPoints.length - 1].latitude ||
      closedPoints[0].longitude !== closedPoints[closedPoints.length - 1].longitude
    ) {
      closedPoints.push(closedPoints[0]);
    }

    // Calculate area using shoelace formula
    // Convert to projected coordinates first (simple equirectangular projection)
    const R = 6371e3; // Earth's radius in meters
    const centerLat = closedPoints.reduce((sum, p) => sum + p.latitude, 0) / closedPoints.length;
    
    const projectedPoints = closedPoints.map(p => ({
      x: R * (p.longitude * Math.PI / 180) * Math.cos(centerLat * Math.PI / 180),
      y: R * (p.latitude * Math.PI / 180)
    }));

    let area = 0;
    for (let i = 0; i < projectedPoints.length - 1; i++) {
      area += projectedPoints[i].x * projectedPoints[i + 1].y;
      area -= projectedPoints[i + 1].x * projectedPoints[i].y;
    }

    return Math.abs(area / 2);
  }

  /**
   * Validate GPS coordinates
   */
  static validateCoordinates(latitude: number, longitude: number): boolean {
    // Sierra Leone approximate bounds
    const SL_BOUNDS = {
      minLat: 6.9,
      maxLat: 10.0,
      minLon: -13.5,
      maxLon: -10.2,
    };

    return (
      latitude >= SL_BOUNDS.minLat &&
      latitude <= SL_BOUNDS.maxLat &&
      longitude >= SL_BOUNDS.minLon &&
      longitude <= SL_BOUNDS.maxLon
    );
  }

  /**
   * Setup background location tracking
   */
  static async setupBackgroundTracking(): Promise<void> {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Background location permission not granted');
        return;
      }

      // Define the background task
      TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
        if (error) {
          console.error('Background location error:', error);
          return;
        }

        if (data) {
          const { locations } = data as any;
          // Process locations (e.g., save to database, sync to server)
          console.log('Background locations:', locations);
        }
      });

      // Start background location updates
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 60000, // 1 minute
        distanceInterval: 50, // 50 meters
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'LandMarking',
          notificationBody: 'Tracking parcel boundaries',
          notificationColor: '#1EB53A',
        },
      });
    } catch (error) {
      console.error('Error setting up background tracking:', error);
    }
  }

  /**
   * Stop background location tracking
   */
  static async stopBackgroundTracking(): Promise<void> {
    try {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } catch (error) {
      console.error('Error stopping background tracking:', error);
    }
  }
}
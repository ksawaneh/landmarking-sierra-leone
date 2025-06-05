/**
 * Unit tests for LocationService
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { LocationService } from '../LocationService';
import { LOCATION_CONFIG, ERROR_MESSAGES } from '../../constants';

jest.mock('expo-location');
jest.mock('expo-task-manager');

describe('LocationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestPermissions', () => {
    it('should return true when all permissions are granted', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

      const result = await LocationService.requestPermissions();
      
      expect(result).toBe(true);
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
      expect(Location.requestBackgroundPermissionsAsync).toHaveBeenCalled();
    });

    it('should return false when foreground permission is denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      const result = await LocationService.requestPermissions();
      
      expect(result).toBe(false);
      expect(Location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('should continue if background permission is denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      const result = await LocationService.requestPermissions();
      
      expect(result).toBe(true);
    });

    it('should handle permission errors', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockRejectedValue(new Error('Permission error'));

      const result = await LocationService.requestPermissions();
      
      expect(result).toBe(false);
    });
  });

  describe('getCurrentLocation', () => {
    const mockPosition = {
      coords: {
        latitude: 8.484,
        longitude: -13.2299,
        accuracy: 10,
        altitude: 100,
      },
    };

    const mockAddress = {
      region: 'Western Area',
      subregion: 'Freetown',
      city: 'Freetown',
      street: 'Siaka Stevens Street',
    };

    beforeEach(() => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(mockPosition);
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([mockAddress]);
    });

    it('should return current location with address', async () => {
      const result = await LocationService.getCurrentLocation();
      
      expect(result).toEqual({
        latitude: mockPosition.coords.latitude,
        longitude: mockPosition.coords.longitude,
        accuracy: mockPosition.coords.accuracy,
        altitude: mockPosition.coords.altitude,
        district: mockAddress.region,
        chiefdom: mockAddress.subregion,
        village: mockAddress.city,
        address: `${mockAddress.street}, ${mockAddress.city}`,
      });
    });

    it('should use high accuracy by default', async () => {
      await LocationService.getCurrentLocation();
      
      expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
        accuracy: Location.Accuracy.High,
      });
    });

    it('should use specified accuracy level', async () => {
      await LocationService.getCurrentLocation('BALANCED');
      
      expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
        accuracy: Location.Accuracy.Balanced,
      });
    });

    it('should handle empty address gracefully', async () => {
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([]);

      const result = await LocationService.getCurrentLocation();
      
      expect(result.district).toBe('');
      expect(result.address).toBe('');
    });

    it('should throw error when permissions are denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      await expect(LocationService.getCurrentLocation()).rejects.toThrow(ERROR_MESSAGES.LOCATION_PERMISSION_DENIED);
    });
  });

  describe('startLocationTracking', () => {
    const mockCallback = jest.fn();

    beforeEach(() => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Location.watchPositionAsync as jest.Mock).mockResolvedValue({ remove: jest.fn() });
    });

    it('should start location tracking and return tracking ID', async () => {
      const trackingId = await LocationService.startLocationTracking(mockCallback);
      
      expect(trackingId).toMatch(/^track_\d+$/);
      expect(Location.watchPositionAsync).toHaveBeenCalled();
    });

    it('should use specified accuracy level', async () => {
      await LocationService.startLocationTracking(mockCallback, 'LOW_POWER');
      
      const config = LOCATION_CONFIG.LOW_POWER;
      expect(Location.watchPositionAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          accuracy: Location.Accuracy.Low,
          timeInterval: config.timeInterval,
          distanceInterval: config.distanceInterval,
        }),
        expect.any(Function)
      );
    });

    it('should call callback with location updates', async () => {
      let locationCallback: any;
      (Location.watchPositionAsync as jest.Mock).mockImplementation((options, cb) => {
        locationCallback = cb;
        return { remove: jest.fn() };
      });

      await LocationService.startLocationTracking(mockCallback);
      
      // Simulate location update
      const mockPosition = {
        coords: {
          latitude: 8.5,
          longitude: -13.2,
          accuracy: 5,
          altitude: 110,
        },
      };
      
      await locationCallback(mockPosition);
      
      expect(mockCallback).toHaveBeenCalledWith({
        latitude: 8.5,
        longitude: -13.2,
        accuracy: 5,
        altitude: 110,
        district: '',
        chiefdom: '',
      });
    });

    it('should throw error when permissions are denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      await expect(
        LocationService.startLocationTracking(mockCallback)
      ).rejects.toThrow(ERROR_MESSAGES.LOCATION_PERMISSION_DENIED);
    });
  });

  describe('stopLocationTracking', () => {
    it('should stop tracking for specific ID', async () => {
      const mockRemove = jest.fn();
      (Location.watchPositionAsync as jest.Mock).mockResolvedValue({ remove: mockRemove });
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

      const trackingId = await LocationService.startLocationTracking(jest.fn());
      await LocationService.stopLocationTracking(trackingId);
      
      // Should not remove subscription when one tracker remains
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it('should remove subscription when all trackers are stopped', async () => {
      const mockRemove = jest.fn();
      (Location.watchPositionAsync as jest.Mock).mockResolvedValue({ remove: mockRemove });
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

      const trackingId = await LocationService.startLocationTracking(jest.fn());
      await LocationService.stopLocationTracking(trackingId);
      await LocationService.stopLocationTracking(); // Stop all
      
      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two points correctly', () => {
      const point1 = { latitude: 8.484, longitude: -13.2299, order: 0 };
      const point2 = { latitude: 8.494, longitude: -13.2199, order: 1 };
      
      const distance = LocationService.calculateDistance(point1, point2);
      
      // Should be approximately 1.4km
      expect(distance).toBeGreaterThan(1400);
      expect(distance).toBeLessThan(1500);
    });

    it('should return 0 for same points', () => {
      const point = { latitude: 8.484, longitude: -13.2299, order: 0 };
      
      const distance = LocationService.calculateDistance(point, point);
      
      expect(distance).toBe(0);
    });
  });

  describe('calculatePolygonArea', () => {
    it('should calculate area of a triangle', () => {
      const points = [
        { latitude: 0, longitude: 0, order: 0 },
        { latitude: 0.001, longitude: 0, order: 1 },
        { latitude: 0, longitude: 0.001, order: 2 },
      ];
      
      const area = LocationService.calculatePolygonArea(points);
      
      // Should be approximately 6170 m²
      expect(area).toBeGreaterThan(6000);
      expect(area).toBeLessThan(6500);
    });

    it('should return 0 for less than 3 points', () => {
      const points = [
        { latitude: 0, longitude: 0, order: 0 },
        { latitude: 0.001, longitude: 0, order: 1 },
      ];
      
      const area = LocationService.calculatePolygonArea(points);
      
      expect(area).toBe(0);
    });

    it('should handle closed polygon', () => {
      const points = [
        { latitude: 0, longitude: 0, order: 0 },
        { latitude: 0.001, longitude: 0, order: 1 },
        { latitude: 0, longitude: 0.001, order: 2 },
        { latitude: 0, longitude: 0, order: 3 }, // Closing point
      ];
      
      const area = LocationService.calculatePolygonArea(points);
      
      // Should be same as triangle
      expect(area).toBeGreaterThan(6000);
      expect(area).toBeLessThan(6500);
    });
  });

  describe('validateCoordinates', () => {
    it('should return true for valid Sierra Leone coordinates', () => {
      const result = LocationService.validateCoordinates(8.484, -13.2299);
      expect(result).toBe(true);
    });

    it('should return false for coordinates outside Sierra Leone', () => {
      // London coordinates
      const result = LocationService.validateCoordinates(51.5074, -0.1278);
      expect(result).toBe(false);
    });

    it('should handle boundary cases', () => {
      // Min bounds
      expect(LocationService.validateCoordinates(6.9, -13.5)).toBe(true);
      // Max bounds
      expect(LocationService.validateCoordinates(10.0, -10.2)).toBe(true);
      // Just outside
      expect(LocationService.validateCoordinates(6.8, -13.6)).toBe(false);
    });
  });

  describe('setupBackgroundTracking', () => {
    it('should setup background tracking when permission granted', async () => {
      (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (TaskManager.defineTask as jest.Mock).mockImplementation(() => {});
      (Location.startLocationUpdatesAsync as jest.Mock).mockResolvedValue(undefined);

      await LocationService.setupBackgroundTracking();
      
      expect(TaskManager.defineTask).toHaveBeenCalledWith(
        'background-location-task',
        expect.any(Function)
      );
      expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
        'background-location-task',
        expect.objectContaining({
          accuracy: Location.Accuracy.High,
          timeInterval: 60000,
          distanceInterval: 50,
          showsBackgroundLocationIndicator: true,
        })
      );
    });

    it('should not start tracking when permission denied', async () => {
      (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      await LocationService.setupBackgroundTracking();
      
      expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (Location.requestBackgroundPermissionsAsync as jest.Mock).mockRejectedValue(new Error('Failed'));

      // Should not throw
      await expect(LocationService.setupBackgroundTracking()).resolves.toBeUndefined();
    });
  });

  describe('stopBackgroundTracking', () => {
    it('should stop background location updates', async () => {
      (Location.stopLocationUpdatesAsync as jest.Mock).mockResolvedValue(undefined);

      await LocationService.stopBackgroundTracking();
      
      expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith('background-location-task');
    });

    it('should handle errors gracefully', async () => {
      (Location.stopLocationUpdatesAsync as jest.Mock).mockRejectedValue(new Error('Failed'));

      // Should not throw
      await expect(LocationService.stopBackgroundTracking()).resolves.toBeUndefined();
    });
  });
});
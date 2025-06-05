/**
 * Screen for registering new land parcels with GPS boundary capture
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { NavigationParams, Parcel } from '../types';
import { LocationService } from '../services/LocationService';
import { ParcelService } from '../services/ParcelService';
import { useAuth } from '../contexts/AuthContext';
import { colors, fonts, spacing, shadow } from '../styles/theme';

type ParcelRegistrationNavigationProp = StackNavigationProp<NavigationParams, 'ParcelRegistration'>;

interface BoundaryPoint {
  latitude: number;
  longitude: number;
}

export const ParcelRegistrationScreen: React.FC = () => {
  const navigation = useNavigation<ParcelRegistrationNavigationProp>();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    parcelNumber: '',
    landUse: 'residential' as Parcel['landUse'],
    description: '',
  });
  
  const [boundaries, setBoundaries] = useState<BoundaryPoint[]>([]);
  const [currentLocation, setCurrentLocation] = useState<BoundaryPoint | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 8.4657,
    longitude: -13.2317,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const location = await LocationService.getCurrentPosition();
      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setCurrentLocation(newLocation);
      setMapRegion({
        ...mapRegion,
        latitude: newLocation.latitude,
        longitude: newLocation.longitude,
      });
    } catch (error) {
      Alert.alert('Location Error', 'Unable to get your current location');
    }
  };

  const startBoundaryCapture = () => {
    if (boundaries.length > 0) {
      Alert.alert(
        'Clear Boundaries?',
        'This will clear all captured boundary points. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Clear',
            onPress: () => {
              setBoundaries([]);
              setIsCapturing(true);
            }
          }
        ]
      );
    } else {
      setIsCapturing(true);
    }
  };

  const capturePoint = async () => {
    try {
      const location = await LocationService.getCurrentPosition();
      const newPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setBoundaries([...boundaries, newPoint]);
      
      Alert.alert(
        'Point Captured',
        `Point ${boundaries.length + 1} captured successfully`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to capture location point');
    }
  };

  const finishBoundaryCapture = () => {
    if (boundaries.length < 3) {
      Alert.alert('Insufficient Points', 'You need at least 3 points to define a parcel boundary');
      return;
    }
    setIsCapturing(false);
  };

  const calculateArea = (points: BoundaryPoint[]): number => {
    // Simple polygon area calculation using Shoelace formula
    if (points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].latitude * points[j].longitude;
      area -= points[j].latitude * points[i].longitude;
    }
    
    // Convert to square meters (approximate)
    return Math.abs(area) * 111319.9 * 111319.9 / 2;
  };

  const handleSubmit = async () => {
    if (!formData.parcelNumber) {
      Alert.alert('Error', 'Please enter a parcel number');
      return;
    }

    if (boundaries.length < 3) {
      Alert.alert('Error', 'Please capture at least 3 boundary points');
      return;
    }

    setLoading(true);
    try {
      const parcelData = {
        ...formData,
        ownerId: user?.id || '',
        location: currentLocation || boundaries[0],
        boundaries,
        area: calculateArea(boundaries),
        status: 'pending' as const,
        documents: [],
        verifications: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        offlineCreated: true,
        syncStatus: 'pending' as const,
      };

      await ParcelService.createParcel(parcelData);
      
      Alert.alert(
        'Success',
        'Parcel registered successfully! It will be synced when you have an internet connection.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to register parcel. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.label}>Parcel Number *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter parcel number"
          value={formData.parcelNumber}
          onChangeText={(value) => setFormData({ ...formData, parcelNumber: value })}
        />

        <Text style={styles.label}>Land Use Type *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={formData.landUse}
            onValueChange={(value) => setFormData({ ...formData, landUse: value })}
            style={styles.picker}
          >
            <Picker.Item label="Residential" value="residential" />
            <Picker.Item label="Commercial" value="commercial" />
            <Picker.Item label="Agricultural" value="agricultural" />
            <Picker.Item label="Industrial" value="industrial" />
            <Picker.Item label="Mixed Use" value="mixed" />
          </Picker>
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Enter property description"
          value={formData.description}
          onChangeText={(value) => setFormData({ ...formData, description: value })}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.mapSection}>
        <Text style={styles.sectionTitle}>Boundary Capture</Text>
        
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            region={mapRegion}
            onRegionChangeComplete={setMapRegion}
            showsUserLocation
            showsMyLocationButton
          >
            {currentLocation && (
              <Marker
                coordinate={currentLocation}
                title="Current Location"
                pinColor={colors.primary}
              />
            )}
            
            {boundaries.map((point, index) => (
              <Marker
                key={index}
                coordinate={point}
                title={`Point ${index + 1}`}
                pinColor={colors.secondary}
              />
            ))}
            
            {boundaries.length >= 3 && (
              <Polygon
                coordinates={boundaries}
                fillColor="rgba(43, 108, 176, 0.2)"
                strokeColor={colors.primary}
                strokeWidth={2}
              />
            )}
          </MapView>
        </View>

        <View style={styles.captureControls}>
          {!isCapturing ? (
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={startBoundaryCapture}
            >
              <Icon name="location-on" size={20} color={colors.white} />
              <Text style={styles.buttonText}>Start Boundary Capture</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={capturePoint}
              >
                <Icon name="add-location" size={20} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>
                  Capture Point ({boundaries.length})
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.successButton]}
                onPress={finishBoundaryCapture}
                disabled={boundaries.length < 3}
              >
                <Icon name="check" size={20} color={colors.white} />
                <Text style={styles.buttonText}>Finish Capture</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {boundaries.length >= 3 && (
          <View style={styles.areaInfo}>
            <Icon name="square-foot" size={20} color={colors.primary} />
            <Text style={styles.areaText}>
              Estimated Area: {calculateArea(boundaries).toFixed(2)} m²
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, styles.submitButton, loading && styles.disabledButton]}
        onPress={handleSubmit}
        disabled={loading || boundaries.length < 3}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <Icon name="save" size={20} color={colors.white} />
            <Text style={styles.buttonText}>Register Parcel</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  form: {
    padding: spacing.lg,
    backgroundColor: colors.white,
  },
  label: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    fontSize: 16,
    fontFamily: fonts.regular,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  picker: {
    height: 50,
  },
  mapSection: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  mapContainer: {
    height: 300,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadow.md,
  },
  map: {
    flex: 1,
  },
  captureControls: {
    marginBottom: spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  successButton: {
    backgroundColor: colors.success,
  },
  submitButton: {
    backgroundColor: colors.primary,
    margin: spacing.lg,
    marginTop: 0,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: fonts.medium,
    marginLeft: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontFamily: fonts.medium,
    marginLeft: spacing.sm,
  },
  areaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
  },
  areaText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: colors.text,
    marginLeft: spacing.sm,
  },
});
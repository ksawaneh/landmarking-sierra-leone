/**
 * Screen showing list of parcels requiring verification
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ParcelStackParamList, Parcel, Verification } from '../types';
import { ParcelService } from '../services/ParcelService';
import { VerificationService } from '../services/VerificationService';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../styles/theme';

type VerificationListNavigationProp = StackNavigationProp<ParcelStackParamList, 'ParcelList'>;

interface ParcelWithVerifications extends Parcel {
  pendingVerifications: number;
  completedVerifications: number;
  totalRequired: number;
}

export const VerificationListScreen: React.FC = () => {
  const navigation = useNavigation<VerificationListNavigationProp>();
  const { user } = useAuth();
  
  const [parcels, setParcels] = useState<ParcelWithVerifications[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  useEffect(() => {
    loadParcels();
  }, []);

  const loadParcels = async () => {
    try {
      // Get all parcels
      const allParcels = await ParcelService.getUserParcels(user?.id || '');
      
      // Load verification status for each parcel
      const parcelsWithVerifications = await Promise.all(
        allParcels.map(async (parcel) => {
          const verifications = await VerificationService.getParcelVerifications(parcel.id);
          const requiredTypes = VerificationService.getRequiredVerifications();
          
          const completedVerifications = verifications.filter(v => v.status === 'completed').length;
          const pendingVerifications = verifications.filter(v => v.status === 'pending').length;
          
          return {
            ...parcel,
            pendingVerifications,
            completedVerifications,
            totalRequired: requiredTypes.length,
          };
        })
      );
      
      setParcels(parcelsWithVerifications);
    } catch (error) {
      console.error('Failed to load parcels:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadParcels();
    setRefreshing(false);
  };

  const getFilteredParcels = () => {
    switch (filter) {
      case 'pending':
        return parcels.filter(p => p.completedVerifications < p.totalRequired);
      case 'completed':
        return parcels.filter(p => p.completedVerifications === p.totalRequired);
      default:
        return parcels;
    }
  };

  const getVerificationProgress = (parcel: ParcelWithVerifications) => {
    return (parcel.completedVerifications / parcel.totalRequired) * 100;
  };

  const getProgressColor = (progress: number) => {
    if (progress === 100) return theme.colors.success;
    if (progress >= 60) return theme.colors.info;
    if (progress >= 40) return theme.colors.warning;
    return theme.colors.error;
  };

  const renderParcelItem = ({ item }: { item: ParcelWithVerifications }) => {
    const progress = getVerificationProgress(item);
    const progressColor = getProgressColor(progress);

    return (
      <TouchableOpacity
        style={styles.parcelCard}
        onPress={() => navigation.navigate('ParcelDetails', { parcelId: item.id })}
      >
        <View style={styles.parcelHeader}>
          <View>
            <Text style={styles.parcelNumber}>{item.parcelNumber}</Text>
            <Text style={styles.ownerName}>{item.ownerName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: progressColor }]}>
            <Text style={styles.statusText}>{Math.round(progress)}%</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, { 
                width: `${progress}%`, 
                backgroundColor: progressColor 
              }]} 
            />
          </View>
          <Text style={styles.progressText}>
            {item.completedVerifications} of {item.totalRequired} verifications
          </Text>
        </View>

        <View style={styles.parcelInfo}>
          <View style={styles.infoItem}>
            <Icon name="landscape" size={16} color={theme.colors.text.secondary} />
            <Text style={styles.infoText}>{item.area.toFixed(2)} m²</Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="location-on" size={16} color={theme.colors.text.secondary} />
            <Text style={styles.infoText}>{item.location.district}</Text>
          </View>
        </View>

        {item.pendingVerifications > 0 && (
          <View style={styles.pendingBanner}>
            <Icon name="schedule" size={16} color={theme.colors.warning} />
            <Text style={styles.pendingText}>
              {item.pendingVerifications} verification(s) pending approval
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderFilterButton = (
    filterType: 'all' | 'pending' | 'completed',
    label: string,
    icon: string
  ) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === filterType && styles.filterButtonActive]}
      onPress={() => setFilter(filterType)}
    >
      <Icon 
        name={icon} 
        size={20} 
        color={filter === filterType ? theme.colors.accent : theme.colors.text.secondary} 
      />
      <Text style={[
        styles.filterText,
        filter === filterType && styles.filterTextActive
      ]}>{label}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const filteredParcels = getFilteredParcels();

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {renderFilterButton('all', 'All', 'list')}
        {renderFilterButton('pending', 'Pending', 'schedule')}
        {renderFilterButton('completed', 'Verified', 'verified-user')}
      </View>

      {/* Parcel List */}
      <FlatList
        data={filteredParcels}
        keyExtractor={(item) => item.id}
        renderItem={renderParcelItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="verified-user" size={64} color={theme.colors.text.secondary} />
            <Text style={styles.emptyText}>No parcels found</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'pending' 
                ? 'All parcels are fully verified!' 
                : 'Register a parcel to start verification'}
            </Text>
          </View>
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('ParcelRegistration')}
      >
        <Icon name="add" size={24} color={theme.colors.accent} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  filterText: {
    marginLeft: theme.spacing.xs,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.text.secondary,
  },
  filterTextActive: {
    color: theme.colors.accent,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl * 2,
  },
  parcelCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadow.sm,
  },
  parcelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  parcelNumber: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
  },
  ownerName: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  statusText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.accent,
  },
  progressContainer: {
    marginBottom: theme.spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.colors.border.light,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.sm,
  },
  progressText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
  },
  parcelInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    marginLeft: theme.spacing.xs,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.warning + '20',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
  },
  pendingText: {
    marginLeft: theme.spacing.xs,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.warning,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl * 2,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    right: theme.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.lg,
  },
});
/**
 * Main dashboard screen showing user's parcels and quick actions
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MainTabParamList, Parcel } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { ParcelService } from '../services/ParcelService';
import { theme } from '../styles/theme';

type DashboardNavigationProp = StackNavigationProp<MainTabParamList, 'Dashboard'>;

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<DashboardNavigationProp>();
  const { user } = useAuth();
  const { syncStatus, refresh: refreshSync } = useSyncStatus();
  
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadParcels();
  }, []);

  const loadParcels = async () => {
    try {
      const userParcels = await ParcelService.getUserParcels(user?.id || '');
      setParcels(userParcels);
    } catch (error) {
      console.error('Failed to load parcels:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadParcels(), refreshSync()]);
    setRefreshing(false);
  };

  const getStatusColor = (status: Parcel['verificationStatus']) => {
    switch (status) {
      case 'FULLY_VERIFIED': return theme.colors.status.verified;
      case 'REJECTED': return theme.colors.status.rejected;
      case 'PENDING_VERIFICATION': return theme.colors.status.pending;
      case 'PARTIALLY_VERIFIED': return theme.colors.status.partial;
      default: return theme.colors.status.draft;
    }
  };

  const QuickActionCard = ({ icon, title, onPress }: any) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <Icon name={icon} size={32} color={theme.colors.primary} />
      <Text style={styles.quickActionText}>{title}</Text>
    </TouchableOpacity>
  );

  const ParcelCard = ({ parcel }: { parcel: Parcel }) => (
    <TouchableOpacity
      style={styles.parcelCard}
      onPress={() => navigation.navigate('ParcelDetails', { parcelId: parcel.id })}
    >
      <View style={styles.parcelHeader}>
        <Text style={styles.parcelNumber}>{parcel.parcelNumber}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(parcel.verificationStatus) }]}>
          <Text style={styles.statusText}>{parcel.verificationStatus.replace('_', ' ')}</Text>
        </View>
      </View>
      <Text style={styles.parcelInfo}>Area: {parcel.area.toFixed(2)} m²</Text>
      <Text style={styles.parcelInfo}>Land Use: {parcel.landUse}</Text>
      {parcel.localChanges && (
        <View style={styles.syncPending}>
          <Icon name="sync" size={16} color={theme.colors.warning} />
          <Text style={styles.syncPendingText}>Pending Sync</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Sync Status Banner */}
        {syncStatus && (
          <TouchableOpacity
            style={styles.syncBanner}
            onPress={() => navigation.navigate('OfflineSync')}
          >
            <View style={styles.syncBannerContent}>
              <Icon 
                name={syncStatus.isOnline ? 'cloud-done' : 'cloud-off'} 
                size={24} 
                color={syncStatus.syncInProgress ? theme.colors.warning : theme.colors.success} 
              />
              <View style={styles.syncInfo}>
                <Text style={styles.syncStatusText}>
                  {syncStatus.syncInProgress ? 'Syncing...' : 'All Synced'}
                </Text>
                {syncStatus.pendingChanges > 0 && (
                  <Text style={styles.syncPendingCount}>
                    {syncStatus.pendingChanges} items pending sync
                  </Text>
                )}
              </View>
            </View>
            <Icon name="chevron-right" size={24} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        )}

        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>Welcome, {user?.name}</Text>
          <Text style={styles.roleText}>{user?.role.replace('_', ' ').toUpperCase()}</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <QuickActionCard
              icon="add-location"
              title="Register Parcel"
              onPress={() => navigation.navigate('ParcelRegistration')}
            />
            <QuickActionCard
              icon="verified-user"
              title="Verify Parcel"
              onPress={() => navigation.navigate('ParcelDetails', { parcelId: '' })}
            />
            <QuickActionCard
              icon="document-scanner"
              title="Scan Document"
              onPress={() => navigation.navigate('DocumentCapture', { parcelId: '', type: 'deed' })}
            />
            <QuickActionCard
              icon="person"
              title="Profile"
              onPress={() => navigation.navigate('Profile')}
            />
          </View>
        </View>

        {/* My Parcels */}
        <View style={styles.parcelsSection}>
          <Text style={styles.sectionTitle}>My Parcels ({parcels.length})</Text>
          {parcels.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="landscape" size={64} color={theme.colors.text.secondary} />
              <Text style={styles.emptyStateText}>No parcels registered yet</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => navigation.navigate('ParcelRegistration')}
              >
                <Text style={styles.addButtonText}>Register Your First Parcel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            parcels.map(parcel => (
              <ParcelCard key={parcel.id} parcel={parcel} />
            ))
          )}
        </View>
      </ScrollView>
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
  syncBanner: {
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  syncBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncInfo: {
    marginLeft: theme.spacing.sm,
  },
  syncStatusText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  syncPendingCount: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  welcomeSection: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
  },
  welcomeText: {
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.surface,
  },
  roleText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.surface,
    opacity: 0.8,
    marginTop: theme.spacing.xs,
  },
  quickActionsContainer: {
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickAction: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: theme.spacing.md,
    alignItems: 'center',
    width: '48%',
    marginBottom: theme.spacing.md,
    ...theme.shadow.md,
  },
  quickActionText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.text.primary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  parcelsSection: {
    padding: theme.spacing.lg,
  },
  parcelCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadow.sm,
  },
  parcelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  parcelNumber: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.surface,
  },
  parcelInfo: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  syncPending: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  syncPendingText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.warning,
    marginLeft: theme.spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.surface,
  },
});
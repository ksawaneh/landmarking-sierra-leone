/**
 * Main application entry point for LandMarking mobile app
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ApiService } from './src/services/ApiService';
import { OfflineSyncService } from './src/services/OfflineSyncService';
import { DatabaseService } from './src/services/DatabaseService';

export default function App() {
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize services
      ApiService.init();
      await DatabaseService.init();
      await OfflineSyncService.init();
      
      console.log('App initialized successfully');
    } catch (error) {
      console.error('App initialization error:', error);
    }
  };

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
        <StatusBar style="light" backgroundColor="#1EB53A" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

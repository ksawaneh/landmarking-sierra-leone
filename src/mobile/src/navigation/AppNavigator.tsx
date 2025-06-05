/**
 * Main navigation structure for the LandMarking mobile app
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../styles/theme';

// Import screens
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ParcelRegistrationScreen } from '../screens/ParcelRegistrationScreen';
import { VerificationListScreen } from '../screens/VerificationListScreen';
import { VerificationWorkflowScreen } from '../screens/VerificationWorkflowScreen';

// Type definitions
import { RootStackParamList, MainTabParamList, ParcelStackParamList } from '../types';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const ParcelStack = createStackNavigator<ParcelStackParamList>();

/**
 * Parcel stack navigator
 */
const ParcelNavigator: React.FC = () => {
  return (
    <ParcelStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.accent,
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily.bold,
        },
      }}
    >
      <ParcelStack.Screen
        name="ParcelList"
        component={VerificationListScreen}
        options={{ title: 'Parcels' }}
      />
      <ParcelStack.Screen
        name="ParcelDetails"
        component={VerificationWorkflowScreen}
        options={{ title: 'Verification' }}
      />
      <ParcelStack.Screen
        name="ParcelRegistration"
        component={ParcelRegistrationScreen}
        options={{ title: 'Register Parcel' }}
      />
    </ParcelStack.Navigator>
  );
};

/**
 * Bottom tab navigator for main app screens
 */
const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.text.secondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border.light,
          borderTopWidth: 1,
        },
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.accent,
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily.bold,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Icon name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Parcels"
        component={ParcelNavigator}
        options={{
          tabBarLabel: 'Parcels',
          tabBarIcon: ({ color, size }) => (
            <Icon name="landscape" size={size} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Verification"
        component={VerificationListScreen}
        options={{
          tabBarLabel: 'Verify',
          tabBarIcon: ({ color, size }) => (
            <Icon name="verified-user" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={DashboardScreen} // Placeholder for now
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Icon name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

/**
 * Root stack navigator handling auth flow
 */
const RootNavigator: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.accent,
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily.bold,
        },
      }}
    >
      {!isAuthenticated ? (
        // Auth screens
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ 
              title: 'Create Account',
              headerShown: true,
            }}
          />
        </>
      ) : (
        // Main app screens
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BiometricSetup"
            component={DashboardScreen} // Placeholder for now
            options={{ title: 'Setup Biometric Login' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

/**
 * App navigator with navigation container
 */
export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
};
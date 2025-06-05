# LandMarking Sierra Leone - Mobile App

React Native mobile application for the LandMarking Sierra Leone digital land registry system.

## Overview

The LandMarking mobile app provides offline-first functionality for land registration, verification, and management in Sierra Leone. It supports GPS boundary capture, biometric authentication, multi-party verification, and 30-60 day offline operation.

## Features

- **Offline-First Design**: Full functionality for 30-60 days without internet
- **GPS Boundary Capture**: Walk the perimeter to capture land boundaries
- **Biometric Authentication**: Fingerprint and face recognition support
- **Multi-Party Verification**: Cryptographic signatures from required parties
- **Document Management**: Capture and store land documents securely
- **Automatic Sync**: Smart conflict resolution when back online
- **Multi-Language Support**: English, Krio, Temne, and Mende (coming soon)

## Prerequisites

- Node.js 20.x or later
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac only) or Android Studio
- Physical device for testing GPS and biometric features

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd landmarking/src/mobile
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Install iOS pods (Mac only):
```bash
cd ios && pod install && cd ..
```

## Running the App

### Development Mode

```bash
# Start the Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web (limited functionality)
npm run web
```

### Physical Device Testing

1. Install Expo Go app on your device
2. Scan the QR code from the terminal
3. For production features (biometrics, background location), create a development build:

```bash
# Create development build
eas build --profile development --platform ios
eas build --profile development --platform android
```

## Project Structure

```
src/
├── components/       # Reusable UI components
├── screens/         # Screen components
│   ├── auth/       # Authentication screens
│   └── ...         # Other screens
├── services/       # Business logic and API services
│   ├── ApiService.ts
│   ├── BiometricService.ts
│   ├── DatabaseService.ts
│   ├── LocationService.ts
│   └── OfflineSyncService.ts
├── navigation/     # Navigation configuration
├── contexts/       # React contexts
├── hooks/          # Custom hooks
├── types/          # TypeScript type definitions
├── constants/      # App constants
├── styles/         # Theme and styling
└── utils/          # Utility functions
```

## Key Services

### Offline Sync
- Automatic background sync every 5 minutes when online
- Queues operations when offline
- Smart conflict resolution
- Progress tracking

### Location Services
- High-accuracy GPS tracking
- Boundary area calculation
- Background location updates
- Sierra Leone bounds validation

### Biometric Authentication
- Fingerprint authentication
- Face ID support (iOS)
- Secure credential storage
- Fallback to password

### Database
- SQLite for offline storage
- Encrypted sensitive data
- Efficient sync tracking
- 100MB cache limit

## Configuration

### Environment Variables

Create a `.env` file:

```bash
EXPO_PUBLIC_API_URL=https://api.landmarking.sl
```

### App Configuration

Edit `src/constants/index.ts` for:
- API endpoints
- Offline settings
- Map defaults
- Verification requirements

## Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm test -- --coverage

# Run E2E tests (requires device/emulator)
npm run test:e2e
```

## Building for Production

```bash
# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Build for both
eas build --platform all
```

## Deployment

1. Configure app signing in `app.json`
2. Set up EAS Build (`eas build:configure`)
3. Submit to stores:

```bash
# Submit to App Store
eas submit --platform ios

# Submit to Google Play
eas submit --platform android
```

## Troubleshooting

### Common Issues

1. **Metro bundler issues**
   ```bash
   npx react-native start --reset-cache
   ```

2. **iOS build failures**
   ```bash
   cd ios && pod deintegrate && pod install
   ```

3. **Android build issues**
   ```bash
   cd android && ./gradlew clean
   ```

4. **Expo issues**
   ```bash
   expo doctor
   ```

### Debugging

- Use React Native Debugger for advanced debugging
- Check device logs: `expo logs`
- For native issues, use Xcode (iOS) or Android Studio logcat

## Security Considerations

- All sensitive data is encrypted using expo-secure-store
- Biometric templates are never transmitted
- API tokens expire after 24 hours
- Offline data is encrypted at rest
- Location data is only collected during boundary capture

## Performance Optimization

- Images are compressed before upload
- Lazy loading for large datasets
- Background sync respects battery levels
- Efficient offline queries with indexes
- Memory management for long capture sessions

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## Support

- Email: support@landmarking.sl
- Phone: +232 76 123 456
- Documentation: https://docs.landmarking.sl

## License

See [LICENSE](../../LICENSE) file.
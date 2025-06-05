# LandMarking Mobile Application

## Overview

The LandMarking mobile application is built using React Native to provide cross-platform support for iOS and Android. The app enables field agents and community members to map land boundaries, collect evidence, and participate in the verification process, even in areas with limited or no connectivity.

## Key Features

- **Offline-First Architecture**: Fully functional without internet connection
- **GPS Boundary Mapping**: Capture land boundaries by walking the perimeter
- **Manual Boundary Drawing**: Draw boundaries on satellite/aerial imagery
- **Evidence Collection**: Take photos, record videos, and capture documents
- **Verification Workflow**: Participate in community verification processes
- **Data Synchronization**: Sync data when connectivity is available
- **Conflict Resolution**: Resolve data conflicts that occur during sync
- **Map Visualization**: View land parcels and boundaries on maps
- **Document Management**: View and manage land documentation
- **Authentication**: Secure login with multi-factor options

## Project Structure

```
mobile/
├── android/                # Android-specific code
├── ios/                    # iOS-specific code
├── src/
│   ├── api/                # API client and service integrations
│   ├── assets/             # Static assets (images, fonts, etc.)
│   ├── components/         # Reusable UI components
│   ├── contexts/           # React context providers
│   ├── hooks/              # Custom React hooks
│   ├── navigation/         # Navigation configuration
│   ├── screens/            # Application screens
│   ├── services/           # Business logic services
│   ├── storage/            # Local storage and database
│   ├── sync/               # Data synchronization logic
│   ├── utils/              # Utility functions
│   ├── validation/         # Form and data validation
│   └── App.tsx             # Application entry point
├── .env.example            # Example environment variables
├── package.json            # Dependencies and scripts
└── README.md               # Project documentation
```

## Technical Stack

- **Framework**: React Native
- **Language**: TypeScript
- **Navigation**: React Navigation
- **State Management**: React Context API + React Query
- **Local Storage**: SQLite (via react-native-sqlite-storage)
- **Maps**: Mapbox GL (via react-native-mapbox-gl)
- **Offline Support**: Watermelondb
- **Authentication**: JWT with secure storage
- **Camera & GPS**: React Native community modules
- **UI Components**: Custom components with UI library support
- **Testing**: Jest with React Native Testing Library

## Offline Capability

The app implements a sophisticated offline-first architecture:

1. **Local Database**: SQLite database stores all necessary data
2. **Sync Engine**: Background synchronization when connectivity is available
3. **Conflict Resolution**: Automatic and manual resolution of data conflicts
4. **Operation Queue**: Captures operations while offline for later sync
5. **Data Prioritization**: Essential data synced first when bandwidth is limited

## Map Functionality

The mapping functionality includes:

1. **GPS Tracking**: Record boundary points by walking the perimeter
2. **Manual Drawing**: Draw boundaries directly on the map
3. **Satellite Imagery**: View high-resolution imagery (cached for offline use)
4. **Layer Management**: Toggle between different map layers
5. **Boundary Validation**: Validate boundaries against existing parcels
6. **Distance & Area Calculation**: Automatic measurement of distances and areas

## Installation and Setup

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env file with appropriate values

# Install iOS dependencies
cd ios && pod install && cd ..

# Start the Metro bundler
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

## Development Workflow

1. **Feature Branches**: Create feature branches from develop
2. **Pull Requests**: Submit PRs for code review
3. **Testing**: Ensure tests pass before merging
4. **Documentation**: Update docs with changes

## Testing

```bash
# Run unit tests
npm test

# Run e2e tests
npm run e2e

# Run linting
npm run lint
```

## Building for Production

```bash
# Android
npm run build:android

# iOS
npm run build:ios
```

## Deployment

- **Android**: Google Play Store with staged rollouts
- **iOS**: Apple App Store with phased releases
- **Enterprise**: Direct distribution for field teams

## Contributing

See the [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
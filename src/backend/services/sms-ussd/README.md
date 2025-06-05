# SMS/USSD Gateway Service

Service for enabling land registry access via basic phones through SMS and USSD (*384#).

## Overview

This service provides a gateway for users with basic phones to access core LandMarking features through SMS and USSD channels. It's designed to work in areas with limited internet connectivity and for users without smartphones.

## Features

### SMS Commands
- **CHECK [PARCEL_ID]** - Check parcel ownership and status
- **VERIFY [PARCEL_ID] [PIN]** - Add verification signature
- **REGISTER [DETAILS]** - Start parcel registration process
- **STATUS** - Check verification requests
- **HELP** - Get command list

### USSD Menu (*384#)
```
1. Check Parcel
2. Verify Parcel
3. Register Parcel
4. My Parcels
5. Verification Status
6. Help
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Mobile    │────▶│  Telco API   │────▶│  SMS/USSD   │
│  Network    │     │   Gateway    │     │   Service   │
└─────────────┘     └──────────────┘     └─────────────┘
                                                │
                                                ▼
                                         ┌─────────────┐
                                         │ LandMarking │
                                         │     API     │
                                         └─────────────┘
```

## Supported Providers

- **Orange Sierra Leone**: Primary provider
- **Africell**: Secondary provider
- **Qcell**: Backup provider

## Security

- PIN-based authentication
- Session timeout after 5 minutes
- Encrypted message storage
- Rate limiting per phone number

## Installation

```bash
cd src/backend/services/sms-ussd
npm install
```

## Configuration

```env
# Telco API credentials
ORANGE_API_KEY=xxx
ORANGE_API_SECRET=xxx
AFRICELL_API_KEY=xxx
QCELL_API_KEY=xxx

# USSD Settings
USSD_SHORT_CODE=384
SESSION_TIMEOUT=300

# SMS Settings
SMS_SENDER_ID=LANDMARK
MAX_SMS_LENGTH=160
```

## Testing

```bash
npm test
npm run test:integration
```

## Deployment

Deployed as a separate service to handle high volume and telco integration requirements.
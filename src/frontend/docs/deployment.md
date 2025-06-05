# LandMarking Application Deployment Guide

This guide covers the deployment process for the LandMarking application's frontend, backend, and AI service components.

## Prerequisites

- GitHub account with access to the project repository
- Vercel account for frontend deployment
- Cloudflare account for backend deployment
- Fly.io account for AI service deployment
- Access to DNS management for your domain

## Environment Setup

### 1. Cloudflare Setup

1. **Create KV Namespaces**:
   ```bash
   wrangler kv:namespace create LAND_PARCELS
   wrangler kv:namespace create USERS
   wrangler kv:namespace create DOCUMENTS
   wrangler kv:namespace create TRANSACTIONS
   ```

2. **Create R2 Bucket**:
   ```bash
   wrangler r2 bucket create landmarking-documents
   ```

3. **Update wrangler.toml**:
   ```toml
   # In wrangler.toml
   
   [[kv_namespaces]]
   binding = "LAND_PARCELS"
   id = "your-kv-namespace-id"
   
   [[kv_namespaces]]
   binding = "USERS"
   id = "your-kv-namespace-id"
   
   [[kv_namespaces]]
   binding = "DOCUMENTS"
   id = "your-kv-namespace-id"
   
   [[kv_namespaces]]
   binding = "TRANSACTIONS"
   id = "your-kv-namespace-id"
   
   [[r2_buckets]]
   binding = "DOCUMENTS_BUCKET"
   bucket_name = "landmarking-documents"
   ```

### 2. Vercel Setup

1. **Create a New Project**:
   - Connect your GitHub repository
   - Select the `/src/frontend` directory as the root

2. **Configure Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL=https://api.landmarking.org
   NEXT_PUBLIC_AI_API_URL=https://ai.landmarking.org
   NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your-mapbox-token
   NEXT_PUBLIC_BLOCKCHAIN_API_URL=https://api.landmarking.org/blockchain
   ```

### 3. Fly.io Setup

1. **Launch the AI Service App**:
   ```bash
   cd src/ai-service
   fly launch --name landmarking-ai
   ```

2. **Set Secrets**:
   ```bash
   fly secrets set MAPBOX_ACCESS_TOKEN=your-mapbox-token
   fly secrets set MODEL_API_KEY=your-model-api-key
   ```

## GitHub Actions Configuration

### 1. Create GitHub Secrets

Add the following secrets to your GitHub repository:

1. **Cloudflare Secrets**:
   - `CF_API_TOKEN`: Your Cloudflare API token with Workers and R2 permissions
   - `CF_ACCOUNT_ID`: Your Cloudflare account ID

2. **Vercel Secrets**:
   - `VERCEL_TOKEN`: Your Vercel API token
   - `VERCEL_ORG_ID`: Your Vercel organization ID
   - `VERCEL_PROJECT_ID`: Your Vercel project ID

3. **Fly.io Secrets**:
   - `FLY_API_TOKEN`: Your Fly.io API token

### 2. Configure Workflow Files

Create workflow files in `.github/workflows/`:

#### Frontend Workflow (deploy-frontend.yml)

```yaml
name: Deploy Frontend

on:
  push:
    branches:
      - main
    paths:
      - 'src/frontend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install Vercel CLI
        run: npm install -g vercel
        
      - name: Install Dependencies
        run: |
          cd src/frontend
          yarn install
          
      - name: Run Tests
        run: |
          cd src/frontend
          yarn test
          
      - name: Deploy to Vercel
        run: |
          cd src/frontend
          vercel --prod --token=${{ secrets.VERCEL_TOKEN }} --yes
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

#### Backend Workflow (deploy-backend.yml)

```yaml
name: Deploy Backend

on:
  push:
    branches:
      - main
    paths:
      - 'src/backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install Wrangler
        run: npm install -g wrangler
        
      - name: Deploy Workers
        run: |
          cd src/backend/workers
          wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
```

#### AI Service Workflow (deploy-ai-service.yml)

```yaml
name: Deploy AI Service

on:
  push:
    branches:
      - main
    paths:
      - 'src/ai-service/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Flyctl
        uses: superfly/flyctl-actions/setup-flyctl@master
        
      - name: Deploy to Fly.io
        run: |
          cd src/ai-service
          flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

## DNS Configuration

Configure your DNS settings to point to the deployed services:

1. **Frontend (Vercel)**:
   - `landmarking.org` -> Vercel deployment
   - `www.landmarking.org` -> Vercel deployment

2. **Backend (Cloudflare Workers)**:
   - `api.landmarking.org` -> Cloudflare Workers deployment

3. **AI Service (Fly.io)**:
   - `ai.landmarking.org` -> Fly.io deployment

## Post-Deployment Verification

After deploying, perform the following checks:

1. **Connectivity Tests**:
   - Verify frontend can connect to backend API
   - Verify frontend can connect to AI service

2. **Functionality Tests**:
   - Test offline synchronization
   - Confirm map and boundary detection
   - Verify document upload and management
   - Test blockchain transaction recording

3. **Performance Monitoring**:
   - Set up monitoring for API endpoints
   - Configure alerts for service disruptions

## Rollback Procedure

If issues are detected after deployment:

1. **Frontend Rollback**:
   ```bash
   vercel rollback --prod --token=<your-token>
   ```

2. **Backend Rollback**:
   ```bash
   cd src/backend/workers
   wrangler deployment rollback
   ```

3. **AI Service Rollback**:
   ```bash
   cd src/ai-service
   fly deploy --image <previous-version>
   ```

## Maintenance and Updates

### Regular Maintenance Tasks

1. **Database Backups**:
   - Schedule weekly backups of KV namespaces
   - Store document backups from R2

2. **Certificate Renewal**:
   - Verify SSL certificates are auto-renewing

3. **Dependency Updates**:
   - Schedule quarterly dependency updates
   - Test updates in staging environment before deployment

4. **Resource Scaling**:
   - Monitor resource usage and scale as needed

## Troubleshooting

### Common Issues

1. **Offline Sync Failures**:
   - Check browser's localStorage limits
   - Verify network event listeners are properly registered

2. **Map Component Issues**:
   - Confirm Mapbox token validity
   - Check browser console for CORS issues

3. **AI Service Timeout**:
   - Verify Fly.io VM has sufficient resources
   - Check AI model loading times

4. **API Connection Issues**:
   - Verify CORS settings in Cloudflare Workers
   - Check rate limiting configuration

## Contact Information

For deployment assistance, contact:

- DevOps Team: devops@landmarking.org
- Project Lead: lead@landmarking.org
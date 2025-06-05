# LandMarking Deployment Guide

This document provides step-by-step instructions for deploying the LandMarking system to production environments.

## Overview

The LandMarking system is deployed across three main platforms:

1. **Frontend (Next.js)**: Deployed to Vercel
2. **Backend API (Cloudflare Workers)**: Deployed to Cloudflare
3. **AI Service (FastAPI)**: Deployed to Fly.io

## Prerequisites

Before deployment, you need the following accounts and credentials:

- **Cloudflare Account** with Workers and R2 enabled
- **Vercel Account** for frontend deployment
- **Fly.io Account** for AI service deployment
- **GitHub Account** for CI/CD workflows
- **Domain Name** (optional but recommended for production)

## Initial Setup

### 1. Cloudflare Setup

1. **Create KV Namespaces**:
   ```bash
   wrangler kv:namespace create USERS_KV
   wrangler kv:namespace create CONFIG_KV
   wrangler kv:namespace create --preview USERS_KV
   wrangler kv:namespace create --preview CONFIG_KV
   ```

2. **Create R2 Bucket**:
   ```bash
   wrangler r2 bucket create landmarking-documents
   wrangler r2 bucket create landmarking-documents-dev
   ```

3. **Update wrangler.toml**:
   Replace the placeholder IDs in `wrangler.toml` with the actual KV namespace IDs.

4. **Set Secrets**:
   ```bash
   wrangler secret put JWT_SECRET
   ```

### 2. Vercel Setup

1. **Link Repository**:
   - Import your GitHub repository to Vercel
   - Set the root directory to `/src/frontend`

2. **Environment Variables**:
   Create environment variables in the Vercel dashboard:
   - `MAPBOX_TOKEN`
   - `API_URL`
   - `NEXT_PUBLIC_AI_API_URL`

3. **Configure Domains**:
   In production, add your custom domain (e.g., landmarking.app)

### 3. Fly.io Setup

1. **Initial Setup**:
   ```bash
   cd src/ai
   fly launch
   ```

2. **Environment Variables**:
   ```bash
   fly secrets set LOG_LEVEL=INFO
   ```

## CI/CD Setup

GitHub Actions workflows are already configured for automated deployments. You need to add the following secrets to your GitHub repository:

- `CF_API_TOKEN`: Cloudflare API token
- `VERCEL_TOKEN`: Vercel API token
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_PROJECT_ID`: Vercel project ID
- `FLY_API_TOKEN`: Fly.io API token

## Manual Deployment

If you need to deploy manually:

### Backend (Cloudflare Workers)

```bash
cd src/backend/workers
npm run deploy          # Development environment
npm run deploy:staging  # Staging environment
npm run deploy:production # Production environment
```

### Frontend (Vercel)

```bash
cd src/frontend
vercel                  # Development/Preview deployment
vercel --prod           # Production deployment
```

### AI Service (Fly.io)

```bash
cd src/ai
fly deploy
```

## Post-Deployment Verification

After deployment, verify that all components are working correctly:

1. **Frontend**: Visit your Vercel deployment URL
2. **Backend API**: Test API endpoints
3. **AI Service**: Check the health endpoint at `/health`

## Troubleshooting

### Common Issues

1. **Missing KV Namespace IDs**:
   - Ensure the KV namespace IDs in `wrangler.toml` are correct

2. **API Connection Errors**:
   - Check CORS settings in Cloudflare Workers
   - Verify API URLs in Vercel environment variables

3. **Deployment Failures**:
   - Check GitHub Actions logs for error details
   - Verify that all required secrets are set

## Monitoring

- **Cloudflare**: Use Cloudflare dashboard for Workers monitoring
- **Vercel**: Use Vercel Analytics for frontend monitoring
- **Fly.io**: Use Fly dashboard and metrics endpoint for AI service monitoring

## Backup Strategy

- **Database**: Regular backups via Cloudflare R2
- **User Documents**: Stored in R2 with versioning enabled
- **Configuration**: Backed up weekly from KV stores

## Support

For deployment issues, contact the development team at support@landmarking.app
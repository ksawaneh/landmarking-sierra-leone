# SMS/USSD Gateway Deployment Guide

## Overview

The SMS/USSD Gateway service enables land registry access via basic phones through SMS commands and USSD menus (*384#). This guide covers deployment, configuration, and integration with Sierra Leone telco providers.

## Prerequisites

- Node.js 20.x or Docker
- Redis 7.x
- SSL certificates for webhook endpoints
- Telco API credentials (Orange, Africell, Qcell)

## Deployment Options

### Option 1: Docker Deployment (Recommended)

```bash
# Clone repository
git clone [repo-url]
cd src/backend/services/sms-ussd

# Copy environment configuration
cp .env.example .env
# Edit .env with your credentials

# Build and run with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f sms-ussd
```

### Option 2: Direct Node.js Deployment

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start service
NODE_ENV=production npm start
```

### Option 3: PM2 Deployment

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start dist/index.js --name sms-ussd --instances 2

# Save PM2 configuration
pm2 save
pm2 startup
```

## Configuration

### Environment Variables

```env
# Required Configuration
REDIS_URL=redis://redis:6379
LANDMARKING_API_URL=https://api.landmarking.gov.sl
LANDMARKING_API_KEY=your-secure-api-key

# Telco Credentials (obtain from providers)
ORANGE_API_KEY=xxx
ORANGE_API_SECRET=xxx
AFRICELL_API_KEY=xxx
QCELL_API_KEY=xxx

# Security
PIN_SALT=generate-secure-random-string
ADMIN_API_KEY=generate-secure-admin-key
```

### Telco Integration

#### 1. Orange Sierra Leone

Contact Orange technical team:
- Email: enterprise@orange.sl
- Phone: +232 76 622222

Required setup:
```
- API endpoint: https://sms.landmarking.gov.sl/api/sms/webhook/orange
- USSD endpoint: https://sms.landmarking.gov.sl/api/ussd/webhook/orange
- Short code: *384#
- Keywords: CHECK, VERIFY, REGISTER, STATUS, HELP
```

#### 2. Africell

Contact Africell VAS team:
- Email: vas@africell.sl
- Phone: +232 88 888888

Required setup:
```
- SMS API endpoint: https://sms.landmarking.gov.sl/api/sms/webhook/africell
- USSD callback: https://sms.landmarking.gov.sl/api/ussd/webhook/africell
- Service code: *384#
```

#### 3. Qcell

Contact Qcell technical support:
- Email: support@qcell.sl
- Phone: +232 30 303030

## Network Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│ Mobile Network  │────▶│ Load Balancer│────▶│  SMS/USSD   │
│   Operators     │     │   (Nginx)    │     │   Service   │
└─────────────────┘     └──────────────┘     └─────────────┘
                                                    │
                                                    ▼
                                             ┌─────────────┐
                                             │    Redis    │
                                             └─────────────┘
```

### Nginx Configuration

```nginx
upstream sms_ussd_backend {
    server sms-ussd-1:3001;
    server sms-ussd-2:3001;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name sms.landmarking.gov.sl;

    ssl_certificate /etc/ssl/certs/landmarking.crt;
    ssl_certificate_key /etc/ssl/private/landmarking.key;

    location /api/ {
        proxy_pass http://sms_ussd_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout settings for USSD
        proxy_connect_timeout 10s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
    }
}
```

## Monitoring

### Health Checks

```bash
# Check service health
curl https://sms.landmarking.gov.sl/api/health

# Check Redis connection
redis-cli ping

# Check telco provider status
curl -H "Authorization: Bearer $ADMIN_KEY" \
  https://sms.landmarking.gov.sl/api/admin/stats
```

### Prometheus Metrics

Add to `prometheus.yml`:
```yaml
scrape_configs:
  - job_name: 'sms-ussd'
    static_configs:
      - targets: ['sms-ussd:3001']
```

### Logging

Logs are stored in:
- Container: `/app/logs/`
- Host: `./logs/`

Log rotation configuration:
```bash
# /etc/logrotate.d/sms-ussd
/path/to/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 nodejs nodejs
    sharedscripts
}
```

## Security Considerations

### 1. Network Security

- Whitelist telco IP addresses in firewall
- Use SSL/TLS for all webhook endpoints
- Implement request signing verification

### 2. Application Security

- Rotate API keys quarterly
- Monitor for unusual activity patterns
- Implement fraud detection for verification abuse

### 3. Data Protection

- Encrypt PIN storage with bcrypt
- Session timeout after 5 minutes
- PCI compliance for handling phone numbers

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.scale.yml
services:
  sms-ussd:
    deploy:
      replicas: 4
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

### Redis Clustering

For high availability:
```yaml
redis:
  image: redis:7-alpine
  command: redis-server --cluster-enabled yes
  deploy:
    replicas: 3
```

## Troubleshooting

### Common Issues

1. **SMS not received**
   - Check telco webhook configuration
   - Verify API credentials
   - Check rate limits

2. **USSD session timeout**
   - Ensure response time < 5 seconds
   - Check Redis connectivity
   - Monitor session cleanup

3. **High latency**
   - Enable Redis persistence
   - Optimize database queries
   - Use connection pooling

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Test SMS processing
curl -X POST https://sms.landmarking.gov.sl/api/admin/test/sms \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to": "+23276123456", "message": "Test message"}'
```

## Backup and Recovery

### Redis Backup

```bash
# Manual backup
redis-cli BGSAVE

# Automated backup script
#!/bin/bash
BACKUP_DIR="/backups/redis"
DATE=$(date +%Y%m%d_%H%M%S)
redis-cli --rdb $BACKUP_DIR/dump_$DATE.rdb
```

### Session Recovery

In case of Redis failure:
```javascript
// Emergency session recovery from logs
npm run recover-sessions -- --from "2024-01-01" --to "2024-01-02"
```

## Performance Tuning

### Redis Optimization

```conf
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
timeout 0
tcp-keepalive 300
```

### Node.js Optimization

```javascript
// PM2 ecosystem.config.js
module.exports = {
  apps: [{
    name: 'sms-ussd',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=512'
    }
  }]
};
```

## Support

### Emergency Contacts

- Technical Lead: +232 76 100000
- DevOps Team: devops@landmarking.gov.sl
- On-call: +232 76 911911

### Runbook

1. Service down: Check Docker logs, restart containers
2. High error rate: Check telco API status, verify credentials
3. Memory issues: Clear Redis cache, restart with increased memory

## Compliance

- Follow Sierra Leone NCA regulations
- Maintain audit logs for 2 years
- Regular security assessments
- GDPR compliance for EU citizens
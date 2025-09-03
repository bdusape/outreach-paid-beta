# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Architecture Overview

This is a minimal Netlify Functions repository that serves as the **paid beta component** of the LUNTRA Outreach automation system. It provides serverless functions for health checks and potentially other paid-tier functionality.

### Core Components

- **Health Endpoint** (`netlify/functions/health.js`) - System status check that validates required environment variables
- **Environment Configuration** (`.env.i`) - Template for production environment variables
- **Netlify Functions** - Serverless deployment architecture

This repository works in conjunction with:
- **OUTREACH AGENT** - Python backend with FastAPI, AI processing, and webhook handlers
- **OUTREACH APP** - Streamlit frontend and React template selector
- **outreach-dashboard** - User dashboard interface

## Development Commands

### Netlify Functions Development

```bash
# Install Netlify CLI globally (if not already installed)
npm install -g netlify-cli

# Start local development server
netlify dev
# Functions available at: http://localhost:8888/.netlify/functions/

# Test the health endpoint specifically
netlify functions:serve
# Access at: http://localhost:9999/.netlify/functions/health
```

### Environment Setup

```bash
# Copy environment template and configure
cp .env.i .env
# Edit .env with real values for:
# - APOLLO_API_KEY (Apollo.io for lead enrichment)
# - RESEND_API_KEY or SENDGRID_API_KEY (email services)
# - STRIPE_PAYMENT_LINK (payment processing)
# - OUTBOUND_FROM_EMAIL (sender identity)
```

### Deployment

```bash
# Deploy to Netlify (requires Netlify CLI login)
netlify deploy

# Deploy to production
netlify deploy --prod

# Check deployment status
netlify status
```

### Testing

```bash
# Test health endpoint locally
curl http://localhost:8888/.netlify/functions/health

# Expected response when properly configured:
# {"ok": true, "ts": 1234567890}

# Test with missing environment variables:
# {"ok": false, "ts": 1234567890}
```

## Key Configuration

### Environment Variables Required

The health endpoint validates these critical environment variables:
- `APOLLO_API_KEY` - Apollo.io API key for lead data enrichment
- `STRIPE_PAYMENT_LINK` - Stripe payment link for beta access
- `OUTBOUND_FROM_EMAIL` - Verified sender email address

### Email Service Configuration
Choose one email provider:
- **Resend**: Set `RESEND_API_KEY` and `RESEND_FROM`
- **SendGrid**: Set `SENDGRID_API_KEY` and `FROM_EMAIL`

### Integration Points
- **Base URL**: Set `APP_BASE_URL` to your deployed Netlify URL
- **Debug Mode**: Set `DEBUG_MODE=true` for development admin panel access

## Architecture Integration

### Function as Health Check
The `health.js` function serves as a system status endpoint that:
1. Validates presence of critical API keys and configuration
2. Returns JSON status with timestamp
3. Provides HTTP 200/500 status codes for monitoring

### Part of Larger System
This repository represents the **serverless tier** of the LUNTRA outreach system:
- Handles paid beta access validation
- Provides system health monitoring
- Supports webhook endpoints (extendable)

### Data Flow Integration
```
User Payment → Stripe → Webhook Processing → Lead Enrichment → Email Outreach
                 ↓                           ↑
            Health Check              Apollo API + AI
```

## Development Notes

### Serverless Architecture
- Functions auto-scale based on demand
- Cold start considerations for performance
- Environment variables managed through Netlify dashboard

### Monitoring and Health
- Health endpoint supports uptime monitoring
- Failed health checks indicate misconfiguration
- Critical for production payment processing reliability

### Security Considerations
- API keys stored as environment variables
- No sensitive data in source code
- Health endpoint doesn't expose secret values

### Extension Pattern
To add new functions:
1. Create new file in `netlify/functions/`
2. Export `handler` function with Netlify signature
3. Update health check if new environment variables required
4. Test locally with `netlify dev`

## Relationship to Main Codebase

This minimal repository focuses specifically on the paid beta serverless infrastructure, while the main LUNTRA system components live in:
- `OUTREACH AGENT/` - Core AI and email processing
- `OUTREACH APP/` - User interface and lead management
- `outreach-dashboard/` - Customer dashboard

The health endpoint here validates that all necessary API integrations are properly configured for the full system to operate.

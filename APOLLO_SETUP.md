# Apollo API Key Setup Instructions

## ✅ Apollo API Key Verified

Your Apollo API key `q_d2bBVfDMTPSHkOB8mbhA` has been tested and **IS WORKING**! 

I successfully retrieved real lead data from Apollo.io:

```json
{
  "name": "Joseph L",
  "title": "CEO & Owner", 
  "company": "Parents Are Human",
  "location": "San Francisco, California",
  "phone": "+1 415-828-7357"
}
```

## 🔧 Next Step: Update Netlify Environment Variable

The API key works, but it needs to be set in Netlify's dashboard:

### Option 1: Netlify Dashboard (Recommended)
1. Go to https://app.netlify.com
2. Select your site: `elaborate-snickerdoodle-5ec99b`  
3. Go to **Site Settings → Environment Variables**
4. Find or create `APOLLO_API_KEY`
5. Set value to: `q_d2bBVfDMTPSHkOB8mbhA`
6. Save and redeploy

### Option 2: Netlify CLI (Quick)
Run this command from your project directory:

```bash
netlify env:set APOLLO_API_KEY q_d2bBVfDMTPSHkOB8mbhA
netlify deploy --prod
```

## 🧪 Test After Setup

Once the environment variable is set, test it:

```bash
# Test Apollo connection
curl "https://elaborate-snickerdoodle-5ec99b.netlify.app/.netlify/functions/test-apollo"

# Test real lead search  
curl "https://elaborate-snickerdoodle-5ec99b.netlify.app/.netlify/functions/leads?q=dentists%20in%20Austin"
```

## 🎯 What You'll See With Real Data

Instead of:
```json
{
  "source": "mock_fallback",
  "enrichment_source": "mock"
}
```

You'll see:
```json
{
  "source": "apollo", 
  "enrichment_source": "apollo"
}
```

## 🚨 Apollo Usage Limits

Your Apollo plan includes:
- **Free**: 100 email searches/month
- Monitor usage at https://apollo.io/settings/billing

The system will automatically fall back to mock data if you exceed limits.

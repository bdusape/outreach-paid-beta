# === Luntra MVP Environment Variables ===
# Copy this file to `.env` and fill in real values

# Apollo Places API key (for fetching real leads)
APOLLO_KEY=q_d2bBVfDMTPSHkOB8mbhA

# Email sending service (choose one)
RESEND_API_KEY=re_H7EmkHzY_35Evxg2J4cG7Qfp5eMT2BkGk
# or
SENDGRID_API_KEY=your_sendgrid_api_key_here 

# Stripe Payment
STRIPE_PAYMENT_LINK=https://buy.stripe.com/eVq9AU9M99ICctr1qA9EI01

# Outbound email identity
OUTBOUND_FROM_EMAIL=outreach@luntra.one
OUTBOUND_FROM_NAME=Luntra

# Base URL of your deployed app
# (use your Netlify URL during testing, then swap for https://app.luntra.one)
APP_BASE_URL=https://your-netlify-url.netlify.app

# Optional: Fallback data source if Google Places fails
CSV_PATH=./data/leads.csv

# Debug flag for admin panel (?debug=1)
DEBUG_MODE=false

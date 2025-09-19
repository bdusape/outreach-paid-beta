export async function handler(event, context) {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  try {
    // Return safe configuration values for frontend
    const config = {
      stripePaymentLink: process.env.STRIPE_PAYMENT_LINK || 'https://buy.stripe.com/eVq9AU9M99ICctr1qA9EI01',
      appBaseUrl: process.env.APP_BASE_URL || 'https://elaborate-snickerdoodle-5ec99b.netlify.app',
      debugMode: process.env.DEBUG_MODE === 'true',
      // Don't expose sensitive API keys
      hasApolloKey: !!(process.env.APOLLO_API_KEY && process.env.APOLLO_API_KEY !== 'your_apollo_api_key_here'),
      hasHunterKey: !!(process.env.HUNTER_API_KEY && process.env.HUNTER_API_KEY !== 'your_hunter_api_key_here'),
      hasSendgridKey: !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your_sendgrid_api_key_here'),
      hasResendKey: !!(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your_resend_api_key_here')
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
      body: JSON.stringify(config)
    };

  } catch (error) {
    console.error('❌ Config function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
}

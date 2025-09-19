export async function handler(event, context) {
  // Handle both GET and POST requests for payment confirmation
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    // Get query parameters
    const queryParams = event.queryStringParameters || {};
    const sessionId = queryParams.session_id;
    const success = queryParams.success;
    
    console.log('💳 Payment confirmation received:', { sessionId, success });

    // In a production app, you would:
    // 1. Verify the payment with Stripe using session_id
    // 2. Update user's payment status in database
    // 3. Set proper session/authentication cookies

    // For now, we'll simulate successful payment processing
    const paymentSuccess = success !== 'false' && success !== '0';
    
    if (paymentSuccess) {
      // Log successful payment
      console.log('✅ Payment confirmed, setting hasPaid=true');
      
      // In production, you'd update the user's payment status in your database
      // await updateUserPaymentStatus(userId, true);
      
      // Set a cookie or session to remember payment status
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/html',
        'Set-Cookie': 'hasPaid=true; Path=/; Max-Age=2592000; SameSite=Lax', // 30 days
        'Location': '/'
      };

      // Return redirect to home page
      return {
        statusCode: 302,
        headers: headers,
        body: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Payment Successful - Luntra</title>
              <meta http-equiv="refresh" content="3;url=/">
              <style>
                body { 
                  font-family: system-ui, -apple-system, sans-serif; 
                  max-width: 600px; 
                  margin: 100px auto; 
                  text-align: center; 
                  padding: 20px;
                  background: #f9fafb;
                }
                .success { 
                  color: #059669; 
                  background: #ecfdf5; 
                  padding: 20px; 
                  border-radius: 8px; 
                  border: 1px solid #d1fae5;
                }
                .loading { margin-top: 20px; color: #6b7280; }
                .logo { font-size: 2rem; margin-bottom: 20px; }
              </style>
            </head>
            <body>
              <div class="logo">🚀 Luntra</div>
              <div class="success">
                <h2>✅ Payment Successful!</h2>
                <p>Your payment has been confirmed. You now have full access to Luntra Outreach.</p>
                <p>Redirecting you back to the application...</p>
              </div>
              <div class="loading">
                <p>If you're not redirected automatically, <a href="/">click here</a>.</p>
              </div>
              <script>
                // Store payment status in localStorage as backup
                localStorage.setItem('hasPaid', 'true');
                localStorage.setItem('paymentConfirmedAt', new Date().toISOString());
                
                // Redirect after 3 seconds
                setTimeout(() => {
                  window.location.href = '/';
                }, 3000);
              </script>
            </body>
          </html>
        `
      };
    } else {
      // Payment failed or cancelled
      console.log('❌ Payment failed or cancelled');
      
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/html'
        },
        body: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Payment Cancelled - Luntra</title>
              <meta http-equiv="refresh" content="5;url=/">
              <style>
                body { 
                  font-family: system-ui, -apple-system, sans-serif; 
                  max-width: 600px; 
                  margin: 100px auto; 
                  text-align: center; 
                  padding: 20px;
                  background: #f9fafb;
                }
                .error { 
                  color: #dc2626; 
                  background: #fef2f2; 
                  padding: 20px; 
                  border-radius: 8px; 
                  border: 1px solid #fecaca;
                }
                .logo { font-size: 2rem; margin-bottom: 20px; }
              </style>
            </head>
            <body>
              <div class="logo">🚀 Luntra</div>
              <div class="error">
                <h2>❌ Payment Cancelled</h2>
                <p>Your payment was cancelled or could not be processed.</p>
                <p>You can try again or continue with limited access.</p>
              </div>
              <p><a href="/">Return to Application</a></p>
            </body>
          </html>
        `
      };
    }

  } catch (error) {
    console.error('❌ Payment processing error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Payment processing failed',
        message: error.message
      })
    };
  }
}

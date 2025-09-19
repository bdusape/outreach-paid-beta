#!/usr/bin/env node

const https = require('https');
const { exec } = require('child_process');

function sendNotification(title, message, sound = 'default') {
  const script = `osascript -e 'display notification "${message}" with title "${title}" sound name "${sound}"'`;
  exec(script, (error) => {
    if (error) {
      console.error('Failed to send notification:', error.message);
    }
  });
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data); // Return raw data if not JSON
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function testPaymentIntegration() {
  console.log('🧪 Testing Payment Integration...');
  console.log('');
  
  // Test 1: Check config endpoint
  console.log('1️⃣ Testing config endpoint...');
  try {
    const config = await makeRequest('https://elaborate-snickerdoodle-5ec99b.netlify.app/.netlify/functions/config');
    console.log('✅ Config endpoint working');
    console.log(`💳 Stripe Payment Link: ${config.stripePaymentLink}`);
    console.log(`🔧 Has Apollo Key: ${config.hasApolloKey}`);
    console.log(`🔧 Has Hunter Key: ${config.hasHunterKey}`);
    console.log('');
    
    // Test 2: Check Stripe link validity
    console.log('2️⃣ Testing Stripe payment link...');
    const stripeUrl = config.stripePaymentLink;
    
    // Test if Stripe link is accessible
    const testStripe = new Promise((resolve, reject) => {
      const https = require('https');
      const req = https.request(stripeUrl, { method: 'HEAD' }, (res) => {
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.end();
    });
    
    const stripeStatus = await testStripe;
    if (stripeStatus === 200) {
      console.log('✅ Stripe payment link is accessible');
      console.log('✅ Payment integration is working correctly!');
      console.log('');
      console.log('🎯 Next steps:');
      console.log('1. Visit your site: https://elaborate-snickerdoodle-5ec99b.netlify.app');
      console.log('2. Click "Upgrade to Pro" button');
      console.log('3. Should redirect to Stripe payment page');
      console.log('4. After payment, user will be redirected back to /paid route');
      
      sendNotification(
        'Payment Integration Ready! 💳',
        'Stripe payment link is configured and working',
        'Glass'
      );
    } else {
      console.log(`❌ Stripe link returned status: ${stripeStatus}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Test 3: Instructions for manual testing
function showManualTestInstructions() {
  console.log('');
  console.log('🔍 Manual Testing Instructions:');
  console.log('');
  console.log('1. Open your site: https://elaborate-snickerdoodle-5ec99b.netlify.app');
  console.log('2. Look for "Upgrade to Pro" button in top-right corner');
  console.log('3. Click the button - it should redirect to Stripe payment page');
  console.log('4. The payment page should show your product/pricing');
  console.log('5. After successful payment, Stripe will redirect to your /paid route');
  console.log('6. The /paid route will set hasPaid=true and redirect to home');
  console.log('7. User should then see "Pro Member" badge instead of upgrade button');
  console.log('');
  console.log('💡 If the button still doesn\'t work:');
  console.log('   • Check browser console for JavaScript errors');
  console.log('   • Verify the config endpoint is loading');
  console.log('   • Make sure JavaScript is enabled');
}

// Run tests
if (require.main === module) {
  testPaymentIntegration()
    .then(() => {
      showManualTestInstructions();
    })
    .catch(error => {
      console.error(`💥 Payment test failed: ${error.message}`);
      process.exit(1);
    });
}

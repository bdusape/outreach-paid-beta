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
          reject(new Error('Invalid JSON response'));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function testHunterAPI(apiKey) {
  console.log('🧪 Testing Hunter.io API...');
  
  // Test with a known domain
  const testDomain = 'stripe.com';
  const url = `https://api.hunter.io/v2/domain-search?domain=${testDomain}&api_key=${apiKey}&limit=3`;
  
  try {
    const response = await makeRequest(url);
    
    if (response.errors) {
      console.log('❌ Hunter.io API Error:', response.errors[0]?.details || 'Unknown error');
      return false;
    }
    
    if (response.data) {
      console.log('✅ Hunter.io API working!');
      console.log(`📊 Found ${response.data.emails?.length || 0} emails for ${testDomain}`);
      
      if (response.data.emails && response.data.emails.length > 0) {
        console.log('📧 Sample emails:');
        response.data.emails.slice(0, 2).forEach(email => {
          console.log(`  • ${email.value} (confidence: ${email.confidence}%)`);
        });
      }
      
      // Show account info
      if (response.meta) {
        console.log(`💳 API calls remaining: ${response.meta.calls?.left || 'Unknown'} / ${response.meta.calls?.limit || 'Unknown'}`);
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Hunter.io test failed:', error.message);
    return false;
  }
}

async function testGooglePlacesAPI(apiKey) {
  console.log('🧪 Testing Google Places API...');
  
  const query = 'coffee shop san francisco';
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
  
  try {
    const response = await makeRequest(url);
    
    if (response.status === 'OK') {
      console.log('✅ Google Places API working!');
      console.log(`📍 Found ${response.results?.length || 0} places for "${query}"`);
      
      if (response.results && response.results.length > 0) {
        const sample = response.results[0];
        console.log('🏢 Sample result:');
        console.log(`  • Name: ${sample.name}`);
        console.log(`  • Address: ${sample.formatted_address}`);
        console.log(`  • Rating: ${sample.rating || 'N/A'}`);
      }
      
      return true;
    } else {
      console.log('❌ Google Places API Error:', response.error_message || response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Google Places test failed:', error.message);
    return false;
  }
}

async function testHunterLeadsFunction() {
  console.log('🧪 Testing hunter-leads function...');
  
  const url = 'https://elaborate-snickerdoodle-5ec99b.netlify.app/.netlify/functions/hunter-leads?q=coffee%20shops%20in%20austin&limit=2';
  
  try {
    const response = await makeRequest(url);
    
    if (response.leads) {
      console.log('✅ Hunter-leads function working!');
      console.log(`📊 Found ${response.leads.length} leads`);
      console.log(`🔍 Source: ${response.source}`);
      
      if (response.leads.length > 0) {
        const sample = response.leads[0];
        console.log('📋 Sample lead:');
        console.log(`  • Company: ${sample.company}`);
        console.log(`  • Email: ${sample.email}`);
        console.log(`  • Source: ${sample.enrichment_source}`);
      }
      
      return true;
    } else {
      console.log('❌ Hunter-leads function error:', response.error || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error('❌ Hunter-leads function test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Hunter.io Alternative Setup & Testing');
  console.log('');
  
  console.log('📋 Setup Steps:');
  console.log('1. Sign up for Hunter.io free account: https://hunter.io/users/sign_up');
  console.log('2. Get your API key from: https://hunter.io/api_keys');
  console.log('3. Add HUNTER_API_KEY to your .env file');
  console.log('4. Optional: Get Google Places API key for business discovery');
  console.log('');
  
  // Check if API keys are configured
  const hunterKey = process.env.HUNTER_API_KEY;
  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  
  console.log('🔍 Checking current configuration...');
  console.log(`Hunter.io API Key: ${hunterKey ? '✅ Configured' : '❌ Not found'}`);
  console.log(`Google Places API Key: ${googleKey ? '✅ Configured' : '❌ Not found'}`);
  console.log('');
  
  if (!hunterKey) {
    console.log('⚠️ Hunter.io API key not found in environment');
    console.log('💡 Add this to your .env file:');
    console.log('   HUNTER_API_KEY=your_hunter_api_key_here');
    console.log('');
    return;
  }
  
  // Test Hunter.io API
  const hunterWorks = await testHunterAPI(hunterKey);
  console.log('');
  
  // Test Google Places API if configured
  if (googleKey) {
    const placesWorks = await testGooglePlacesAPI(googleKey);
    console.log('');
  } else {
    console.log('⚠️ Google Places API not configured (optional but recommended)');
    console.log('💡 Get key from: https://console.cloud.google.com/apis/credentials');
    console.log('');
  }
  
  // Test the combined function
  await testHunterLeadsFunction();
  console.log('');
  
  if (hunterWorks) {
    console.log('🎉 Hunter.io alternative is ready!');
    console.log('');
    console.log('📖 Usage examples:');
    console.log('curl "https://your-app.netlify.app/.netlify/functions/hunter-leads?q=marketing%20agencies%20in%20denver&limit=5"');
    console.log('');
    console.log('🔄 To switch from Apollo to Hunter.io:');
    console.log('1. Update your frontend to use /hunter-leads endpoint');
    console.log('2. Deploy the new function');
    console.log('3. Test with real queries');
    
    sendNotification(
      'Hunter.io Alternative Ready! 🎉',
      'Email finding system is configured and working',
      'Glass'
    );
  } else {
    console.log('❌ Setup incomplete - check API keys and try again');
  }
}

// Run the setup
if (require.main === module) {
  main().catch(error => {
    console.error(`💥 Setup failed: ${error.message}`);
    process.exit(1);
  });
}

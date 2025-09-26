#!/usr/bin/env node

const https = require('https');
const { exec } = require('child_process');

const HUNTER_API_KEY = 'ab8c60231a95eb18ed6f97f2e0fa8a76b995d711';

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

async function testHunterDomain(domain) {
  console.log(`🔍 Searching for emails at ${domain}...`);
  
  const url = `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_API_KEY}&limit=5`;
  
  try {
    const response = await makeRequest(url);
    
    if (response.errors) {
      console.log(`❌ Error for ${domain}:`, response.errors[0]?.details);
      return [];
    }
    
    if (response.data && response.data.emails) {
      const emails = response.data.emails;
      console.log(`✅ Found ${emails.length} emails for ${domain}:`);
      
      emails.forEach(email => {
        console.log(`  📧 ${email.value} (${email.first_name} ${email.last_name}) - ${email.confidence}% confidence`);
        console.log(`      Position: ${email.position || 'Unknown'}`);
      });
      
      return emails;
    }
    
    console.log(`⏳ No emails found for ${domain}`);
    return [];
    
  } catch (error) {
    console.error(`❌ Hunter.io error for ${domain}:`, error.message);
    return [];
  }
}

async function main() {
  console.log('🚀 Direct Hunter.io Email Finding Test');
  console.log(`🔑 Using API key: ${HUNTER_API_KEY.substring(0, 8)}...`);
  console.log('');
  
  // Test with some known company domains
  const testDomains = [
    'mailchimp.com',
    'hubspot.com', 
    'salesforce.com',
    'adobe.com',
    'shopify.com'
  ];
  
  let totalEmails = 0;
  let successfulDomains = 0;
  
  for (const domain of testDomains) {
    const emails = await testHunterDomain(domain);
    
    if (emails.length > 0) {
      totalEmails += emails.length;
      successfulDomains++;
    }
    
    console.log('');
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('📊 Test Summary:');
  console.log(`✅ Found emails at ${successfulDomains}/${testDomains.length} domains`);
  console.log(`📧 Total emails found: ${totalEmails}`);
  
  if (totalEmails > 0) {
    console.log('🎉 Hunter.io is working great! Real emails found!');
    sendNotification(
      'Hunter.io Working! 🎉',
      `Found ${totalEmails} real emails across ${successfulDomains} companies`,
      'Glass'
    );
  } else {
    console.log('⏳ No emails found - might need to test different domains');
  }
  
  console.log('');
  console.log('💡 Next steps:');
  console.log('1. Test with specific company domains you want to target');
  console.log('2. Combine with business discovery (Google Places, manual research)');
  console.log('3. Use the email patterns as backup for domains without Hunter data');
}

// Run the test
if (require.main === module) {
  main().catch(error => {
    console.error(`💥 Test failed: ${error.message}`);
    process.exit(1);
  });
}

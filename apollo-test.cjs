#!/usr/bin/env node

const https = require('https');
const { exec } = require('child_process');

const APOLLO_API_KEY = 'AqrWtiBrg7z3mduSGlVeKw';

function sendNotification(title, message, sound = 'default') {
  const script = `osascript -e 'display notification "${message}" with title "${title}" sound name "${sound}"'`;
  exec(script, (error) => {
    if (error) {
      console.error('Failed to send notification:', error.message);
    }
  });
}

function makeApolloRequest(endpoint, method = 'POST', data = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: 'api.apollo.io',
      port: 443,
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': APOLLO_API_KEY
      }
    };
    
    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

// Test search with reveal_personal_emails parameter
async function testSearchWithReveal() {
  console.log('🔍 Testing people search with reveal_personal_emails...');
  
  const searchPayload = {
    person_titles: ["ceo", "founder"],
    organization_locations: ["Denver"],
    page: 1,
    per_page: 2,
    reveal_personal_emails: true,
    reveal_phone_number: true
  };
  
  try {
    const response = await makeApolloRequest('/v1/mixed_people/search', 'POST', searchPayload);
    console.log(`📊 Search with reveal status: ${response.status}`);
    
    if (response.status === 200 && response.data.people) {
      console.log(`📋 Found ${response.data.people.length} people`);
      
      const unlockedEmails = response.data.people.filter(p => 
        p.email && !p.email.includes('email_not_unlocked')
      );
      
      if (unlockedEmails.length > 0) {
        console.log('🎉 SUCCESS! Found unlocked emails:');
        unlockedEmails.forEach(person => {
          console.log(`  ✅ ${person.first_name} ${person.last_name}: ${person.email}`);
        });
        
        sendNotification(
          'Apollo Emails Unlocked! 🎉',
          `${unlockedEmails.length} emails unlocked via search API`,
          'Glass'
        );
        
        return unlockedEmails;
      } else {
        console.log('⏳ All emails still locked even with reveal flag');
        if (response.data.people[0]) {
          console.log('📄 Sample person email:', response.data.people[0].email);
        }
      }
    } else if (response.status === 402) {
      console.log('💳 Payment required for email reveal');
      console.log('📄 Response:', response.data);
    } else {
      console.log(`❌ Search failed with status ${response.status}:`, response.data);
    }
    
    return [];
  } catch (error) {
    console.error('❌ Search error:', error.message);
    return [];
  }
}

async function main() {
  console.log('🚀 Testing Apollo API with Reveal Parameters');
  console.log(`🔑 Using API key: ${APOLLO_API_KEY.substring(0, 8)}...`);
  console.log('');
  
  // Test search with reveal parameters
  const unlockedFromSearch = await testSearchWithReveal();
  
  if (unlockedFromSearch.length > 0) {
    console.log(`\n🎊 SUCCESS: Found ${unlockedFromSearch.length} unlocked emails!`);
  } else {
    console.log('\n📋 No emails could be unlocked with current API key');
    console.log('💡 This suggests email unlocking requires:');
    console.log('   • Apollo subscription upgrade');
    console.log('   • Purchase of email reveal credits');
    console.log('   • Different API permissions');
  }
}

// Run the test
if (require.main === module) {
  main().catch(error => {
    console.error(`💥 API test failed: ${error.message}`);
    process.exit(1);
  });
}

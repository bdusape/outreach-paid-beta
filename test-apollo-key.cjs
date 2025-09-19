#!/usr/bin/env node

const https = require('https');

// Test different queries to find unlocked emails
const testQueries = [
  'software companies in Austin',
  'marketing agencies in Seattle', 
  'consulting firms in Boston',
  'tech startups in Denver',
  'small businesses in Portland'
];

const ENDPOINT = 'https://elaborate-snickerdoodle-5ec99b.netlify.app/.netlify/functions/leads';
const LIMIT = 2;

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

async function testQuery(query) {
  try {
    console.log(`\n🔍 Testing: "${query}"`);
    const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&limit=${LIMIT}`;
    const response = await makeRequest(url);
    
    if (!response.leads || !Array.isArray(response.leads)) {
      console.log('❌ Invalid response structure');
      return;
    }
    
    const unlockedEmails = response.leads.filter(lead => 
      lead.email && !lead.email.includes('email_not_unlocked')
    );
    
    const lockedEmails = response.leads.filter(lead => 
      lead.email && lead.email.includes('email_not_unlocked')
    );
    
    console.log(`📊 Results: ${response.leads.length} leads total`);
    console.log(`🔓 Unlocked: ${unlockedEmails.length}`);
    console.log(`🔒 Locked: ${lockedEmails.length}`);
    
    if (unlockedEmails.length > 0) {
      console.log('🎉 FOUND UNLOCKED EMAILS:');
      unlockedEmails.forEach(lead => {
        console.log(`  ✅ ${lead.name} (${lead.company}): ${lead.email}`);
      });
      return true; // Found unlocked emails
    } else {
      console.log('⏳ All emails still locked');
      return false;
    }
    
  } catch (error) {
    console.log(`❌ Error testing "${query}": ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Testing new Apollo API key: AqrWtiBrg7z3mduSGlVeKw');
  console.log('🎯 Looking for unlocked emails across different queries...\n');
  
  let foundUnlocked = false;
  
  for (const query of testQueries) {
    const hasUnlocked = await testQuery(query);
    if (hasUnlocked) {
      foundUnlocked = true;
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n📋 Test Summary:');
  if (foundUnlocked) {
    console.log('🎉 SUCCESS: Found some unlocked emails!');
    console.log('💡 The new API key is working and has access to email data.');
  } else {
    console.log('⏳ All tested queries returned locked emails');
    console.log('💡 This suggests:');
    console.log('   • The API key is valid but needs credits to unlock emails');
    console.log('   • Email unlocking may require Apollo account upgrade');
    console.log('   • Or emails need to be individually unlocked in Apollo dashboard');
  }
}

// Run the tests
if (require.main === module) {
  runTests().catch(error => {
    console.error(`💥 Test failed: ${error.message}`);
    process.exit(1);
  });
}

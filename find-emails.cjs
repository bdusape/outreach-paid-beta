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

// Try Apollo's email finder API for specific people
async function findEmail(firstName, lastName, company) {
  console.log(`🔍 Finding email for ${firstName} ${lastName} at ${company}...`);
  
  const payload = {
    first_name: firstName,
    last_name: lastName,
    organization_name: company
  };
  
  try {
    const response = await makeApolloRequest('/v1/email_accounts', 'POST', payload);
    console.log(`📊 Email finder response status: ${response.status}`);
    
    if (response.status === 200 && response.data.account) {
      const email = response.data.account.email;
      if (email && !email.includes('email_not_unlocked')) {
        console.log(`✅ Found email: ${email}`);
        return email;
      } else {
        console.log(`⏳ Email still locked: ${email}`);
      }
    } else if (response.status === 402) {
      console.log('💳 Payment required for email finder');
    } else {
      console.log('❌ Email finder failed:', response.data);
    }
    
    return null;
  } catch (error) {
    console.error('❌ Email finder error:', error.message);
    return null;
  }
}

// Try Apollo's credit information
async function checkCredits() {
  console.log('💰 Checking Apollo account credits...');
  
  try {
    const response = await makeApolloRequest('/v1/users/current', 'GET');
    console.log(`📊 Account info status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('📄 Account data:', JSON.stringify(response.data, null, 2));
      
      if (response.data.user) {
        const user = response.data.user;
        console.log(`👤 User: ${user.first_name} ${user.last_name}`);
        console.log(`📧 Email: ${user.email}`);
        
        // Check for credit information
        if (user.email_credit_balance !== undefined) {
          console.log(`💳 Email credits: ${user.email_credit_balance}`);
        }
        
        if (user.export_credit_balance !== undefined) {
          console.log(`📤 Export credits: ${user.export_credit_balance}`);
        }
      }
    } else {
      console.log('❌ Account check failed:', response.data);
    }
  } catch (error) {
    console.error('❌ Account check error:', error.message);
  }
}

// Try to use Apollo's enrichment with specific parameters
async function enrichPerson(personId, unlock = true) {
  console.log(`🔬 Enriching person ${personId} with unlock=${unlock}...`);
  
  const payload = {
    reveal_personal_emails: unlock,
    reveal_phone_number: unlock
  };
  
  try {
    const response = await makeApolloRequest(`/v1/people/${personId}/enrich`, 'POST', payload);
    console.log(`📊 Enrichment status: ${response.status}`);
    console.log('📄 Response:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 && response.data.person) {
      const person = response.data.person;
      if (person.email && !person.email.includes('email_not_unlocked')) {
        console.log(`✅ Successfully enriched: ${person.first_name} ${person.last_name} - ${person.email}`);
        return person;
      }
    } else if (response.status === 402) {
      console.log('💳 Enrichment requires payment/credits');
    }
    
    return null;
  } catch (error) {
    console.error('❌ Enrichment error:', error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Apollo Email Finder & Unlock Attempt');
  console.log(`🔑 Using API key: ${APOLLO_API_KEY.substring(0, 8)}...`);
  console.log('');
  
  // Check account credits first
  await checkCredits();
  console.log('');
  
  // Try finding emails for known contacts
  const testContacts = [
    { firstName: 'Jack', lastName: 'Martin', company: 'Abbotts Cleanup & Restoration' },
    { firstName: 'Eboni', lastName: 'Blake', company: 'EBI Labs' },
    { firstName: 'Khris', lastName: 'Thayer', company: 'Optizmo Technologies' }
  ];
  
  console.log('🎯 Attempting email finder for known contacts...');
  let foundEmails = [];
  
  for (const contact of testContacts) {
    const email = await findEmail(contact.firstName, contact.lastName, contact.company);
    if (email) {
      foundEmails.push({ ...contact, email });
    }
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
  }
  
  if (foundEmails.length > 0) {
    console.log(`\n🎉 SUCCESS: Found ${foundEmails.length} emails!`);
    foundEmails.forEach(contact => {
      console.log(`  ✅ ${contact.firstName} ${contact.lastName}: ${contact.email}`);
    });
    
    sendNotification(
      'Emails Found! 🎉',
      `${foundEmails.length} emails discovered via Apollo API`,
      'Glass'
    );
  } else {
    console.log('\n❌ No emails could be unlocked via email finder');
  }
  
  // Try enrichment with unlock for specific person IDs
  console.log('\n🔄 Trying enrichment with unlock flag...');
  const personIds = ['60c614126c31a50001b0d7a6', '54a7b801746869705a0bc14e'];
  
  for (const personId of personIds) {
    await enrichPerson(personId, true);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
  }
  
  console.log('\n📋 Email unlock attempts completed');
}

// Run the finder
if (require.main === module) {
  main().catch(error => {
    console.error(`💥 Email finder failed: ${error.message}`);
    process.exit(1);
  });
}

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

// Function to make Apollo API requests
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

// Get specific contact details first
async function searchForContacts() {
  console.log('🔍 Searching for contacts to unlock...');
  
  const searchPayload = {
    person_titles: ["owner", "ceo", "president", "founder"],
    organization_locations: ["Denver", "Austin", "Seattle"],
    page: 1,
    per_page: 5,
    person_seniorities: ["owner", "c_level", "vp"]
  };
  
  try {
    const response = await makeApolloRequest('/v1/mixed_people/search', 'POST', searchPayload);
    console.log(`📊 Search response status: ${response.status}`);
    
    if (response.status === 200 && response.data.people) {
      console.log(`📋 Found ${response.data.people.length} contacts`);
      return response.data.people.slice(0, 3); // Take first 3 for unlocking
    } else {
      console.log('❌ Search failed:', response.data);
      return [];
    }
  } catch (error) {
    console.error('❌ Search error:', error.message);
    return [];
  }
}

// Try to unlock emails using Apollo's email reveal API
async function unlockEmails(contacts) {
  console.log(`\n🔓 Attempting to unlock ${contacts.length} emails...`);
  
  const contactIds = contacts.map(c => c.id);
  console.log('📋 Contact IDs to unlock:', contactIds);
  
  // Try the email reveal endpoint
  const revealPayload = {
    contact_ids: contactIds
  };
  
  try {
    console.log('📡 Calling Apollo email reveal API...');
    const response = await makeApolloRequest('/v1/contacts/reveal', 'POST', revealPayload);
    
    console.log(`📊 Reveal response status: ${response.status}`);
    console.log('📄 Response data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200) {
      console.log('🎉 Email reveal request successful!');
      
      if (response.data.contacts) {
        const unlockedContacts = response.data.contacts.filter(c => c.email && !c.email.includes('email_not_unlocked'));
        
        if (unlockedContacts.length > 0) {
          console.log(`✅ Successfully unlocked ${unlockedContacts.length} emails:`);
          unlockedContacts.forEach(contact => {
            console.log(`  🎯 ${contact.first_name} ${contact.last_name}: ${contact.email}`);
          });
          
          // Send notification
          sendNotification(
            'Emails Successfully Unlocked! 🎉',
            `${unlockedContacts.length} emails revealed via Apollo API`,
            'Glass'
          );
          
          return unlockedContacts;
        } else {
          console.log('⏳ Emails still locked after reveal attempt');
        }
      }
    } else if (response.status === 402) {
      console.log('💳 Payment required - insufficient Apollo credits');
      sendNotification(
        'Apollo Credits Required 💳',
        'Email unlock requires additional credits',
        'default'
      );
    } else if (response.status === 403) {
      console.log('🚫 Access denied - API key may lack email reveal permissions');
    } else {
      console.log(`❌ Unlock failed with status ${response.status}`);
    }
    
    return [];
    
  } catch (error) {
    console.error('❌ Unlock error:', error.message);
    return [];
  }
}

// Alternative: Try individual contact enrichment
async function enrichContact(contactId) {
  console.log(`\n🔬 Attempting individual enrichment for contact ${contactId}...`);
  
  try {
    const response = await makeApolloRequest(`/v1/people/${contactId}`, 'GET');
    console.log(`📊 Enrichment response status: ${response.status}`);
    
    if (response.status === 200) {
      const person = response.data.person;
      if (person && person.email && !person.email.includes('email_not_unlocked')) {
        console.log(`✅ Contact enriched: ${person.first_name} ${person.last_name} - ${person.email}`);
        return person;
      } else {
        console.log(`⏳ Email still locked for ${person?.first_name} ${person?.last_name}`);
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Enrichment error:', error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Apollo Email Unlock Attempt');
  console.log(`🔑 Using API key: ${APOLLO_API_KEY.substring(0, 8)}...`);
  console.log('');
  
  // Step 1: Search for contacts
  const contacts = await searchForContacts();
  
  if (contacts.length === 0) {
    console.log('❌ No contacts found to unlock');
    return;
  }
  
  // Step 2: Try bulk email reveal
  const unlockedContacts = await unlockEmails(contacts);
  
  if (unlockedContacts.length > 0) {
    console.log(`\n🎊 SUCCESS: ${unlockedContacts.length} emails unlocked!`);
    return;
  }
  
  // Step 3: Try individual enrichment as fallback
  console.log('\n🔄 Trying individual contact enrichment...');
  
  for (const contact of contacts.slice(0, 2)) { // Try first 2 individually
    await enrichContact(contact.id);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
  }
  
  console.log('\n📋 Email unlock attempts completed');
  console.log('💡 If emails are still locked, you may need to:');
  console.log('   • Purchase Apollo credits for email reveals');
  console.log('   • Upgrade your Apollo plan');
  console.log('   • Manually unlock emails in Apollo dashboard');
}

// Run the unlock attempt
if (require.main === module) {
  main().catch(error => {
    console.error(`💥 Unlock script failed: ${error.message}`);
    process.exit(1);
  });
}

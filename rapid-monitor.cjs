#!/usr/bin/env node

const https = require('https');
const { exec } = require('child_process');

const ENDPOINT = 'https://elaborate-snickerdoodle-5ec99b.netlify.app/.netlify/functions/leads';
const QUERIES = [
  'marketing agencies in Denver',
  'software companies in Austin',
  'tech startups in Seattle',
  'consulting firms in Boston'
];
const CHECK_INTERVAL = 30000; // 30 seconds for rapid monitoring
const RAPID_DURATION = 10 * 60 * 1000; // Monitor rapidly for 10 minutes

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

async function checkForUnlockedEmails() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🔄 Rapid check cycle...`);
  
  let totalUnlocked = 0;
  let totalLeads = 0;
  
  for (const query of QUERIES) {
    try {
      const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&limit=3`;
      const response = await makeRequest(url);
      
      if (response.leads && Array.isArray(response.leads)) {
        totalLeads += response.leads.length;
        
        const unlockedEmails = response.leads.filter(lead => 
          lead.email && !lead.email.includes('email_not_unlocked')
        );
        
        if (unlockedEmails.length > 0) {
          totalUnlocked += unlockedEmails.length;
          console.log(`🎉 FOUND UNLOCKED EMAILS in "${query}":`);
          unlockedEmails.forEach(lead => {
            console.log(`  ✅ ${lead.name} (${lead.company}): ${lead.email}`);
          });
          
          // Send immediate notification
          sendNotification(
            'Apollo Emails UNLOCKED! 🎉',
            `${unlockedEmails.length} emails available in "${query}"`,
            'Glass'
          );
        }
      }
      
      // Small delay between queries
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.log(`❌ Error checking "${query}": ${error.message}`);
    }
  }
  
  if (totalUnlocked === 0) {
    console.log(`⏳ All ${totalLeads} leads still locked across ${QUERIES.length} queries`);
  } else {
    console.log(`🎊 TOTAL: ${totalUnlocked} unlocked emails found!`);
  }
}

async function startRapidMonitoring() {
  console.log('🚀 Starting RAPID Apollo monitoring...');
  console.log(`⚡ Checking every ${CHECK_INTERVAL/1000} seconds`);
  console.log(`⏱️ Will run for ${RAPID_DURATION/60000} minutes`);
  console.log(`🔍 Testing ${QUERIES.length} different queries per cycle`);
  console.log('');
  
  // Send startup notification
  sendNotification(
    'Rapid Apollo Monitor Started ⚡',
    `Checking every ${CHECK_INTERVAL/1000}s for unlocked emails`,
    'default'
  );
  
  // Initial check
  await checkForUnlockedEmails();
  
  // Set up rapid checking
  const intervalId = setInterval(async () => {
    await checkForUnlockedEmails();
  }, CHECK_INTERVAL);
  
  // Stop rapid monitoring after duration
  setTimeout(() => {
    clearInterval(intervalId);
    console.log('');
    console.log('🏁 Rapid monitoring complete');
    console.log('📡 Switching back to standard 3-minute monitoring');
    
    sendNotification(
      'Rapid Monitor Complete 🏁',
      'Switching back to standard monitoring',
      'default'
    );
    
    process.exit(0);
  }, RAPID_DURATION);
  
  console.log('📡 Rapid monitoring active. Press Ctrl+C to stop early.');
  console.log('');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('🛑 Rapid monitoring stopped by user');
  process.exit(0);
});

// Start rapid monitoring
if (require.main === module) {
  startRapidMonitoring().catch(error => {
    console.error(`💥 Rapid monitor failed: ${error.message}`);
    process.exit(1);
  });
}

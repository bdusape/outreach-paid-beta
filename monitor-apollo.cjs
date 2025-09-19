#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configuration
const ENDPOINT = 'https://elaborate-snickerdoodle-5ec99b.netlify.app/.netlify/functions/leads';
const QUERY = 'marketing agencies in Denver';
const LIMIT = 5;
const CHECK_INTERVAL = 3 * 60 * 1000; // 3 minutes
const LOG_FILE = path.join(__dirname, 'apollo-monitor.log');

// Function to make HTTP request
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

// Function to send macOS desktop notification
function sendNotification(title, message, sound = 'default') {
  const script = `osascript -e 'display notification "${message}" with title "${title}" sound name "${sound}"'`;
  exec(script, (error) => {
    if (error) {
      console.error('Failed to send notification:', error.message);
    }
  });
}

// Function to log messages
function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  
  console.log(logEntry.trim());
  fs.appendFileSync(LOG_FILE, logEntry);
}

// Function to check Apollo API
async function checkApollo() {
  try {
    const url = `${ENDPOINT}?q=${encodeURIComponent(QUERY)}&limit=${LIMIT}`;
    const response = await makeRequest(url);
    
    if (!response.leads || !Array.isArray(response.leads)) {
      log('ERROR: Invalid response structure');
      return;
    }
    
    const totalLeads = response.leads.length;
    const unlockedEmails = response.leads.filter(lead => 
      lead.email && !lead.email.includes('email_not_unlocked')
    );
    
    const lockedEmails = response.leads.filter(lead => 
      lead.email && lead.email.includes('email_not_unlocked')
    );
    
    log(`📊 Status Check: ${totalLeads} leads total`);
    log(`🔓 Unlocked emails: ${unlockedEmails.length}`);
    log(`🔒 Locked emails: ${lockedEmails.length}`);
    
    if (unlockedEmails.length > 0) {
      log('🎉 EMAILS UNLOCKED! Here are the available emails:');
      unlockedEmails.forEach(lead => {
        log(`  • ${lead.name} (${lead.company}): ${lead.email}`);
      });
      log('💡 You can now use these emails for outreach!');
      
      // Send desktop notification
      const emailList = unlockedEmails.map(lead => `${lead.name} (${lead.company})`).join(', ');
      sendNotification(
        'Apollo Emails Unlocked! 🎉',
        `${unlockedEmails.length} email${unlockedEmails.length > 1 ? 's' : ''} now available: ${emailList}`,
        'Glass'
      );
    }
    
    if (lockedEmails.length > 0) {
      log('⏳ Still waiting for these emails to unlock:');
      lockedEmails.forEach(lead => {
        log(`  • ${lead.name} (${lead.company}): ${lead.title}`);
      });
    }
    
    // Save snapshot for comparison
    const snapshot = {
      timestamp: new Date().toISOString(),
      totalLeads,
      unlockedCount: unlockedEmails.length,
      lockedCount: lockedEmails.length,
      leads: response.leads
    };
    
    // Compare with previous before saving new snapshot
    compareWithPrevious(snapshot);
    
    fs.writeFileSync(
      path.join(__dirname, 'apollo-snapshot.json'), 
      JSON.stringify(snapshot, null, 2)
    );
    
  } catch (error) {
    log(`❌ ERROR: ${error.message}`);
  }
}

// Function to compare with previous snapshot and detect changes
function compareWithPrevious(currentSnapshot) {
  const snapshotFile = path.join(__dirname, 'apollo-snapshot.json');
  
  if (fs.existsSync(snapshotFile)) {
    try {
      const previous = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
      
      // Check if unlocked count increased
      if (currentSnapshot.unlockedCount > previous.unlockedCount) {
        const newUnlocked = currentSnapshot.unlockedCount - previous.unlockedCount;
        log(`🚨 ALERT: ${newUnlocked} new email${newUnlocked > 1 ? 's' : ''} just unlocked!`);
        
        // Send urgent notification for newly unlocked emails
        sendNotification(
          'NEW Emails Just Unlocked! 🚨',
          `${newUnlocked} additional email${newUnlocked > 1 ? 's' : ''} became available`,
          'Sosumi'
        );
      }
      
      return previous;
    } catch (e) {
      log('⚠️  Could not read previous snapshot');
    }
  }
  
  return null;
}

// Main monitoring function
async function startMonitoring() {
  log('🚀 Starting Apollo email unlock monitoring...');
  log(`📍 Endpoint: ${ENDPOINT}`);
  log(`🔍 Query: "${QUERY}"`);
  log(`⏰ Check interval: ${CHECK_INTERVAL / 60000} minutes`);
  log(`📝 Log file: ${LOG_FILE}`);
  log('🔔 Desktop notifications: ENABLED');
  log('');
  
  // Send startup notification
  sendNotification(
    'Apollo Monitor Started 🚀',
    `Monitoring ${QUERY} every ${CHECK_INTERVAL / 60000} minutes`,
    'default'
  );
  
  // Initial check
  await checkApollo();
  
  // Set up periodic checks
  setInterval(async () => {
    log('');
    log('🔄 Performing scheduled check...');
    await checkApollo();
  }, CHECK_INTERVAL);
  
  // Keep the script running
  log('');
  log('📡 Monitoring active. Press Ctrl+C to stop.');
  log('');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('');
  log('🛑 Monitoring stopped by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('');
  log('🛑 Monitoring stopped');
  process.exit(0);
});

// Start monitoring
if (require.main === module) {
  startMonitoring().catch(error => {
    log(`💥 Fatal error: ${error.message}`);
    process.exit(1);
  });
}

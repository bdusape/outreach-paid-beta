#!/usr/bin/env node

const { exec } = require('child_process');

// Function to send macOS desktop notification
function sendNotification(title, message, sound = 'default') {
  const script = `osascript -e 'display notification "${message}" with title "${title}" sound name "${sound}"'`;
  exec(script, (error) => {
    if (error) {
      console.error('❌ Failed to send notification:', error.message);
    } else {
      console.log('✅ Test notification sent successfully!');
    }
  });
}

// Test notification
console.log('🧪 Testing desktop notification system...');
sendNotification(
  'Apollo Monitor Test 🧪',
  'Desktop notifications are working correctly!',
  'Glass'
);

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
    
    const req = https.request(options, (res) => {\n      let responseData = '';\n      \n      res.on('data', (chunk) => {\n        responseData += chunk;\n      });\n      \n      res.on('end', () => {\n        try {\n          const parsed = JSON.parse(responseData);\n          resolve({ status: res.statusCode, data: parsed });\n        } catch (e) {\n          resolve({ status: res.statusCode, data: responseData });\n        }\n      });\n    });\n    \n    req.on('error', (err) => {\n      reject(err);\n    });\n    \n    if (postData) {\n      req.write(postData);\n    }\n    \n    req.end();\n  });\n}\n\n// Test search with reveal_personal_emails parameter\nasync function testSearchWithReveal() {\n  console.log('🔍 Testing people search with reveal_personal_emails...');\n  \n  const searchPayload = {\n    person_titles: [\"ceo\", \"founder\"],\n    organization_locations: [\"Denver\"],\n    page: 1,\n    per_page: 2,\n    reveal_personal_emails: true, // Try to unlock emails in search\n    reveal_phone_number: true\n  };\n  \n  try {\n    const response = await makeApolloRequest('/v1/mixed_people/search', 'POST', searchPayload);\n    console.log(`📊 Search with reveal status: ${response.status}`);\n    \n    if (response.status === 200 && response.data.people) {\n      console.log(`📋 Found ${response.data.people.length} people`);\n      \n      const unlockedEmails = response.data.people.filter(p => \n        p.email && !p.email.includes('email_not_unlocked')\n      );\n      \n      if (unlockedEmails.length > 0) {\n        console.log('🎉 SUCCESS! Found unlocked emails:');\n        unlockedEmails.forEach(person => {\n          console.log(`  ✅ ${person.first_name} ${person.last_name}: ${person.email}`);\n        });\n        \n        sendNotification(\n          'Apollo Emails Unlocked! 🎉',\n          `${unlockedEmails.length} emails unlocked via search API`,\n          'Glass'\n        );\n        \n        return unlockedEmails;\n      } else {\n        console.log('⏳ All emails still locked even with reveal flag');\n        console.log('📄 Sample person:', JSON.stringify(response.data.people[0], null, 2));\n      }\n    } else if (response.status === 402) {\n      console.log('💳 Payment required for email reveal');\n    } else {\n      console.log(`❌ Search failed with status ${response.status}:`, response.data);\n    }\n    \n    return [];\n  } catch (error) {\n    console.error('❌ Search error:', error.message);\n    return [];\n  }\n}\n\n// Test contact enrichment endpoint\nasync function testContactEnrichment() {\n  console.log('\\n🔬 Testing contact enrichment API...');\n  \n  // First get a contact ID from search\n  const searchPayload = {\n    person_titles: [\"ceo\"],\n    organization_locations: [\"Austin\"],\n    page: 1,\n    per_page: 1\n  };\n  \n  try {\n    const searchResponse = await makeApolloRequest('/v1/mixed_people/search', 'POST', searchPayload);\n    \n    if (searchResponse.status === 200 && searchResponse.data.people && searchResponse.data.people.length > 0) {\n      const person = searchResponse.data.people[0];\n      console.log(`📋 Testing enrichment for: ${person.first_name} ${person.last_name}`);\n      \n      // Try different enrichment endpoints\n      const endpoints = [\n        `/v1/people/${person.id}`,\n        `/v1/people/match`,\n        `/v1/people/bulk_match`\n      ];\n      \n      for (const endpoint of endpoints) {\n        console.log(`🔍 Testing endpoint: ${endpoint}`);\n        \n        try {\n          const enrichResponse = await makeApolloRequest(endpoint, 'GET');\n          console.log(`  📊 Status: ${enrichResponse.status}`);\n          \n          if (enrichResponse.status === 200) {\n            console.log('  ✅ Endpoint exists and responded');\n            if (enrichResponse.data.person && enrichResponse.data.person.email) {\n              const email = enrichResponse.data.person.email;\n              if (!email.includes('email_not_unlocked')) {\n                console.log(`  🎉 FOUND UNLOCKED EMAIL: ${email}`);\n                return enrichResponse.data.person;\n              }\n            }\n          } else if (enrichResponse.status === 404) {\n            console.log('  ❌ Endpoint not found');\n          } else {\n            console.log(`  ⚠️ Other status: ${enrichResponse.status}`);\n          }\n        } catch (error) {\n          console.log(`  ❌ Error: ${error.message}`);\n        }\n        \n        await new Promise(resolve => setTimeout(resolve, 500));\n      }\n    }\n  } catch (error) {\n    console.error('❌ Contact enrichment test failed:', error.message);\n  }\n  \n  return null;\n}\n\n// Test email finder with different approaches\nasync function testEmailFinder() {\n  console.log('\\n📧 Testing email finder approaches...');\n  \n  const approaches = [\n    { endpoint: '/v1/email-accounts', method: 'POST' },\n    { endpoint: '/v1/email_accounts', method: 'POST' },\n    { endpoint: '/v1/emails/find', method: 'POST' },\n    { endpoint: '/v1/people/find', method: 'POST' }\n  ];\n  \n  const testData = {\n    first_name: 'Jack',\n    last_name: 'Martin',\n    organization_name: 'Abbotts Cleanup & Restoration'\n  };\n  \n  for (const approach of approaches) {\n    console.log(`🔍 Testing: ${approach.method} ${approach.endpoint}`);\n    \n    try {\n      const response = await makeApolloRequest(approach.endpoint, approach.method, testData);\n      console.log(`  📊 Status: ${response.status}`);\n      \n      if (response.status === 200) {\n        console.log('  ✅ Endpoint exists!');\n        console.log('  📄 Response:', JSON.stringify(response.data, null, 2));\n      } else if (response.status === 404) {\n        console.log('  ❌ Endpoint not found');\n      } else if (response.status === 402) {\n        console.log('  💳 Payment required');\n      } else {\n        console.log(`  ⚠️ Status ${response.status}:`, response.data);\n      }\n    } catch (error) {\n      console.log(`  ❌ Error: ${error.message}`);\n    }\n    \n    await new Promise(resolve => setTimeout(resolve, 500));\n  }\n}\n\nasync function main() {\n  console.log('🚀 Apollo API Endpoint Discovery & Testing');\n  console.log(`🔑 Using API key: ${APOLLO_API_KEY.substring(0, 8)}...`);\n  console.log('');\n  \n  // Test 1: Search with reveal parameters\n  const unlockedFromSearch = await testSearchWithReveal();\n  \n  if (unlockedFromSearch.length > 0) {\n    console.log(`\\n🎊 SUCCESS: Found ${unlockedFromSearch.length} unlocked emails via search!`);\n    return;\n  }\n  \n  // Test 2: Contact enrichment endpoints\n  const enrichedContact = await testContactEnrichment();\n  \n  if (enrichedContact) {\n    console.log(`\\n🎊 SUCCESS: Found unlocked email via enrichment!`);\n    return;\n  }\n  \n  // Test 3: Email finder endpoints\n  await testEmailFinder();\n  \n  console.log('\\n📋 Endpoint testing completed');\n  console.log('💡 Summary: Most endpoints require payment/credits to unlock emails');\n}\n\n// Run the tests\nif (require.main === module) {\n  main().catch(error => {\n    console.error(`💥 API testing failed: ${error.message}`);\n    process.exit(1);\n  });\n}","line_range_start":1,"line_range_end":225}}
</function_results>

<function_calls>
<invoke name="run_command">
<parameter name="command">node test-apollo-endpoints.cjs

export async function handler(event, context) {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  try {
    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const domain = queryParams.domain;
    const query = queryParams.q || queryParams.query || 'marketing agencies';
    const limit = Math.min(parseInt(queryParams.limit) || 5, 10);

    console.log(`🔍 Hunter.io search request: domain="${domain}" query="${query}" limit=${limit}`);

    // Check if Hunter.io API key is configured
    const hunterApiKey = process.env.HUNTER_API_KEY;
    if (!hunterApiKey || hunterApiKey === 'your_hunter_api_key_here') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Hunter.io API key not configured',
          message: 'Please add HUNTER_API_KEY to environment variables'
        })
      };
    }

    let leads = [];

    if (domain) {
      // Search specific domain
      leads = await searchHunterDomain(hunterApiKey, domain, limit);
    } else {
      // Search common business domains based on query
      const suggestedDomains = generateDomainSuggestions(query);
      
      for (const suggestedDomain of suggestedDomains.slice(0, 3)) {
        try {
          const domainLeads = await searchHunterDomain(hunterApiKey, suggestedDomain, 2);
          leads.push(...domainLeads);
          
          if (leads.length >= limit) break;
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.log(`⚠️ Skipping ${suggestedDomain}:`, error.message);
        }
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        leads: leads.slice(0, limit),
        source: 'hunter',
        query: domain || query,
        total: leads.length,
        searched_domain: domain,
        message: domain ? 
          `Found ${leads.length} contacts at ${domain}` : 
          `Found ${leads.length} contacts across suggested domains`
      })
    };

  } catch (error) {
    console.error('❌ Hunter simple function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
}

// Search Hunter.io for emails at a specific domain
async function searchHunterDomain(apiKey, domain, limit = 5) {
  console.log(`🔍 Searching Hunter.io for emails at ${domain}`);
  
  const url = `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}&limit=${limit}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Hunter.io API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.errors) {
      throw new Error(data.errors[0]?.details || 'Unknown Hunter.io error');
    }
    
    if (data.data && data.data.emails) {
      const emails = data.data.emails;
      console.log(`✅ Found ${emails.length} emails at ${domain}`);
      
      // Transform Hunter data to our lead format
      return emails.map(email => ({
        id: `hunter_${email.value.replace('@', '_at_')}`,
        name: email.first_name && email.last_name ? 
          `${email.first_name} ${email.last_name}` : 
          email.value.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        first_name: email.first_name || email.value.split('@')[0].split(/[._]/)[0],
        last_name: email.last_name || email.value.split('@')[0].split(/[._]/).slice(1).join(' '),
        email: email.value,
        title: email.position || 'Contact',
        company: data.data.organization || domain.replace(/\.(com|org|net|io)$/, '').replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        industry: 'Business',
        location: data.data.country || 'Unknown',
        confidence: email.confidence,
        linkedin_url: email.linkedin,
        twitter: email.twitter,
        phone: email.phone_number,
        enrichment_source: 'hunter',
        website: `https://${domain}`,
        domain: domain
      }));
    }
    
    console.log(`⏳ No emails found at ${domain}`);
    return [];
    
  } catch (error) {
    console.error(`❌ Hunter.io search failed for ${domain}:`, error.message);
    throw error;
  }
}

// Generate domain suggestions based on query
function generateDomainSuggestions(query) {
  const commonDomains = [
    // Tech companies
    'stripe.com', 'shopify.com', 'hubspot.com', 'salesforce.com', 'adobe.com',
    'mailchimp.com', 'slack.com', 'notion.so', 'figma.com', 'canva.com',
    
    // Marketing/Agency domains  
    'wearegrowth.com', 'digitalgrowth.com', 'growthmarketing.com',
    'performancemarketing.com', 'contentmarketing.com', 'socialmedia.com',
    
    // Service businesses
    'cleaningservices.com', 'maintenanceservices.com', 'contractorservices.com',
    'consultingservices.com', 'marketingservices.com', 'designservices.com'
  ];
  
  // Filter domains based on query keywords
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/);
  
  const relevantDomains = commonDomains.filter(domain => {
    return keywords.some(keyword => 
      domain.includes(keyword) || 
      keyword.includes(domain.split('.')[0].split(/[_-]/)[0])
    );
  });
  
  // Return relevant domains first, then common ones
  return relevantDomains.length > 0 ? 
    [...relevantDomains, ...commonDomains.filter(d => !relevantDomains.includes(d))] :
    commonDomains;
}

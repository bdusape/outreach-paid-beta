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
    const query = queryParams.q || queryParams.query || 'cleaners in Charlotte';
    const limit = Math.min(parseInt(queryParams.limit) || 5, 20); // Max 20 results

    console.log(`🔍 Lead search request: "${query}" (limit: ${limit})`);

    // Check if Apollo API key is configured
    const apolloApiKey = process.env.APOLLO_API_KEY;
    if (!apolloApiKey || apolloApiKey === 'your_apollo_api_key_here') {
      console.warn('⚠️ APOLLO_API_KEY not configured or using placeholder, returning mock data');
      console.log('💡 To get real leads: Set APOLLO_API_KEY environment variable with your Apollo.io API key');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          leads: generateMockLeads(query, limit),
          source: 'mock',
          query: query,
          total: limit,
          message: 'Using demo data. Configure Apollo API key for real leads.'
        })
      };
    }

    // Try Apollo.io API for real lead data
    try {
      const leads = await searchApolloLeads(apolloApiKey, query, limit);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          leads: leads,
          source: 'apollo',
          query: query,
          total: leads.length
        })
      };
    } catch (apolloError) {
      console.error('❌ Apollo API error:', apolloError.message);
      // Fallback to mock data if Apollo fails
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          leads: generateMockLeads(query, limit),
          source: 'mock_fallback',
          query: query,
          total: limit,
          error: 'Apollo API unavailable'
        })
      };
    }

  } catch (error) {
    console.error('❌ Leads function error:', error);
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

async function searchApolloLeads(apiKey, query, limit) {
  // Parse query to extract industry and location
  const parts = query.toLowerCase().split(' in ');
  const industry = parts[0] || 'business';
  const location = parts[1] || 'United States';

  console.log(`🔍 Apollo search: ${industry} in ${location}`);
  console.log(`🔑 Using API key: ${apiKey.substring(0, 8)}...`);

  // Simplified Apollo.io People Search API request
  const searchPayload = {
    // Search for decision makers
    person_titles: ["owner", "ceo", "president", "founder", "manager"],
    organization_locations: [location],
    page: 1,
    per_page: Math.min(limit, 10), // Start with smaller limit
    person_seniorities: ["owner", "c_level", "vp", "director"]
  };
  
  console.log('📦 Apollo request payload:', JSON.stringify(searchPayload, null, 2));

  const apolloResponse = await fetch('https://api.apollo.io/v1/mixed_people/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': apiKey
    },
    body: JSON.stringify(searchPayload)
  });

  console.log(`📊 Apollo response status: ${apolloResponse.status}`);
  
  if (!apolloResponse.ok) {
    const errorText = await apolloResponse.text();
    console.error(`❌ Apollo API error ${apolloResponse.status}:`, errorText);
    
    // Provide specific error messages for common issues
    if (apolloResponse.status === 401) {
      throw new Error('Apollo API key is invalid or expired. Please check your API key.');
    } else if (apolloResponse.status === 403) {
      throw new Error('Apollo API key does not have permission for this endpoint.');
    } else if (apolloResponse.status === 429) {
      throw new Error('Apollo API rate limit exceeded. Please try again later.');
    } else {
      throw new Error(`Apollo API error ${apolloResponse.status}: ${errorText}`);
    }
  }

  const data = await apolloResponse.json();
  const people = data.people || [];
  
  console.log(`📊 Apollo returned ${people.length} people`);
  console.log('📊 Sample response structure:', {
    totalPeople: people.length,
    firstPersonKeys: people[0] ? Object.keys(people[0]) : 'No people found',
    hasOrganization: people[0] ? !!people[0].organization : false
  });

  // Transform Apollo data to our lead format
  return people.map(person => ({
    id: person.id,
    name: person.first_name + ' ' + person.last_name,
    first_name: person.first_name,
    last_name: person.last_name,
    email: person.email,
    title: person.title,
    company: person.organization?.name || 'Unknown Company',
    industry: person.organization?.industry || industry,
    location: person.organization?.city + ', ' + person.organization?.state || location,
    phone: person.phone_numbers?.[0]?.sanitized_number,
    company_size: person.organization?.estimated_num_employees,
    linkedin_url: person.linkedin_url,
    enrichment_source: 'apollo'
  })).filter(lead => lead.email); // Only return leads with email addresses
}

function generateMockLeads(query, limit) {
  // Parse query for better mock data
  const parts = query.toLowerCase().split(' in ');
  const industry = parts[0] || 'business';
  const location = parts[1] || 'Charlotte, NC';

  const mockCompanyTypes = {
    'clean': ['CleanPro Services', 'Spotless Solutions', 'Elite Cleaning Co', 'Fresh Start Cleaners'],
    'restaurant': ['Bella Vista Restaurant', 'Corner Cafe', 'Downtown Bistro', 'Family Kitchen'],
    'retail': ['Main Street Store', 'Corner Shop', 'Local Boutique', 'Community Market'],
    'default': ['Local Business', 'Professional Services', 'Family Company', 'Regional Enterprise']
  };

  const industryKey = Object.keys(mockCompanyTypes).find(key => industry.includes(key)) || 'default';
  const companies = mockCompanyTypes[industryKey];

  const mockTitles = ['Owner', 'General Manager', 'CEO', 'President', 'Operations Manager'];
  const mockNames = [
    'Sarah Johnson', 'Mike Chen', 'Lisa Rodriguez', 'David Kim', 'Emma Wilson',
    'Tom Anderson', 'Maria Garcia', 'James Miller', 'Alex Taylor', 'Jessica Brown'
  ];

  const leads = [];
  for (let i = 0; i < limit; i++) {
    const name = mockNames[i % mockNames.length];
    const [first_name, last_name] = name.split(' ');
    const company = companies[i % companies.length];
    
    leads.push({
      id: `mock_${i + 1}`,
      name: name,
      first_name: first_name,
      last_name: last_name,
      email: `${first_name.toLowerCase()}.${last_name.toLowerCase()}@${company.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '')}.com`,
      title: mockTitles[i % mockTitles.length],
      company: company,
      industry: industry,
      location: location,
      phone: `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      company_size: Math.floor(Math.random() * 100) + 5,
      enrichment_source: 'mock'
    });
  }

  return leads;
}

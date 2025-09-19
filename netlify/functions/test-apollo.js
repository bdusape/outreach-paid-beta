export async function handler(event, context) {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const apolloApiKey = process.env.APOLLO_API_KEY;
  
  console.log('🧪 Testing Apollo API integration...');
  console.log(`🔑 API Key: ${apolloApiKey ? `${apolloApiKey.substring(0, 8)}...` : 'NOT SET'}`);

  if (!apolloApiKey || apolloApiKey === 'your_apollo_api_key_here') {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Apollo API key not configured',
        instructions: [
          '1. Sign up at https://apollo.io',
          '2. Go to Settings → Integrations → API', 
          '3. Generate an API key',
          '4. Set APOLLO_API_KEY environment variable in Netlify dashboard'
        ]
      })
    };
  }

  try {
    // Test with a simple Apollo API request
    const testPayload = {
      person_titles: ["ceo", "owner"],
      organization_locations: ["San Francisco"],
      page: 1,
      per_page: 1
    };

    console.log('📦 Test request payload:', JSON.stringify(testPayload, null, 2));

    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apolloApiKey
      },
      body: JSON.stringify(testPayload)
    });

    console.log(`📊 Apollo test response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Apollo test error:`, errorText);
      
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: `Apollo API error (${response.status})`,
          details: errorText,
          troubleshooting: response.status === 401 
            ? 'API key is invalid or expired'
            : response.status === 403
            ? 'API key lacks permission'
            : response.status === 429
            ? 'Rate limit exceeded'
            : 'Unknown error'
        })
      };
    }

    const data = await response.json();
    console.log('✅ Apollo test successful');
    console.log('📊 Sample data:', {
      totalPeople: data.people?.length || 0,
      pagination: data.pagination
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Apollo API connection successful!',
        data: {
          totalPeople: data.people?.length || 0,
          pagination: data.pagination,
          samplePerson: data.people?.[0] ? {
            name: data.people[0].first_name + ' ' + data.people[0].last_name,
            title: data.people[0].title,
            company: data.people[0].organization?.name,
            hasEmail: !!data.people[0].email
          } : null
        }
      })
    };

  } catch (error) {
    console.error('❌ Apollo test failed:', error);
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Apollo API test failed',
        details: error.message
      })
    };
  }
}

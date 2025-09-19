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
    const query = queryParams.q || queryParams.query || 'marketing agencies in Denver';
    const limit = Math.min(parseInt(queryParams.limit) || 5, 10);

    console.log(`🔍 Hunter.io lead search request: "${query}" (limit: ${limit})`);

    // Check if Hunter.io API key is configured
    const hunterApiKey = process.env.HUNTER_API_KEY;
    if (!hunterApiKey || hunterApiKey === 'your_hunter_api_key_here') {
      console.warn('⚠️ HUNTER_API_KEY not configured, falling back to Google Places');
      return await searchWithGooglePlaces(query, limit);
    }

    // Try Hunter.io + Google Places combination
    try {
      const leads = await searchWithHunterAndPlaces(hunterApiKey, query, limit);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          leads: leads,
          source: 'hunter_places',
          query: query,
          total: leads.length
        })
      };
    } catch (hunterError) {
      console.error('❌ Hunter.io error:', hunterError.message);
      
      // Fallback to Google Places only
      const fallbackLeads = await searchWithGooglePlaces(query, limit);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          leads: fallbackLeads,
          source: 'google_places_fallback',
          query: query,
          total: fallbackLeads.length,
          note: 'Hunter.io unavailable, using Google Places data'
        })
      };
    }

  } catch (error) {
    console.error('❌ Hunter leads function error:', error);
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

// Combined Hunter.io + Google Places search
async function searchWithHunterAndPlaces(hunterApiKey, query, limit) {
  console.log('🎯 Using Hunter.io + Google Places combination');
  
  // Step 1: Get businesses from Google Places
  const businesses = await getBusinessesFromGooglePlaces(query, limit);
  
  // Step 2: Enrich with emails from Hunter.io
  const enrichedLeads = [];
  
  for (const business of businesses) {
    try {
      // Extract domain from business website or generate likely domain
      const domain = extractDomain(business.website) || generateLikelyDomain(business.name);
      
      if (domain) {
        console.log(`🔍 Finding emails for ${business.name} at ${domain}`);
        
        // Search Hunter.io for emails at this domain
        const hunterData = await searchHunterDomain(hunterApiKey, domain);
        
        if (hunterData && hunterData.emails && hunterData.emails.length > 0) {
          // Found emails via Hunter.io
          const email = hunterData.emails[0]; // Get the most confident email
          
          enrichedLeads.push({
            id: `hunter_${Date.now()}_${Math.random()}`,
            name: email.first_name && email.last_name ? 
              `${email.first_name} ${email.last_name}` : 
              business.contact_name || 'Business Owner',
            first_name: email.first_name || business.contact_name?.split(' ')[0] || 'Business',
            last_name: email.last_name || business.contact_name?.split(' ').slice(1).join(' ') || 'Owner',
            email: email.value,
            title: email.position || 'Contact',
            company: business.name,
            industry: business.types?.join(', ') || 'Business',
            location: business.address || 'Unknown',
            phone: business.phone,
            website: business.website,
            confidence: email.confidence,
            enrichment_source: 'hunter',
            rating: business.rating,
            total_reviews: business.user_ratings_total
          });
        } else {
          // No emails found, use business data with generated email patterns
          const generatedEmails = generateEmailPatterns(business.name, domain);
          
          enrichedLeads.push({
            id: `places_${business.place_id}`,
            name: business.contact_name || 'Business Contact',
            first_name: business.contact_name?.split(' ')[0] || 'Business',
            last_name: business.contact_name?.split(' ').slice(1).join(' ') || 'Owner',
            email: generatedEmails[0], // Use most likely pattern
            email_patterns: generatedEmails,
            title: 'Contact',
            company: business.name,
            industry: business.types?.join(', ') || 'Business',
            location: business.address,
            phone: business.phone,
            website: business.website,
            enrichment_source: 'places_pattern',
            rating: business.rating,
            total_reviews: business.user_ratings_total,
            note: 'Email generated from pattern - verify before sending'
          });
        }
      }
      
      // Rate limiting - don't hammer Hunter.io
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`❌ Error enriching ${business.name}:`, error.message);
      
      // Add business without email enrichment
      enrichedLeads.push({
        id: `places_${business.place_id}`,
        name: business.contact_name || 'Business Contact',
        first_name: 'Business',
        last_name: 'Owner',
        email: null,
        title: 'Contact',
        company: business.name,
        industry: business.types?.join(', ') || 'Business',
        location: business.address,
        phone: business.phone,
        website: business.website,
        enrichment_source: 'places_only',
        rating: business.rating,
        total_reviews: business.user_ratings_total,
        error: 'Could not find email'
      });
    }
  }
  
  return enrichedLeads.filter(lead => lead.email); // Only return leads with emails
}

// Search Hunter.io for emails at a specific domain
async function searchHunterDomain(apiKey, domain) {
  const url = `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}&limit=5`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Hunter.io API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.data) {
      console.log(`✅ Hunter.io found ${data.data.emails?.length || 0} emails for ${domain}`);
      return data.data;
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Hunter.io search failed for ${domain}:`, error.message);
    return null;
  }
}

// Get businesses from Google Places API
async function getBusinessesFromGooglePlaces(query, limit) {
  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
  
  if (!googleApiKey) {
    throw new Error('Google Places API key not configured');
  }
  
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${googleApiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status !== 'OK') {
      throw new Error(`Google Places API error: ${data.status}`);
    }
    
    return data.results.slice(0, limit).map(place => ({
      place_id: place.place_id,
      name: place.name,
      address: place.formatted_address,
      phone: place.international_phone_number,
      website: place.website,
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      types: place.types
    }));
    
  } catch (error) {
    console.error('❌ Google Places error:', error.message);
    throw error;
  }
}

// Fallback: Google Places only
async function searchWithGooglePlaces(query, limit) {
  console.log('🗺️ Using Google Places only (no email enrichment)');
  
  const businesses = await getBusinessesFromGooglePlaces(query, limit);
  
  return businesses.map(business => {
    const domain = extractDomain(business.website) || generateLikelyDomain(business.name);
    const emailPatterns = domain ? generateEmailPatterns(business.name, domain) : [];
    
    return {
      id: `places_${business.place_id}`,
      name: 'Business Contact',
      first_name: 'Business',
      last_name: 'Owner',
      email: emailPatterns[0] || null,
      email_patterns: emailPatterns,
      title: 'Contact',
      company: business.name,
      industry: business.types?.join(', ') || 'Business',
      location: business.address,
      phone: business.phone,
      website: business.website,
      enrichment_source: 'places_only',
      rating: business.rating,
      total_reviews: business.user_ratings_total,
      note: emailPatterns.length > 0 ? 'Email generated from pattern - verify before sending' : 'No email available'
    };
  });
}

// Utility functions
function extractDomain(website) {
  if (!website) return null;
  
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`);
    return url.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

function generateLikelyDomain(businessName) {
  if (!businessName) return null;
  
  // Simple domain generation from business name
  const cleaned = businessName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '');
  
  return `${cleaned}.com`;
}

function generateEmailPatterns(businessName, domain) {
  if (!domain) return [];
  
  const patterns = [
    `info@${domain}`,
    `contact@${domain}`,
    `hello@${domain}`,
    `sales@${domain}`,
    `admin@${domain}`
  ];
  
  // Add business-specific patterns
  const businessPart = businessName.toLowerCase().replace(/[^a-z]/g, '').substring(0, 8);
  if (businessPart) {
    patterns.unshift(`${businessPart}@${domain}`);
  }
  
  return patterns;
}

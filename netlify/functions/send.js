export async function handler(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
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
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { 
      to, 
      subject, 
      body: emailBody, 
      emailsSent = 0, 
      hasPaid = false,
      firstName,
      company,
      industry,
      personalize = true
    } = body;

    console.log(`📧 Send email request to: ${to}`);

    // Basic validation
    if (!to || !isValidEmail(to)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Invalid or missing email address'
        })
      };
    }

    // Check rate limits for unpaid users
    if (!hasPaid && emailsSent >= 5) {
      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Free tier limited to 5 emails. Upgrade to send more.',
          upgradeUrl: process.env.STRIPE_PAYMENT_LINK
        })
      };
    }

    // Prepare email content (with optional AI personalization)
    let finalSubject = subject || 'Hello from Luntra Outreach';
    let finalBody = emailBody || 'Hi there! Thanks for your interest.';

    if (personalize && firstName) {
      try {
        const personalized = await personalizeEmail({
          firstName,
          company,
          industry,
          subject: finalSubject,
          body: finalBody
        });
        finalSubject = personalized.subject;
        finalBody = personalized.body;
      } catch (error) {
        console.warn('⚠️ Personalization failed, using original content:', error.message);
      }
    }

    // Send email via configured provider
    const sendResult = await sendEmail({
      to,
      subject: finalSubject,
      body: finalBody
    });

    if (sendResult.success) {
      // Log the successful send
      await logEmailActivity({
        to,
        subject: finalSubject,
        status: 'sent',
        provider: sendResult.provider,
        timestamp: new Date().toISOString()
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Email sent successfully',
          provider: sendResult.provider,
          emailsSent: emailsSent + 1,
          remainingEmails: hasPaid ? 'unlimited' : Math.max(0, 4 - emailsSent)
        })
      };
    } else {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Failed to send email',
          message: sendResult.error
        })
      };
    }

  } catch (error) {
    console.error('❌ Send function error:', error);
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

async function sendEmail({ to, subject, body }) {
  // Check which email provider is configured
  const resendApiKey = process.env.RESEND_API_KEY;
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.OUTBOUND_FROM_EMAIL || process.env.RESEND_FROM || process.env.FROM_EMAIL;

  if (!fromEmail) {
    throw new Error('No sender email configured');
  }

  // Try Resend first (preferred)
  if (resendApiKey) {
    try {
      const result = await sendViaResend(resendApiKey, fromEmail, to, subject, body);
      return { success: true, provider: 'resend', ...result };
    } catch (error) {
      console.error('❌ Resend failed:', error.message);
      // Fall through to SendGrid if available
    }
  }

  // Try SendGrid as fallback
  if (sendgridApiKey) {
    try {
      const result = await sendViaSendGrid(sendgridApiKey, fromEmail, to, subject, body);
      return { success: true, provider: 'sendgrid', ...result };
    } catch (error) {
      console.error('❌ SendGrid failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // No email provider configured
  console.warn('⚠️ No email provider configured, simulating send');
  return { 
    success: true, 
    provider: 'simulation',
    message: 'Email simulated (no provider configured)'
  };
}

async function sendViaResend(apiKey, from, to, subject, body) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: from,
      to: [to],
      subject: subject,
      text: body,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${body.replace(/\n/g, '<br>')}</div>`
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error ${response.status}: ${error}`);
  }

  const result = await response.json();
  return { messageId: result.id };
}

async function sendViaSendGrid(apiKey, from, to, subject, body) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: to }],
        subject: subject
      }],
      from: { email: from },
      content: [
        {
          type: 'text/plain',
          value: body
        },
        {
          type: 'text/html',
          value: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${body.replace(/\n/g, '<br>')}</div>`
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SendGrid API error ${response.status}: ${error}`);
  }

  return { messageId: response.headers.get('X-Message-Id') };
}

async function personalizeEmail({ firstName, company, industry, subject, body }) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    console.warn('⚠️ No OpenAI API key, skipping personalization');
    return { subject, body };
  }

  const prompt = `You are an outreach assistant. Personalize this email for the recipient.

Recipient:
- Name: ${firstName}
- Company: ${company || 'their company'}
- Industry: ${industry || 'their industry'}

Current email:
Subject: ${subject}
Body: ${body}

Make it more personal and relevant to their role/industry. Keep it professional but friendly.
Respond in this exact format:
Subject: [personalized subject]
Body: [personalized body]`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse the response
    const subjectMatch = content.match(/Subject: (.+)/);
    const bodyMatch = content.match(/Body: ([\s\S]+)/);

    if (subjectMatch && bodyMatch) {
      return {
        subject: subjectMatch[1].trim(),
        body: bodyMatch[1].trim()
      };
    }
  } catch (error) {
    console.error('❌ OpenAI personalization error:', error.message);
  }

  // Return original if personalization fails
  return { subject, body };
}

async function logEmailActivity(activity) {
  // In a production app, this would write to a database
  // For now, just log to console for debugging
  console.log('📊 Email activity:', JSON.stringify(activity, null, 2));
  
  // Could extend this to write to external logging service
  // or store in Netlify Forms for simple logging
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

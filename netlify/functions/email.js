// /netlify/functions/email.js
export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle preflight requests
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ error: "method_not_allowed" }) 
    };
  }

  try {
    const { to, subject, body, html, emailsSent = 0, hasPaid = false } = JSON.parse(event.body || "{}");
    const emailBody = body || html; // Support both 'body' and 'html' parameters

    if (!to || !subject || !emailBody) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "missing_required_fields" })
      };
    }
    
    // Check email limits for free tier
    const FREE_EMAIL_LIMIT = 5; // Free users can send 5 emails
    
    if (!hasPaid && emailsSent >= FREE_EMAIL_LIMIT) {
      const STRIPE_PAYMENT_LINK = process.env.STRIPE_PAYMENT_LINK;
      
      if (!STRIPE_PAYMENT_LINK) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: "payment_link_not_configured",
            message: "Email limit reached but payment system not configured" 
          })
        };
      }
      
      return {
        statusCode: 402, // Payment Required
        headers,
        body: JSON.stringify({ 
          error: "email_limit_reached",
          message: `Free tier limit of ${FREE_EMAIL_LIMIT} emails reached. Please upgrade to continue.`,
          payLink: STRIPE_PAYMENT_LINK,
          emailsSent,
          limit: FREE_EMAIL_LIMIT
        })
      };
    }

    // Environment variables
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    const FROM_EMAIL = process.env.OUTBOUND_FROM_EMAIL;
    const FROM_NAME = process.env.OUTBOUND_FROM_NAME || "Outreach System";

    if (!FROM_EMAIL) {
      throw new Error("no_from_email_configured");
    }

    // Try Resend first
    if (RESEND_API_KEY) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: [to],
          subject,
          html: emailBody,
        }),
      });
      
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`resend_${r.status}_${t}`);
      }
      
      const result = await r.json();
      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify({ 
          ok: true, 
          provider: "resend",
          id: result.id 
        }) 
      };
    } 
    // Try SendGrid as fallback
    else if (SENDGRID_API_KEY) {
      const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: FROM_EMAIL, name: FROM_NAME },
          subject,
          content: [{ type: "text/html", value: emailBody }],
        }),
      });
      
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`sendgrid_${r.status}_${t}`);
      }

      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify({ 
          ok: true, 
          provider: "sendgrid" 
        }) 
      };
    } else {
      throw new Error("no_email_provider_configured");
    }

  } catch (err) {
    console.error("Email sending error:", err);
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ 
        error: "send_failed",
        message: err.message 
      }) 
    };
  }
}

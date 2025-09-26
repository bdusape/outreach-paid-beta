// /netlify/functions/leads.js
import { readFileSync } from "fs";
import { join } from "path";

const ok = (v) => typeof v === "string" && v.trim().length > 0;

export async function handler(event) {
  const query = new URLSearchParams(event.queryStringParameters).get("q") || "";
  const apiKey = process.env.APOLLO_KEY;

  // CORS (optional)
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  if (!ok(query)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "missing_query" }) };
  }

  // Try Apollo People Search first
  try {
    if (!ok(apiKey)) throw new Error("no_apollo_key");

    const apolloRes = await fetch("https://api.apollo.io/v1/people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        q_keywords: query,   // free-text search
        page: 1,
        per_page: 5,
      }),
    });

    if (!apolloRes.ok) throw new Error(`apollo_${apolloRes.status}`);
    const data = await apolloRes.json();

    const people = Array.isArray(data.people) ? data.people : [];
    const leads = people.slice(0, 5).map((p) => ({
      name: p.name || "",
      title: p.title || "",
      company: (p.organization && p.organization.name) || p.employer || "",
      email: p.email || "",
      phone: p.phone_number || "",
      city: p.city || "",
      website: (p.organization && p.organization.website_url) || "",
    }));

    if (leads.length) {
      return { statusCode: 200, headers, body: JSON.stringify({ leads }) };
    }
    throw new Error("empty_apollo");
  } catch (e) {
    // CSV fallback
    try {
      const csvPath = join(process.cwd(), "data", "leads.csv");
      const raw = readFileSync(csvPath, "utf8");
      const rows = raw.split(/\r?\n/).filter(Boolean);
      const [header, ...rest] = rows;
      const idx = Object.fromEntries(header.split(",").map((h, i) => [h.trim(), i]));
      const filtered = rest
        .map((line) => line.split(","))
        .filter((cols) => (cols[idx.city] || "").toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5)
        .map((c) => ({
          name: "",
          title: "",
          company: c[idx.company] || "",
          email: c[idx.email] || "",
          phone: c[idx.phone] || "",
          city: c[idx.city] || "",
          website: c[idx.website] || "",
        }));

      return { statusCode: 200, headers, body: JSON.stringify({ leads: filtered }) };
    } catch (csvErr) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "leads_failed" }) };
    }
  }
}

// Returns Facebook oEmbed for a given post URL using App access token
// Expects FACEBOOK_APP_ID and FACEBOOK_CLIENT_SECRET in environment (Netlify env)
const fetch =
  globalThis.fetch || ((...args) => import("node-fetch").then((m) => m.default(...args)));

export const handler = async (event) => {
  try {
    const url = event.queryStringParameters?.url;
    if (!url) return { statusCode: 400, body: JSON.stringify({ error: "Missing url parameter" }) };

    const explicitToken = process.env.FACEBOOK_TOKEN;
    const access_token =
      explicitToken ||
      (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_CLIENT_SECRET
        ? `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_CLIENT_SECRET}`
        : null);
    if (!access_token)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Facebook app credentials not configured" }),
      };

    const oembedUrl = `https://graph.facebook.com/v17.0/oembed_post?url=${encodeURIComponent(url)}&access_token=${encodeURIComponent(access_token)}&omitscript=true`;
    const resp = await fetch(oembedUrl, { method: "GET" });

    const text = await resp.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    // diagnostic log for function logs
    console.log("facebook-oembed:", { url, fb_status: resp.status, fb_body: parsed });

    // Success: return oEmbed payload
    if (resp.ok) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
        body: typeof parsed === "string" ? parsed : JSON.stringify(parsed),
      };
    }

    // FB returned an error (expired token, not embeddable, etc.)
    // Return 200 so the frontend can show a normal link; include fb error for console/logging.
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({
        embed_available: false,
        url,
        fb_status: resp.status,
        fb_body: parsed,
        message: "oEmbed unavailable; show link fallback",
      }),
    };
  } catch (err) {
    console.error("facebook-oembed handler error", err);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({
        embed_available: false,
        url: event.queryStringParameters?.url || null,
        error: err.message,
        message: "Handler error; show link fallback",
      }),
    };
  }
};

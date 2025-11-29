// Returns Facebook oEmbed for a given post URL using App access token
// Expects FACEBOOK_APP_ID and FACEBOOK_CLIENT_SECRET in environment (Netlify env)
const fetch =
  globalThis.fetch || ((...args) => import("node-fetch").then((m) => m.default(...args)));

export const handler = async (event) => {
  try {
    const url = event.queryStringParameters?.url;
    if (!url) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing url parameter" }) };
    }

    // Prefer an explicit long-lived token if provided; otherwise build an app access token from
    // FACEBOOK_APP_ID and FACEBOOK_CLIENT_SECRET. Tokens/Secrets must remain server-side.
    const explicitToken = process.env.FACEBOOK_TOKEN;
    let access_token;
    if (explicitToken) {
      access_token = explicitToken;
    } else {
      const appId = process.env.FACEBOOK_APP_ID;
      const appSecret = process.env.FACEBOOK_CLIENT_SECRET;
      if (!appId || !appSecret) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: "Facebook app credentials not configured" }),
        };
      }
      access_token = `${appId}|${appSecret}`;
    }

    // Use omitscript=true to avoid returning the FB JS SDK tag; the client should load FB SDK once if needed
    const oembedUrl = `https://graph.facebook.com/v17.0/oembed_post?url=${encodeURIComponent(url)}&access_token=${encodeURIComponent(access_token)}&omitscript=true`;

    const resp = await fetch(oembedUrl, { method: "GET" });
    const data = await resp.json();

    const statusCode = resp.ok ? 200 : 502;

    // Recommend clients cache this response for some time — set Cache-Control on success
    const headers = { "Content-Type": "application/json" };
    if (resp.ok) headers["Cache-Control"] = "public, max-age=3600";

    return {
      statusCode,
      headers,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err.message }) };
  }
};

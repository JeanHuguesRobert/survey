import { PROVIDERS } from "../lib/oauthProviders.js";
import fetch from "node-fetch"; // Netlify Functions environment usually has node-fetch or global fetch in Node 18+

// Helper to exchange code for token
async function exchangeCodeForToken(providerConf, code, redirectUri) {
  const params = new URLSearchParams({
    client_id: process.env[providerConf.clientIdEnv],
    client_secret: process.env[providerConf.clientSecretEnv],
    code,
  });

  if (providerConf.name === "Google") {
    params.append("grant_type", "authorization_code");
    params.append("redirect_uri", redirectUri);
  }

  const response = await fetch(providerConf.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to exchange token: ${text}`);
  }

  return response.json();
}

// Helper to fetch profile
async function fetchProfile(providerConf, tokenData) {
  const accessToken = tokenData.access_token;
  const url = providerConf.profileUrl || providerConf.userInfoUrl;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user profile");
  }

  return response.json();
}

// Mock function for storing avatar
async function storeAvatarForUser(userId, normalizedAvatarUrl, provider, sourceValue) {
  // TODO: Download image from normalizedAvatarUrl
  // TODO: Resize to 128x128
  // TODO: Upload to Supabase Storage / S3
  // TODO: Update user profile in DB with new internal URL

  console.log(`[TODO] Store avatar for user ${userId}: ${normalizedAvatarUrl}`);
  return normalizedAvatarUrl;
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { provider, code, userId } = JSON.parse(event.body);
    const conf = PROVIDERS[provider];

    if (!conf) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid provider" }),
      };
    }

    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:8888";
    const redirectUri = `${appBaseUrl}${conf.redirectPath}`;

    // 1. Exchange code for token
    const tokenData = await exchangeCodeForToken(conf, code, redirectUri);

    // 2. Fetch profile
    const profile = await fetchProfile(conf, tokenData);

    // 3. Map and normalize
    const { providerUserId, username, rawAvatarUrl } = conf.mapProfile(profile);
    const normalizedAvatarUrl = conf.normalizeAvatarUrl(rawAvatarUrl);

    // 4. Store/Update (Mock)
    const finalAvatarUrl = await storeAvatarForUser(
      userId,
      normalizedAvatarUrl,
      provider,
      username || providerUserId
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        avatarUrl: finalAvatarUrl,
        sourceType: provider,
        sourceValue: username || providerUserId,
      }),
    };
  } catch (error) {
    console.error("OAuth Complete Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

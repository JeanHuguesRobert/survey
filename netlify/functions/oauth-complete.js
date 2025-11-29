import { PROVIDERS } from "../lib/oauthProviders.js";
import fetch from "node-fetch"; // Netlify Functions environment usually has node-fetch or global fetch in Node 18+
import { createClient } from "@supabase/supabase-js";

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
  // Minimal implementation: persist avatarUrl and provider identifier into user's metadata
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.warn("Supabase service role key not configured; cannot persist avatar");
      return normalizedAvatarUrl;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

    // Read existing metadata
    const { data: existing, error: fetchErr } = await supabase
      .from("users")
      .select("metadata")
      .eq("id", userId)
      .maybeSingle();
    let metadata = (existing && existing.metadata) || {};
    // Set facebook id (sourceValue) for provider 'facebook'
    if (provider === "facebook") {
      metadata.facebookId = sourceValue;
    }
    // Update avatar URL
    metadata.avatarUrl = normalizedAvatarUrl;

    const { data, error } = await supabase
      .from("users")
      .update({ metadata })
      .eq("id", userId)
      .select()
      .single();
    if (error) {
      console.error("Failed to persist avatar metadata:", error);
      return normalizedAvatarUrl;
    }
    return normalizedAvatarUrl;
  } catch (err) {
    console.error("storeAvatarForUser error", err);
    return normalizedAvatarUrl;
  }
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

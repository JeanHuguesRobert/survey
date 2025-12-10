import { loadInstanceConfig, getConfigValue } from "../lib/instanceConfig.js";

export const handler = async () => {
  try {
    // Charger la configuration
    await loadInstanceConfig();
    const SUPABASE_URL = getConfigValue("supabase_url");
    const SUPABASE_SERVICE_ROLE_KEY = getConfigValue("supabase_service_role_key");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Server misconfigured: SUPABASE_URL or service key missing",
        }),
      };
    }

    // Fetch first user (site owner) and return its site_config metadata
    const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/users?select=id,metadata&order=created_at.asc&limit=1`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!res.ok) {
      const txt = await res.text();
      console.warn("Supabase query failed, status", res.status, txt);
      return { statusCode: 502, body: JSON.stringify({ error: "Upstream query failed" }) };
    }

    const users = await res.json();
    if (!Array.isArray(users) || users.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
    }

    const metadata = users[0].metadata || {};
    const site_config = metadata.site_config || { redirect_enabled: false, redirect_url: "" };
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_config, user_id: users[0].id }),
    };
  } catch (err) {
    console.error("site-config error", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

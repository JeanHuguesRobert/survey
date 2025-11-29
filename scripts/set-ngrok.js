#!/usr/bin/env node
import fetch from "node-fetch";
import { argv } from "process";

function parseArgs() {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--url") out.url = argv[++i];
    if (argv[i] === "--on") out.on = true;
    if (argv[i] === "--off") out.on = false;
  }
  return out;
}

(async () => {
  const { url, on } = parseArgs();
  if (typeof on === "undefined") {
    console.error("Specify --on or --off");
    process.exit(1);
  }

  const SITE_URL = url || process.env.NGROK_URL;
  if (on && !SITE_URL) {
    console.error("No NGROK url supplied (use --url or set NGROK_URL in env)");
    process.exit(1);
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in env");
    process.exit(1);
  }

  try {
    const q = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/users?select=id,metadata&order=created_at.asc&limit=1`;
    const res = await fetch(q, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("Failed to fetch first user:", res.status, txt);
      process.exit(1);
    }
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) {
      console.error("No users found");
      process.exit(1);
    }
    const user = arr[0];
    const metadata = user.metadata || {};
    metadata.site_config = metadata.site_config || {};
    metadata.site_config.redirect_enabled = !!on;
    if (on) metadata.site_config.redirect_url = SITE_URL.replace(/\/$/, "");

    const patchUrl = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/users?id=eq.${encodeURIComponent(
      user.id
    )}`;
    const patch = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ metadata }),
    });
    if (!patch.ok) {
      console.error("Patch failed", await patch.text());
      process.exit(1);
    }
    console.log(
      "Updated site_config for user",
      user.id,
      "redirect_on=",
      !!on,
      "url=",
      metadata.site_config.redirect_url
    );
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();

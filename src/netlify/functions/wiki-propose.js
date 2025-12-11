import {
  loadInstanceConfig,
  getFederationConfig,
  getConfigValue,
  getSecret,
} from "../../common/config/instanceConfig.backend.js";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import wikiFederation from "../../lib/wikiFederation.js";

export default async (req, context) => {
  await loadInstanceConfig();

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const body = await req.json();
    const slug = body.slug || body.pageKey;
    if (!slug) return new Response(JSON.stringify({ error: "slug required" }), { status: 400 });

    // Ensure page exists locally
    const supabaseUrl = getConfigValue("supabase_url") || process.env.SUPABASE_URL;
    const supabaseRoleKey =
      getConfigValue("supabase_service_role_key") || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const localSupabase = createSupabaseClient(supabaseUrl, supabaseRoleKey);
    const { data: local, error: findErr } = await localSupabase
      .from("wiki_pages")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (findErr || !local)
      return new Response(JSON.stringify({ error: "Page not found locally" }), { status: 404 });

    // Mark as proposed upstream locally and optionally notify parent
    // Prefer vault-stored secret (server-side) for secure forwarding
    const parentApiKeyVault = await getSecret("parent_hub_api_key");
    // For security, do NOT trust client-provided API keys. Only use vault-stored or env var keys.
    const parentApiKey = parentApiKeyVault || process.env.PARENT_HUB_API_KEY || null;
    const res = await wikiFederation.proposeToParent({
      pageKey: slug,
      notifyParent: !!parentApiKey,
      parentApiKey,
    });
    if (!res?.success) {
      return new Response(JSON.stringify({ error: res?.error || "Could not mark proposed" }), {
        status: 500,
      });
    }

    return new Response(JSON.stringify({ success: true, forwarded: !!res.forwarded }), {
      status: 200,
    });
  } catch (err) {
    console.error("wiki-propose error", err.message || err);
    return new Response(JSON.stringify({ error: err.message || "internal" }), { status: 500 });
  }
};

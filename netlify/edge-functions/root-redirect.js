// netlify/edge-functions/root-redirect.js

export default async (request, context) => {
  const url = new URL(request.url);
  const markdownTarget = resolveMarkdownTarget(request, url);
  if (markdownTarget) {
    const viewerUrl = new URL(request.url);
    viewerUrl.pathname = "/markdown-viewer";
    viewerUrl.search = new URLSearchParams({ file: markdownTarget }).toString();
    return Response.redirect(viewerUrl.toString(), 302);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const CACHE_TTL = Number(Deno.env.get("SITE_CONFIG_CACHE_TTL") || 5); // seconds

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return context.next();
  }

  // simple in-memory cache per edge instance
  if (!globalThis.__SITE_CONFIG_CACHE) globalThis.__SITE_CONFIG_CACHE = { ts: 0, cfg: null };
  const now = Date.now();
  if (
    !globalThis.__SITE_CONFIG_CACHE.cfg ||
    now - globalThis.__SITE_CONFIG_CACHE.ts > CACHE_TTL * 1000
  ) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/users?select=metadata&limit=1`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      });
      if (res.ok) {
        const users = await res.json();
        if (users && users.length) {
          globalThis.__SITE_CONFIG_CACHE.cfg =
            users[0].metadata && users[0].metadata.site_config
              ? users[0].metadata.site_config
              : null;
          globalThis.__SITE_CONFIG_CACHE.ts = now;
        } else {
          globalThis.__SITE_CONFIG_CACHE.cfg = null;
          globalThis.__SITE_CONFIG_CACHE.ts = now;
        }
      }
    } catch (e) {
      // ignore and continue
    }
  }

  const cfg = globalThis.__SITE_CONFIG_CACHE.cfg;
  if (!cfg || !cfg.redirect_enabled || !cfg.redirect_url) return context.next();

  try {
    const reqUrl = url;
    const target = new URL(cfg.redirect_url);
    // bypass if same host
    if (reqUrl.host === target.host) return context.next();
    // bypass if developer sets cookie to skip (optional)
    const cookie = request.headers.get("cookie") || "";
    if (/ngrok_bypass=1/.test(cookie)) return context.next();

    return Response.redirect(cfg.redirect_url, 302);
  } catch (e) {
    return context.next();
  }
};

function resolveMarkdownTarget(request, url) {
  const accept = request.headers.get("accept") || "";
  if (!accept.includes("text/html")) return null;
  if (!url.pathname.startsWith("/docs/")) return null;
  if (url.searchParams.get("raw") === "1") return null;
  if (!url.pathname.endsWith(".md")) return null;
  return `${url.pathname}${url.search}`;
}

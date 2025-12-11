import { getConfig } from "../../common/config/instanceConfig.backend.js";
import wikiFederation from "../../lib/wikiFederation.js";

export default async (req, context) => {
  await loadInstanceConfig();

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const params = req.method === "GET" ? req.queryStringParameters || {} : await req.json();
  const slug = params.slug || params.pageKey;
  const extended = params.extended === "true" || params.extended === true;

  if (!slug) {
    return new Response(JSON.stringify({ error: "slug or pageKey required" }), { status: 400 });
  }

  try {
    const resolved = await wikiFederation.resolvePage({ pageKey: slug, extended });
    if (!resolved) {
      return new Response(JSON.stringify({ page: null }), { status: 200 });
    }
    return new Response(JSON.stringify({ page: resolved.page, metadata: resolved }), {
      status: 200,
    });
  } catch (err) {
    console.error("wiki-resolve error", err?.message || err);
    return new Response(JSON.stringify({ error: err?.message || "internal" }), { status: 500 });
  }
};

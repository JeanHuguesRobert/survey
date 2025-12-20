// src/common/config/instanceConfig.core.js
// Module de configuration centralisé (lecture seule)

/**
 * loadConfigTable(supabaseClient, { force=false })
 * - Charge TOUTES les colonnes de public.instance_config
 * - Retourne un hashtable: { [key: string]: rowObject }
 * - Cache global cross-runtime via globalThis (Node / Deno / Netlify)
 * - Une seule requête effective, sauf force=true
 *
 * getConfig(key, { table, fallback=undefined })
 * - Cherche la clé en essayant : exact, lower, upper
 * - Prend value_json si présent, sinon value
 * - Optionnel: fallback
 */

const GLOBAL_CACHE_KEY = "__INSTANCE_DATA_CACHE_V1__";

// Idempotency, singleton, global instance stuff
var init_done = false;
function inited() {
  return init_done;
}
function set_init_done() {
  if (init_done) {
    // console.log("set_init_done: multiple calls, ignored");
  }
  init_done = true;
}

function getGlobalCache() {
  if (!globalThis[GLOBAL_CACHE_KEY]) {
    globalThis[GLOBAL_CACHE_KEY] = {
      config: null, // { [key]: row }
      inFlight: null,
      loadedAt: 0,
      supabase: null,
      factory: null,
      getenv: null,
      data: {},
    };
  }
  return globalThis[GLOBAL_CACHE_KEY];
}

async function fetchAllRows(supabaseClient) {
  const pageSize = 1000;
  let from = 0;
  const all = [];

  while (true) {
    const { data, error } = await supabaseClient
      .from("instance_config")
      .select("*")
      .order("key", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`loadConfigTable: ${error.message}`);

    const rows = data ?? [];
    all.push(...rows);

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  const map = Object.create(null);
  for (const row of all) {
    if (row?.key) map[row.key] = row;
  }
  return map;
}

// Load the instance config from some supabase. Reload if forced.
export async function loadConfigTable(force = false, supabase_config = null) {
  const cache = getGlobalCache();

  // If supabase config provided (url & keys), use them
  cache.supabase_config = supabase_config;
  if (supabase_config) {
    supabase_config = getGlobalCache().supabase;
    // TODO
    console.log("loadInstanceConfig: TODO using supabase_config=", supabase_config);
  }

  if (!force && cache.inFlight) {
    console.log("loadConfigTable: already running, return promise");
    return cache.inFlight;
  }

  // If config is already in cache, no need to fetch it again
  if (!force && cache.config) return cache.config;

  // Reuse supabase client or create a new (non admin) one
  if (cache.supabase) {
    console.log("loadConfigTable: using existing supabase client");
  } else {
    console.log("loadConfigTable: creating new supabase client");
    cache.supabase = cache.factory(cache.admin, cache.getenv);
  }

  cache.inFlight = (async () => {
    try {
      const map = await fetchAllRows(cache.supabase);
      cache.config = map;
      cache.loadedAt = Date.now();
      cache.forced = force;
      return map;
    } finally {
      cache.inFlight = null;
    }
  })();

  return cache.inFlight;
}

/**
 * Get all entries's name in the instance config as a name table.
 * One should then call getConfig( key ) to get the value.
 */

export function getAllConfigKeys() {
  const cache = getGlobalCache();
  const t = cache.config;
  return t ? Object.keys(t) : [];
}

/**
 * Récupère la valeur d'une clé depuis la table chargée (ou depuis le cache global).
 *
 * @param {string} key
 * @returns {*} value_json si présent, sinon value, sinon undefined
 */
export function getConfig(key, by_default = undefined) {
  if (!key) return undefined;

  // Get from env vars first, if present
  const cache = getGlobalCache();
  const envVal = cache.getenv(key);
  if (envVal !== undefined) return envVal;

  const t = cache.config;
  if (!t) {
    return undefined;
  }

  const k = String(key);
  // Case insensitive search
  const candidates = [k, k.toLowerCase(), k.toUpperCase()];

  for (const c of candidates) {
    const row = t[c];
    if (!row) continue;

    if (row.value_json !== null && row.value_json !== undefined) return row.value_json;
    if (row.value !== null && row.value !== undefined) return row.value;
    return undefined;
  }

  return by_default || undefined;
}

/** Optionnel: accès au timestamp du cache */
export function getConfigInfo() {
  const cache = getGlobalCache();
  return {
    loadedAt: cache.loadedAt,
    hasConfig: !!cache.config,
    config: cache.config,
    data: cache.data,
    inFlight: !!cache.inFlight,
    supabase: cache.supabase,
    factory: cache.factory,
    getenv: cache.getenv,
  };
}

export function getSupabase() {
  if (!inited()) {
    console.warn("getSupabase: premature call");
  }
  const cache = getGlobalCache();
  if (!cache.supabase) {
    console.warn("getSupabase: supabase not initialized, fatal");
    throw new Error("getSupabase: supabase not initialized, fatal");
  }
  return cache.supabase;
}

export function supabaseFactory() {
  if (!inited) {
    console.warn("supabaseFactory: premature call");
  }
  return getGlobalCache().factory;
}

export function setInstanceData(key, val) {
  getGlobalCache().data[key] = val;
}

export function getInstanceData(key) {
  return getGlobalCache().data[key];
}

export async function initializeInstanceCore(supabase, getenv_impl, newSupabase_impl, admin) {
  // This function is called by either initializeInstance_Backend() or initializeInstance_Edge()
  // or initializeInstance_Client() depending on the the actual runtime

  // Adapters must be provided
  if (!getenv_impl || !newSupabase_impl) {
    throw new Error("initializeInstanceCore: getenv_impl and newSupabase_impl must be provided");
  }
  // Admin option must be provided
  if (admin === undefined) {
    throw new Error("initializeInstanceCore: admin option must be provided");
  }

  getGlobalCache().admin = admin;
  getGlobalCache().supabase = supabase;
  getGlobalCache().getenv = getenv_impl;
  getGlobalCache().factory = newSupabase_impl;
  set_init_done();
  // Returns a supabaseClient factory
  return newSupabase_impl;
}

export async function reloadInstanceConfig() {
  // Valid only if already initialized
  if (!inited()) {
    console.warn("reloadInstanceConfig: not initialized, ignored");
    return false;
  }
  return loadConfigTable(true);
}

export async function loadInstanceConfig(force = false, supabase_config = null) {
  // Invalid if not initialized properly
  if (!inited()) {
    console.warn("loadInstanceConfig: not initialized, fatal");
    throw new Error("loadInstanceConfig: not initialized, fatal");
  }
  return loadConfigTable(force, supabase_config);
}

export function getenv(key) {
  // Invalid if not initialized
  if (!inited()) {
    console.warn("getenv: not initialized, fatal");
    throw new Error("getenv: not initialized, fatal");
  }
  return getGlobalCache().getenv(key);
}

export function getFederationConfig() {
  // TODO: implement federation config
  // Invalid if not initialized
  if (!inited()) {
    console.warn("getFederationConfig: not initialized, fatal");
    throw new Error("getFederationConfig: not initialized, fatal.");
  }
  return {};
}

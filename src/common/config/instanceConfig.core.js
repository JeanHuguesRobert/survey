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
  return !!globalThis[GLOBAL_CACHE_KEY];
}
function set_init_done() {
  if (init_done) {
    throw new Error("instanceConfig multiple instance init");
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
// Return false if premature call (with warning) or promise if already in flight.
export async function loadConfigTable(supabaseClient, { force = false } = {}) {
  if (!supabaseClient?.from) {
    // Inspect the supabaseClient object
    console.log("loadConfigTable: supabaseClient inspection:", supabaseClient);
    throw new TypeError("loadConfigTable: supabaseClient invalide (attendu: client Supabase)");
  }
  if (!inited()) {
    console.warn("instanceConfig.core: premature call to loadConfigTable, ingnored");
    // Return as if inFlight
    return false;
  }

  const cache = getGlobalCache();

  if (!force && cache.inFlight) return cache.inFlight;
  if (!force && cache.config) return cache.config;

  cache.inFlight = (async () => {
    try {
      const map = await fetchAllRows(supabaseClient);
      cache.config = map;
      cache.loadedAt = Date.now();
      cache.supabase = supabaseClient;
      cache.forced = force;
      return map;
    } finally {
      cache.inFlight = null;
    }
  })();

  return !cache.inFlight;
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

  const cache = getGlobalCache();
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
  return getGlobalCache().supabase;
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
  if (inited()) {
    console.warn("initializeInstanceCore: multiple calls");
    return getGlobalCache().factory;
  }
  if (!supabase) {
    console.log("initializeInstanceCore: supabaseClient is null, trying to create a new one");
  } else {
    console.log("initializeInstanceCore: using existing supabaseClient");
  }
  const notnull_supabase = supabase || (await newSupabase_impl(admin));
  await loadConfigTable(notnull_supabase, { force: true });
  getGlobalCache().getenv = getenv_impl;
  getGlobalCache().factory = newSupabase_impl;
  set_init_done();
  // Returns a supabaseClient factory
  return newSupabase_impl;
}

export async function reloadInstanceConfig(force = false) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("reloadInstanceConfig: supabaseClient non initialisé");
  return loadConfigTable(supabase, { force });
}

export async function loadInstanceConfig() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("loadInstanceConfig: supabaseClient non initialisé");
  return loadConfigTable(supabase, { force: false });
}

export function getenv(key) {
  return getGlobalCache().getenv(key);
}

export function getFederationConfig() {
  // TODO: implement federation config
  return {};
}

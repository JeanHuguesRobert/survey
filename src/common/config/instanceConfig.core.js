// src/common/config/instanceConfig.core.js
// Module de configuration centralisé (lecture seule)

/**
 * loadConfigTable(supabaseClient, { force=false })
 * - Charge TOUTES les colonnes de public.instance_config
 * - Retourne un hashtable: { [key: string]: rowObject }
 * - Cache global cross-runtime via globalThis (Node / Deno / Netlify)
 * - Une seule requête effective, sauf force=true
 *
 * getConfig(key, { table, fallbackToEnv=false })
 * - Cherche la clé en essayant : exact, lower, upper
 * - Prend value_json si présent, sinon value
 * - Optionnel: fallbackToEnv pour lire process.env / Deno.env (si dispo)
 */

const GLOBAL_CACHE_KEY = "__INSTANCE_CONFIG_TABLE_CACHE_V1__";

function getGlobalCache() {
  if (!globalThis[GLOBAL_CACHE_KEY]) {
    globalThis[GLOBAL_CACHE_KEY] = {
      data: null, // { [key]: row }
      inFlight: null,
      loadedAt: 0,
      supabaseClient: null,
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

export async function loadConfigTable(supabaseClient, { force = false } = {}) {
  if (!supabaseClient?.from) {
    // Inspect the supabaseClient object
    console.log("loadConfigTable: supabaseClient inspection:", supabaseClient);
    throw new TypeError("loadConfigTable: supabaseClient invalide (attendu: client Supabase)");
  }

  const cache = getGlobalCache();

  if (!force && cache.data) return cache.data;
  if (!force && cache.inFlight) return cache.inFlight;

  cache.inFlight = (async () => {
    try {
      const map = await fetchAllRows(supabaseClient);
      cache.data = map;
      cache.loadedAt = Date.now();
      cache.supabaseClient = supabaseClient;
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
  const t = cache.data;
  return t ? Object.keys(t) : [];
}

/**
 * Récupère la valeur d'une clé depuis la table chargée (ou depuis le cache global).
 *
 * @param {string} key
 * @returns {*} value_json si présent, sinon value, sinon undefined
 */
export function getConfig(key) {
  if (!key) return undefined;

  const cache = getGlobalCache();
  const t = cache.data;
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

  return undefined;
}

/** Optionnel: accès au timestamp du cache */
export function getConfigInfo() {
  const cache = getGlobalCache();
  return {
    loadedAt: cache.loadedAt,
    hasData: !!cache.data,
    data: cache.data,
    inFlight: !!cache.inFlight,
    supabaseClient: cache.supabaseClient,
    getenv: cache.getenv,
  };
}

export function getSupabase() {
  return getGlobalCache().supabaseClient;
}

var getenvPtr = null;

export async function initializeConfigCore(supabase, getenv_impl, newSupabase_impl, admin) {
  // This function is called by either initializeConfig_Backend() or initializeConfig_Edge()
  // or initializeConfig_Client() depending on the the actual runtime
  if (!supabase) {
    console.log("initializeConfigCore: supabaseClient is null, trying to create a new one");
  }
  const notnull_supabase = supabase || (await newSupabase_impl(admin));
  getenvPtr = getenv_impl;
  await loadConfigTable(notnull_supabase, { force: true });
  getGlobalCache().getenv = getenv_impl;
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
  return getenvPtr(key);
}

export function getFederationConfig() {
  // TODO: implement federation config
  return {};
}

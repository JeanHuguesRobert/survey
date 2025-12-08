// netlify/edge-functions/lib/instanceConfig.js
// Module de configuration pour les Edge Functions (Deno)
//
// APPROCHE PROGRESSIVE :
// 1. Le vault (table instance_config) est prioritaire
// 2. Deno.env reste le fallback (compatibilité)
// 3. Valeurs par défaut en dernier recours
// 4. Pas de breaking change pour l'instance déployée

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// CONFIGURATION DES CLÉS
// ============================================================================

/**
 * Mapping des clés de config vers les variables d'environnement correspondantes
 * Chaque clé peut avoir plusieurs alternatives (la première trouvée est utilisée)
 */
const ENV_KEY_MAPPING = {
  // Identité
  community_name: ["COMMUNITY_NAME", "CITY_NAME"],
  community_type: ["COMMUNITY_TYPE"],
  community_tagline: ["CITY_TAGLINE"],
  city_name: ["CITY_NAME"],

  // Branding
  movement_name: ["MOVEMENT_NAME"],
  party_name: ["PARTY_NAME"],
  hashtag: ["HASHTAG"],
  bot_name: ["BOT_NAME"],

  // Contact
  contact_email: ["CONTACT_EMAIL"],

  // Supabase
  supabase_url: ["SUPABASE_URL"],
  supabase_service_role_key: ["SUPABASE_SERVICE_ROLE_KEY"],
  supabase_anon_key: ["SUPABASE_ANON_KEY"],

  // IA providers
  openai_api_key: ["OPENAI_API_KEY"],
  anthropic_api_key: ["ANTHROPIC_API_KEY"],
  mistral_api_key: ["MISTRAL_API_KEY"],
  huggingface_api_key: ["HUGGINGFACE_API_KEY"],
  gemini_api_key: ["GEMINI_API_KEY"],
  grok_api_key: ["GROK_API_KEY"],
  google_filesearch_api_key: ["GOOGLE_FILESEARCH_API_KEY", "GEMINI_API_KEY"],

  // Search
  brave_search_api_key: ["BRAVE_SEARCH_API_KEY"],

  // GitHub
  github_token: ["GITHUB_TOKEN"],
  github_repo: ["GITHUB_REPO"],

  // App
  app_url: ["URL", "DEPLOY_PRIME_URL"],
  bob_system_prompt: ["BOB_SYSTEM_PROMPT"],

  // Database
  postgres_url: ["POSTGRES_URL", "DATABASE_URL"],
  database_url: ["DATABASE_URL", "POSTGRES_URL"],

  // Cron
  cron_api_key: ["CRON_API_KEY"],
  cli_token: ["CLI_TOKEN"],

  // Features
  disable_provider_randomization: ["DISABLE_PROVIDER_RANDOMIZATION"],
  llm_stream_timeout_ms: ["LLM_STREAM_TIMEOUT_MS"],
  site_config_cache_ttl: ["SITE_CONFIG_CACHE_TTL"],

  // Document search
  file_search_default_stores: ["FILE_SEARCH_DEFAULT_STORES"],
  gemini_cache_id: ["GEMINI_CACHE_ID"],
  supabase_storage_bucket: ["SUPABASE_STORAGE_BUCKET"],
  file_search_cache_table: ["FILE_SEARCH_CACHE_TABLE"],
  file_search_cache_ttl_days: ["FILE_SEARCH_CACHE_TTL_DAYS"],
};

/**
 * Valeurs par défaut pour les clés connues
 */
const DEFAULT_VALUES = {
  community_name: "Corte",
  community_type: "municipality",
  community_tagline: "CAPITALE",
  city_name: "Corte",
  movement_name: "Pertitellu",
  hashtag: "#PERTITELLU",
  bot_name: "Ophélia",
  github_repo: "JeanHuguesRobert/survey",
  llm_stream_timeout_ms: 30000,
  site_config_cache_ttl: 5,
  supabase_storage_bucket: "public-documents",
  file_search_cache_table: "file_search_cache",
  file_search_cache_ttl_days: 7,
};

// ============================================================================
// CACHE LOCAL
// ============================================================================

let configCache = null;
let cacheTimestamp = null;
let vaultAvailable = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// FONCTIONS INTERNES
// ============================================================================

/**
 * Récupère une valeur depuis les variables d'environnement
 * Gère automatiquement la conversion clé_minuscule -> CLÉ_MAJUSCULE
 * @param {string} key - Clé de configuration (lowercase avec underscores)
 * @returns {string|null}
 */
function getEnvValue(key) {
  const envKeys = ENV_KEY_MAPPING[key];
  if (envKeys) {
    // Parcourir les clés env possibles
    for (const envKey of envKeys) {
      const value = Deno.env.get(envKey);
      if (value) return value;
    }
    return null;
  }

  // Clé inconnue: convertir en UPPER_SNAKE_CASE
  const envKey = key.toUpperCase().replace(/-/g, "_");
  return Deno.env.get(envKey) || null;
}

/**
 * Parse une valeur string en type approprié
 * @param {string} value - Valeur à parser
 * @param {string} key - Clé pour déterminer le type
 * @returns {any}
 */
function parseValue(value, key) {
  if (value === null || value === undefined || value === "") return null;

  // Booléens
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "1" && key.includes("disable")) return true;
  if (value === "0" && key.includes("disable")) return false;

  // Nombres (clés se terminant par _ms, _ttl, _days, _count, etc.)
  if (/_(?:ms|ttl|days|count|size|limit|max|min)$/i.test(key)) {
    const num = Number(value);
    if (!isNaN(num)) return num;
  }

  return value;
}

/**
 * Génère la config depuis les variables d'environnement
 * Utilisé pour pré-remplir le cache
 */
function buildEnvConfig() {
  const config = {};

  // Parcourir toutes les clés connues
  for (const key of Object.keys(ENV_KEY_MAPPING)) {
    const value = getEnvValue(key);
    if (value !== null) {
      config[key] = parseValue(value, key);
    } else if (DEFAULT_VALUES[key] !== undefined) {
      config[key] = DEFAULT_VALUES[key];
    }
  }

  return config;
}

// ============================================================================
// CHARGEMENT DE LA CONFIG
// ============================================================================

/**
 * Tente de charger la config depuis le vault
 * Retourne {} si le vault n'est pas disponible
 */
async function loadFromVault() {
  if (vaultAvailable === false) {
    return {};
  }

  // Utiliser getEnvValue pour la cohérence
  const supabaseUrl = getEnvValue("supabase_url");
  const supabaseKey = getEnvValue("supabase_service_role_key");

  if (!supabaseUrl || !supabaseKey) {
    vaultAvailable = false;
    return {};
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // On charge toutes les configs (y compris secrets, car on est côté serveur avec service_role)
    const { data, error } = await supabase
      .from("instance_config")
      .select("key, value, value_json")
      .order("key");

    if (error) {
      // Table n'existe pas = migration pas appliquée
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.log("[instanceConfig] Vault non disponible (migration pas appliquée)");
        vaultAvailable = false;
        return {};
      }
      console.warn("[instanceConfig] Erreur vault:", error.message);
      return {};
    }

    vaultAvailable = true;

    // Convertir en objet clé-valeur
    const config = {};
    for (const row of data || []) {
      if (row.value_json !== null) {
        config[row.key] = row.value_json;
      } else if (row.value !== null && row.value !== "") {
        config[row.key] = parseValue(row.value, row.key);
      }
    }

    console.log(`[instanceConfig] ${Object.keys(config).length} configs depuis vault`);
    return config;
  } catch (err) {
    console.warn("[instanceConfig] Vault inaccessible:", err.message);
    vaultAvailable = false;
    return {};
  }
}

/**
 * Charge la configuration de l'instance
 * APPROCHE PROGRESSIVE :
 * 1. Charge d'abord les env vars (fallback garanti)
 * 2. Tente de charger depuis la DB (si vault disponible)
 * 3. Fusionne : DB surcharge env vars
 *
 * @param {boolean} forceRefresh - Force le rechargement depuis la DB
 * @returns {Promise<Object>}
 */
export async function loadInstanceConfig(forceRefresh = false) {
  // Vérifier le cache
  if (!forceRefresh && configCache && cacheTimestamp) {
    const age = Date.now() - cacheTimestamp;
    if (age < CACHE_TTL_MS) {
      return configCache;
    }
  }

  // Toujours commencer par les env vars
  const envConfig = buildEnvConfig();

  // Tenter de charger depuis la DB (vault)
  const dbConfig = await loadFromVault();

  // Fusionner : DB surcharge env vars
  configCache = {
    ...envConfig,
    ...dbConfig,
  };
  cacheTimestamp = Date.now();

  return configCache;
}

// ============================================================================
// ACCESSEURS PUBLICS
// ============================================================================

/**
 * Récupère une valeur de configuration avec fallback automatique vers env vars
 * @param {string} key - Clé de configuration
 * @param {any} defaultValue - Valeur par défaut si non trouvée (optionnel)
 * @returns {any}
 */
export function getConfigValue(key, defaultValue = undefined) {
  // 1. D'abord vérifier le cache (vault + env déjà fusionnés)
  if (configCache) {
    const cached = configCache[key];
    if (cached !== undefined && cached !== null && cached !== "") {
      return cached;
    }
  }

  // 2. Fallback vers les variables d'environnement (si cache pas chargé)
  const envValue = getEnvValue(key);
  if (envValue !== null && envValue !== "") {
    return parseValue(envValue, key);
  }

  // 3. Valeur par défaut explicite
  if (defaultValue !== undefined) {
    return defaultValue;
  }

  // 4. Valeur par défaut implicite
  return DEFAULT_VALUES[key] ?? null;
}

/**
 * Alias pour getConfigValue
 */
export const getConfig = getConfigValue;

// ============================================================================
// HELPERS SPÉCIALISÉS
// ============================================================================

/**
 * Récupère la configuration de branding
 */
export async function getBranding() {
  await loadInstanceConfig();
  return {
    botName: getConfigValue("bot_name", "Ophélia"),
    cityName: getConfigValue("city_name", "Corte"),
    communityName: getConfigValue("community_name", "Corte"),
    movementName: getConfigValue("movement_name", "Pertitellu"),
    partyName: getConfigValue("party_name", ""),
    hashtag: getConfigValue("hashtag", "#PERTITELLU"),
  };
}

/**
 * Récupère la configuration OpenAI
 */
export async function getOpenAIConfig() {
  await loadInstanceConfig();
  return {
    apiKey: getConfigValue("openai_api_key", ""),
    model: getConfigValue("openai_model", "gpt-4o-mini"),
  };
}

/**
 * Récupère la clé API pour un provider donné
 * @param {string} provider - Nom du provider (openai, anthropic, mistral, etc.)
 * @returns {Promise<string>}
 */
export async function getProviderApiKey(provider) {
  await loadInstanceConfig();
  const keyName = provider === "google" ? "gemini_api_key" : `${provider.toLowerCase()}_api_key`;
  return getConfigValue(keyName, "");
}

/**
 * Vérifie si un provider est disponible (a une clé API)
 * @param {string} provider - Nom du provider
 * @returns {Promise<boolean>}
 */
export async function isProviderAvailable(provider) {
  const apiKey = await getProviderApiKey(provider);
  return Boolean(apiKey);
}

/**
 * Récupère la configuration Supabase
 */
export function getSupabaseConfig() {
  return {
    url: getConfigValue("supabase_url", ""),
    serviceRoleKey: getConfigValue("supabase_service_role_key", ""),
    anonKey: getConfigValue("supabase_anon_key", ""),
  };
}

/**
 * Crée un client Supabase avec la configuration du vault
 */
export function createSupabaseClient(useServiceRole = true) {
  const config = getSupabaseConfig();
  if (!config.url) return null;

  const key = useServiceRole ? config.serviceRoleKey : config.anonKey;
  if (!key) return null;

  return createClient(config.url, key);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  loadInstanceConfig,
  getConfigValue,
  getConfig,
  getBranding,
  getOpenAIConfig,
  getProviderApiKey,
  isProviderAvailable,
  getSupabaseConfig,
  createSupabaseClient,
};

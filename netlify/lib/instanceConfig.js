// netlify/lib/instanceConfig.js
// Module de configuration backend (Node.js) - Vault centralisé
//
// APPROCHE PROGRESSIVE :
// 1. Le vault (table instance_config) est prioritaire
// 2. process.env reste le fallback (compatibilité)
// 3. Valeurs par défaut en dernier recours
// 4. Pas de breaking change pour l'instance déployée

import { createClient } from "@supabase/supabase-js";

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
  community_code: ["COMMUNE_INSEE"],
  city_name: ["CITY_NAME"],

  // Localisation
  region_name: ["REGION_NAME"],
  region_code: ["REGION_CODE"],

  // Branding
  movement_name: ["MOVEMENT_NAME"],
  party_name: ["PARTY_NAME"],
  hashtag: ["HASHTAG"],
  bot_name: ["BOT_NAME"],

  // Contact
  contact_email: ["CONTACT_EMAIL", "VITE_CONTACT_EMAIL"],

  // Supabase
  supabase_url: ["SUPABASE_URL"],
  supabase_service_role_key: ["SUPABASE_SERVICE_ROLE_KEY"],
  supabase_anon_key: ["SUPABASE_ANON_KEY"],

  // IA providers
  openai_api_key: ["OPENAI_API_KEY"],
  openai_model: ["OPENAI_MODEL"],
  openai_base_url: ["OPENAI_BASE_URL"],
  anthropic_api_key: ["ANTHROPIC_API_KEY"],
  mistral_api_key: ["MISTRAL_API_KEY"],
  huggingface_api_key: ["HUGGINGFACE_API_KEY"],
  hf_api_key: ["HUGGINGFACE_API_KEY", "HF_API_KEY"],
  gemini_api_key: ["GEMINI_API_KEY"],
  grok_api_key: ["GROK_API_KEY"],

  // Search
  brave_search_api_key: ["BRAVE_SEARCH_API_KEY"],

  // GitHub
  github_token: ["GITHUB_TOKEN"],
  github_repo: ["GITHUB_REPO"],
  github_wiki_branch: ["GITHUB_WIKI_BRANCH"],
  github_client_id: ["GITHUB_CLIENT_ID"],
  github_client_secret: ["GITHUB_CLIENT_SECRET"],

  // Facebook
  facebook_app_id: ["FACEBOOK_APP_ID", "VITE_FACEBOOK_APP_ID"],
  facebook_token: ["FACEBOOK_TOKEN"],
  facebook_client_secret: ["FACEBOOK_CLIENT_SECRET"],

  // Google OAuth
  google_client_id: ["GOOGLE_CLIENT_ID"],
  google_client_secret: ["GOOGLE_CLIENT_SECRET"],

  // App
  app_url: ["URL", "DEPLOY_PRIME_URL"],
  app_base_url: ["APP_BASE_URL", "URL", "DEPLOY_PRIME_URL"],

  // Database
  postgres_url: ["POSTGRES_URL", "DATABASE_URL"],
  database_url: ["DATABASE_URL", "POSTGRES_URL"],

  // Cron
  cron_api_key: ["CRON_API_KEY"],
  cli_token: ["CLI_TOKEN"],

  // Federation
  parent_hub_url: ["PARENT_HUB_URL"],
  parent_hub_api_key: ["PARENT_HUB_API_KEY"],

  // Features
  disable_provider_randomization: ["DISABLE_PROVIDER_RANDOMIZATION"],
  llm_stream_timeout_ms: ["LLM_STREAM_TIMEOUT_MS"],
  site_config_cache_ttl: ["SITE_CONFIG_CACHE_TTL"],
};

/**
 * Valeurs par défaut pour les clés connues
 */
const DEFAULT_VALUES = {
  community_name: "Corte",
  community_type: "municipality",
  community_tagline: "CAPITALE",
  community_code: "2B096",
  city_name: "Corte",
  region_name: "Corse",
  region_code: "COR",
  movement_name: "Pertitellu",
  hashtag: "#PERTITELLU",
  bot_name: "Ophélia",
  github_repo: "JeanHuguesRobert/survey",
  github_wiki_branch: "main",
  openai_model: "gpt-4o-mini",
  openai_base_url: "https://api.openai.com/v1",
  app_base_url: "http://localhost:8888",
  llm_stream_timeout_ms: 30000,
  site_config_cache_ttl: 5,
  // Features (activées par défaut)
  feature_wiki: true,
  feature_consultations: true,
  feature_chatbot: true,
  feature_rag: true,
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
      const value = process.env[envKey];
      if (value) return value;
    }
    return null;
  }

  // Clé inconnue: convertir en UPPER_SNAKE_CASE
  const envKey = key.toUpperCase().replace(/-/g, "_");
  return process.env[envKey] || null;
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

  // Ajouter les features (valeurs par défaut)
  for (const [key, value] of Object.entries(DEFAULT_VALUES)) {
    if (key.startsWith("feature_") && config[key] === undefined) {
      config[key] = value;
    }
  }

  return config;
}

// ============================================================================
// CLIENT SUPABASE (lazy init)
// ============================================================================

let _supabase = null;

function getSupabase() {
  if (!_supabase) {
    const url = getEnvValue("supabase_url");
    const key = getEnvValue("supabase_service_role_key");
    if (url && key) {
      _supabase = createClient(url, key);
    }
  }
  return _supabase;
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

  const supabase = getSupabase();
  if (!supabase) {
    vaultAvailable = false;
    return {};
  }

  try {
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
 * Alias pour getConfigValue (rétrocompatibilité)
 */
export function getConfig(key, defaultValue = null) {
  return getConfigValue(key, defaultValue);
}

/**
 * Récupère un secret (charge depuis vault si disponible)
 * @param {string} key
 */
export async function getSecret(key) {
  await loadInstanceConfig();
  return getConfigValue(key, null);
}

/**
 * Vérifie si une feature est activée
 */
export function isFeatureEnabled(featureName) {
  return getConfigValue(`feature_${featureName}`, true);
}

// ============================================================================
// HELPERS SPÉCIFIQUES
// ============================================================================

/**
 * Récupère la config de branding
 */
export async function getBranding() {
  await loadInstanceConfig();
  return {
    botName: getConfigValue("bot_name"),
    cityName: getConfigValue("city_name"),
    communityName: getConfigValue("community_name"),
    movementName: getConfigValue("movement_name"),
    partyName: getConfigValue("party_name", ""),
    hashtag: getConfigValue("hashtag"),
    contactEmail: getConfigValue("contact_email", ""),
  };
}

/**
 * Récupère la config GitHub
 */
export async function getGitHubConfig() {
  await loadInstanceConfig();
  const repo = getConfigValue("github_repo");
  const [owner, repoName] = repo.includes("/") ? repo.split("/") : ["JeanHuguesRobert", repo];

  return {
    owner,
    repo: repoName,
    branch: getConfigValue("github_wiki_branch"),
    wikiPath: "wiki",
    token: getConfigValue("github_token", ""),
  };
}

/**
 * Récupère la config OpenAI
 */
export async function getOpenAIConfig() {
  await loadInstanceConfig();
  return {
    apiKey: getConfigValue("openai_api_key", ""),
    model: getConfigValue("openai_model"),
    baseUrl: getConfigValue("openai_base_url"),
  };
}

/**
 * Récupère la config Facebook
 */
export async function getFacebookConfig() {
  await loadInstanceConfig();
  return {
    appId: getConfigValue("facebook_app_id", ""),
    token: getConfigValue("facebook_token", ""),
    clientSecret: getConfigValue("facebook_client_secret", ""),
  };
}

/**
 * Récupère la configuration de fédération
 * @returns {Object}
 */
export async function getFederationConfig() {
  await loadInstanceConfig();
  return {
    isHub: getConfigValue("is_hub", false),
    hubType: getConfigValue("hub_type", "commune"),
    parentHubUrl: getConfigValue("parent_hub_url", ""),
    peers: getConfigValue("federation_peers", []),
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  loadInstanceConfig,
  getConfig,
  getConfigValue,
  getSecret,
  isFeatureEnabled,
  getBranding,
  getGitHubConfig,
  getOpenAIConfig,
  getFacebookConfig,
  getFederationConfig,
};

// scripts/lib/config.js
// Module de configuration pour les scripts CLI
//
// APPROCHE PROGRESSIVE :
// 1. Le vault (table instance_config) est prioritaire si disponible
// 2. process.env (via dotenv) reste le fallback
// 3. Valeurs par défaut en dernier recours

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger .env
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

// ============================================================================
// CONFIGURATION DES CLÉS
// ============================================================================

/**
 * Mapping des clés de config vers les variables d'environnement correspondantes
 */
const ENV_KEY_MAPPING = {
  // Supabase
  supabase_url: ["SUPABASE_URL"],
  supabase_service_role_key: ["SUPABASE_SERVICE_ROLE_KEY"],
  supabase_anon_key: ["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"],
  supabase_storage_bucket: ["SUPABASE_STORAGE_BUCKET"],

  // IA providers
  openai_api_key: ["OPENAI_API_KEY"],
  openai_model: ["OPENAI_MODEL", "OPENAI_CHAT_MODEL"],
  openai_embedding_model: ["OPENAI_EMBEDDING_MODEL"],
  anthropic_api_key: ["ANTHROPIC_API_KEY"],
  gemini_api_key: ["GEMINI_API_KEY"],
  google_filesearch_api_key: ["GOOGLE_FILESEARCH_API_KEY", "GEMINI_API_KEY"],

  // GitHub
  github_token: ["GITHUB_TOKEN"],
  github_repo: ["GITHUB_REPO"],

  // App
  app_url: ["URL", "VITE_APP_URL", "DEPLOY_PRIME_URL"],
  app_base_url: ["APP_BASE_URL", "URL", "DEPLOY_URL"],

  // Identité
  city_name: ["CITY_NAME", "VITE_CITY_NAME"],
  party_name: ["PARTY_NAME", "VITE_PARTY_NAME"],

  // CLI
  cli_token: ["CLI_TOKEN"],
  ngrok_control_secret: ["NGROK_CONTROL_SECRET"],
};

/**
 * Valeurs par défaut
 */
const DEFAULT_VALUES = {
  supabase_storage_bucket: "public-documents",
  openai_model: "gpt-4o-mini",
  openai_embedding_model: "text-embedding-3-small",
  city_name: "Corte",
  party_name: "Petit Parti",
  app_url: "https://lepp.fr",
  github_repo: "JeanHuguesRobert/survey",
};

// ============================================================================
// CACHE ET CLIENTS
// ============================================================================

let configCache = null;
let vaultChecked = false;
let _supabase = null;

function getEnvValue(key) {
  const envKeys = ENV_KEY_MAPPING[key];
  if (envKeys) {
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

function parseValue(value, key) {
  if (value === null || value === undefined || value === "") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/_(?:ms|ttl|days|count|size|limit|max|min)$/i.test(key)) {
    const num = Number(value);
    if (!isNaN(num)) return num;
  }
  return value;
}

function getSupabaseForVault() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      _supabase = createClient(url, key);
    }
  }
  return _supabase;
}

// ============================================================================
// CHARGEMENT DE LA CONFIG
// ============================================================================

async function loadFromVault() {
  const supabase = getSupabaseForVault();
  if (!supabase) return {};

  try {
    const { data, error } = await supabase
      .from("instance_config")
      .select("key, value, value_json")
      .order("key");

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.log("[config] Vault non disponible (table instance_config absente)");
        return {};
      }
      console.warn("[config] Erreur vault:", error.message);
      return {};
    }

    const config = {};
    for (const row of data || []) {
      if (row.value_json !== null) {
        config[row.key] = row.value_json;
      } else if (row.value !== null && row.value !== "") {
        config[row.key] = parseValue(row.value, row.key);
      }
    }

    console.log(`[config] ${Object.keys(config).length} configs chargées depuis le vault`);
    return config;
  } catch (err) {
    console.warn("[config] Vault inaccessible:", err.message);
    return {};
  }
}

function buildEnvConfig() {
  const config = {};
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

/**
 * Charge la configuration (vault + env vars)
 * @param {boolean} forceRefresh - Force le rechargement
 * @returns {Promise<Object>}
 */
export async function loadConfig(forceRefresh = false) {
  if (!forceRefresh && configCache) {
    return configCache;
  }

  // Toujours commencer par les env vars
  const envConfig = buildEnvConfig();

  // Tenter de charger depuis le vault
  if (!vaultChecked || forceRefresh) {
    const dbConfig = await loadFromVault();
    configCache = { ...envConfig, ...dbConfig };
    vaultChecked = true;
  } else {
    configCache = envConfig;
  }

  return configCache;
}

// ============================================================================
// ACCESSEURS
// ============================================================================

/**
 * Récupère une valeur de configuration
 * @param {string} key - Clé de configuration
 * @param {any} defaultValue - Valeur par défaut
 * @returns {any}
 */
export function getConfigValue(key, defaultValue = undefined) {
  // 1. Cache
  if (configCache) {
    const cached = configCache[key];
    if (cached !== undefined && cached !== null && cached !== "") {
      return cached;
    }
  }

  // 2. Env vars
  const envValue = getEnvValue(key);
  if (envValue !== null && envValue !== "") {
    return parseValue(envValue, key);
  }

  // 3. Default explicite
  if (defaultValue !== undefined) {
    return defaultValue;
  }

  // 4. Default implicite
  return DEFAULT_VALUES[key] ?? null;
}

/**
 * Créé un client Supabase avec les credentials du vault/env
 * @returns {import("@supabase/supabase-js").SupabaseClient}
 */
export function createSupabaseClient() {
  const url = getConfigValue("supabase_url");
  const key = getConfigValue("supabase_service_role_key");
  if (!url || !key) {
    throw new Error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis");
  }
  return createClient(url, key);
}

/**
 * Créé un client OpenAI avec les credentials du vault/env
 * @returns {Promise<import("openai").default>}
 */
export async function createOpenAIClient() {
  const OpenAI = (await import("openai")).default;
  const apiKey = getConfigValue("openai_api_key");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY est requis");
  }
  return new OpenAI({ apiKey });
}

// Export par défaut
export default {
  loadConfig,
  getConfigValue,
  createSupabaseClient,
  createOpenAIClient,
};

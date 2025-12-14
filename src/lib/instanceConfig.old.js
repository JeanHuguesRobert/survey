// TODO: Remove this file, it should never be imported

// src/lib/instanceConfig.js
// Module de configuration d'instance - Vault centralisé
//
// APPROCHE PROGRESSIVE ("en douceur") :
// 1. Les variables d'environnement restent la source principale (compatibilité)
// 2. Si la table instance_config existe, ses valeurs SURCHARGENT les env vars
// 3. Pas de breaking change pour l'instance déployée
//
// Pour migrer progressivement :
// - Appliquer la migration 20251205_instance_vault.sql
// - L'app continue de fonctionner avec les env vars
// - Les configs ajoutées en DB prennent le dessus

import { supabase } from "./supabase";

// ============================================================================
// CACHE LOCAL
// ============================================================================

let configCache = null;
let cacheTimestamp = null;
let vaultAvailable = null; // null = pas encore testé, true/false après test
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// RÉCUPÉRATION DE LA CONFIG PUBLIQUE
// ============================================================================

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

  // Toujours commencer par les env vars (garantit que l'app fonctionne)
  const envConfig = getEnvConfig();

  // Tenter de charger depuis la DB (vault)
  const dbConfig = await loadFromVault();

  // Fusionner : DB surcharge env vars (mais env vars = fallback)
  configCache = {
    ...envConfig,
    ...dbConfig, // Les valeurs DB écrasent les env vars
  };
  cacheTimestamp = Date.now();

  if (Object.keys(dbConfig).length > 0) {
    console.log(
      `✓ Config: ${Object.keys(dbConfig).length} valeurs depuis vault, ${Object.keys(envConfig).length} depuis env`
    );
  } else {
    console.log("📋 Config: mode env vars uniquement (vault non disponible ou vide)");
  }

  return configCache;
}

/**
 * Tente de charger la config depuis le vault (table instance_config)
 * Retourne {} si le vault n'est pas disponible (migration non appliquée)
 */
async function loadFromVault() {
  // Si on sait déjà que le vault n'est pas disponible, skip
  if (vaultAvailable === false) {
    return {};
  }

  try {
    const { data, error } = await supabase.rpc("get_public_instance_config");

    if (error) {
      // Erreur 42883 = fonction n'existe pas (migration pas appliquée)
      // Erreur 42P01 = table n'existe pas
      if (
        error.code === "42883" ||
        error.code === "42P01" ||
        error.message?.includes("does not exist")
      ) {
        console.log("ℹ️ Vault non disponible (migration pas encore appliquée)");
        vaultAvailable = false;
        return {};
      }
      console.warn("⚠️ Erreur vault:", error.message);
      return {};
    }

    vaultAvailable = true;
    return parseConfigValues(data || {});
  } catch (err) {
    console.warn("⚠️ Vault inaccessible:", err.message);
    vaultAvailable = false;
    return {};
  }
}

/**
 * Récupère la configuration depuis les variables d'environnement
 * C'est le comportement ACTUEL - garantit la compatibilité
 */
function getEnvConfig() {
  return {
    // Identité
    community_name:
      import.meta.env.VITE_COMMUNITY_NAME || import.meta.env.VITE_CITY_NAME || "Corte",
    community_type: import.meta.env.VITE_COMMUNITY_TYPE || "municipality",
    community_tagline: import.meta.env.VITE_CITY_TAGLINE || "CAPITALE",
    community_code: import.meta.env.VITE_COMMUNE_INSEE || "2B096",

    // Localisation
    region_name: import.meta.env.VITE_REGION_NAME || "Corse",
    region_code: import.meta.env.VITE_REGION_CODE || "COR",
    country: "FR",
    timezone: "Europe/Paris",
    locale: "fr-FR",

    // Branding
    movement_name: import.meta.env.VITE_MOVEMENT_NAME || "Pertitellu",
    party_name: import.meta.env.VITE_PARTY_NAME || "",
    hashtag: import.meta.env.VITE_HASHTAG || "#PERTITELLU",
    bot_name: import.meta.env.VITE_BOT_NAME || "Ophélia",
    primary_color: "#B35A4A",
    secondary_color: "#3B4E6B",

    // Contact
    contact_email: import.meta.env.VITE_CONTACT_EMAIL || "",

    // Social / Facebook
    facebook_page_url: import.meta.env.VITE_FACEBOOK_PAGE_URL || "",
    facebook_app_id: import.meta.env.VITE_FACEBOOK_APP_ID || "",

    // Gazette
    global_gazette_editor_group: import.meta.env.VITE_GLOBAL_GAZETTE_EDITOR_GROUP || "La Gazette",

    // API Keys (exposed to frontend for direct API calls)
    huggingface_api_key: import.meta.env.VITE_HUGGINGFACE_API_KEY || "",

    // Features (toutes activées par défaut)
    feature_wiki: true,
    feature_consultations: true,
    feature_petitions: true,
    feature_chatbot: true,
    feature_transparency: true,
    feature_social: true,
    feature_rag: true,
    feature_comments: true,
    feature_ocr: true,
    feature_moderation: true,

    // Carte (parser le format "lat,lng" si présent)
    ...parseMapEnv(),

    // Chatbot
    chatbot_welcome_message: "Bonjour ! Je suis Ophélia. Comment puis-je vous aider ?",
    chatbot_fallback_message:
      "Désolée, je ne trouve pas de réponse. Souhaitez-vous créer une proposition ?",
    chatbot_similarity_threshold: 0.65,
    chatbot_max_sources: 3,

    // Fédération
    is_hub: import.meta.env.VITE_SUPABASE_URL === import.meta.env.VITE_NATIONAL_API_URL,
    hub_type: "commune",
    parent_hub_url: import.meta.env.VITE_NATIONAL_API_URL || "",
  };
}

/**
 * Parse la variable VITE_MAP_DEFAULT_CENTER (format "lat,lng")
 */
function parseMapEnv() {
  const center = import.meta.env.VITE_MAP_DEFAULT_CENTER;
  if (center && center.includes(",")) {
    const [lat, lng] = center.split(",").map(parseFloat);
    return {
      map_default_lat: lat || 42.3084,
      map_default_lng: lng || 9.1505,
      map_default_zoom: 13,
      map_style: "osm",
    };
  }
  return {
    map_default_lat: 42.3084,
    map_default_lng: 9.1505,
    map_default_zoom: 13,
    map_style: "osm",
  };
}

/**
 * Configuration de fallback (utilisée si loadInstanceConfig non appelé)
 * @deprecated Utiliser loadInstanceConfig() au démarrage de l'app
 */
function getFallbackConfig() {
  return getEnvConfig();
}

/**
 * Parse les valeurs de config (convertit strings en types appropriés)
 */
function parseConfigValues(config) {
  const parsed = {};

  for (const [key, value] of Object.entries(config)) {
    // Null ou undefined = skip
    if (value === null || value === undefined) {
      continue;
    }
    // Booleans
    if (value === "true") {
      parsed[key] = true;
    } else if (value === "false") {
      parsed[key] = false;
    }
    // Numbers (mais pas les strings vides)
    else if (typeof value === "string" && value !== "" && !isNaN(value)) {
      parsed[key] = parseFloat(value);
    }
    // JSON objects déjà parsés
    else if (typeof value === "object") {
      parsed[key] = value;
    }
    // Strings non vides seulement
    else if (value !== "") {
      parsed[key] = value;
    }
  }

  return parsed;
}

// ============================================================================
// VÉRIFICATION DISPONIBILITÉ VAULT
// ============================================================================

/**
 * Vérifie si le vault (table instance_config) est disponible
 * Utile pour l'UI admin
 * @returns {Promise<boolean>}
 */
export async function isVaultAvailable() {
  if (vaultAvailable !== null) {
    return vaultAvailable;
  }

  // Tenter de charger pour vérifier
  await loadFromVault();
  return vaultAvailable === true;
}

// ============================================================================
// ACCESSEURS TYPÉS
// ============================================================================

/**
 * Récupère une valeur de configuration
 * @param {string} key - Clé de configuration
 * @param {any} defaultValue - Valeur par défaut
 * @returns {any}
 */
export function getConfig(key, defaultValue = null) {
  if (!configCache) {
    // Si le cache n'est pas chargé, retourner la valeur par défaut
    // Le composant devrait appeler loadInstanceConfig() au mount
    console.warn(`Config non chargée, valeur par défaut pour: ${key}`);
    return defaultValue;
  }
  return configCache[key] ?? defaultValue;
}

/**
 * Vérifie si une feature est activée
 * @param {string} featureName - Nom de la feature (sans le préfixe feature_)
 * @returns {boolean}
 */
export function isFeatureEnabled(featureName) {
  return getConfig(`feature_${featureName}`, true);
}

/**
 * Récupère les informations d'identité de l'instance
 * @returns {Object}
 */
export function getIdentity() {
  return {
    name: getConfig("community_name", "Corte"),
    type: getConfig("community_type", "municipality"),
    tagline: getConfig("community_tagline", ""),
    code: getConfig("community_code", ""),
    region: getConfig("region_name", ""),
    regionCode: getConfig("region_code", ""),
    country: getConfig("country", "FR"),
    timezone: getConfig("timezone", "Europe/Paris"),
    locale: getConfig("locale", "fr-FR"),
  };
}

/**
 * Récupère les informations de branding
 * @returns {Object}
 */
export function getBranding() {
  return {
    movementName: getConfig("movement_name", ""),
    partyName: getConfig("party_name", ""),
    hashtag: getConfig("hashtag", ""),
    botName: getConfig("bot_name", "Ophélia"),
    primaryColor: getConfig("primary_color", "#B35A4A"),
    secondaryColor: getConfig("secondary_color", "#3B4E6B"),
    logo: getConfig("logo", { url: "/images/logo.png" }),
    favicon: getConfig("favicon", { url: "/favicon.ico" }),
  };
}

/**
 * Récupère la configuration de la carte
 * @returns {Object}
 */
export function getMapConfig() {
  return {
    center: [getConfig("map_default_lat", 42.3084), getConfig("map_default_lng", 9.1505)],
    zoom: getConfig("map_default_zoom", 13),
    style: getConfig("map_style", "osm"),
  };
}

/**
 * Récupère la configuration du chatbot
 * @returns {Object}
 */
export function getChatbotConfig() {
  return {
    welcomeMessage: getConfig("chatbot_welcome_message", "Bonjour !"),
    fallbackMessage: getConfig("chatbot_fallback_message", "Désolée, je ne trouve pas de réponse."),
    similarityThreshold: getConfig("chatbot_similarity_threshold", 0.65),
    maxSources: getConfig("chatbot_max_sources", 3),
  };
}

/**
 * Récupère la configuration de fédération
 * @returns {Object}
 */
export function getFederationConfig() {
  return {
    isHub: getConfig("is_hub", false),
    hubType: getConfig("hub_type", "commune"),
    parentHubUrl: getConfig("parent_hub_url", ""),
    peers: getConfig("federation_peers", []),
  };
}

// ============================================================================
// ADMIN : MISE À JOUR DES CONFIGS
// ============================================================================

/**
 * Met à jour une configuration (admin only)
 * @param {string} key - Clé de configuration
 * @param {string} value - Nouvelle valeur
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateConfig(key, value) {
  try {
    const { data, error } = await supabase.rpc("set_instance_config", {
      p_key: key,
      p_value: String(value),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Invalider le cache
    configCache = null;
    cacheTimestamp = null;

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Met à jour plusieurs configurations en batch
 * @param {Object} updates - Object {key: value, ...}
 * @returns {Promise<{success: boolean, errors?: Object}>}
 */
export async function updateConfigs(updates) {
  const results = {};
  const errors = {};

  for (const [key, value] of Object.entries(updates)) {
    const result = await updateConfig(key, value);
    if (result.success) {
      results[key] = true;
    } else {
      errors[key] = result.error;
    }
  }

  return {
    success: Object.keys(errors).length === 0,
    results,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Récupère une configuration secrète (admin only, via edge function)
 * @param {string} key - Clé du secret
 * @returns {Promise<string|null>}
 */
export async function getSecretConfig(key) {
  try {
    const { data, error } = await supabase.rpc("get_instance_config", {
      p_key: key,
    });

    if (error) {
      console.error("Erreur lecture secret:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Erreur critique secret:", err);
    return null;
  }
}

// ============================================================================
// INITIALISATION AU BOOT
// ============================================================================

/**
 * Initialise la configuration de l'instance
 * À appeler au démarrage de l'application (App.jsx ou main.jsx)
 *
 * APPROCHE PROGRESSIVE :
 * - Si vault non disponible → utilise env vars (comportement actuel)
 * - Si vault disponible → fusionne (DB prioritaire)
 *
 * @returns {Promise<Object>}
 */
export async function initInstanceConfig() {
  console.log("🔧 Initialisation config instance...");

  const config = await loadInstanceConfig();

  // Afficher un résumé (sans secrets)
  console.log(`📍 Instance: ${config.community_name} (${config.community_type})`);
  console.log(`🤖 Bot: ${config.bot_name}`);
  console.log(`🌍 Région: ${config.region_name}`);

  if (vaultAvailable) {
    console.log("🔐 Vault: activé");
  } else {
    console.log("📋 Vault: non disponible (mode env vars)");
  }

  return config;
}

// ============================================================================
// HOOK REACT (optionnel)
// ============================================================================

import { useState, useEffect } from "react";

/**
 * Hook React pour utiliser la configuration d'instance
 * @returns {{ config: Object, loading: boolean, error: Error|null, refresh: Function }}
 */
export function useInstanceConfig() {
  const [config, setConfig] = useState(configCache || getFallbackConfig());
  const [loading, setLoading] = useState(!configCache);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!configCache) {
      loadInstanceConfig()
        .then((cfg) => {
          setConfig(cfg);
          setLoading(false);
        })
        .catch((err) => {
          setError(err);
          setLoading(false);
        });
    }
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const cfg = await loadInstanceConfig(true);
      setConfig(cfg);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return { config, loading, error, refresh };
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  // Chargement
  loadInstanceConfig,
  initInstanceConfig,
  isVaultAvailable,

  // Accesseurs
  getConfig,
  isFeatureEnabled,
  getIdentity,
  getBranding,
  getMapConfig,
  getChatbotConfig,
  getFederationConfig,

  // Admin
  updateConfig,
  updateConfigs,
  getSecretConfig,

  // Hook React
  useInstanceConfig,
};

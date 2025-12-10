// src/common/config/instanceConfig.core.js
// Module de configuration centralisé (lecture seule)
// Agnostique à l'environnement (Node.js, Deno, Frontend)
// Les fonctions spécifiques à l'environnement (lecture env, client Supabase) sont injectées.

// ============================================================================\
// CONFIGURATION DES CLÉS
// ============================================================================\

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
  country: ["COUNTRY"],
  timezone: ["TIMEZONE"],
  locale: ["LOCALE"],

  // Branding
  movement_name: ["MOVEMENT_NAME"],
  party_name: ["PARTY_NAME"],
  hashtag: ["HASHTAG"],
  bot_name: ["BOT_NAME"],
  primary_color: ["PRIMARY_COLOR"],
  secondary_color: ["SECONDARY_COLOR"],
  logo: ["LOGO"],
  favicon: ["FAVICON"],

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
  huggingface_api_key: ["HUGGINGFACE_API_KEY", "HF_API_KEY"],
  gemini_api_key: ["GEMINI_API_KEY"],
  grok_api_key: ["GROK_API_KEY"],
  google_filesearch_api_key: ["GOOGLE_FILESEARCH_API_KEY", "GEMINI_API_KEY"],

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
  facebook_page_url: ["FACEBOOK_PAGE_URL"],

  // Google OAuth
  google_client_id: ["GOOGLE_CLIENT_ID"],
  google_client_secret: ["GOOGLE_CLIENT_SECRET"],

  // App
  app_url: ["URL", "DEPLOY_PRIME_URL"],
  app_base_url: ["APP_BASE_URL", "URL", "DEPLOY_PRIME_URL"],
  bob_system_prompt: ["BOB_SYSTEM_PROMPT"],

  // Database
  postgres_url: ["POSTGRES_URL", "DATABASE_URL"],
  database_url: ["DATABASE_URL", "POSTGRES_URL"],

  // Cron
  cron_api_key: ["CRON_API_KEY"],
  cli_token: ["CLI_TOKEN"],

  // Federation
  parent_hub_url: ["PARENT_HUB_URL"],
  parent_hub_api_key: ["PARENT_HUB_API_KEY"],
  is_hub: ["IS_HUB"], // Déduit si SUPABASE_URL === NATIONAL_API_URL
  hub_type: ["HUB_TYPE"],
  federation_peers: ["FEDERATION_PEERS"],

  // Features
  disable_provider_randomization: ["DISABLE_PROVIDER_RANDOMIZATION"],
  llm_stream_timeout_ms: ["LLM_STREAM_TIMEOUT_MS"],
  site_config_cache_ttl: ["SITE_CONFIG_CACHE_TTL"],
  feature_wiki: ["FEATURE_WIKI"],
  feature_consultations: ["FEATURE_CONSULTATIONS"],
  feature_petitions: ["FEATURE_PETITIONS"],
  feature_chatbot: ["FEATURE_CHATBOT"],
  feature_transparency: ["FEATURE_TRANSPARENCY"],
  feature_social: ["FEATURE_SOCIAL"],
  feature_rag: ["FEATURE_RAG"],
  feature_comments: ["FEATURE_COMMENTS"],
  feature_ocr: ["FEATURE_OCR"],
  feature_moderation: ["FEATURE_MODERATION"],

  // Document search
  file_search_default_stores: ["FILE_SEARCH_DEFAULT_STORES"],
  gemini_cache_id: ["GEMINI_CACHE_ID"],
  supabase_storage_bucket: ["SUPABASE_STORAGE_BUCKET"],
  file_search_cache_table: ["FILE_SEARCH_CACHE_TABLE"],
  file_search_cache_ttl_days: ["FILE_SEARCH_CACHE_TTL_DAYS"],

  // Gazette
  global_gazette_editor_group: ["GLOBAL_GAZETTE_EDITOR_GROUP"],

  // Chatbot
  chatbot_welcome_message: ["CHATBOT_WELCOME_MESSAGE"],
  chatbot_fallback_message: ["CHATBOT_FALLBACK_MESSAGE"],
  chatbot_similarity_threshold: ["CHATBOT_SIMILARITY_THRESHOLD"],
  chatbot_max_sources: ["CHATBOT_MAX_SOURCES"],

  // Map
  map_default_center: ["MAP_DEFAULT_CENTER"], // "lat,lng"
  map_default_lat: ["MAP_DEFAULT_LAT"],
  map_default_lng: ["MAP_DEFAULT_LNG"],
  map_default_zoom: ["MAP_DEFAULT_ZOOM"],
  map_style: ["MAP_STYLE"],
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
  country: "FR",
  timezone: "Europe/Paris",
  locale: "fr-FR",
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
  supabase_storage_bucket: "public-documents",
  file_search_cache_table: "file_search_cache",
  file_search_cache_ttl_days: 7,
  global_gazette_editor_group: "La Gazette",
  chatbot_welcome_message: "Bonjour ! Je suis Ophélia. Comment puis-je vous aider ?",
  chatbot_fallback_message:
    "Désolée, je ne trouve pas de réponse. Souhaitez-vous créer une proposition ?",
  chatbot_similarity_threshold: 0.65,
  chatbot_max_sources: 3,
  map_default_lat: 42.3084,
  map_default_lng: 9.1505,
  map_default_zoom: 13,
  map_style: "osm",
  primary_color: "#B35A4A",
  secondary_color: "#3B4E6B",
  logo: { url: "/images/logo.png" },
  favicon: { url: "/favicon.ico" },
  hub_type: "commune",
  federation_peers: [],

  // Features (activées par défaut)
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
};

// ============================================================================\
// CACHE LOCAL
// ============================================================================\

let configCache = null;
let cacheTimestamp = null;
let vaultAvailable = null; // null = pas encore testé, true/false après test
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================\
// FONCTIONS INTERNES (injectées par l'adaptateur d'environnement)
// ============================================================================\

let _getEnvValue = null;
let _createSupabaseClient = null;
let _getSupabaseInstance = null; // Pour les cas où le client est déjà initialisé (ex: frontend)

/**
 * Initialise les fonctions spécifiques à l'environnement.
 * Doit être appelée une fois au démarrage de l'application/environnement.
 * @param {Object} envFns
 * @param {Function} envFns.getEnvValue - Fonction pour lire une variable d'environnement.
 * @param {Function} [envFns.createSupabaseClient] - Fonction pour créer un client Supabase.
 * @param {Object} [envFns.supabaseInstance] - Instance Supabase déjà créée.
 */
export function initializeConfigCore(envFns) {
  if (!envFns || typeof envFns.getEnvValue !== "function") {
    throw new Error("initializeConfigCore requires a getEnvValue function.");
  }
  _getEnvValue = envFns.getEnvValue;
  _createSupabaseClient = envFns.createSupabaseClient;
  _getSupabaseInstance = envFns.supabaseInstance;
}

/**
 * Récupère une valeur depuis les variables d'environnement en utilisant la fonction injectée.
 * @param {string} key - Clé de configuration (lowercase avec underscores)
 * @returns {string|null}
 */
function getEnvValue(key) {
  if (!_getEnvValue) {
    console.warn("ConfigCore: getEnvValue not initialized. Returning null for", key);
    return null;
  }
  const envKeys = ENV_KEY_MAPPING[key];
  if (envKeys) {
    for (const envKey of envKeys) {
      const value = _getEnvValue(envKey);
      if (value) return value;
    }
    return null;
  }

  // Clé inconnue: convertir en UPPER_SNAKE_CASE
  const envKey = key.toUpperCase().replace(/-/g, "_");
  return _getEnvValue(envKey) || null;
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
  // Cas spécifique pour les features désactivées par "0" ou "1"
  if (key.startsWith("disable_") || key.startsWith("feature_")) {
    if (value === "1") return true;
    if (value === "0") return false;
  }

  // Nombres (clés se terminant par _ms, _ttl, _days, _count, etc.)
  if (/_(?:ms|ttl|days|count|size|limit|max|min)$/i.test(key)) {
    const num = Number(value);
    if (!isNaN(num)) return num;
  }

  // JSON (si la valeur est une chaîne JSON valide)
  if (
    (typeof value === "string" && value.startsWith("{") && value.endsWith("}")) ||
    (value.startsWith("[") && value.endsWith("]"))
  ) {
    try {
      const json = JSON.parse(value);
      return json;
    } catch (e) {
      // Pas du JSON valide, continuer
    }
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

  // Gérer les cas spéciaux de déduction
  // is_hub
  const supabaseUrl = getEnvValue("supabase_url");
  const nationalApiUrl = getEnvValue("NATIONAL_API_URL"); // Assumer que c'est une env var directe
  if (supabaseUrl && nationalApiUrl && supabaseUrl === nationalApiUrl) {
    config.is_hub = true;
  } else if (config.is_hub === undefined) {
    config.is_hub = false; // Valeur par défaut
  }

  // Map default center
  const mapCenter = getEnvValue("map_default_center");
  if (mapCenter && mapCenter.includes(",")) {
    const [lat, lng] = mapCenter.split(",").map(parseFloat);
    if (!isNaN(lat) && !isNaN(lng)) {
      config.map_default_lat = lat;
      config.map_default_lng = lng;
    }
  }

  // Ajouter les features (valeurs par défaut si non définies par env)
  for (const [key, value] of Object.entries(DEFAULT_VALUES)) {
    if (key.startsWith("feature_") && config[key] === undefined) {
      config[key] = value;
    }
  }

  return config;
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

  let supabaseClient = null;
  if (_getSupabaseInstance) {
    supabaseClient = _getSupabaseInstance;
  } else if (_createSupabaseClient) {
    supabaseClient = _createSupabaseClient(true); // true pour service_role
  }

  if (!supabaseClient) {
    vaultAvailable = false;
    return {};
  }

  try {
    // Tente d'appeler la fonction RPC si elle existe (frontend)
    if (typeof supabaseClient.rpc === "function") {
      const { data, error } = await supabaseClient.rpc("get_public_instance_config");
      if (!error) {
        vaultAvailable = true;
        return parseConfigValues(data || {});
      }
      // Si la fonction RPC n'existe pas ou erreur, on essaie la table directe
      if (
        error.code !== "42883" &&
        error.code !== "42P01" &&
        !error.message?.includes("does not exist")
      ) {
        console.warn("[instanceConfig.core] Erreur RPC vault:", error.message);
      }
    }

    // Fallback: lecture directe de la table (backend/edge)
    const { data, error } = await supabaseClient
      .from("instance_config")
      .select("key, value, value_json")
      .order("key");

    if (error) {
      // Table n'existe pas = migration pas appliquée
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.log("[instanceConfig.core] Vault non disponible (migration pas appliquée)");
        vaultAvailable = false;
        return {};
      }
      console.warn("[instanceConfig.core] Erreur vault:", error.message);
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

    console.log(`[instanceConfig.core] ${Object.keys(config).length} configs depuis vault`);
    return config;
  } catch (err) {
    console.warn("[instanceConfig.core] Vault inaccessible:", err.message);
    vaultAvailable = false;
    return {};
  }
}

/**
 * Parse les valeurs de config (convertit strings en types appropriés)
 * Utilisé pour les données venant du vault.
 */
function parseConfigValues(config) {
  const parsed = {};
  for (const [key, value] of Object.entries(config)) {
    if (value === null || value === undefined) {
      continue;
    }
    // Les valeurs du vault sont déjà souvent typées, mais on repasse par parseValue
    // pour la cohérence et les cas spécifiques (features, etc.)
    parsed[key] = parseValue(value, key);
  }
  return parsed;
}

// ============================================================================\
// CHARGEMENT DE LA CONFIG PUBLIQUE
// ============================================================================\

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
  if (!_getEnvValue) {
    console.error("ConfigCore: initializeConfigCore must be called before loadInstanceConfig.");
    return {};
  }

  // Vérifier le cache
  if (!forceRefresh && configCache && cacheTimestamp) {
    const age = Date.now() - cacheTimestamp;
    if (age < CACHE_TTL_MS) {
      return configCache;
    }
  }

  // Toujours commencer par les env vars (garantit que l'app fonctionne)
  const envConfig = buildEnvConfig();

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

// ============================================================================\
// ACCESSEURS PUBLICS
// ============================================================================\

/**
 * Récupère une valeur de configuration
 * @param {string} key - Clé de configuration
 * @param {any} defaultValue - Valeur par défaut
 * @returns {any}
 */
export function getConfigValue(key, defaultValue = undefined) {
  if (!configCache) {
    // Si le cache n'est pas chargé, tenter de récupérer directement de l'env ou valeur par défaut
    const envValue = getEnvValue(key);
    if (envValue !== null && envValue !== "") {
      return parseValue(envValue, key);
    }
    return defaultValue ?? DEFAULT_VALUES[key] ?? null;
  }
  return configCache[key] ?? defaultValue ?? DEFAULT_VALUES[key] ?? null;
}

/**
 * Alias pour getConfigValue
 */
export const getConfig = getConfigValue;

/**
 * Vérifie si une feature est activée
 * @param {string} featureName - Nom de la feature (sans le préfixe feature_)
 * @returns {boolean}
 */
export function isFeatureEnabled(featureName) {
  return getConfig(`feature_${featureName}`, true);
}

// ============================================================================\
// HELPERS SPÉCIALISÉS
// ============================================================================\

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
    botName: getConfig("bot_name", "Ophélia"),
    cityName: getConfig("city_name", "Corte"),
    communityName: getConfig("community_name", "Corte"),
    movementName: getConfig("movement_name", "Pertitellu"),
    partyName: getConfig("party_name", ""),
    hashtag: getConfig("hashtag", "#PERTITELLU"),
    contactEmail: getConfig("contact_email", ""),
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

/**
 * Récupère la configuration GitHub
 */
export function getGitHubConfig() {
  const repo = getConfigValue("github_repo");
  const [owner, repoName] =
    repo && repo.includes("/") ? repo.split("/") : ["JeanHuguesRobert", repo];

  return {
    owner,
    repo: repoName,
    branch: getConfigValue("github_wiki_branch"),
    wikiPath: "wiki",
    token: getConfigValue("github_token", ""),
  };
}

/**
 * Récupère la configuration OpenAI
 */
export function getOpenAIConfig() {
  return {
    apiKey: getConfigValue("openai_api_key", ""),
    model: getConfigValue("openai_model"),
    baseUrl: getConfigValue("openai_base_url"),
  };
}

/**
 * Récupère la clé API pour un provider donné
 * @param {string} provider - Nom du provider (openai, anthropic, mistral, etc.)
 * @returns {string}
 */
export function getProviderApiKey(provider) {
  const keyName = provider === "google" ? "gemini_api_key" : `${provider.toLowerCase()}_api_key`;
  return getConfigValue(keyName, "");
}

/**
 * Vérifie si un provider est disponible (a une clé API)
 * @param {string} provider - Nom du provider
 * @returns {boolean}
 */
export function isProviderAvailable(provider) {
  const apiKey = getProviderApiKey(provider);
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

// ============================================================================\
// INITIALISATION AU BOOT
// ============================================================================\

/**
 * Initialise la configuration de l'instance
 * À appeler au démarrage de l'application/environnement.
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

// ============================================================================\
// EXPORT PAR DÉFAUT (pour faciliter l'import)
// ============================================================================\

export default {
  initializeConfigCore,
  loadInstanceConfig,
  getConfigValue,
  getConfig,
  isFeatureEnabled,
  getIdentity,
  getBranding,
  getMapConfig,
  getChatbotConfig,
  getFederationConfig,
  getGitHubConfig,
  getOpenAIConfig,
  getProviderApiKey,
  isProviderAvailable,
  getSupabaseConfig,
  // Note: createSupabaseClient n'est pas exporté ici car il dépend de l'implémentation
  // spécifique à l'environnement et sera géré par les adaptateurs.
};

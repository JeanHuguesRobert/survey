import { createClient } from "@supabase/supabase-js";

// ============================================================================
// SUPABASE DYNAMIQUE MULTI-INSTANCES
// ============================================================================
// L'instance Supabase est résolue dynamiquement selon l'URL :
// 1. Paramètre ?instance=xxx (dev/localhost)
// 2. Sous-domaine : corte.transparence.corsica
// 3. Fallback : variables d'environnement
//
// En développement : utiliser http://localhost:5173?instance=corte
// En production : les sous-domaines sont résolus automatiquement

let supabaseInstance = null;
let currentInstanceConfig = null;
let initPromise = null;

// ============================================================================
// CRÉATION DU CLIENT AVEC LOGGING
// ============================================================================

/**
 * Crée un client Supabase avec logging
 * @param {string} url
 * @param {string} anonKey
 * @param {string} subdomain - Pour isoler les sessions
 * @returns {SupabaseClient}
 */
function createLoggingClient(url, anonKey, subdomain = "default") {
  const rawClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // Clé de stockage unique par instance (isole les sessions)
      storageKey: `sb-${subdomain}-auth`,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    },
  });

  // Proxy de logging (même logique qu'avant)
  return new Proxy(rawClient, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value === "function") {
        return (...args) => {
          const startTime = Date.now();
          console.log(`Supabase: Calling ${prop}`, args.length > 0 ? args[0] : "");

          try {
            const result = value.apply(target, args);

            if (result && typeof result.then === "function") {
              return result.then(
                (data) => {
                  const duration = Date.now() - startTime;
                  if (data?.error) {
                    console.error(
                      `Supabase: ${prop} resolved in ${duration}ms Error: ${data.error.message}`
                    );
                    throw new Error(`Supabase error in ${prop}: ${data.error.message}`);
                  } else {
                    console.log(`Supabase: ${prop} resolved in ${duration}ms Success`);
                  }
                  return data;
                },
                (error) => {
                  const duration = Date.now() - startTime;
                  console.error(`Supabase: ${prop} rejected in ${duration}ms`, error);
                  throw error;
                }
              );
            }

            console.log(`Supabase: ${prop} returned synchronously`);
            return result;
          } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`Supabase: ${prop} threw synchronously in ${duration}ms`, error);
            throw error;
          }
        };
      }
      return value;
    },
  });
}

// ============================================================================
// INITIALISATION DYNAMIQUE
// ============================================================================

/**
 * Initialise Supabase avec l'instance résolue
 * @param {Object} instanceConfig - Config depuis instanceResolver
 * @returns {SupabaseClient|null}
 */
export function initSupabaseWithInstance(instanceConfig) {
  if (!instanceConfig?.supabaseUrl || !instanceConfig?.supabaseAnonKey) {
    console.error("❌ Configuration Supabase invalide");
    return null;
  }

  currentInstanceConfig = instanceConfig;
  supabaseInstance = createLoggingClient(
    instanceConfig.supabaseUrl,
    instanceConfig.supabaseAnonKey,
    instanceConfig.subdomain || "default"
  );

  console.log(
    `✅ Supabase initialisé pour: ${instanceConfig.displayName || instanceConfig.subdomain}`
  );

  // Exposer pour debug
  if (typeof window !== "undefined") {
    window.__SUPABASE_INSTANCE__ = {
      subdomain: instanceConfig.subdomain,
      displayName: instanceConfig.displayName,
      source: instanceConfig.source,
    };
  }

  return supabaseInstance;
}

/**
 * Initialise Supabase de manière asynchrone (résout l'instance automatiquement)
 * @returns {Promise<{supabase: SupabaseClient, instance: Object}>}
 */
export async function initSupabase() {
  // Éviter les initialisations multiples
  if (initPromise) {
    return initPromise;
  }

  // Si déjà initialisé, retourner directement
  if (supabaseInstance && currentInstanceConfig) {
    return { supabase: supabaseInstance, instance: currentInstanceConfig };
  }

  initPromise = (async () => {
    // Import dynamique pour éviter les dépendances circulaires
    const { resolveInstance } = await import("./instanceResolver.js");

    const instance = await resolveInstance();

    if (!instance.isConfigured && !instance.supabaseUrl) {
      throw new Error("Aucune configuration Supabase valide trouvée");
    }

    const client = initSupabaseWithInstance(instance);

    return { supabase: client, instance };
  })();

  return initPromise;
}

// ============================================================================
// COMPATIBILITÉ : EXPORT SYNCHRONE
// ============================================================================

// Pour la compatibilité avec le code existant, on crée un client par défaut
// Ce client sera remplacé par initSupabase() au démarrage de l'app

const defaultUrl = import.meta.env.VITE_SUPABASE_URL;
const defaultAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Client par défaut (sera remplacé par initSupabase au boot)
const defaultClient =
  defaultUrl && defaultAnonKey ? createLoggingClient(defaultUrl, defaultAnonKey, "default") : null;

// Export synchrone pour compatibilité
// ATTENTION: Préférer getSupabase() après initSupabase()
export const supabase = defaultClient;

// ============================================================================
// ACCESSEURS
// ============================================================================

/**
 * Récupère le client Supabase initialisé
 * @returns {SupabaseClient}
 * @throws {Error} si non initialisé
 */
export function getSupabase() {
  if (!supabaseInstance) {
    // Fallback sur le client par défaut
    if (defaultClient) {
      console.warn("⚠️ Utilisation du client Supabase par défaut (initSupabase non appelé)");
      return defaultClient;
    }
    throw new Error("Supabase non initialisé. Appeler initSupabase() d'abord.");
  }
  return supabaseInstance;
}

/**
 * Récupère la configuration de l'instance actuelle
 * @returns {Object|null}
 */
export function getInstanceConfig() {
  return currentInstanceConfig;
}

/**
 * Vérifie si Supabase est initialisé
 * @returns {boolean}
 */
export function isSupabaseReady() {
  return supabaseInstance !== null || defaultClient !== null;
}

// ============================================================================
// RESET (pour tests)
// ============================================================================

/**
 * Réinitialise le client Supabase (pour tests)
 */
export function resetSupabase() {
  supabaseInstance = null;
  currentInstanceConfig = null;
  initPromise = null;
}

// ============================================================================
// HOOK DEPRECATED
// ============================================================================

/**
 * Hook to get current authenticated user (deprecated - use useSupabase context instead)
 */
export function useAuth() {
  console.warn("useAuth is deprecated. Use useSupabase context instead.");
  return { user: null, loading: false };
}

// netlify/edge-functions/instance-resolver.js
// Edge function pour résoudre l'instance à partir du sous-domaine.
// TODO: WIP
//
// Cette fonction :
// 1. Extrait le sous-domaine de la requête
// 2. Recherche l'instance dans le registre (Supabase du hub)
// 3. Injecte les informations dans les headers de réponse
//
// Le frontend lit ces headers pour initialiser le bon client Supabase

import {
  loadInstanceConfig,
  getConfig,
  getSupabase,
  newSupabase,
} from "../../common/config/instanceConfig.edge.js";
import { injectMetadata } from "./lib/html-injector.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Domaines de base pour la détection
const BASE_DOMAINS = ["lepp.fr", "kudocracy.org"];

// Sous-domaines système à ignorer
const IGNORED_SUBDOMAINS = ["www", "app", "api", "admin", "staging", "preview"];

// ============================================================================
// HANDLER
// ============================================================================

export default async function handler(request, context) {
  const url = new URL(request.url);
  const hostname = url.hostname;

  // Extraire le sous-domaine
  const subdomain = extractSubdomain(hostname);

  // Rechercher l'instance dans le registre (si sous-domaine présent)
  const instance = subdomain ? await lookupInstance(subdomain) : null;

  // Si on a un sous-domaine, on prévient les fonctions suivantes (comme root-redirect)
  // qu'elles n'ont pas besoin d'injecter les métadonnées par défaut
  if (subdomain) {
    request.headers.set("X-Ophelia-Skip-Default-Injection", "true");
  }

  // Obtenir la réponse suivante (index.html ou autre asset)
  let response = await context.next();

  // 1. Gérer l'injection de métadonnées (uniquement si instance trouvée)
  // Pour le domaine racine, c'est root-redirect qui s'en occupe.
  if (instance) {
    response = await injectMetadata(response, instance, subdomain);
  }

  // 2. Gérer les headers d'instance
  if (instance) {
    response.headers.set("X-Ophelia-Instance", subdomain);
    response.headers.set("X-Ophelia-Instance-Name", instance.display_name || subdomain);
    response.headers.set("X-Ophelia-Supabase-URL", instance.supabase_url);
    response.headers.set("X-Ophelia-Supabase-Anon-Key", instance.supabase_anon_key);
    console.log(`[instance-resolver] Instance found: ${instance.display_name}`);
  } else if (subdomain) {
    response.headers.set("X-Ophelia-Instance", subdomain);
    response.headers.set("X-Ophelia-Instance-Error", "not-found");
    console.log(`[instance-resolver] Instance not found: ${subdomain}`);
  }

  return addCorsHeaders(response);
}

// ============================================================================
// EXTRACTION DU SOUS-DOMAINE
// ============================================================================

function extractSubdomain(hostname) {
  // Localhost ou IP = pas de sous-domaine
  if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  // Vérifier chaque domaine de base
  for (const baseDomain of BASE_DOMAINS) {
    if (hostname.endsWith(`.${baseDomain}`)) {
      const subdomain = hostname.replace(`.${baseDomain}`, "");

      // Ignorer les sous-domaines système
      if (IGNORED_SUBDOMAINS.includes(subdomain)) {
        return null;
      }

      // Pour Netlify previews, extraire le vrai sous-domaine
      // Format: deploy-preview-123--site-name.netlify.app
      if (baseDomain === "netlify.app" && subdomain.includes("--")) {
        return null; // Laisser le frontend gérer via ?instance=
      }

      return subdomain;
    }
  }

  return null;
}

// ============================================================================
// LOOKUP DANS LE REGISTRE
// ============================================================================

async function lookupInstance(subdomain) {
  // On utilise initializeInstanceAdmin pour être sûr d'avoir accès aux variables d'env du hub
  await loadInstanceConfig(false);

  // URL du registre central (hub)
  const registryUrl = getConfig("REGISTRY_SUPABASE_URL") || getConfig("SUPABASE_URL");
  const registryKey = getConfig("REGISTRY_SUPABASE_ANON_KEY") || getConfig("SUPABASE_ANON_KEY");

  if (!registryUrl || !registryKey) {
    console.warn("[instance-resolver] No registry configured");
    return null;
  }

  try {
    // Utilise la factory Deno avec les options de registre si définies
    const supabase = newSupabase(false, {
      supabaseUrl: registryUrl,
      supabaseAnonKey: registryKey,
    });

    // Recherche de l'instance via RPC
    const { data, error } = await supabase.rpc("get_instance_by_subdomain", {
      p_subdomain: subdomain,
    });

    if (error) {
      // Fonction n'existe pas = migration pas appliquée
      if (error.code === "42883") {
        console.log("[instance-resolver] Registry not available (migration not applied)");
        return null;
      }
      console.error("[instance-resolver] Lookup error:", error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[instance-resolver] Lookup failed:", err.message);
    return null;
  }
}

// ============================================================================
// CORS HEADERS
// ============================================================================

function addCorsHeaders(response) {
  // Exposer les headers personnalisés au JavaScript
  const exposedHeaders = [
    "X-Ophelia-Instance",
    "X-Ophelia-Instance-Name",
    "X-Ophelia-Supabase-URL",
    "X-Ophelia-Supabase-Anon-Key",
    "X-Ophelia-Instance-Error",
  ].join(", ");

  response.headers.set("Access-Control-Expose-Headers", exposedHeaders);

  return response;
}

// ============================================================================
// CONFIG NETLIFY
// ============================================================================

export const config = {
  // S'exécute sur toutes les requêtes
  path: "/*",
  // Exclure les assets statiques
  excludedPath: ["/assets/*", "/_next/*", "/images/*", "/fonts/*"],
};

/**
 * src\common\config\instanceConfig.edge.js
 * Adaptateur Edge Function (Deno) pour l'initialisation de la configuration de l'instance.
 * Gère l'accès aux variables d'environnement Deno et l'initialisation du client Supabase.
 */

import { initializeConfigCore } from "./instanceConfig.core.js";
// Pour Deno Edge Functions, le client Supabase est généralement importé depuis un CDN ou un module spécifique à Deno.
// Assurez-vous que cette importation est correcte pour votre environnement Deno.
// Par exemple, si vous utilisez le client Supabase pour Deno :
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1"; // Exemple d'importation pour Deno

// Fonction pour récupérer les variables d'environnement côté Deno Edge Functions
const getEnvValueEdge = (key) => {
  // Deno.env.get() est la manière standard d'accéder aux variables d'environnement dans Deno
  const envKey = key.toUpperCase(); // Les variables d'environnement sont souvent en majuscules
  return Deno.env.get(envKey) || null;
};

// Fonction pour créer une instance Supabase côté Deno Edge Functions
const createSupabaseClientEdge = () => {
  const supabaseUrl = getEnvValueEdge("SUPABASE_URL");
  const supabaseServiceRoleKey = getEnvValueEdge("SUPABASE_SERVICE_ROLE_KEY"); // Utilisation de la clé de rôle de service pour les Edge Functions

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn(
      "Supabase URL or Service Role Key not found in Deno Edge environment. Supabase client will not be initialized."
    );
    return null;
  }

  // Pour les Edge Functions, comme pour le backend, il est courant d'utiliser la clé de rôle de service.
  return createClient(supabaseUrl, supabaseServiceRoleKey);
};

// Instance Supabase (peut être null si les clés ne sont pas disponibles)
const supabaseClientInstance = createSupabaseClientEdge();

// Initialiser le module de configuration core avec les fonctions spécifiques à Deno Edge
initializeConfigCore({
  getEnvValue: getEnvValueEdge,
  createSupabaseClient: createSupabaseClientEdge,
  supabaseInstance: supabaseClientInstance,
});

// Ré-exporter tout de instanceConfig.core.js pour une utilisation facile dans les Edge Functions
export * from "./instanceConfig.core.js";

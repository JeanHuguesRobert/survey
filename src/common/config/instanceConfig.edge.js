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

// Function to get env var in Netlify
function getenv(key) {
  return Netlify.env.get(key);
}

// Fonction pour créer une instance Supabase côté Deno Edge Functions
const createSupabase_Edge = () => {
  const supabaseUrl = getenv("SUPABASE_URL");
  const supabaseServiceRoleKey = getenv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn(
      "Supabase URL or Service Role Key not found in Deno Edge environment. Supabase client will not be initialized."
    );
    return null;
  }

  // Pour les Edge Functions, comme pour le backend, il est courant d'utiliser la clé de rôle de service.
  return createClient(supabaseUrl, supabaseServiceRoleKey);
};

export async function newSupabase() {
  return createSupabase_Edge();
}

export async function initializeConfig_Edge(supabase, admin = false) {
  return initializeConfigCore(supabase, getenv, newSupabase);
}

// Edge functions should call this function very early on.
// TODO: where should the instance be selected in the multi-instance case?
export async function initializeConfigAdmin_Edge(supabase) {
  return initializeConfig_Edge(supabase, true);
}

// Ré-exporter tout de instanceConfig.core.js pour une utilisation facile dans les Edge Functions
export * from "./instanceConfig.core.js";

/**
 * src\common\config\instanceConfig.backend.js
 * Adaptateur backend (Node.js) pour l'initialisation de la configuration de l'instance.
 * Gère l'accès aux variables d'environnement côté serveur et l'initialisation du client Supabase.
 */

import { initializeInstanceCore } from "./instanceConfig.core.js";
import { createClient } from "@supabase/supabase-js";

// Use dotenv to load .env
import dotenv from "dotenv";
dotenv.config();

// Fonction pour récupérer les variables d'environnement côté backend (Node.js)
function getenv(key) {
  return process.env[key];
}

// Fonction pour créer une instance Supabase côté backend
const createSupabase_Backend = (admin = true) => {
  const supabaseUrl = getenv("SUPABASE_URL");
  const supabaseServiceRoleKey = getenv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn(
      "Supabase URL or Service Role Key not found in backend environment. Supabase client will not be initialized."
    );
    return null;
  }

  if (!admin) {
    // TODO: handle non admin connections
    console.warn("Should create a non admin supabase connection.");
  }
  // Pour le backend, il est courant d'utiliser la clé de rôle de service pour des opérations privilégiées
  return createClient(supabaseUrl, supabaseServiceRoleKey);
};

export async function newSupabase(admin = true) {
  return createSupabase_Backend(admin);
}

export async function initializeInstanceBackend(supabase = null, admin = false) {
  return initializeInstanceCore(supabase, getenv, newSupabase, admin);
}

export async function initializeInstanceAdminBackend(supabase = null) {
  return initializeInstanceCore(supabase, getenv, newSupabase, true);
}

// Ré-exporter tout de instanceConfig.core.js pour une utilisation facile dans le backend
export * from "./instanceConfig.core.js";

/**
 * src\common\config\instanceConfig.backend.js
 * Adaptateur backend (Node.js) pour l'initialisation de la configuration de l'instance.
 * Gère l'accès aux variables d'environnement côté serveur et l'initialisation du client Supabase.
 */

import { initializeConfigCore } from "./instanceConfig.core.js";
import { createClient } from "@supabase/supabase-js";

// Fonction pour récupérer les variables d'environnement côté backend (Node.js)
const getEnvValueBackend = (key) => {
  // process.env est la manière standard d'accéder aux variables d'environnement en Node.js
  // Nous utilisons une convention de nommage pour les variables d'environnement
  const envKey = key.toUpperCase(); // Les variables d'environnement sont souvent en majuscules
  return process.env[envKey] || null;
};

// Fonction pour créer une instance Supabase côté backend
const createSupabaseClientBackend = () => {
  const supabaseUrl = getEnvValueBackend("SUPABASE_URL");
  const supabaseServiceRoleKey = getEnvValueBackend("SUPABASE_SERVICE_ROLE_KEY"); // Utilisation de la clé de rôle de service pour le backend

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn(
      "Supabase URL or Service Role Key not found in backend environment. Supabase client will not be initialized."
    );
    return null;
  }

  // Pour le backend, il est courant d'utiliser la clé de rôle de service pour des opérations privilégiées
  return createClient(supabaseUrl, supabaseServiceRoleKey);
};

// Instance Supabase (peut être null si les clés ne sont pas disponibles)
const supabaseClientInstance = createSupabaseClientBackend();

// Initialiser le module de configuration core avec les fonctions spécifiques au backend
initializeConfigCore({
  getEnvValue: getEnvValueBackend,
  createSupabaseClient: createSupabaseClientBackend,
  supabaseInstance: supabaseClientInstance,
});

// Ré-exporter tout de instanceConfig.core.js pour une utilisation facile dans le backend
export * from "./instanceConfig.core.js";

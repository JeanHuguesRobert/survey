/**
 * src\common\config\instanceConfig.client.js
 * Adaptateur client (frontend React) pour l'initialisation de la configuration de l'instance.
 * Gère l'accès aux variables d'environnement côté client et l'initialisation du client Supabase.
 */

import { initializeConfigCore } from "./instanceConfig.core.js";
import { createClient } from "@supabase/supabase-js";

// Fonction pour récupérer les variables d'environnement côté client (React)
const getEnvValueClient = (key) => {
  // import.meta.env est la manière standard d'accéder aux variables d'environnement dans Vite/React
  // Nous utilisons une convention de nommage pour les variables d'environnement
  const envKey = `VITE_APP_${key.toUpperCase()}`;
  return import.meta.env[envKey] || null;
};

// Fonction pour créer une instance Supabase côté client
const createSupabaseClientClient = () => {
  const supabaseUrl = getEnvValueClient("SUPABASE_URL");
  const supabaseAnonKey = getEnvValueClient("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "Supabase URL or Anon Key not found in client environment. Supabase client will not be initialized."
    );
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

// Instance Supabase (peut être null si les clés ne sont pas disponibles)
const supabaseClientInstance = createSupabaseClientClient();

// Initialiser le module de configuration core avec les fonctions spécifiques au client
initializeConfigCore({
  getEnvValue: getEnvValueClient,
  createSupabaseClient: createSupabaseClientClient,
  supabaseInstance: supabaseClientInstance,
});

// Ré-exporter tout de instanceConfig.core.js pour une utilisation facile dans le frontend
export * from "./instanceConfig.core.js";

/**
 * Utilitaires pour afficher les noms d'utilisateurs de manière cohérente
 */

/**
 * Obtient le nom d'affichage d'un utilisateur
 * Priorité: display_name > metadata.displayName > email > 'Anonyme'
 *
 * @param {Object} user - Objet utilisateur (peut venir de users, auth, etc.)
 * @returns {string} Le nom d'affichage
 */
export function getDisplayName(user) {
  if (!user) return "Anonyme";

  // Essayer display_name (format Supabase standard)
  if (user.display_name) return user.display_name;

  // Essayer metadata.displayName
  if (user.metadata?.displayName) return user.metadata.displayName;

  // Fallback sur email (dernier recours)
  if (user.email) return user.email;
  // ...existing code...

  return "Anonyme";
}

/**
 * Obtient l'initiale pour un avatar
 *
 * @param {Object} user - Objet utilisateur
 * @returns {string} L'initiale en majuscule
 */
export function getUserInitial(user) {
  const displayName = getDisplayName(user);

  // Si c'est "Anonyme", retourne "?"
  if (displayName === "Anonyme") return "?";

  // Retourne la première lettre en majuscule
  return displayName[0].toUpperCase();
}

/**
 * Obtient le nom court (prénom seulement si nom complet)
 *
 * @param {Object} user - Objet utilisateur
 * @returns {string} Le nom court
 */
export function getShortDisplayName(user) {
  const fullName = getDisplayName(user);

  // Si c'est un email, retourne la partie avant @
  if (fullName.includes("@")) {
    return fullName.split("@")[0];
  }

  // Si c'est un nom complet (avec espace), retourne le prénom
  const parts = fullName.split(" ");
  return parts[0];
}

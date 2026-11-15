/**
 * Ophelia Template Engine (OTE) - Plugins de Filtres
 * Permet d'étendre les capacités de transformation des variables.
 */

export const filters = {
  // --- Filtres de base ---
  uppercase: (val) => String(val).toUpperCase(),
  lowercase: (val) => String(val).toLowerCase(),
  trim: (val) => String(val).trim(),
  json: (val) => JSON.stringify(val),
  urlencode: (val) => encodeURIComponent(String(val)),

  // --- Filtres de contenu ---
  // Affiche un texte si la valeur est vide
  default: (val, fallback) => (val === undefined || val === null || val === "" ? fallback : val),

  // Tronque la chaîne à une certaine longueur
  truncate: (val, len = 100) => {
    const s = String(val);
    return s.length > len ? s.substring(0, len) + "..." : s;
  },

  // Remplace des morceaux de texte
  replace: (val, search, replaceWith = "") =>
    String(val).replace(new RegExp(search, "g"), replaceWith),

  // --- Filtres HTML ---
  // Supprime les balises HTML
  strip_html: (val) => String(val).replace(/<[^>]*>?/gm, ""),

  // Échappe les caractères HTML de base
  escape: (val) =>
    String(val)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;"),

  // --- Filtres de Date (Basiques) ---
  // Retourne l'année actuelle si "now" ou formate une date
  date: (val, format = "YYYY") => {
    const d = val === "now" ? new Date() : new Date(val);
    if (isNaN(d.getTime())) return val;

    if (format === "YYYY") return d.getFullYear();
    if (format === "MM") return String(d.getMonth() + 1).padStart(2, "0");
    if (format === "DD") return String(d.getDate()).padStart(2, "0");
    return d.toLocaleDateString();
  },
};

/**
 * Applique une chaîne de filtres à une valeur
 * @param {any} value - La valeur initiale
 * @param {string[]} filterChain - Tableau de chaînes (ex: ["uppercase", "truncate(20)"])
 */
export function applyFilters(value, filterChain) {
  let result = value;

  for (const filterStr of filterChain) {
    // Extraction du nom du filtre et des arguments éventuels : filterName(arg1, arg2)
    const match = filterStr.match(/^([^(]+)(?:\((.*)\))?$/);
    if (!match) continue;

    const name = match[1].trim().toLowerCase();
    const argsStr = match[2];
    const args = argsStr
      ? argsStr.split(",").map((arg) => arg.trim().replace(/^["']|["']$/g, ""))
      : [];

    if (filters[name]) {
      try {
        result = filters[name](result, ...args);
      } catch (err) {
        console.error(`[OTE] Error applying filter "${name}":`, err.message);
      }
    }
  }

  return result;
}

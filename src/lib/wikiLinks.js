// Utilitaires pour l’auto-liage façon Ward Wiki (CamelCase)
// - CamelCase → lien Markdown vers slug normalisé
// - Ignore les blocs de code ```...``` et le code inline `...`

export function normalizeSlug(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function linkifyWardWiki(text) {
  if (!text || typeof text !== "string") return "";
  const parts = text.split(/(```[\s\S]*?```|`[^`]*`)/g);
  const processed = parts.map((part) => {
    if (/^```[\s\S]*```$/.test(part) || /^`[^`]*`$/.test(part)) {
      return part;
    }
    return part.replace(/(?<!!)\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g, (m, word) => {
      // Garder le CamelCase tel quel pour l'href
      return `[${word}](${word})`;
    });
  });
  return processed.join("");
}

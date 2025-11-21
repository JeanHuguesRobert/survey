// Configuration pour le module de recherche documentaire

export const DocumentSearchConfig = {
    // Gemini
    GEMINI_API_KEY: Deno.env.get("GOOGLE_FILESEARCH_API_KEY") || Deno.env.get("GEMINI_API_KEY"),

    // Supabase
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),

    // File Search
    // Liste des stores par défaut séparés par des virgules
    FILE_SEARCH_DEFAULT_STORES: (Deno.env.get("FILE_SEARCH_DEFAULT_STORES") || "").split(",").filter(s => s.trim().length > 0),

    // Context Caching (Alternative recommandée)
    GEMINI_CACHE_ID: Deno.env.get("GEMINI_CACHE_ID"),

    // Storage
    SUPABASE_STORAGE_BUCKET: Deno.env.get("SUPABASE_STORAGE_BUCKET") || "public-documents",

    // Cache
    FILE_SEARCH_CACHE_TABLE: Deno.env.get("FILE_SEARCH_CACHE_TABLE") || "file_search_cache",
    FILE_SEARCH_CACHE_TTL_DAYS: parseInt(Deno.env.get("FILE_SEARCH_CACHE_TTL_DAYS") || "7", 10),

    // Sources History
    DOCUMENT_SOURCES_TABLE: "document_sources",

    // Constraints
    MAX_SNIPPETS: 5,
    MAX_CONTEXT_CHARS: 4000,
};

/**
 * Valide que la configuration minimale est présente.
 * @throws {Error} Si une variable requise est manquante.
 */
export function validateConfig() {
    const required = [
        "GEMINI_API_KEY",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY"
    ];

    const missing = required.filter(key => !Deno.env.get(key));

    if (missing.length > 0) {
        throw new Error(`[DocumentSearch] Configuration manquante : ${missing.join(", ")}`);
    }
}

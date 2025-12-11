// ============================================================================
// SYSTEM PROMPT - Chargement dynamique
// ============================================================================

import { getConfigValue } from "../../../../common/config/instanceConfig.edge.js";

/**
 * Petit utilitaire pour prévisualiser les valeurs dans les logs
 */
function previewForLog(value, max = 400) {
  try {
    const s = typeof value === "string" ? value : JSON.stringify(value);
    return s.length > max ? s.slice(0, max) + "..." : s;
  } catch {
    return String(value).slice(0, max) + (String(value).length > max ? "..." : "");
  }
}

/**
 * Récupère le prompt système depuis l'URL publique
 */
async function fetchPublicSystemPrompt(siteUrl) {
  if (!siteUrl) return null;

  const promptFiles = ["bob-system.md", "OPHELIA_DB_CAPABILITIES.md"];
  const collected = [];

  for (const fileName of promptFiles) {
    const promptUrl = `${siteUrl}/prompts/${fileName}`;
    try {
      console.log(`[Prompt] ➜ fetching system prompt from ${promptUrl}`);
      const response = await fetch(promptUrl);
      console.log(`[Prompt] ⬅ ${fileName} status=${response.status}`);
      if (!response.ok) continue;

      const content = await response.text();
      console.log(`[Prompt] ⬅ ${fileName} length=${content.length}`);
      if (content.trim()) {
        collected.push(`<!-- ${fileName} -->\n${content.trim()}`);
      }
    } catch (error) {
      console.warn(`[SystemPrompt] Erreur fetch ${fileName}:`, error.message);
    }
  }

  if (collected.length === 0) return null;
  return collected.join("\n\n---\n\n");
}

/**
 * Récupère le contexte municipal consolidé
 */
async function fetchCouncilContext(siteUrl) {
  if (!siteUrl) return null;
  try {
    const councilUrl = `${siteUrl}/docs/conseils/conseil-consolidated.semantic.md`;
    console.log(`[Council] ➜ fetching consolidated council context from ${councilUrl}`);
    const response = await fetch(councilUrl);
    console.log(`[Council] ⬅ status=${response.status}`);
    if (response.ok) {
      const text = await response.text();
      console.log(`[Council] ⬅ content length=${text.length}`);
      if (text.trim()) return text;
    }
  } catch (error) {
    console.warn("[Council] ❌ Unable to fetch consolidated council context:", error.message);
  }
  return null;
}

/**
 * Charge et construit le system prompt complet
 *
 * @returns {Promise<string>} System prompt complet
 */
export async function getSystemPrompt() {
  const currentDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  let basePrompt = `📅 **Date actuelle :** ${currentDate}\\n\\n`;

  // 1. Charge le prompt depuis l'URL publique
  const siteUrl = getConfigValue("app_url");
  const localPrompt = await fetchPublicSystemPrompt(siteUrl);
  if (localPrompt) {
    basePrompt += localPrompt;
  } else {
    // 2. Fallback avec les variables d'environnement
    const envPrompt = getConfigValue("bob_system_prompt");
    if (envPrompt) {
      basePrompt += envPrompt;
    } else {
      // 3. Fallback par défaut
      const city = getConfigValue("city_name");
      const movement = getConfigValue("movement_name");
      const bot = getConfigValue("bot_name");
      basePrompt += `
      **Rôle :** Tu es **${bot}**, l'assistant citoyen du mouvement **${movement}** pour la commune de **${city}**.

      **Instructions :**
      - Réponds **uniquement en français**, de manière **factuelle, concise et structurée** (Markdown : titres, listes, liens).
      - Cite toujours tes **sources officielles** quand c'est possible.
      - Pour les questions locales (projets, horaires), utilise les outils disponibles (**web_search**, base de données locale).
      - Si tu ne connais pas la réponse, dis-le clairement et propose une alternative.
      - **Processus de Réflexion** : Pour les questions complexes, détaille ton raisonnement dans des balises \`<Think>...</Think>\` avant ta réponse.

      **Exemple de réponse :**
      > **Horaires de la mairie :**
      > - Lundi-vendredi : 8h30-17h
      > - Samedi : 9h-12h
      > *(Source : [site de la mairie](#))*`;
    }
  }

  // 4. Charge le wiki consolidé depuis Supabase
  /*
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl && supabaseKey) {
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/consolidated_wiki_documents?select=content&order=updated_at.desc&limit=1`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        console.log(
          `[SystemPrompt] Supabase data preview: ${previewForLog(data?.[0]?.content, 100)}`
        );
        if (data?.length > 0 && data[0].content) {
          basePrompt += `\n\n📚 **Contexte local (wiki) :**\n${data[0].content}...`;
        }
      }
    } catch (error) {
      console.error("[SystemPrompt] Erreur Supabase:", error.message);
    }
  }

  // 5. Charge le contexte municipal (si disponible)
  const councilContext = await fetchCouncilContext(siteUrl);
  if (councilContext) {
    basePrompt += `\n\n🏛 **Contexte municipal (conseils consolidés) :**\n${councilContext}...`;
  } else {
    basePrompt += `\n\n🏛 **Contexte municipal (conseils consolidés) :** indisponible pour le moment.`;
  }
  */
  console.log(`[SystemPrompt] ✅ Prompt chargé (${basePrompt.length} caractères)`);
  return basePrompt;
}

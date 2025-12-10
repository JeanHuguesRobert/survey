// ============================================================================
// TOOLS - Définition et exécution centralisée
// ============================================================================

import { getConfigValue } from "../../../common/config/instanceConfig.edge.js";
import { AgentExecutorService } from "../../../common/services/AgentExecutorService.js";

const agentExecutor = new AgentExecutorService();

/**
 * Définition des outils disponibles pour les LLM
 */
export const TOOLS = {
  web_search: {
    name: "web_search",
    description:
      "Recherche des informations actualisées sur Internet. Utilise cet outil pour des questions sur des actualités, horaires, ou données externes (ex: 'horaires mairie corte 2025').",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Requête de recherche courte et précise (3-8 mots).",
          minLength: 3,
          maxLength: 50,
        },
      },
      required: ["query"],
    },
  },
  sql_query: {
    name: "sql_query",
    description:
      "Exécute une requête SQL en lecture seule sur la base de données. Utilise cet outil pour récupérer des informations structurées de la base de données (ex: 'SELECT * FROM users LIMIT 5'). La requête doit être une instruction SELECT valide.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "La requête SQL en lecture seule à exécuter.",
        },
      },
      required: ["query"],
    },
  },
};

/**
 * Brave Search - Implémentation de l'outil web_search
 */
async function performWebSearch(query) {
  console.log(`[WebSearch] ➜ request query=${query.slice(0, 100)}`);
  const apiKey = getConfigValue("brave_search_api_key");
  if (!apiKey) {
    console.warn("[WebSearch] ⚠️ BRAVE_SEARCH_API_KEY manquant");
    return `Recherche web non configurée pour: "${query}". Réponds en t'excusant et en proposant une alternative si possible.`;
  }

  try {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.append("q", query);
    url.searchParams.append("count", "10");
    url.searchParams.append("search_lang", "fr");
    url.searchParams.append("country", "FR");

    console.log(`[WebSearch] 🌐 fetch url=${url.toString().slice(0, 100)}`);
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    console.log(`[WebSearch] ⬅ status=${response.status}`);
    if (!response.ok) throw new Error(`Brave API: ${response.status}`);

    const data = await response.json();
    let resultText = `🔍 Résultats pour "${query}":\n\n`;

    // Résultats web classiques
    if (data.web?.results?.length > 0) {
      data.web.results.slice(0, 10).forEach((result, i) => {
        resultText += `📄 ${i + 1}. **${result.title}**\n`;
        resultText += `${result.description?.substring(0, 300) || "Pas de description"}...\n`;
        resultText += `🔗 [Source](${result.url})\n\n`;
      });
    } else {
      resultText += "Aucun résultat web trouvé.\n\n";
    }

    // Résultats locaux
    if (data.locations?.results?.length > 0) {
      resultText += `📍 **Infos locales :**\n`;
      data.locations.results.slice(0, 10).forEach((loc) => {
        resultText += `- **${loc.title}**\n`;
        if (loc.address) resultText += `  📍 ${loc.address}\n`;
        if (loc.phone) resultText += `  📞 ${loc.phone}\n`;
        if (loc.hours) resultText += `  ⏰ ${loc.hours}\n`;
      });
    }

    console.log(`[WebSearch] ✅ ${data.web?.results?.length || 0} résultats formatés`);
    return resultText;
  } catch (error) {
    console.error("[WebSearch] ❌ Erreur:", error.message);
    return `⚠️ Erreur de recherche: ${error.message}. Je ne peux pas accéder à Internet pour le moment.`;
  }
}

/**
 * Handlers pour l'exécution des outils
 */
/**
 * Handlers pour l'exécution des outils
 */
const TOOL_HANDLERS = {
  web_search: performWebSearch,
  sql_query: performSqlQuery,
};

/**
 * SQL Query - Implémentation de l'outil sql_query
 */
async function performSqlQuery(args) {
  console.log(`[SqlQuery] ➜ request query=${args.query.slice(0, 400)}`);
  try {
    const result = await agentExecutor.executeReadOnly(args.query);
    console.log(`[SqlQuery] ✅ Query executed, ${result.length} rows returned.`);
    return JSON.stringify(result);
  } catch (error) {
    console.error("[SqlQuery] ❌ Erreur:", error.message);
    return `⚠️ Erreur d'exécution SQL: ${error.message}`;
  }
}

/**
 * Parse les arguments d'un tool call
 */
function parseToolArguments(raw) {
  if (!raw) return {};
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
}

/**
 * Exécute une liste de tool calls et retourne les résultats formatés
 *
 * @param {Array} toolCalls - Liste des tool calls à exécuter
 * @param {string} provider - Nom du provider (pour les logs)
 * @param {Object} fallbackContext - Contexte de fallback pour les arguments manquants
 * @returns {Promise<Array>} Messages de résultats des tools
 */
export async function executeToolCalls(toolCalls, provider = "mistral", fallbackContext = {}) {
  console.log(`[${provider}] 🔁 executeToolCalls called count=${toolCalls.length}`);
  const results = [];

  for (const call of toolCalls) {
    try {
      const toolName = call.function?.name || call.name;
      let args = parseToolArguments(call.function?.arguments || call.arguments);
      console.log(
        `[${provider}] ➜ Tool call: ${toolName} args=${JSON.stringify(args).slice(0, 400)}`
      );

      // Apply fallback logic for web_search: use question if query is missing
      if (toolName === "web_search") {
        if (!args || !args.query) {
          const fallbackQuery = fallbackContext?.web_search?.query || fallbackContext?.defaultQuery;
          if (fallbackQuery && typeof fallbackQuery === "string" && fallbackQuery.trim()) {
            args = { ...args, query: fallbackQuery };
            console.log(`[${provider}] ℹ️ web_search fallback -> query="${fallbackQuery}"`);
          }
        }
      }

      // Validate required parameters based on TOOLS definition
      const toolDef = Object.values(TOOLS).find((t) => t.name === toolName);
      if (toolDef) {
        const required = toolDef.parameters?.required || [];
        let hasAllRequired = true;
        for (const r of required) {
          if (
            !args ||
            args[r] === undefined ||
            args[r] === null ||
            (typeof args[r] === "string" && args[r].trim() === "")
          ) {
            hasAllRequired = false;
            break;
          }
        }
        if (!hasAllRequired) {
          console.warn(
            `[${provider}] ⚠️ Paramètres manquants pour ${toolName} (call id=${call.id}). Ignoré.`
          );
          continue;
        }
      }

      const handler = TOOL_HANDLERS[toolName];
      if (!handler) {
        console.warn(`[${provider}] Outil non géré: ${toolName}`);
        continue;
      }

      console.log(`[${provider}] 🛠 Exécution de ${toolName} avec:`, args);
      const output = await handler(args);
      console.log(
        `[${provider}] ⬅ Tool result for ${toolName} preview: ${String(output).slice(0, 400)}`
      );

      results.push({
        role: "tool",
        tool_call_id: call.id,
        name: toolName,
        content: output,
      });
    } catch (error) {
      console.error(`[${provider}] ❌ Erreur outil:`, error);
      results.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function?.name || call.name,
        content: `⚠️ Erreur: ${error.message}`,
      });
    }
  }

  return results;
}

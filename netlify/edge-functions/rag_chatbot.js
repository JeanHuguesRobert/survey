// ============================================================================
// CONFIGURATION - Modèles et paramètres par défaut
// ============================================================================
const PROVIDER_META_PREFIX = "__PROVIDER_INFO__";
import { providerMetrics } from "./lib/utils/provider-metrics.js";
const PROVIDERS_STATUS_PREFIX = "__PROVIDERS_STATUS__";

const MODEL_MODES = {
  mistral: {
    fast: "mistral-small-latest",
    strong: "mistral-large-latest",
    reasoning: "magistral-medium-latest",
  },

  anthropic: {
    main: "claude-sonnet-4-5-20250929",
    cheap: "claude-3-haiku-20240307",
  },

  openai: {
    main: "gpt-4.1",
    reasoning: "gpt-5.1",
    cheap: "gpt-5.1-nano",
  },

  google: {
    // Le modèle le plus intelligent (Gemini 3)
    main: "gemini-3-pro-preview",
    // Le modèle rapide et stable (Gemini 2.5 Flash)
    fast: "gemini-2.5-flash",
    // Modèle de raisonnement avancé (Thinking)
    reasoning: "gemini-2.0-flash-thinking-exp",
    // Pas cher
    cheap: "gemini-2.5-flash-lite",
  },

  huggingface: {
    // Chat généraliste (non limité au reasoning)
    main: "deepseek-ai/DeepSeek-V3",
    // Version plus légère (distill, toujours capable de reasoning mais moins coûteuse)
    small: "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
    // Gros modèle reasoning quand tu veux l’artillerie lourde
    reasoning: "deepseek-ai/DeepSeek-R1",
  },
};

const DEFAULT_MODEL_MODE = {
  mistral: "fast",
  anthropic: "main",
  openai: "reasoning", // Changé à reasoning pour gpt-5.1
  huggingface: "main",
  google: "main",
};

const MODEL_MODE_DIRECTIVE_REGEX = /model_mode\s*=\s*([^\s;]+)/i;
const resolveModelForProvider = (provider, overrideMode) => {
  const providerModes = MODEL_MODES[provider];
  if (!providerModes) {
    console.warn(`[resolveModel] No modes defined for provider: ${provider}`);
    return undefined;
  }

  console.log(`[resolveModel] Resolving for provider=${provider}, overrideMode=${overrideMode}`);
  console.log(`[resolveModel] Available modes:`, Object.keys(providerModes));
  console.log(`[resolveModel] Default mode:`, DEFAULT_MODEL_MODE[provider]);

  const candidateMode =
    overrideMode && providerModes[overrideMode]
      ? overrideMode
      : DEFAULT_MODEL_MODE[provider] || Object.keys(providerModes)[0];

  const resolved = providerModes[candidateMode];
  console.log(`[resolveModel] Resolved mode=${candidateMode} -> model=${resolved}`);
  return resolved;
};

// ============================================================================
// OUTILS (TOOLS) - Définition centralisée
// ============================================================================
const TOOLS = {
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
  // Ajoute d'autres outils ici (ex: search_local_db, weather, etc.)
};

// ============================================================================
// GESTIONNAIRES D'OUTILS - Fonctions d'exécution
// ============================================================================
const TOOL_HANDLERS = {
  async web_search({ query }) {
    return performWebSearch(query);
  },
  // Ajoute d'autres handlers ici
};

// UTIL: small preview helper for logs
function previewForLog(value, max = 400) {
  try {
    const s = typeof value === "string" ? value : JSON.stringify(value);
    return s.length > max ? s.slice(0, max) + "..." : s;
  } catch {
    return String(value).slice(0, max) + (String(value).length > max ? "..." : "");
  }
}

// ============================================================================
// BRAVE SEARCH - Outil de recherche web (amélioré)
// ============================================================================
async function performWebSearch(query) {
  console.log(`[WebSearch] ➜ request query=${previewForLog(query)}`);
  const apiKey = Deno.env.get("BRAVE_SEARCH_API_KEY");
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

    console.log(`[WebSearch] 🌐 fetch url=${previewForLog(url.toString())}`);
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    console.log(`[WebSearch] ⬅ status=${response.status}`);
    if (!response.ok) throw new Error(`Brave API: ${response.status}`);

    const data = await response.json();
    console.log(`[WebSearch] ⬅ data preview: ${previewForLog(data)}`);

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

// ============================================================================
// UTILITAIRES - Fonctions communes
// ============================================================================
const parseToolArguments = (raw) => {
  if (!raw) return {};
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
};

const isAsyncIterable = (value) =>
  Boolean(value && typeof value[Symbol.asyncIterator] === "function");

// Update executeToolCalls to accept a fallbackContext for missing arguments
async function executeToolCalls(toolCalls, provider = "mistral", fallbackContext = {}) {
  console.log(`[${provider}] 🔁 executeToolCalls called count=${toolCalls.length}`);
  const results = [];
  for (const call of toolCalls) {
    try {
      const toolName = call.function?.name || call.name;
      let args = parseToolArguments(call.function?.arguments || call.arguments);
      console.log(`[${provider}] ➜ Tool call: ${toolName} args=${previewForLog(args, 400)}`);

      // Apply fallback logic for web_search: use question if query is missing
      if (toolName === "web_search") {
        if (!args || !args.query) {
          // fallbackContext may contain a default query string
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
        `[${provider}] ⬅ Tool result for ${toolName} preview: ${previewForLog(output, 400)}`
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

// ============================================================================
// APPels API - Gestion unifiée des LLM (Mistral, Anthropic, OpenAI)
// ============================================================================
const PROVIDER_CONFIGS = {
  mistral: {
    apiUrl: "https://api.mistral.ai/v1/chat/completions",
    defaultModel: "mistral-large-latest",
    toolFormat: "openai", // Mistral utilise le même format qu'OpenAI
  },
  anthropic: {
    apiUrl: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-3-opus-20240229",
    toolFormat: "anthropic", // Format spécifique
  },
  openai: {
    apiUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    toolFormat: "openai", // ✅ Identique à Mistral (SSE)
  },
  huggingface: {
    apiUrl: (model) => `https://router.huggingface.co/v1/chat/completions`,
    defaultModel: "mistralai/Mixtral-8x22B-Instruct-v0.1",
    toolFormat: null, // Pas de support des outils
  },
  google: {
    // Utilisation de l'endpoint de compatibilité OpenAI de Google
    apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    defaultModel: "gemini-2.5-flash",
    toolFormat: "openai", // Gemini via cet endpoint supporte le format OpenAI
  },
};

function formatToolsForProvider(tools, provider) {
  const config = PROVIDER_CONFIGS[provider];
  if (config.toolFormat === "anthropic") {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  } else if (config.toolFormat === "openai") {
    return tools.map((tool) => ({
      type: "function",
      function: tool,
    }));
  } else {
    return []; // Pas de support des outils
  }
}

async function callLLMAPI({
  provider,
  model,
  messages,
  tools = [],
  toolChoice = "auto",
  stream = true,
}) {
  const config = PROVIDER_CONFIGS[provider];
  // GESTION SPÉCIFIQUE POUR LA CLÉ API GEMINI
  let apiKey;
  if (provider === "google") {
    apiKey = Deno.env.get("GEMINI_API_KEY");
  } else {
    apiKey = Deno.env.get(`${provider.toUpperCase()}_API_KEY`);
  }
  if (!apiKey) throw new Error(`Clé API manquante pour ${provider}`);

  const formattedTools = formatToolsForProvider(Object.values(TOOLS), provider);
  const payload = {
    model: model || config.defaultModel,
    messages,
    ...(formattedTools.length ? { tools: formattedTools } : {}),
    ...(toolChoice !== "none" ? { tool_choice: toolChoice } : {}),
    stream: stream && provider !== "huggingface",
    temperature: 0.3,
    top_p: 0.95,
  };

  // Add extended thinking for Anthropic (Claude)
  if (provider === "anthropic") {
    payload.thinking = {
      type: "enabled",
      budget_tokens: 2000, // Adjust based on your needs
    };
  }

  // Debug: request payload summary
  console.log(
    `[LLM] ➜ ${provider} request: model=${payload.model}, messages=${payload.messages?.length || 0}, tools=${formattedTools.length}, stream=${payload.stream}`
  );
  console.log(
    `[LLM] ➜ ${provider} payload preview: ${previewForLog({ model: payload.model, firstMessage: payload.messages?.[0]?.content || "", toolCount: formattedTools.length }, 100)}`
  );

  const apiUrl = typeof config.apiUrl === "function" ? config.apiUrl(model) : config.apiUrl;

  // Headers spécifiques par provider
  let headers = {
    "Content-Type": "application/json",
  };
  if (provider === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  console.log(`[LLM] ⬅ ${provider} response status=${response.status} stream=${stream}`);

  if (!response.ok) {
    const body = await response.text();
    console.error(`[LLM] ❌ ${provider} error body preview: ${previewForLog(body)}`);
    throw new Error(`${provider} API ${response.status}: ${body}`);
  }

  if (!stream || provider === "huggingface") {
    const data = await response.json();
    console.log(`[LLM] ⬅ ${provider} non-stream preview: ${previewForLog(data, 1000)}`);
    return handleDirectResponse(data, provider);
  } else {
    console.log(`[LLM] ⬅ ${provider} streaming start`);
    return handleStreamingResponse(response, provider);
  }
}

// Update handleStreamingResponse to yield event objects instead of raw strings
async function* handleStreamingResponse(response, provider) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let toolCalls = [];
  let fullContent = "";

  // Buffering for tool call fragments: id -> { name, argsStr }
  const pendingToolArgs = new Map();
  const pushedToolIds = new Set();
  const context = { pendingToolArgs, pushedToolIds, toolCalls, toolFragmentCounter: 0 };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const payload = trimmed.startsWith("data:")
        ? trimmed.slice(trimmed.indexOf(":") + 1).trim()
        : trimmed;
      if (!payload || payload === "[DONE]") continue;

      try {
        // Small preview to help debugging
        const preview = payload.length > 300 ? payload.slice(0, 300) + "..." : payload;
        const data = JSON.parse(payload);
        const delta = provider === "anthropic" ? data.delta : data.choices?.[0]?.delta;
        const hasToolDelta =
          Boolean(delta?.tool_calls?.length) ||
          Boolean(delta?.tool_call) ||
          Boolean(delta?.tool_use?.length);
        const onlyContentDelta =
          Boolean(delta?.content) && !hasToolDelta && !delta?.tool_use?.length;
        const shouldLogPayload = !onlyContentDelta;

        if (shouldLogPayload) {
          console.log(`[${provider}] [SSE] incoming payload preview: ${preview}`);
          console.log(`[${provider}] [SSE] parsed keys: ${Object.keys(data).join(",")}`);
          if (delta) {
            console.log(`[${provider}] [SSE] delta keys: ${Object.keys(delta).join(",")}`);
          }
        }

        if (provider === "anthropic") {
          // Handle thinking blocks (extended thinking feature)
          if (delta?.type === "thinking" && delta?.thinking) {
            // Wrap thinking in <Think> tags for frontend
            const thinkingText = `<Think>${delta.thinking}</Think>`;
            fullContent += thinkingText;
            yield thinkingText;
          }

          // Handle regular text content
          if (delta?.text) {
            fullContent += delta.text;
            yield delta.text;
          }

          // Handle tool calls
          const calls = delta?.tool_use ? delta.tool_use.map(normalizeToolCall) : [];
          if (calls.length) toolCalls.push(...calls);
        } else {
          if (delta?.content) {
            fullContent += delta.content;
            yield delta.content;
          }
          const rawToolCalls = delta?.tool_calls || (delta?.tool_call ? [delta.tool_call] : []);
          if (rawToolCalls.length) {
            for (const raw of rawToolCalls) {
              processToolCallFragment(context, raw, provider);
            }
            while (context.toolCalls.length > 0) {
              const call = context.toolCalls.shift();
              toolCalls.push(call);
              yield { type: "tool_call", call };
            }
          }
        }
      } catch (err) {
        console.error(`[${provider}] [SSE] Erreur parsing payload: ${err.message}`, {
          payloadPreview: payload.slice(0, 200),
        });
      }
    }
  }

  return {
    content: fullContent,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

function handleDirectResponse(data, provider) {
  if (provider === "anthropic") {
    let content = "";

    // Check for thinking blocks
    if (data.thinking && Array.isArray(data.thinking)) {
      const thinkingContent = data.thinking.map((t) => t.content || t.text || "").join("\n");
      if (thinkingContent) {
        content += `<Think>${thinkingContent}</Think>\n\n`;
      }
    }

    // Add regular content
    content += data.content[0].text;

    return {
      content,
      toolCalls: data.tool_uses || [],
    };
  }
}

// Replace previous normalizeToolCall definition:
const normalizeToolCall = (call, idx = 0) => {
  // Accept multiple possible shapes and extract function-like properties
  const fnShape = call.function || call.tool || call.action || call.intent || call.metadata || {};
  let name =
    fnShape.name ||
    call.name ||
    call.tool?.name ||
    call.action?.name ||
    call.intent?.name ||
    call.metadata?.name ||
    "";
  let args = fnShape.arguments ?? call.arguments ?? call.params ?? call.payload ?? "{}";

  if (args == null) args = "{}";
  if (typeof args !== "string") {
    try {
      args = JSON.stringify(args);
    } catch {
      args = String(args);
    }
  }

  // Heuristic inference for missing function name
  if (!name || !name.trim()) {
    try {
      const parsedArgs = JSON.parse(args || "{}");
      if (parsedArgs && typeof parsedArgs === "object") {
        if (parsedArgs.query) {
          name = "web_search";
        }
        // Add additional heuristics here as needed
      }
    } catch {
      // ignore
    }
  }

  name = (name || "").trim();

  return {
    id: call.id || `tool-${Date.now()}-${idx}`,
    type: "function",
    function: {
      name,
      arguments: args,
    },
  };
};
const normalizeToolCalls = (calls = []) => calls.map(normalizeToolCall);

// New helper: assemble tool call fragments and push complete calls to toolCalls
function processToolCallFragment(context, raw, provider) {
  const { pendingToolArgs, pushedToolIds, toolCalls } = context;
  context.toolFragmentCounter = context.toolFragmentCounter || 0;

  const id =
    raw.id ||
    raw.tool_call_id ||
    raw.tool_call?.id ||
    `tool-${Date.now()}-${context.toolFragmentCounter++}`;

  const fn = raw.function || raw.tool || raw.tool_call || raw;
  let name = fn?.name || "";
  let argsFragment = fn?.arguments ?? fn?.args ?? fn?.arguments_text ?? "";

  if (argsFragment === undefined || argsFragment === null) {
    argsFragment = "";
  } else if (typeof argsFragment !== "string") {
    try {
      argsFragment = JSON.stringify(argsFragment);
    } catch {
      argsFragment = String(argsFragment);
    }
  }

  const existing = pendingToolArgs.get(id) || { name: "", argsStr: "" };
  const combinedName = existing.name || name;
  const combinedArgsStr = existing.argsStr + argsFragment;

  pendingToolArgs.set(id, { name: combinedName, argsStr: combinedArgsStr });

  // Try to parse the combined string as JSON only if it looks like JSON
  let parsedArgs;
  try {
    const trimmedArgs = combinedArgsStr.trim();
    if (trimmedArgs.startsWith("{") || trimmedArgs.startsWith("[")) {
      parsedArgs = JSON.parse(trimmedArgs);
    }
  } catch {
    parsedArgs = null; // Not complete / invalid JSON yet
  }

  // If parsed and not already pushed
  if (parsedArgs !== undefined && parsedArgs !== null && !pushedToolIds.has(id)) {
    // Infer a name if missing
    let finalName = combinedName || "";
    if (!finalName && parsedArgs && typeof parsedArgs === "object") {
      if (parsedArgs.query) finalName = "web_search";
      // Add more heuristics here if needed
    }

    if (finalName && TOOL_HANDLERS[finalName]) {
      const fullCall = {
        id,
        type: "function",
        function: {
          name: finalName,
          arguments: JSON.stringify(parsedArgs),
        },
      };
      toolCalls.push(fullCall);
      pushedToolIds.add(id);
      pendingToolArgs.delete(id);
    } else {
      // Mark as pushed/handled so we don't loop forever on fragments
      pushedToolIds.add(id);
      pendingToolArgs.delete(id);
      console.warn(
        `[${provider}] Outil ignoré après assemblage : ${finalName || "(no-name)"} (id=${id})`
      );
    }
  }
}

// ============================================================================
// ANALYSE DES DIRECTIVES - Extraction des directives utilisateur
// ============================================================================

const MODEL_DIRECTIVE_REGEX = /model\s*=\s*([^\s;]+)/i;
const PROVIDER_DIRECTIVE_REGEX = /provider\s*=\s*(anthropic|openai|huggingface|mistral|google)/i;
const MODE_DIRECTIVE_REGEX = /mode\s*=\s*(debug)/i;

const MODEL_PROVIDER_PATTERNS = {
  anthropic: ["claude", "anthropic"],
  openai: ["gpt-", "gpt", "openai", "oai"],
  mistral: ["mistral"],
  huggingface: ["huggingface", "hf"],
  google: ["gemini", "google", "goog"],
};
const PROVIDERS = ["openai", "mistral", "huggingface", "anthropic", "google"];

const parseDirectives = (rawQuestion = "") => {
  const trimmed = String(rawQuestion).trim();
  const semicolonIndex = trimmed.indexOf(";");
  const directiveSource = semicolonIndex >= 0 ? trimmed.slice(0, semicolonIndex).trim() : trimmed;
  let userQuestion = semicolonIndex >= 0 ? trimmed.slice(semicolonIndex + 1).trim() : trimmed;

  if (semicolonIndex < 0) {
    userQuestion = userQuestion
      .replace(MODE_DIRECTIVE_REGEX, "")
      .replace(MODEL_DIRECTIVE_REGEX, "")
      .replace(PROVIDER_DIRECTIVE_REGEX, "")
      .replace(MODEL_MODE_DIRECTIVE_REGEX, "")
      .trim();
  }

  const modelModeMatch = directiveSource.match(MODEL_MODE_DIRECTIVE_REGEX);
  const providerMatch = directiveSource.match(PROVIDER_DIRECTIVE_REGEX);
  const modelMatch = directiveSource.match(MODEL_DIRECTIVE_REGEX);

  return {
    rawDirective: directiveSource,
    userQuestion,
    hasDirectiveBlock: semicolonIndex >= 0,
    directiveModelMode: modelModeMatch ? modelModeMatch[1].toLowerCase() : null,
    directiveProvider: providerMatch ? providerMatch[1].toLowerCase() : null,
    directiveModel: modelMatch ? modelMatch[1].toLowerCase() : null,
  };
};

const detectModelProvider = (model) => {
  if (!model) return null;
  const target = model.toLowerCase();
  return PROVIDERS.find((provider) =>
    MODEL_PROVIDER_PATTERNS[provider]?.some((pattern) => target.includes(pattern))
  );
};

const PROVIDER_ENV_CHECKERS = {
  anthropic: () => Boolean(Deno.env.get("ANTHROPIC_API_KEY")),
  openai: () => Boolean(Deno.env.get("OPENAI_API_KEY")),
  mistral: () => Boolean(Deno.env.get("MISTRAL_API_KEY")),
  huggingface: () => Boolean(Deno.env.get("HUGGINGFACE_API_KEY")),
  google: () => Boolean(Deno.env.get("GEMINI_API_KEY")),
};
const isProviderAvailable = (provider) => Boolean(PROVIDER_ENV_CHECKERS[provider]?.());

const isMistralCapacityError = (error) => {
  const msg = error?.message || "";
  return /service_tier_capacity_exceeded|capacity|3505|429/i.test(msg);
};

const SHOULD_RANDOMIZE_PROVIDERS = Deno.env.get("DISABLE_PROVIDER_RANDOMIZATION") !== "1";
const shuffleProviders = (providers) => {
  const arr = [...providers];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const buildProviderOrder = (modelProvider, failedProviders = new Set()) => {
  const order = [...PROVIDERS];
  if (modelProvider && order.includes(modelProvider)) {
    return [modelProvider, ...order.filter((p) => p !== modelProvider)];
  }
  // Prioriser OpenAI si non échoué
  if (!failedProviders.has("openai") && order.includes("openai")) {
    return ["openai", ...order.filter((p) => p !== "openai")];
  }
  return order; // Si OpenAI échoué, garder l'ordre par défaut (sera mélangé si SHOULD_RANDOMIZE)
};

const parseRetryAfter = (errorMessage) => {
  const match = errorMessage.match(/Please try again in (\d+(?:\.\d+)?)s/);
  return match ? parseFloat(match[1]) * 1000 : 5000; // default 5s if not found
};

const isRateLimitError = (error) => {
  const msg = error?.message || "";
  return /rate.?limit|429/i.test(msg) && /tokens?|requests?/i.test(msg);
};

function createDebugLogger() {
  const pendingLogs = [];
  let controllerRef = null;
  let encoderRef = null;
  let enabled = false;
  const originals = {};

  const formatArgs = (args) =>
    args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ");

  const safeEnqueue = (line) => {
    if (!controllerRef || !encoderRef) {
      pendingLogs.push(line);
      return;
    }
    try {
      controllerRef.enqueue(encoderRef.encode(`\n\n${line}\n\n`));
    } catch (err) {
      // Controller may be closed; fallback to pending logs and detach controller
      pendingLogs.push(line);
      controllerRef = null;
      encoderRef = null;
    }
  };

  const emit = (level, args) => {
    const line = `[DEBUG] ${level.toUpperCase()}: ${formatArgs(args)}`;
    safeEnqueue(line);
  };

  const wrap =
    (level) =>
    (...args) => {
      originals[level](...args);
      emit(level, args);
    };

  return {
    enable() {
      if (enabled) return;
      enabled = true;
      originals.log = console.log;
      originals.warn = console.warn;
      originals.error = console.error;
      console.log = wrap("log");
      console.warn = wrap("warn");
      console.error = wrap("error");
    },
    attachStream(controller, encoder) {
      if (!enabled) return;
      controllerRef = controller;
      encoderRef = encoder;
      if (pendingLogs.length > 0) {
        // try to flush, keep safe if controller throws
        const logsToFlush = pendingLogs.splice(0);
        for (const line of logsToFlush) {
          try {
            controller.enqueue(encoder.encode(`\n\n${line}\n\n`));
          } catch (err) {
            // If fails, put the remaining lines back to pending logs
            pendingLogs.unshift(line);
            controllerRef = null;
            encoderRef = null;
            break;
          }
        }
      }
    },
    disable() {
      if (!enabled) return;
      console.log = originals.log;
      console.warn = originals.warn;
      console.error = originals.error;
      enabled = false;
      controllerRef = null;
      encoderRef = null;
    },
  };
}

// ============================================================================
// SYSTEM PROMPT - Chargement dynamique
// ============================================================================
async function fetchPublicSystemPrompt(siteUrl) {
  if (!siteUrl) return null;
  try {
    const promptUrl = `${siteUrl}/prompts/bob-system.md`;
    console.log(`[Prompt] ➜ fetching system prompt from ${promptUrl}`);
    const response = await fetch(promptUrl);
    console.log(`[Prompt] ⬅ status=${response.status}`);
    if (response.ok) {
      const content = await response.text();
      console.log(`[Prompt] ⬅ content length=${content.length}`);
      if (content.trim()) return content;
    }
  } catch (error) {
    console.warn("[SystemPrompt] Erreur fetch:", error.message);
  }
  return null;
}

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

async function getSystemPrompt() {
  const currentDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  let basePrompt = `📅 **Date actuelle :** ${currentDate}\n\n`;

  // 1. Charge le prompt depuis l'URL publique
  const siteUrl = Deno.env.get("URL") || Deno.env.get("DEPLOY_PRIME_URL");
  const localPrompt = await fetchPublicSystemPrompt(siteUrl);
  if (localPrompt) {
    basePrompt += localPrompt;
  } else {
    // 2. Fallback avec les variables d'environnement
    const envPrompt = Deno.env.get("BOB_SYSTEM_PROMPT");
    if (envPrompt) {
      basePrompt += envPrompt;
    } else {
      // 3. Fallback par défaut
      const city = Deno.env.get("CITY_NAME") || "Corte";
      const movement = Deno.env.get("MOVEMENT_NAME") || "Pertitellu";
      const bot = Deno.env.get("BOT_NAME") || "Ophélia";
      basePrompt += `
      **Rôle :** Tu es **${bot}**, l'assistant citoyen du mouvement **${movement}** pour la commune de **${city}**.

      **Instructions :**
      - Réponds **uniquement en français**, de manière **factuelle, concise et structurée** (Markdown : titres, listes, liens).
      - Cite toujours tes **sources officielles** quand c'est possible.
      - Pour les questions locales (projets, horaires), utilise les outils disponibles (**web_search**, base de données locale).
      - Si tu ne connais pas la réponse, dis-le clairement et propose une alternative.

      **Exemple de réponse :**
      > **Horaires de la mairie :**
      > - Lundi-vendredi : 8h30-17h
      > - Samedi : 9h-12h
      > *(Source : [site de la mairie](#))*`;
    }
  }

  // 4. Charge le wiki consolidé depuis Supabase
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
  console.log(`[SystemPrompt] ✅ Prompt chargé (${basePrompt.length} caractères)`);
  return basePrompt;
}

// ============================================================================
// HANDLER - Fonction principale de gestion des requêtes
// ============================================================================

const handler = async (request) => {
  // Quick healthcheck support (frontend calls GET /api/chat-stream?healthcheck=true)
  try {
    const url = new URL(request.url);
    if (request.method === "GET" && url.searchParams.get("healthcheck") === "true") {
      const providersList = (PROVIDERS || []).map((p) => {
        const configured = isProviderAvailable(p);
        const model = resolveModelForProvider(p);
        return {
          name: p,
          status: configured ? "available" : "not_configured",
          models: [
            {
              name: model || null,
              avgResponseTime: null,
              successRate: null,
              recentlyUsed: false,
              retryAfter: null,
              consecutiveErrors: 0,
            },
          ],
        };
      });
      return new Response(JSON.stringify({ providers: providersList }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    // continue to normal handler on malformed URL
  }

  // 1. Vérifie la méthode HTTP
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée." }), { status: 405 });
  }

  // 2. Parse le corps de la requête
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Charge utile invalide", { status: 400 });
  }

  // Support POST-based healthcheck bodies: { healthcheck: true } or question === 'healthcheck'
  try {
    if (
      body &&
      (body.healthcheck === true || String(body.question || "").toLowerCase() === "healthcheck")
    ) {
      const providersList = (PROVIDERS || []).map((p) => {
        const configured = isProviderAvailable(p);
        const model = resolveModelForProvider(p);
        return {
          name: p,
          status: configured ? "available" : "not_configured",
          models: [
            {
              name: model || null,
              avgResponseTime: null,
              successRate: null,
              recentlyUsed: false,
              retryAfter: null,
              consecutiveErrors: 0,
            },
          ],
        };
      });
      return new Response(JSON.stringify({ providers: providersList }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    // ignore and continue
  }

  // 3. Valide la question
  const rawQuestion = String(body?.question || "").trim();
  if (!rawQuestion) {
    return new Response("Question manquante", { status: 400 });
  }

  // 4. Récupère l'historique de conversation
  const conversation_history = Array.isArray(body?.conversation_history)
    ? body.conversation_history
    : [];

  // 5. Parse les directives (modèle, fournisseur, debug)
  const {
    rawDirective,
    userQuestion,
    hasDirectiveBlock,
    directiveModelMode,
    directiveProvider,
    directiveModel,
  } = parseDirectives(rawQuestion);

  const bodyModelMode =
    typeof body?.modelMode === "string" ? body.modelMode.trim().toLowerCase() : null;
  const effectiveModelMode = directiveModelMode || bodyModelMode;
  const debugMode = Boolean(rawDirective && MODE_DIRECTIVE_REGEX.test(rawDirective));

  // 6. Détermine le fournisseur et le modèle
  let forcedProvider = directiveProvider; // Ex: "provider=anthropic"
  let modelProvider = directiveModel ? detectModelProvider(directiveModel) : null;

  // 7. Vérifie la disponibilité des clés API
  if (forcedProvider && !isProviderAvailable(forcedProvider)) {
    return new Response(
      JSON.stringify({
        error: `Le fournisseur "${forcedProvider}" est demandé mais non configuré.`,
      }),
      { status: 400 }
    );
  }

  if (modelProvider && !isProviderAvailable(modelProvider)) {
    return new Response(
      JSON.stringify({
        error: `Le modèle "${directiveModel}" requiert "${modelProvider}", mais sa clé API est absente.`,
      }),
      { status: 400 }
    );
  }

  // 8. Détermine l'ordre des fournisseurs
  const enforcedProvider = forcedProvider || modelProvider;
  const failedProviders = new Set(); // Suivi des échecs pendant la conversation
  let providerOrder = buildProviderOrder(enforcedProvider, failedProviders);
  if (!enforcedProvider && SHOULD_RANDOMIZE_PROVIDERS) {
    providerOrder = shuffleProviders(providerOrder);
  }
  console.log(
    `[EdgeFunction] 🔧 Fournisseur: ${enforcedProvider || "auto"} (ordre=${providerOrder.join(",")})`
  );

  // 9. Active les logs de debug
  const debugLogger = debugMode ? createDebugLogger() : null;
  debugLogger?.enable();

  // 10. Logs initiaux
  console.log(`[EdgeFunction] ========================================`);
  console.log(`[EdgeFunction] 🎯 Question: "${rawQuestion}"`);
  console.log(`[EdgeFunction] 📚 Historique: ${conversation_history.length} messages`);
  console.log(`[EdgeFunction] 🔧 Fournisseur: ${enforcedProvider || "auto"}`);
  console.log(`[EdgeFunction] ⏱️ Début: ${new Date().toISOString()}`);

  // 11. Charge le prompt système
  const systemPrompt = await getSystemPrompt();
  console.log(`[EdgeFunction] 📏 System prompt: ${systemPrompt.length} caractères`);

  // 12. Crée un ReadableStream pour la réponse
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      debugLogger?.attachStream(controller, encoder);
      const emitProviderMeta = (meta) =>
        controller.enqueue(encoder.encode(`${PROVIDER_META_PREFIX}${JSON.stringify(meta)}\n`));

      // Préfixes pour les logs
      const logPrefix = "📜 [LOG] ";
      const errorPrefix = "❌ [ERREUR] ";
      const chunkPrefix = "";

      let handled = false;
      let lastError = null;

      // 13. Essaie chaque fournisseur dans l'ordre
      for (let providerIndex = 0; providerIndex < providerOrder.length; providerIndex++) {
        const provider = providerOrder[providerIndex];
        let providerRetries = 0;
        const maxProviderRetries = 2;

        while (providerRetries <= maxProviderRetries) {
          try {
            // GESTION SPÉCIFIQUE POUR LA CLÉ API GEMINI
            let apiKey;
            if (provider === "google") {
              apiKey = Deno.env.get("GEMINI_API_KEY");
            } else {
              apiKey = Deno.env.get(`${provider.toUpperCase()}_API_KEY`);
            }
            if (!apiKey) {
              console.log(`[EdgeFunction] ⏭️ Skipping ${provider} (no API key)`);
              // Mark provider as failed/unavailable so we don't retry indefinitely
              try {
                failedProviders.add(provider);
              } catch (_) {}
              // break the retry loop to move to the next provider
              break;
            }
            const resolvedModel = resolveModelForProvider(provider, effectiveModelMode);
            console.log(
              `[EdgeFunction] 🔍 Model resolution: provider=${provider}, mode=${effectiveModelMode}, resolved=${resolvedModel}`
            );
            console.log(
              `[EdgeFunction] 🔍 Available modes for ${provider}:`,
              MODEL_MODES[provider]
            );
            emitProviderMeta({ provider, model: resolvedModel });
            console.log(`[EdgeFunction] 🚀 Tentative avec ${provider} (model=${resolvedModel})...`);
            if (provider === "huggingface") {
              // HuggingFace a une API différente (non-streaming)
              const result = await runHuggingFaceAgent(
                userQuestion,
                systemPrompt,
                effectiveModelMode
              );
              controller.enqueue(encoder.encode(chunkPrefix + result));
            } else {
              // Mistral, OpenAI, Anthropic utilisent tous runConversationalAgent
              for await (const chunk of runConversationalAgent({
                provider,
                question: userQuestion,
                systemPrompt,
                conversationHistory: conversation_history,
                maxToolCalls: 2,
                modelMode: effectiveModelMode,
              })) {
                controller.enqueue(encoder.encode(chunkPrefix + chunk));
              }
            }
            handled = true;
            break;
          } catch (error) {
            const isForcedProvider = forcedProvider === provider;
            const capacityError = provider === "mistral" && isMistralCapacityError(error);
            const rateLimitError = provider === "openai" && isRateLimitError(error);

            if (capacityError && !isForcedProvider) {
              const fallbackMessage = `${errorPrefix}${provider} indisponible (crédit/limite atteinte). Tentative avec un autre fournisseur...\n\n`;
              console.warn(
                `[EdgeFunction] ⚠️ ${provider} capacité atteinte, passage au fournisseur suivant.`
              );
              controller.enqueue(encoder.encode(fallbackMessage));
              failedProviders.add(provider);
              break; // Passe immédiatement au provider suivant
            } else if (rateLimitError && providerRetries < maxProviderRetries) {
              const delayMs = parseRetryAfter(error.message);
              console.warn(
                `[EdgeFunction] ⏳ ${provider} rate limit, retrying in ${delayMs}ms (attempt ${providerRetries + 1}/${maxProviderRetries + 1})`
              );
              await new Promise((resolve) => setTimeout(resolve, delayMs));
              providerRetries++;
              continue; // retry same provider
            } else {
              const errorDetail = error.message || String(error);
              const errorMessage = `⚠️ **${provider.toUpperCase()} FAILED**: ${errorDetail}\n\n`;
              console.error(`[EdgeFunction] ❌ ${provider} error:`, errorDetail);

              // Emit error as a visible message
              controller.enqueue(encoder.encode(errorMessage));

              // If this is a forced provider, don't fallback
              if (isForcedProvider) {
                console.error(
                  `[EdgeFunction] 🛑 Forced provider ${provider} failed, not falling back`
                );
                controller.enqueue(
                  encoder.encode(
                    `\n\n**Error**: You requested ${provider} specifically, but it failed. Please try a different provider or check your configuration.\n\n`
                  )
                );
                handled = true;
                break;
              }

              controller.enqueue(encoder.encode(`Trying next provider...\n\n`));
              failedProviders.add(provider);
              break; // move to next provider
            }
          }
        }
        if (handled) break;
      }

      // 14. Gestion des erreurs
      if (!handled) {
        const message = lastError?.message || "Aucun fournisseur disponible.";
        controller.enqueue(encoder.encode(`${errorPrefix}${message}\n\n`));
      }
      // Emit final providers status (frontend reads metrics from this stream end)
      try {
        const providersList = (PROVIDERS || []).map((provider) => {
          const configured = isProviderAvailable(provider);
          // Get all model keys for this provider
          const modelModes = MODEL_MODES[provider] || {};
          const modelNames = Object.values(modelModes);
          const models = modelNames.map((modelName) => {
            const metricEntry = providerMetrics.get(provider, modelName);
            const m = metricEntry?.metrics || {};
            const successRate =
              m.requestCount && m.requestCount > 0
                ? Math.round((m.successCount / m.requestCount) * 100)
                : null;
            let retryAfter = null;
            if (
              metricEntry?.status === "rate_limited" &&
              metricEntry.metrics.lastError?.retryAfter
            ) {
              const retryTime =
                metricEntry.metrics.lastError.timestamp +
                metricEntry.metrics.lastError.retryAfter * 1000;
              const secondsUntilRetry = Math.max(0, Math.ceil((retryTime - Date.now()) / 1000));
              if (secondsUntilRetry > 0) retryAfter = secondsUntilRetry;
            }
            return {
              name: modelName,
              avgResponseTime: m.avgResponseTime ?? null,
              successRate: successRate,
              recentlyUsed: Boolean(m.lastUsed && Date.now() - m.lastUsed < 30000),
              retryAfter: retryAfter,
              consecutiveErrors: m.consecutiveErrors || 0,
              status: metricEntry?.status || (configured ? "available" : "not_configured"),
            };
          });
          return {
            name: provider,
            status: configured ? "available" : "not_configured",
            models,
          };
        });
        controller.enqueue(
          encoder.encode(
            `${PROVIDERS_STATUS_PREFIX}${JSON.stringify({ providers: providersList })}\n`
          )
        );
      } catch (err) {
        console.warn("[EdgeFunction] ⚠️ Failed to emit providers status:", err?.message || err);
      }
      controller.close();
    },

    cancel() {
      debugLogger?.disable();
    },
  });

  // 15. Retourne la réponse streamée
  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
};

// Add runConversationalAgent (hoisted so handler can call it)
async function* runConversationalAgent({
  provider = "mistral",
  question,
  systemPrompt,
  conversationHistory = [],
  maxToolCalls = 2,
  modelMode,
}) {
  let toolCallCount = 0;
  const idleTimeoutMs = Number(Deno.env.get("LLM_STREAM_TIMEOUT_MS")) || 30000;

  let messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: question },
  ];

  console.log(`[${provider}] ✅ runConversationalAgent initialized (maxToolCalls=${maxToolCalls})`);

  while (toolCallCount < maxToolCalls) {
    console.log(
      `[${provider}] 🔁 Appel LLM (model=${resolveModelForProvider(provider, modelMode)}) - messages:${messages.length}`
    );
    const streamOrDirect = await callLLMAPI({
      provider,
      model: resolveModelForProvider(provider, modelMode),
      messages,
      tools: Object.values(TOOLS),
      toolChoice: "auto",
      stream: true,
    });

    // Direct (non-stream) response
    if (!isAsyncIterable(streamOrDirect)) {
      console.log(`[${provider}] ℹ️ Direct LLM response received`);
      const data = streamOrDirect || {};
      if (data.toolCalls && data.toolCalls.length > 0) {
        const normalized = normalizeToolCalls(data.toolCalls);
        const valid = normalized.filter((c) => c.function?.name && TOOL_HANDLERS[c.function.name]);
        if (valid.length > 0) {
          toolCallCount++;
          console.log(
            `[${provider}] 🛠 Executing ${valid.length} tool(s) (direct):`,
            valid.map((c) => c.function.name)
          );
          const toolMessages = await executeToolCalls(valid, provider, {
            web_search: { query: question },
            defaultQuery: question,
          });
          messages = [
            ...messages,
            {
              role: "assistant",
              content: data.content || null,
              ...(provider === "anthropic" ? { tool_uses: valid } : { tool_calls: valid }),
            },
            ...toolMessages,
          ];
          continue; // re-run LLM with augmented messages
        }
      }
      if (data.content) {
        yield data.content;
      }
      return;
    }

    // Streamed response: iterate events with timeout
    console.log(`[${provider}] 🚀 Streaming LLM response - processing events`);
    const iterator = streamOrDirect[Symbol.asyncIterator]?.();
    let accumulatedContent = "";
    let eventToolExecuted = false;
    let streamTimedOut = false;
    let finalStreamResult = undefined;

    try {
      while (true) {
        const nextPromise = iterator.next();
        let res;
        try {
          res = await Promise.race([
            nextPromise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("stream-timeout")), idleTimeoutMs)
            ),
          ]);
        } catch (err) {
          if (err?.message === "stream-timeout") {
            console.warn(
              `[${provider}] ⚠️ Stream idle timeout (${idleTimeoutMs}ms). Falling back to direct call.`
            );
            streamTimedOut = true;
            break;
          }
          throw err;
        }

        if (res.done) {
          console.log(`[${provider}] ℹ️ Stream finished cleanly`);
          finalStreamResult = res.value;
          break;
        }
        const evt = res.value;
        if (!evt) continue;

        if (typeof evt === "string") {
          accumulatedContent += evt;
          yield evt;
          continue;
        }
        if (evt.type === "content") {
          accumulatedContent += evt.chunk;
          yield evt.chunk;
          continue;
        }
        if (evt.type === "tool_call") {
          const call = evt.call;
          const fnName = call?.function?.name;
          console.log(
            `[${provider}] 🛠 Received tool_call event: id=${call?.id}, name=${fnName || "(no-name)"}`
          );

          if (!fnName || !TOOL_HANDLERS[fnName]) {
            console.warn(
              `[${provider}] ⚠️ Unknown/unsupported tool: ${fnName || "(no-name)"} - ignoring`
            );
            continue;
          }

          toolCallCount++;
          if (toolCallCount > maxToolCalls) {
            throw new Error(`[${provider}] Limite de ${maxToolCalls} appels d'outils atteinte.`);
          }

          console.log(`[${provider}] 🛠 Executing tool now: ${fnName} (id=${call.id})`);
          const toolMessages = await executeToolCalls([call], provider, {
            web_search: { query: question },
            defaultQuery: question,
          });

          messages = [
            ...messages,
            {
              role: "assistant",
              content: accumulatedContent || null,
              ...(provider === "anthropic" ? { tool_uses: [call] } : { tool_calls: [call] }),
            },
            ...toolMessages,
          ];

          eventToolExecuted = true;
          break; // restart LLM with updated messages
        }
      }
    } finally {
      try {
        if (iterator?.return) await iterator.return();
      } catch {
        /* ignore */
      }
    }

    if (eventToolExecuted) {
      console.log(
        `[${provider}] 🔄 Completed a tool call cycle during streaming, restarting LLM loop`
      );
      continue;
    }

    const streamToolCalls = Array.isArray(finalStreamResult?.toolCalls)
      ? normalizeToolCalls(finalStreamResult.toolCalls)
      : [];
    const validStreamCalls = streamToolCalls.filter(
      (c) => c.function?.name && TOOL_HANDLERS[c.function.name]
    );
    if (validStreamCalls.length > 0) {
      toolCallCount++;
      console.log(
        `[${provider}] 🛠 Executing ${validStreamCalls.length} tool(s) (stream completion):`,
        validStreamCalls.map((c) => c.function.name)
      );
      const toolMessages = await executeToolCalls(validStreamCalls, provider, {
        web_search: { query: question },
        defaultQuery: question,
      });
      messages = [
        ...messages,
        {
          role: "assistant",
          content: finalStreamResult?.content || null,
          ...(provider === "anthropic"
            ? { tool_uses: validStreamCalls }
            : { tool_calls: validStreamCalls }),
        },
        ...toolMessages,
      ];
      continue;
    }

    if (accumulatedContent && accumulatedContent.trim().length > 0) {
      console.log(
        `[${provider}] ✅ Streaming provided content (${accumulatedContent.length} chars). Returning.`
      );
      return;
    }

    // Fallback: direct call to fetch content/tool_calls if stream timed out or provided nothing
    console.log(
      `[${provider}] ⚠️ ${streamTimedOut ? "Stream timed out." : "No tool calls/content from stream."} Attempting direct fallback.`
    );
    const direct = await callLLMAPI({
      provider,
      model: resolveModelForProvider(provider, modelMode),
      messages,
      tools: Object.values(TOOLS),
      toolChoice: "auto",
      stream: false,
    });

    const directHasContent = Boolean(direct?.content && String(direct.content).trim());
    const directHasToolCalls = Array.isArray(direct?.toolCalls) && direct.toolCalls.length > 0;

    if (directHasToolCalls) {
      const normalized = normalizeToolCalls(direct.toolCalls);
      const valid = normalized.filter((c) => c.function?.name && TOOL_HANDLERS[c.function.name]);
      if (valid.length > 0) {
        toolCallCount++;
        console.log(
          `[${provider}] 🛠 Executing ${valid.length} tool(s) (direct fallback):`,
          valid.map((c) => c.function.name)
        );
        const toolMessages = await executeToolCalls(valid, provider, {
          web_search: { query: question },
          defaultQuery: question,
        });
        messages = [
          ...messages,
          {
            role: "assistant",
            content: direct.content || null,
            ...(provider === "anthropic" ? { tool_uses: valid } : { tool_calls: valid }),
          },
          ...toolMessages,
        ];
        continue; // re-run LLM
      } else {
        console.warn(
          `[${provider}] ⚠️ Direct fallback tool_calls present but none were valid/handled.`
        );
      }
    }

    if (directHasContent) {
      console.log(
        `[${provider}] ✅ Direct fallback returned content (${String(direct.content).length} chars).`
      );
      yield direct.content;
      return;
    }

    console.warn(`[${provider}] ⚠️ Direct fallback returned no content and no tool_calls.`);
    return;
  }

  throw new Error(`[${provider}] Limite de ${maxToolCalls} appels d'outils atteinte.`);
}

async function runHuggingFaceAgent(userQuestion, systemPrompt, modelMode) {
  const provider = "huggingface";
  const apiKey = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!apiKey) throw new Error("Clé API manquante pour huggingface");

  const model =
    resolveModelForProvider(provider, modelMode) || PROVIDER_CONFIGS.huggingface.defaultModel;
  const url =
    typeof PROVIDER_CONFIGS.huggingface.apiUrl === "function"
      ? PROVIDER_CONFIGS.huggingface.apiUrl(model)
      : PROVIDER_CONFIGS.huggingface.apiUrl;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userQuestion },
  ];

  const payload = {
    model,
    messages,
    temperature: 0.3,
    top_p: 0.95,
    stream: false,
  };

  console.log(`[huggingface] ➜ request model=${model}`);
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  console.log(`[huggingface] ⬅ status=${resp.status}`);
  if (!resp.ok) {
    const body = await resp.text();
    console.error(`[huggingface] ❌ error body preview: ${previewForLog(body)}`);
    throw new Error(`huggingface API ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || "";

  return String(text || "").trim();
}

export default handler;
export const config = { path: "/api/chat-stream" };

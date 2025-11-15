import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.32.1";

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

async function fetchPublicSystemPrompt(siteUrl) {
  if (!siteUrl) {
    console.warn("[SystemPrompt] ⚠️ URL du déploiement introuvable pour charger le prompt public");
    return null;
  }

  try {
    const promptUrl = `${siteUrl}/prompts/bob-system.md`;
    const response = await fetch(promptUrl);
    if (response.ok) {
      const content = await response.text();
      if (content.trim()) {
        const firstLine = content.split(/\r?\n/).find(line => line.trim()) || "";
        console.log(`[SystemPrompt] ✅ Prompt public chargé via ${promptUrl}`);
        console.log(`[SystemPrompt] 📄 Première ligne du prompt public: ${firstLine}`);
        return content;
      }
    }
  } catch (error) {
    console.warn("[SystemPrompt] ⚠️ Erreur fetch prompt public:", error.message);
  }

  return null;
}

async function getSystemPrompt() {
  const currentDate = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let basePrompt = `Date actuelle : ${currentDate}\n\n`;

  const siteUrl = Deno.env.get("URL") || Deno.env.get("DEPLOY_PRIME_URL");

  const localPrompt = await fetchPublicSystemPrompt(siteUrl);
  if (localPrompt) {
    basePrompt += localPrompt;
  } else {
    const envPrompt = Deno.env.get("BOB_SYSTEM_PROMPT");
    if (envPrompt) {
      basePrompt += envPrompt;
    } else {
      // 2. Fallback avec paramètres
      const city = Deno.env.get("CITY_NAME") || "Corte";
      const movement = Deno.env.get("MOVEMENT_NAME") || "Pertitellu";
      const party = Deno.env.get("PARTY_NAME") || "Petit Parti";
      const bot = Deno.env.get("BOT_NAME") || "Ophélia";
      const hashtag = Deno.env.get("HASHTAG") || "#PERTITELLU";

      basePrompt += `Tu es l'assistant citoyen ${bot} du mouvement/parti ${movement} (${party}) ${hashtag} pour la commune de ${city}. Réponds uniquement en français, de façon factuelle, concise et structurée en Markdown (titres, listes, tableaux, liens) en citant les ressources officielles pertinentes quand c'est possible.`;
    }
  }

  // 3. Charger le wiki consolidé depuis Supabase
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (supabaseUrl && supabaseKey) {
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/consolidated_wiki_documents?select=content&order=updated_at.desc&limit=1`,
        {
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json"
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0 && data[0].content) {
          basePrompt += `\n\nVoici un résumé consolidé des pages wiki disponibles. Utilise ces informations pour répondre aux questions si elles sont pertinentes:\n\n${data[0].content}`;
          console.log(`[SystemPrompt] ✅ Wiki consolidé chargé: ${data[0].content.length} chars`);
        }
      }
    } catch (error) {
      console.error("[SystemPrompt] Erreur Supabase:", error.message);
    }
  }

  // 4. Charger conseil-consolidated.semantic.md via HTTP si déployé
  if (siteUrl) {
    try {
      const councilUrl = `${siteUrl}/docs/conseils/conseil-consolidated.semantic.md`;
      const response = await fetch(councilUrl);
      if (response.ok) {
        const councilContext = await response.text();
        if (councilContext.trim()) {
          basePrompt += `\n\n===== CONTEXTE MUNICIPAL (sources locales) =====\n\n${councilContext}`;
          console.log(`[SystemPrompt] ✅ Conseil consolidé chargé: ${councilContext.length} chars`);
        }
      }
    } catch (error) {
      console.warn("[SystemPrompt] conseil-consolidated.semantic.md non disponible:", error.message);
    }
  }

  console.log(`[SystemPrompt] ✅ Prompt final: ${basePrompt.length} caractères`);
  return basePrompt;
}

// ============================================================================
// BRAVE SEARCH
// ============================================================================

async function performWebSearch(query) {
  const apiKey = Deno.env.get("BRAVE_SEARCH_API_KEY");

  if (!apiKey) {
    console.warn("[WebSearch] ⚠️ BRAVE_SEARCH_API_KEY manquant");
    return `Recherche web non configurée pour: "${query}"`;
  }

  try {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.append("q", query);
    url.searchParams.append("count", "3");
    url.searchParams.append("search_lang", "fr");
    url.searchParams.append("country", "FR");

    console.log(`[WebSearch] 🌐 Appel API Brave pour: "${query}"`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Subscription-Token": apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Brave API: ${response.status}`);
    }

    const data = await response.json();

    let resultText = `Résultats pour "${query}":\n\n`;

    if (data.web && data.web.results) {
      data.web.results.slice(0, 3).forEach((result, i) => {
        const shortDesc = result.description?.substring(0, 150) || "";
        resultText += `${i + 1}. ${result.title}\n`;
        resultText += `   ${shortDesc}...\n`;
        resultText += `   Source: ${result.url}\n\n`;
      });
    }

    if (data.locations && data.locations.results && data.locations.results.length > 0) {
      resultText += `\nINFOS LOCALES:\n`;
      data.locations.results.slice(0, 2).forEach(loc => {
        resultText += `- ${loc.title}\n`;
        if (loc.address) resultText += `  Adresse: ${loc.address}\n`;
        if (loc.phone) resultText += `  Tél: ${loc.phone}\n`;
        if (loc.hours) resultText += `  Horaires: ${loc.hours}\n`;
      });
    }

    console.log(`[WebSearch] ✅ ${data.web?.results?.length || 0} résultats formatés`);
    return resultText;

  } catch (error) {
    console.error("[WebSearch] ❌", error.message);
    return `Erreur recherche: ${error.message}`;
  }
}

// ============================================================================
// ANTHROPIC AGENT (avec tools et streaming)
// ============================================================================

async function* runAnthropicAgentStream(question, systemPrompt, conversationHistory = []) {
  const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-5-20250929";
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY manquant");
  }

  const anthropicClient = new Anthropic({ apiKey });

  const tools = [
    {
      name: "web_search",
      description: "Search the web for current information about Corte, municipal services, local events, or verify facts that may have changed since January 2025.",
      input_schema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query in French (2-6 words). Examples: 'mairie corte horaires', 'conseil municipal corte 2025'"
          }
        },
        required: ["query"]
      }
    }
  ];

  console.log(`[Anthropic] 🚀 Model: ${model}`);
  console.log(`[Anthropic] 📝 Question: "${question}"`);
  console.log(`[Anthropic] 📚 Historique: ${conversationHistory.length} messages`);
  console.log(`[Anthropic] ⏱️ Start: ${new Date().toISOString()}`);

  // ✅ Construire l'historique intelligent (max 5 derniers échanges)
  const MAX_HISTORY = 5;
  const recentHistory = conversationHistory.slice(-MAX_HISTORY);
  
  let messages = [];
  
  // Ajouter l'historique formaté
  for (const item of recentHistory) {
    if (item.role === "user" && item.content) {
      messages.push({ role: "user", content: item.content });
    } else if (item.role === "assistant" && item.content) {
      messages.push({ role: "assistant", content: item.content });
    }
  }
  
  // Ajouter la question actuelle
  messages.push({ role: "user", content: question });
  
  console.log(`[Anthropic] 💬 Messages context: ${messages.length} (${recentHistory.length} historique + 1 nouvelle)`);

  let iterationCount = 0;
  const MAX_ITERATIONS = 1;

  while (iterationCount <= MAX_ITERATIONS) {
    console.log(`[Anthropic] 📡 Appel API Claude (iteration ${iterationCount})...`);

    const stream = await anthropicClient.messages.stream({
      model,
      max_tokens: 8192,
      temperature: 0.3,
      system: systemPrompt,
      messages,
      tools
    });

    let currentToolUse = null;
    let hasToolUse = false;
    let textContent = "";
    let allContent = [];

    // Stream les chunks
    for await (const chunk of stream) {
      if (chunk.type === "content_block_start") {
        if (chunk.content_block.type === "tool_use") {
          currentToolUse = {
            id: chunk.content_block.id,
            name: chunk.content_block.name,
            input: {}
          };
          hasToolUse = true;
          console.log(`[Anthropic] 🔧 Tool détecté: ${chunk.content_block.name}`);
        } else if (chunk.content_block.type === "text") {
          allContent.push({ type: "text", text: "" });
        }
      } else if (chunk.type === "content_block_delta") {
        if (chunk.delta.type === "text_delta") {
          const text = chunk.delta.text;
          textContent += text;
          if (allContent.length > 0 && allContent[allContent.length - 1].type === "text") {
            allContent[allContent.length - 1].text += text;
          }
          yield text; // Stream progressif à l'utilisateur
        } else if (chunk.delta.type === "input_json_delta" && currentToolUse) {
          // Accumuler l'input du tool
          try {
            const partialInput = JSON.parse(chunk.delta.partial_json);
            currentToolUse.input = { ...currentToolUse.input, ...partialInput };
          } catch {
            // JSON partiel, on attend la suite
          }
        }
      } else if (chunk.type === "content_block_stop" && currentToolUse) {
        allContent.push({
          type: "tool_use",
          id: currentToolUse.id,
          name: currentToolUse.name,
          input: currentToolUse.input
        });
        currentToolUse = null;
      }
    }

    const finalMessage = await stream.finalMessage();

    // Si pas de tool_use, on a fini
    if (!hasToolUse || iterationCount >= MAX_ITERATIONS) {
      console.log(`[Anthropic] ✅ Terminé (${textContent.length} chars)`);
      break;
    }

    // Exécuter les tools
    iterationCount++;
    console.log(`[Anthropic] 🔄 Iteration ${iterationCount}: execution tools...`);

    const toolUseBlocks = finalMessage.content.filter(block => block.type === "tool_use");

    const toolResults = [];

    for (const toolUse of toolUseBlocks) {
      if (toolUse.name === "web_search") {
        yield "\n\n🔍 Recherche sur Internet en cours…\n\n";
        const query = toolUse.input.query;
        console.log(`[Anthropic] 🔍 Recherche: "${query}"`);

        try {
          const searchResults = await performWebSearch(query);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: searchResults
          });
        } catch (error) {
          console.error(`[Anthropic] ❌ Erreur recherche:`, error.message);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Erreur: ${error.message}`,
            is_error: true
          });
        }
      }
    }

    // Ajouter les résultats dans la conversation
    messages.push({
      role: "assistant",
      content: finalMessage.content
    });

    messages.push({
      role: "user",
      content: toolResults
    });

    yield "\n\n---\n\n"; // Séparateur visuel entre recherche et réponse finale
  }

  console.log(`[Anthropic] ⏱️ End: ${new Date().toISOString()}`);
}

// ============================================================================
// OPENAI FALLBACK (streaming)
// ============================================================================

async function* runOpenAIAgentStream(question, systemPrompt, conversationHistory = []) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY manquant");
  }

  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

  console.log(`[OpenAI] 🚀 Model: ${model}`);
  console.log(`[OpenAI] 📚 Historique: ${conversationHistory.length} messages`);

  // ✅ Construire les messages avec historique
  const MAX_HISTORY = 5;
  const recentHistory = conversationHistory.slice(-MAX_HISTORY);
  
  const messages = [
    { role: "system", content: systemPrompt }
  ];
  
  // Ajouter l'historique
  for (const item of recentHistory) {
    if (item.role && item.content) {
      messages.push({ role: item.role, content: item.content });
    }
  }
  
  // Ajouter la question actuelle
  messages.push({ role: "user", content: question });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0.3,
      stream: true,
      messages // ✅ Avec historique
    })
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`OpenAI API ${response.status}: ${body}`);
    err.isProviderError = true;
    throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter(line => line.trim().startsWith("data: "));

    for (const line of lines) {
      const data = line.replace("data: ", "").trim();
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          yield delta;
        }
      } catch {
        // Ignorer les lignes mal formées
      }
    }
  }

  console.log(`[OpenAI] ✅ Stream terminé`);
}

async function runOpenAIAgent({ question, systemPrompt }) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY manquant");
  }

  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`OpenAI API ${response.status}: ${body}`);
    err.isProviderError = true;
    throw err;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// ============================================================================
// DEBUG LOGGER
// ============================================================================

function createDebugLogger() {
	const pendingLogs = [];
	let controllerRef = null;
	let encoderRef = null;
	let enabled = false;
	const originals = {};

	const formatArgs = (args) =>
		args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ");

	const emit = (level, args) => {
		const line = `[DEBUG] ${level.toUpperCase()}: ${formatArgs(args)}`;
		if (controllerRef && encoderRef) {
			controllerRef.enqueue(encoderRef.encode(`\n\n${line}\n\n`));
		} else {
			pendingLogs.push(line);
		}
	};

	const wrap = (level) => (...args) => {
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
				for (const line of pendingLogs) {
					controller.enqueue(encoder.encode(`\n\n${line}\n\n`));
				}
				pendingLogs.length = 0;
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
			pendingLogs.length = 0;
		}
	};
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async (request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Méthode non autorisée. Utilisez POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await request.json();
    const { question, conversation_history } = body;

    const debugMode = question && /mode debug/i.test(question);
    const sanitizedQuestion = debugMode ? question.replace(/mode debug/gi, "").trim() : question;
    const userQuestion = sanitizedQuestion || question;

    if (!question) {
      return new Response(
        JSON.stringify({ error: "La question est requise." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const debugLogger = debugMode ? createDebugLogger() : null;
    debugLogger?.enable();

    console.log(`[EdgeFunction] ========================================`);
    console.log(`[EdgeFunction] 🎯 Question: "${question}"`);
    console.log(`[EdgeFunction] 📚 Historique: ${conversation_history?.length || 0} messages`);
    console.log(`[EdgeFunction] ⏱️ Start: ${new Date().toISOString()}`);

    const systemPrompt = await getSystemPrompt();
    console.log(`[EdgeFunction] 📏 System prompt: ${systemPrompt.length} chars`);

    // Créer le stream de réponse
    const encoder = new TextEncoder();
    let streamCreated = false;

    const readable = new ReadableStream({
      async start(controller) {
        debugLogger?.attachStream(controller, encoder);
        try {
          // Essayer Anthropic d'abord
          if (Deno.env.get("ANTHROPIC_API_KEY")) {
            console.log(`[EdgeFunction] 🔄 Tentative Anthropic...`);
            try {
              for await (const chunk of runAnthropicAgentStream(
                userQuestion,
                systemPrompt,
                conversation_history
              )) {
                controller.enqueue(encoder.encode(chunk));
              }
              console.log(`[EdgeFunction] ✅ Succès Anthropic`);
              controller.close();
              return;
            } catch (error) {
              console.error(`[EdgeFunction] ❌ Anthropic failed:`, error.message);
              // console.error(`[EdgeFunction] Stack:`, error.stack);
              if (/credit balance/i.test(error.message)) {
                controller.enqueue(
                  encoder.encode(`\n\n[⚠️ Anthropic bloqué : crédits insuffisants.]\n\n`)
                );
              }
              controller.enqueue(encoder.encode(`\n\n[⚠️ Basculement sur OpenAI...]\n\n`));
            }
          }

          // Fallback OpenAI
          if (Deno.env.get("OPENAI_API_KEY")) {
            console.log(`[EdgeFunction] 🔄 Tentative OpenAI...`);
            for await (const chunk of runOpenAIAgentStream(
              userQuestion,
              systemPrompt,
              conversation_history
            )) {
              controller.enqueue(encoder.encode(chunk));
            }
            console.log(`[EdgeFunction] ✅ Succès OpenAI`);
          } else {
            throw new Error("Aucun provider disponible (ANTHROPIC_API_KEY et OPENAI_API_KEY manquants)");
          }

          controller.close();
        } catch (error) {
          console.error("[EdgeFunction] ❌ Erreur globale:", error.message);
          if (!error.isProviderError) {
            console.error("[EdgeFunction] Stack:", error.stack);
          }
          controller.enqueue(
            encoder.encode(`\n\n❌ Erreur: ${error.message}`)
          );
          controller.close();
        } finally {
          debugLogger?.disable();
        }
      }
    });
    streamCreated = true;

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      }
    });

  } catch (error) {
    console.error("[EdgeFunction] ❌ Erreur handler:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
};

export const config = {
  path: "/api/chat-stream"
};
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { HfInference } from "@huggingface/inference";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const hfClient = new HfInference(process.env.HF_TOKEN);

// ============================================================================
// CONFIGURATION
// ============================================================================

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

const MODEL_ALIASES = {
  "mistral-7b-instruct-v0.1": "mistralai/Mistral-7B-Instruct-v0.1",
  "mistral-7b-instruct-v0.2": "mistralai/Mistral-7B-Instruct-v0.2",
  "mistral-large-2": "mistralai/Mistral-Large-Instruct",
  "mixtral-8x7b-instruct": "mistralai/Mixtral-8x7B-Instruct-v0.1",
  "llama-3-8b-instruct": "meta-llama/Meta-Llama-3-8B-Instruct",
  "llama-3-70b-instruct": "meta-llama/Meta-Llama-3-70B-Instruct",
};

const resolveModel = (alias) => MODEL_ALIASES[alias] || alias;




// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const STATIC_CONSOLIDATED = path.resolve(process.cwd(), "public", "docs", "conseils", "conseil-consolidated.semantic.md");

function readStaticConsolidated() {
  try {
    if (fs.existsSync(STATIC_CONSOLIDATED)) {
      const txt = fs.readFileSync(STATIC_CONSOLIDATED, "utf8");
      return txt?.trim() ? txt : "";
    }
  } catch { /* ignore */ }
  return "";
}


async function getSystemPrompt() {
  // **AJOUTER LA DATE ACTUELLE**
  const currentDate = new Date().toLocaleDateString('fr-FR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  let basePrompt = `Date actuelle : ${currentDate}\n\n`;

  // 1. Variable d'environnement directe
  if (process.env.HF_SYSTEM_PROMPT) {
    basePrompt += process.env.HF_SYSTEM_PROMPT;
  } else {
    // 2. Fichier externe
    const promptPath =
      process.env.HF_SYSTEM_PROMPT_PATH ||
      path.resolve("public", "prompts", "bob-system.md");

    try {
      const content = fs.readFileSync(promptPath, "utf-8").trim();
      if (content) basePrompt += content;
    } catch (readError) {
      console.warn(
        `[System] Impossible de lire le prompt système (${promptPath}) : ${readError.message}`
      );
    }
  }

  // 3. Fallback par défaut si aucun prompt n'a été trouvé
  if (basePrompt === `Date actuelle : ${currentDate}\n\n`) {
    const city = process.env.CITY_NAME || "Corte";
    const movement = process.env.MOVEMENT_NAME || "Pertitellu";
    const party = process.env.PARTY_NAME || "Petit Parti";
    const bot = process.env.BOT_NAME || "Ophélia";
    const hashtag = process.env.HASHTAG || "#PERTITELLU";

    basePrompt += `Tu es l'assistant citoyen ${bot} du mouvement/parti ${movement} (${party}) ${hashtag} pour la commune de ${city}. Réponds uniquement en français, de façon factuelle, concise et structurée en Markdown (titres, listes, tableaux, liens) en citant les ressources officielles pertinentes quand c'est possible.`;
  }

  // 4. Ajouter le document wiki consolidé
  try {
    const { data: consolidatedDoc, error } = await supabase
      .from('consolidated_wiki_documents')
      .select('content')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error("Erreur lors de la récupération du document wiki consolidé:", error);
    } else if (consolidatedDoc) {
      basePrompt += `\n\nVoici un résumé consolidé des pages wiki disponibles. Utilise ces informations pour répondre aux questions si elles sont pertinentes:\n\n${consolidatedDoc.content}`;
    }
  } catch (dbError) {
    console.error("Erreur inattendue lors de la récupération du document consolidé:", dbError);
  }

  try {
  const councilContext = readStaticConsolidated();
  if (councilContext) {
    basePrompt += `

===== CONTEXTE MUNICIPAL (sources locales) =====

${councilContext}
`;
  } else {
    console.warn("[System] conseil-consolidated?semantic.md absent ou vide.");
  }
} catch (e) {
  console.error("[System] Erreur lecture conseil-consolidated.semantic.md:", e.message);
}

  return basePrompt;
}

// ============================================================================
// ANTHROPIC (Claude)
// ============================================================================

/**
 * Effectue une recherche web via Brave Search API
 */
async function performWebSearch(query) {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  
  if (!apiKey) {
    console.warn("[WebSearch] ⚠️ BRAVE_SEARCH_API_KEY manquant");
    return {
      error: "Recherche web non configurée",
      message: "Clé API Brave Search requise",
      query: query
    };
  }

  try {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.append("q", query);
    url.searchParams.append("count", "3"); // RÉDUIT À 3 pour éviter surcharge
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

    // FORMAT ULTRA-CONCIS pour Claude
    let resultText = `Résultats pour "${query}":\n\n`;
    
    if (data.web && data.web.results) {
      data.web.results.slice(0, 3).forEach((result, i) => {
        // Limiter la description à 150 caractères
        const shortDesc = result.description?.substring(0, 150) || "";
        resultText += `${i+1}. ${result.title}\n`;
        resultText += `   ${shortDesc}...\n`;
        resultText += `   Source: ${result.url}\n\n`;
      });
    }

    // Résultats locaux (très utile pour mairie, commerces, etc.)
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

    return resultText; // RETOURNE DU TEXTE au lieu d'un objet JSON

  } catch (error) {
    console.error("[WebSearch] ❌", error.message);
    return `Erreur recherche: ${error.message}`;
  }
}

async function runAnthropicAgent({ question, systemPrompt }) {

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";
  
  const tools = [
    {
      name: "web_search",
      description: "Search the web for current information. Use this to find up-to-date information about Corte, municipal services, local events, or verify facts that may have changed since January 2025.",
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

  console.log(`[Anthropic] 🚀 Démarrage avec modèle: ${model}`);
  console.log(`[Anthropic] 📝 Question: "${question}"`);
  console.log(`[Anthropic] ⏱️ Timestamp début: ${new Date().toISOString()}`);

  try {
    console.log("[Anthropic] 🔧 Tools configurés:", JSON.stringify(tools, null, 2));
    console.log("[Anthropic] 📏 Longueur system prompt:", systemPrompt.length);
    
    let messages = [{ role: "user", content: question }];
    
    console.log("[Anthropic] 📡 Appel initial API Claude...");
    const apiCallStart = Date.now();
    
    let response = await anthropicClient.messages.create({
      model,
      max_tokens: 8192,
      temperature: 0.3,
      system: systemPrompt,
      messages,
      tools
    });

    const apiCallDuration = Date.now() - apiCallStart;
    console.log(`[Anthropic] ✅ Réponse API reçue en ${apiCallDuration}ms`);
    console.log(`[Anthropic] 🛑 Stop reason: ${response.stop_reason}`);
    console.log(`[Anthropic] 📦 Content blocks: ${response.content.length}`);
    console.log(`[Anthropic] 🔍 Block types: ${response.content.map(b => b.type).join(', ')}`);
    
    let iterationCount = 0;
    const MAX_ITERATIONS = 1; // 5;

    while (response.stop_reason === "tool_use" && iterationCount < MAX_ITERATIONS) {
      iterationCount++;
      console.log(`[Anthropic] 🔄 Itération ${iterationCount}/${MAX_ITERATIONS}: Claude utilise des tools...`);

      const toolUseBlocks = response.content.filter(block => block.type === "tool_use");
      console.log(`[Anthropic] 🔧 ${toolUseBlocks.length} tool(s) détecté(s): ${toolUseBlocks.map(t => t.name).join(', ')}`);
      
      messages.push({
        role: "assistant",
        content: response.content
      });

      const toolResults = [];
      for (const toolUse of toolUseBlocks) {
        console.log(`[Anthropic] 🛠️ Exécution tool: ${toolUse.name} (id: ${toolUse.id})`);
        
        if (toolUse.name === "web_search") {
          const query = toolUse.input.query;
          console.log(`[Anthropic] 🔍 Recherche web: "${query}"`);
          
          const searchStart = Date.now();
          try {
            const searchResults = await performWebSearch(query);
            const searchDuration = Date.now() - searchStart;
            console.log(`[Anthropic] ✅ Recherche terminée en ${searchDuration}ms`);
            console.log(`[Anthropic] 📄 Résultats (preview): ${String(searchResults).substring(0, 100)}...`);
            
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: String(searchResults)
            });
          } catch (error) {
            const searchDuration = Date.now() - searchStart;
            console.error(`[Anthropic] ❌ Erreur recherche web après ${searchDuration}ms:`, error.message);
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: JSON.stringify({
                error: "Erreur lors de la recherche web",
                message: error.message
              }),
              is_error: true
            });
          }
        }
      }

      console.log(`[Anthropic] 📤 Envoi ${toolResults.length} résultats de tools à Claude...`);
      messages.push({
        role: "user",
        content: toolResults
      });

      console.log(`[Anthropic] 📡 Appel API Claude (itération ${iterationCount})...`);
      const iterationStart = Date.now();
      
      response = await anthropicClient.messages.create({
        model,
        max_tokens: 8192,
        temperature: 0.3,
        system: systemPrompt,
        messages,
        tools
      });
      
      const iterationDuration = Date.now() - iterationStart;
      console.log(`[Anthropic] ✅ Réponse itération ${iterationCount} reçue en ${iterationDuration}ms`);
      console.log(`[Anthropic] 🛑 Nouveau stop_reason: ${response.stop_reason}`);
    }

    if (iterationCount >= MAX_ITERATIONS) {
      console.warn(`[Anthropic] ⚠️ Limite de ${MAX_ITERATIONS} recherches atteinte`);
    }

    const textBlocks = response.content.filter(block => block.type === "text");
    console.log(`[Anthropic] 📝 ${textBlocks.length} bloc(s) texte trouvé(s)`);
    
    const fullResponse = textBlocks
      .map(block => block.text)
      .join("\n")
      .trim();

    console.log(`[Anthropic] ✅ Réponse finale générée (${fullResponse.length} caractères).`);
    console.log(`[Anthropic] 📄 Extrait (200 chars):`, fullResponse.substring(0, 200));

    if (!fullResponse || fullResponse.trim().length === 0) {
      console.error("[Anthropic] ⚠️ RÉPONSE VIDE ! Contenu brut:", JSON.stringify(response.content, null, 2));
      console.error("[Anthropic] ⚠️ Messages history:", JSON.stringify(messages, null, 2));
      throw new Error("Anthropic a retourné une réponse vide");
    }
    
    console.log(`[Anthropic] ⏱️ Timestamp fin: ${new Date().toISOString()}`);
    
    return {
      answer: fullResponse,
      provider: "anthropic",
      model,
      searchCount: iterationCount
    };
  } catch (error) {
    console.error(`[Anthropic] ❌❌❌ ÉCHEC CRITIQUE ❌❌❌`);
    console.error(`[Anthropic] ❌ Type erreur: ${error.constructor.name}`);
    console.error(`[Anthropic] ❌ Message: ${error.message}`);
    console.error(`[Anthropic] ❌ Stack:`, error.stack);
    console.error(`[Anthropic] ⏱️ Timestamp échec: ${new Date().toISOString()}`);
    
    throw error; // Re-throw pour déclencher le fallback
  }
}

// ============================================================================
// OPENAI (Simplifié - 1 seul appel)
// ============================================================================

async function runOpenAIAgent({ question, systemPrompt }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY manquant");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  console.log(`[OpenAI] Démarrage avec modèle: ${model}`);

  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model,
    max_tokens: 4096,
    temperature: 0.3,
    messages: [
      { role: "system", content: systemPrompt }, // Déplacé ici
      { role: "user", content: question },
    ],
    stream: false,
  });

  const fullResponse = response.choices[0].message.content;

  console.log(`[OpenAI] Réponse générée (${fullResponse.length} chars)`);

  return {
    answer: fullResponse,
    provider: "openai",
    model,
  };
}

// ============================================================================
// HUGGING FACE
// ============================================================================

async function runHuggingFaceAgent({ question, systemPrompt }) {
  const model = process.env.HF_MODEL || "HuggingFaceH4/zephyr-7b-beta";
  console.log(`[HuggingFace] Démarrage avec modèle: ${model}`);
  const formattedPrompt = `<|system|>${systemPrompt}</s><|user|>${question}</s><|assistant|>`;
  const response = await hfClient.textGeneration({
    model, inputs: formattedPrompt, parameters: { max_new_tokens: 4096, temperature: 0.3, return_full_text: false }
  });
  const fullResponse = response.generated_text;
  console.log(`[HuggingFace] Réponse générée (${fullResponse.length} chars)`);
  return {
    answer: fullResponse,
    provider: "huggingface",
    model,
  };
}

// ============================================================================
// FALLBACK ORCHESTRATOR
// ============================================================================

function buildFallbackChain() {
  const fallbacks = [];

  // 1. Anthropic (Priorité 1)
  if (process.env.ANTHROPIC_API_KEY) {
    fallbacks.push({
      provider: "anthropic",
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929", // "claude-sonnet-4-5-20250929",
      executor: runAnthropicAgent,
    });
  }

  // 2. OpenAI (Priorité 2)
  if (process.env.OPENAI_API_KEY) {
    fallbacks.push({
      provider: "openai",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      executor: runOpenAIAgent,
    });
  }

  // 3. Hugging Face (Fallbacks)
  if (process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY) {
    const hfProvider = process.env.HF_CHAT_PROVIDER || "together";
    const hfModel = resolveModel(
      process.env.HF_CHAT_MODEL || "mistralai/Mixtral-8x7B-Instruct-v0.1"
    );

    fallbacks.push(
      {
        provider: hfProvider,
        model: hfModel,
        executor: runHuggingFaceAgent,
      },
      {
        provider: "together",
        model: resolveModel("mixtral-8x7b-instruct"),
        executor: runHuggingFaceAgent,
      },
      {
        provider: "groq",
        model: "llama3-8b-8192",
        executor: runHuggingFaceAgent,
      },
      {
        provider: "hf-inference",
        model: resolveModel("meta-llama/Meta-Llama-3-8B-Instruct"),
        executor: runHuggingFaceAgent,
      }
    );
  }

  // Dédupliquer
  const unique = fallbacks.filter(
    (item, index, arr) =>
      item.provider &&
      item.model &&
      index ===
        arr.findIndex(
          (other) =>
            other.provider === item.provider && other.model === item.model
        )
  );

  return unique;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

async function handlerInternal(event, context) {
  // Charge le prompt de Bob de façon résiliente (voir ensureBobPrompt défini plus haut dans ce fichier)
  const { prompt: BOB_PROMPT, diagnostics: BOB_PROMPT_DIAG } = await ensureBobPrompt();
  console.info('[rag_chatbot] bob prompt diagnostics:', BOB_PROMPT_DIAG);

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Méthode non autorisée. Utilisez POST." }),
    };
  }

  try {
    const { question, user_id, settings } = JSON.parse(event.body);

    if (!question) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "La question est requise." }),
      };
    }

    console.log(`[Main] ========================================`);
    console.log(`[Main] 🎯 Nouvelle requête reçue`);
    console.log(`[Main] 📝 Question: "${question}"`);
    console.log(`[Main] ⏱️ Timestamp: ${new Date().toISOString()}`);
    console.log(`[Main] ========================================`);

    const systemPrompt = await getSystemPrompt();
    console.log(`[Main] 📏 System prompt chargé (${systemPrompt.length} chars)`);
    
    const fallbackChain = buildFallbackChain();

    if (fallbackChain.length === 0) {
      console.error(`[Main] ❌ Aucun provider configuré !`);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error:
            "Aucun provider configuré. Définissez au moins une clé API (ANTHROPIC_API_KEY, OPENAI_API_KEY, ou HF_TOKEN).",
        }),
      };
    }

    console.log(`[Main] 🔗 Chaîne de fallback (${fallbackChain.length} providers):`);
    fallbackChain.forEach((f, idx) => {
      console.log(`[Main]    ${idx + 1}. ${f.provider}/${f.model}`);
    });

    let finalAnswer = "";
    let finalProvider = "";
    let finalModel = "";
    const attempts = [];
    const debugTrace = [];

    for (let i = 0; i < fallbackChain.length; i++) {
      const { provider, model, executor } = fallbackChain[i];
      
      console.log(`[Main] ========================================`);
      console.log(`[Main] 🔄 Tentative ${i + 1}/${fallbackChain.length}: ${provider}/${model}`);
      console.log(`[Main] ⏱️ Start: ${new Date().toISOString()}`);
      
      const attemptStart = Date.now();
      debugTrace.push({
        provider,
        model,
        status: "attempting",
        timestamp: new Date().toISOString(),
        startTime: attemptStart,
        attemptNumber: i + 1,
      });

      try {
        console.log(`[Main] 📡 Appel executor pour ${provider}...`);
        
        const result = await executor({
          question,
          systemPrompt,
          provider,
          model,
        });

        console.log(`[Main] 📦 Résultat reçu de ${provider}:`, {
          hasAnswer: !!result.answer,
          answerLength: result.answer?.length || 0,
          answerType: typeof result.answer,
          provider: result.provider,
          model: result.model
        });

        // Si l'agent retourne un objet avec une propriété 'error', le considérer comme un échec
        if (result.answer && typeof result.answer === 'object' && result.answer.error) {
          console.error(`[Main] ❌ ${provider} a retourné une erreur:`, result.answer.error);
          throw new Error(result.answer.error);
        }

        // Vérifier que la réponse n'est pas vide
        if (!result.answer || (typeof result.answer === 'string' && result.answer.trim().length === 0)) {
          console.error(`[Main] ❌ ${provider} a retourné une réponse vide`);
          throw new Error("Réponse vide du provider");
        }

        const attemptEnd = Date.now();
        const duration = attemptEnd - attemptStart;

        console.log(`[Main] ✅ SUCCÈS avec ${provider} en ${duration}ms`);
        console.log(`[Main] 📄 Extrait réponse: ${String(result.answer).substring(0, 150)}...`);

        debugTrace[debugTrace.length - 1] = {
          ...debugTrace[debugTrace.length - 1],
          status: "success",
          duration,
          endTime: attemptEnd,
          answerLength: result.answer.length,
        };

        finalAnswer = result.answer;
        finalProvider = result.provider;
        finalModel = result.model;
        
        console.log(`[Main] 🎉 Réponse finale sélectionnée: ${finalProvider}/${finalModel}`);
        console.log(`[Main] ========================================`);
        break; // Exit after first successful executor
        
      } catch (err) {
        const attemptEnd = Date.now();
        const duration = attemptEnd - attemptStart;

        console.error(`[Main] ========================================`);
        console.error(`[Main] ❌ ÉCHEC ${provider} après ${duration}ms`);
        console.error(`[Main] ❌ Type: ${err.constructor.name}`);
        console.error(`[Main] ❌ Message: ${err.message}`);
        console.error(`[Main] ❌ Stack:`, err.stack?.substring(0, 500));
        console.error(`[Main] ========================================`);

        debugTrace[debugTrace.length - 1] = {
          ...debugTrace[debugTrace.length - 1],
          status: "error",
          duration,
          endTime: attemptEnd,
          error: err.message,
          errorType: err.constructor.name,
        };

        attempts.push({
          provider,
          model,
          message: err.message,
          duration,
          attemptNumber: i + 1,
        });
        
        if (i < fallbackChain.length - 1) {
          console.log(`[Main] 🔄 Passage au fallback suivant...`);
        } else {
          console.error(`[Main] ❌ Tous les fallbacks épuisés`);
        }
        // Continue to next fallback if error
      }
    }

    if (!finalAnswer) {
      console.error(`[Main] ❌❌❌ ÉCHEC TOTAL - Aucune réponse valide`);
      console.error(`[Main] 📊 Tentatives:`, JSON.stringify(attempts, null, 2));
      
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Échec de traitement de la demande. Aucune réponse valide reçue des modèles.",
          attempts,
          debugTrace,
        }),
      };
    }

    console.log(`[Main] ========================================`);
    console.log(`[Main] 🎉 SUCCÈS GLOBAL`);
    console.log(`[Main] 📊 Provider: ${finalProvider}`);
    console.log(`[Main] 📊 Model: ${finalModel}`);
    console.log(`[Main] 📊 Réponse: ${finalAnswer.length} caractères`);
    console.log(`[Main] ⏱️ Timestamp fin: ${new Date().toISOString()}`);
    console.log(`[Main] ========================================`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answer: finalAnswer,
        provider: finalProvider,
        model: finalModel,
        debugTrace,
      }),
    };
  } catch (err) {
    console.error(`[Main] ❌❌❌ ERREUR GLOBALE NON GÉRÉE ❌❌❌`);
    console.error(`[Main] ❌ Message: ${err.message}`);
    console.error(`[Main] ❌ Stack:`, err.stack);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}

// --- Remplacement/ajout : loader résilient pour le prompt de "Bob" ---
// Ne pas effectuer de top-level await ici. Appeler ensureBobPrompt() depuis le handler.

// helper safe sync read (used only in dev fallback)
function tryReadSync(filePath) {
  try {
    return { ok: true, text: fs.readFileSync(filePath, 'utf8') };
  } catch (e) {
    return { ok: false, err: e };
  }
}

let _bobPromptCache = null;
let _bobPromptDiag = null;

async function fetchText(url, headers) {
  const r = await fetch(url, { redirect: "follow", headers });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.text();
}

async function loadBobPrompt() {
  const diag = { tried: [], cwd: process.cwd(), timestamp: new Date().toISOString() };

  // 1) FILESYSTEM FIRST (local bundle in functions / public/)
  const fsCandidates = [
    path.resolve(process.cwd(), 'public', 'prompts', 'bob-system.md'),
    path.resolve(process.cwd(), 'public', 'prompts', 'bob.md'),
    path.resolve(process.cwd(), 'public', 'docs', 'bob_prompt.md'),
    path.resolve(process.cwd(), 'public', 'docs', 'bob-system.md'),
    path.resolve(process.cwd(), 'public', 'bob-system.md'),
    path.resolve(process.cwd(), 'prompts', 'bob-system.md'),
    // also allow function-local prompts directory
    path.resolve(process.cwd(), 'netlify', 'functions', 'prompts', 'bob-system.md'),
  ];
  for (const p of fsCandidates) {
    diag.tried.push({ source: 'fs', path: p });
    try {
      if (fs.existsSync && fs.existsSync(p)) {
        const txt = fs.readFileSync(p, 'utf8');
        if (txt && txt.trim().length > 0) {
          diag.found = { via: 'fs', path: p, len: txt.length };
          _bobPromptDiag = diag;
          return { prompt: txt, diagnostics: diag };
        } else {
          diag[`fs_empty:${p}`] = true;
        }
      }
    } catch (e) {
      diag[`fs_err:${p}`] = String(e.code || e.message || e);
    }
  }

  // 2) ENV variable (fast, recommended for prod)
  if (process.env.BOB_PROMPT && String(process.env.BOB_PROMPT).trim()) {
    diag.tried.push({ source: 'env', note: 'BOB_PROMPT' });
    _bobPromptDiag = diag;
    return { prompt: String(process.env.BOB_PROMPT), diagnostics: diag };
  }

  // 3) Remote public URL (site CDN) — try SITE/SITE_BASE_URL/SITE_URL/URL/DEPLOY envs
  const siteCandidates = [
    process.env.BOB_PROMPT_URL,
    process.env.SITE_BASE_URL,
    process.env.SITE_URL,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL
  ].filter(Boolean);
  const remotePaths = [];
  for (const base of siteCandidates) {
    const baseClean = String(base).replace(/\/+$/, '');
    remotePaths.push(`${baseClean}/prompts/bob-system.md`);
    remotePaths.push(`${baseClean}/prompts/bob.md`);
    remotePaths.push(`${baseClean}/docs/bob_prompt.md`);
  }
  for (const url of remotePaths) {
    diag.tried.push({ source: 'http', url });
    try {
      const txt = await fetchText(url);
      if (txt && txt.trim().length) {
        diag.found = { via: 'http', url, len: txt.length };
        _bobPromptDiag = diag;
        return { prompt: txt, diagnostics: diag };
      } else {
        diag[`http_empty:${url}`] = true;
      }
    } catch (e) {
      diag[`http_err:${url}`] = String(e.message || e);
    }
  }

  // 4) GitHub raw fallback if configured (GITHUB_RAW_BASE)
  if (process.env.GITHUB_RAW_BASE) {
    const ghBase = String(process.env.GITHUB_RAW_BASE).replace(/\/+$/, '');
    const ghCandidates = [
      `${ghBase}/prompts/bob-system.md`
    ];
    const ghToken = process.env.GITHUB_TOKEN ? String(process.env.GITHUB_TOKEN).trim() : null;
    for (const url of ghCandidates) {
      diag.tried.push({ source: 'github_raw', url });
      try {
        const headers = ghToken ? { Authorization: `token ${ghToken}` } : undefined;
        const txt = await fetchText(url, headers);
        if (txt && txt.trim().length) {
          diag.found = { via: 'github_raw', url, len: txt.length };
          _bobPromptDiag = diag;
          return { prompt: txt, diagnostics: diag };
        } else {
          diag[`gh_empty:${url}`] = true;
        }
      } catch (e) {
        diag[`gh_err:${url}`] = String(e.message || e);
      }
    }
  }

  // 5) Final fallback (env fallback or built-in)
  diag.tried.push({ source: 'fallback', note: 'BOB_PROMPT_FALLBACK / inline default' });
  const fallback = process.env.BOB_PROMPT_FALLBACK || `Bonjour, je suis l'IA civique. Posez votre question.`;
  _bobPromptDiag = diag;
  return { prompt: fallback, diagnostics: diag };
}

async function ensureBobPrompt() {
  if (_bobPromptCache) return { prompt: _bobPromptCache, diagnostics: _bobPromptDiag };
  const loaded = await loadBobPrompt();
  _bobPromptCache = loaded.prompt;
  _bobPromptDiag = loaded.diagnostics;
  console.info('[rag_chatbot] Bob prompt source diagnostics:', JSON.stringify(_bobPromptDiag));
  return { prompt: _bobPromptCache, diagnostics: _bobPromptDiag };
}

// Example usage inside your handler (replace any fs.readFileSync(...) for bob-system.md):
// const { prompt: BOB_PROMPT, diagnostics } = await ensureBobPrompt();

// Export final unique du handler — référence la fonction interne définie plus haut.
export const handler = handlerInternal;

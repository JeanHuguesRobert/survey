import { OpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { InferenceClient } from "@huggingface/inference";
import fs from "node:fs";
import path from "node:path";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

async function getSystemPrompt() {
  let basePrompt = "";

  // 1. Variable d'environnement directe
  if (process.env.HF_SYSTEM_PROMPT) {
    basePrompt = process.env.HF_SYSTEM_PROMPT;
  } else {
    // 2. Fichier externe
    const promptPath =
      process.env.HF_SYSTEM_PROMPT_PATH ||
      path.resolve("public", "prompts", "bob-system.md");

    try {
      const content = fs.readFileSync(promptPath, "utf-8").trim();
      if (content) basePrompt = content;
    } catch (readError) {
      console.warn(
        `[System] Impossible de lire le prompt système (${promptPath}) : ${readError.message}`
      );
    }
  }

  // 3. Fallback par défaut si aucun prompt n'a été trouvé
  if (!basePrompt) {
    const city = process.env.CITY_NAME || "Corte";
    const movement = process.env.MOVEMENT_NAME || "Pertitellu";
    const party = process.env.PARTY_NAME || "Petit Parti";
    const bot = process.env.BOT_NAME || "Ophélia";
    const hashtag = process.env.HASHTAG || "#PERTITELLU";

    basePrompt = `Tu es l'assistant citoyen ${bot} du mouvement/parti ${movement} (${party}) ${hashtag} pour la commune de ${city}. Réponds uniquement en français, de façon factuelle, concise et structurée en Markdown (titres, listes, tableaux, liens) en citant les ressources officielles pertinentes quand c'est possible.`;
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

  return basePrompt;
}

// ============================================================================
// ANTHROPIC (Claude)
// ============================================================================

async function runAnthropicAgent({ question, systemPrompt }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY manquant");
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

  console.log(`[Anthropic] Démarrage avec modèle: ${model}`);

  const client = new Anthropic({ apiKey }); // Initialisation du client Anthropic

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    temperature: 0.3,
    system: systemPrompt,
    messages: [
      { role: "user", content: question },
    ],
  });

  const fullResponse = response.content[0].text;

  return {
    answer: fullResponse,
    provider: "anthropic",
    model,
  };
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
  const apiKey = process.env.HF_TOKEN; // Correction ici
  if (!apiKey) {
    throw new Error("HF_API_KEY manquant");
  }

  const model = process.env.HF_MODEL || "HuggingFaceH4/zephyr-7b-beta";

  console.log(`[HuggingFace] Démarrage avec modèle: ${model}`);

  const client = new HfInference(apiKey);

  const formattedPrompt = `<|system|>${systemPrompt}</s><|user|>${question}</s><|assistant|>`;

  const response = await client.textGeneration({
    model,
    inputs: formattedPrompt,
    parameters: {
      max_new_tokens: 4096,
      temperature: 0.3,
      return_full_text: false,
    },
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
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
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

    const systemPrompt = await getSystemPrompt();
    const fallbackChain = buildFallbackChain();

    if (fallbackChain.length === 0) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error:
            "Aucun provider configuré. Définissez au moins une clé API (ANTHROPIC_API_KEY, OPENAI_API_KEY, ou HF_TOKEN).",
        }),
      };
    }

    console.log(
      `[Main] Chaîne de fallback: ${fallbackChain.map((f) => `${f.provider}/${f.model}`).join(" → ")}`
    );

    let finalAnswer = "";
    let finalProvider = "";
    let finalModel = "";
    const attempts = [];
    const debugTrace = [];

    for (const { provider, model, executor } of fallbackChain) {
      const attemptStart = Date.now();
      debugTrace.push({
        provider,
        model,
        status: "attempting",
        timestamp: new Date().toISOString(),
        startTime: attemptStart,
      });

      try {
        const { answer, provider: p, model: m } = await executor({
          question,
          systemPrompt,
          provider,
          model,
        });

        const attemptEnd = Date.now();
        const duration = attemptEnd - attemptStart;

        debugTrace[debugTrace.length - 1] = {
          ...debugTrace[debugTrace.length - 1],
          status: "success",
          duration,
          endTime: attemptEnd,
        };

        finalAnswer = answer;
        finalProvider = p;
        finalModel = m;
        break; // Exit after first successful executor
      } catch (err) {
        const attemptEnd = Date.now();
        const duration = attemptEnd - attemptStart;

        debugTrace[debugTrace.length - 1] = {
          ...debugTrace[debugTrace.length - 1],
          status: "error",
          duration,
          endTime: attemptEnd,
          error: err.message,
        };

        attempts.push({
          provider,
          model,
          message: err.message,
        });
        // Continue to next fallback if error
      }
    }

    if (!finalAnswer) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Échec de traitement de la demande. Aucune réponse valide reçue des modèles.",
          attempts,
          debugTrace,
        }),
      };
    }

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
    console.error(`[Main] Erreur globale: ${err.message}`);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}

// si globalThis.fetch n'existe pas, on fera un import dynamique plus bas dans ensureBobPrompt()
let _bobPromptCache = null;
let _bobPromptDiag = null;

function tryReadFileSync(filePath) {
  try {
    const txt = fs.readFileSync(filePath, 'utf8');
    return { ok: true, text: txt };
  } catch (e) {
    return { ok: false, err: e };
  }
}

async function loadBobPrompt() {
  const diag = { tried: [], cwd: process.cwd(), timestamp: new Date().toISOString() };

  // 1) env variable (fast)
  if (process.env.BOB_PROMPT && String(process.env.BOB_PROMPT).trim()) {
    diag.tried.push({ source: 'env', note: 'BOB_PROMPT' });
    _bobPromptDiag = diag;
    return { prompt: String(process.env.BOB_PROMPT), diagnostics: diag };
  }

  // 2) candidate filesystem paths (multi-location)
  const candidates = [
    path.join(process.cwd(), 'public', 'prompts', 'bob-system.md'),
    path.join(process.cwd(), 'public', 'prompts', 'bob.md'),
    path.join(process.cwd(), 'public', 'prompts', 'bob-system.txt'),
    path.join(process.cwd(), 'public', 'docs', 'bob_prompt.md'),
    path.join(process.cwd(), 'public', 'docs', 'bob-system.md'),
    path.join(process.cwd(), 'public', 'bob-system.md'),
    path.join(process.cwd(), 'prompts', 'bob-system.md'), // alternate
  ];

  for (const p of candidates) {
    diag.tried.push({ source: 'fs', path: p });
    const res = tryReadFileSync(p);
    if (res.ok && res.text && res.text.trim().length > 0) {
      diag.found = { path: p, size: res.text.length };
      _bobPromptDiag = diag;
      return { prompt: res.text, diagnostics: diag };
    }
    if (!res.ok) {
      diag[`err_${path.basename(p)}`] = String(res.err.code || res.err.message || res.err);
    }
  }

  // 3) remote URL (publicly served file)
  const url = process.env.BOB_PROMPT_URL || (process.env.SITE_BASE_URL ? `${String(process.env.SITE_BASE_URL).replace(/\/$/,'')}/prompts/bob-system.md` : null);
  if (url) {
    diag.tried.push({ source: 'http', url });
    try {
      const r = await fetch(url);
      if (r.ok) {
        const text = await r.text();
        if (text && text.trim().length > 0) {
          diag.found = { url, size: text.length };
          _bobPromptDiag = diag;
          return { prompt: text, diagnostics: diag };
        }
        diag.http_empty = true;
      } else {
        diag.http_status = r.status;
      }
    } catch (e) {
      diag.http_err = String(e.message || e);
    }
  }

  // 4) fallback default
  diag.tried.push({ source: 'fallback', note: 'using default inline prompt' });
  const fallback = process.env.BOB_PROMPT_FALLBACK || `Bonjour, je suis l'IA civique. Posez votre question.`;
  _bobPromptDiag = diag;
  return { prompt: fallback, diagnostics: diag };
}

async function ensureBobPrompt() {
  if (_bobPromptCache) return { prompt: _bobPromptCache, diagnostics: _bobPromptDiag };
  const loaded = await loadBobPrompt();
  _bobPromptCache = loaded.prompt;
  _bobPromptDiag = loaded.diagnostics;
  // log summary (do not leak sensitive content)
  console.info('[rag_chatbot] Bob prompt source diagnostics:', JSON.stringify(_bobPromptDiag, null, 2));
  return { prompt: _bobPromptCache, diagnostics: _bobPromptDiag };
}

// Export final unique du handler — référence la fonction interne définie plus haut.
export const handler = handlerInternal;

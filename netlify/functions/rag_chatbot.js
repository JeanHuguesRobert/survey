import Anthropic from "@anthropic-ai/sdk";
import { InferenceClient } from "@huggingface/inference";
import fs from "fs";
import path from "path";

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

function getSystemPrompt() {
  // 1. Variable d'environnement directe
  if (process.env.HF_SYSTEM_PROMPT) {
    return process.env.HF_SYSTEM_PROMPT;
  }

  // 2. Fichier externe
  const promptPath =
    process.env.HF_SYSTEM_PROMPT_PATH ||
    path.resolve("public", "prompts", "bob-system.md");

  try {
    const content = fs.readFileSync(promptPath, "utf-8").trim();
    if (content) return content;
  } catch (readError) {
    console.warn(
      `[System] Impossible de lire le prompt système (${promptPath}) : ${readError.message}`
    );
  }

  // 3. Fallback par défaut
  const city = process.env.CITY_NAME || "Corte";
  const movement = process.env.MOVEMENT_NAME || "Pertitellu";
  const party = process.env.PARTY_NAME || "Petit Parti";
  const bot = process.env.BOT_NAME || "Ophélia";
  const hashtag = process.env.HASHTAG || "#PERTITELLU";

  return `Tu es l'assistant citoyen ${bot} du mouvement/parti ${movement} (${party}) ${hashtag} pour la commune de ${city}. Réponds uniquement en français, de façon factuelle, concise et structurée en Markdown (titres, listes, tableaux, liens) en citant les ressources officielles pertinentes quand c'est possible.`;
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

  const client = new Anthropic({ apiKey });

  let fullResponse = "";

  const stream = await client.messages.stream({
    model,
    max_tokens: 4096,
    temperature: 0.3,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: question,
      },
    ],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullResponse += event.delta.text;
    }
  }

  console.log(`[Anthropic] Réponse générée (${fullResponse.length} chars)`);

  return {
    answer: fullResponse.trim(),
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

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  let fullResponse = "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter((line) => line.trim() !== "");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") break;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullResponse += content;
          }
        } catch (e) {
          // Ignorer les lignes mal formées
        }
      }
    }
  }

  console.log(`[OpenAI] Réponse générée (${fullResponse.length} chars)`);

  return {
    answer: fullResponse.trim(),
    provider: "openai",
    model,
  };
}

// ============================================================================
// HUGGING FACE
// ============================================================================

async function runHuggingFaceAgent({ question, systemPrompt, provider, model }) {
  const apiKey = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error("HF_TOKEN manquant");
  }

  console.log(`[HuggingFace] Démarrage provider="${provider}" model="${model}"`);

  const client = new InferenceClient(apiKey);

  let fullResponse = "";

  const stream = client.chatCompletionStream({
    provider,
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ],
  });

  for await (const chunk of stream) {
    const delta = chunk?.choices?.[0]?.delta?.content;
    if (delta) {
      fullResponse += delta;
    }
  }

  console.log(`[HuggingFace] Réponse générée (${fullResponse.length} chars)`);

  return {
    answer: fullResponse.trim(),
    provider,
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

export const handler = async (event) => {
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

    const systemPrompt = getSystemPrompt();
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

    const attempts = [];
    const debugTrace = [];

    for (const { provider, model, executor } of fallbackChain) {
      const attemptStart = Date.now();

      console.log(`[Main] Tentative: ${provider}/${model}`);
      debugTrace.push({
        provider,
        model,
        status: "attempting",
        timestamp: new Date().toISOString(),
        startTime: attemptStart,
      });

      try {
        const result = await executor({ question, systemPrompt, provider, model });

        const attemptEnd = Date.now();
        const duration = attemptEnd - attemptStart;

        console.log(`[Main] ✅ Succès avec ${provider}/${model} en ${duration}ms`);

        debugTrace[debugTrace.length - 1] = {
          ...debugTrace[debugTrace.length - 1],
          status: "success",
          duration,
          endTime: attemptEnd,
        };

        return {
          statusCode: 200,
          body: JSON.stringify({
            answer: result.answer,
            sources: [],
            cached: false,
            provider: result.provider,
            model: result.model,
            debugTrace,
          }),
        };
      } catch (err) {
        const attemptEnd = Date.now();
        const duration = attemptEnd - attemptStart;

        console.error(`[Main] ❌ Échec ${provider}/${model}: ${err.message}`);

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
      }
    }

    // Échec total
    return {
      statusCode: 500,
      body: JSON.stringify({
        error:
          "Échec de traitement de la demande. Aucune réponse valide reçue des modèles.",
        attempts,
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
};

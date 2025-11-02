import { InferenceClient } from "@huggingface/inference";
import fs from "fs";
import path from "path";

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

// détection : est-ce qu'on vise un modèle OpenAI/GPT
function isGPTModel(provider, model) {
  if (!model) return false;
  const m = String(model).toLowerCase();
  if (provider === "openai") return true;
  return (
    m.startsWith("gpt-") ||
    m.includes("gpt-4o") ||
    m.includes("gpt-4.1") ||
    m.startsWith("o1") ||
    m.startsWith("o3")
  );
}

// branche OpenAI complète (modération → routage → modèle final)
async function runOpenAIAgent({ question, systemPrompt }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error:
          "OPENAI_API_KEY manquant. Définissez-le dans l’environnement pour activer le mode GPT.",
      }),
    };
  }

  // 1. modération
  const moderationModel =
    process.env.OPENAI_MODERATION_MODEL || "omni-moderation-latest";

  const modRes = await fetch(`${OPENAI_BASE_URL}/moderations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: moderationModel,
      input: question.slice(0, 4000),
    }),
  });

  const modData = await modRes.json();
  const flagged = modData && modData.results && modData.results[0] && modData.results[0].flagged;
  if (flagged) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Contenu refusé par la modération OpenAI.",
        categories: modData.results[0].categories,
      }),
    };
  }

  // 2. routage léger/lourd
  const smallModel = process.env.OPENAI_SMALL_MODEL || "gpt-4.1-mini";

  const routerRes = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: smallModel,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Vous êtes un routeur pour un assistant de participation citoyenne communal. Vous recevez la question d’un habitant. Répondez UNIQUEMENT en JSON minifié de la forme {"mode":"léger|lourd","justification":"..."} ; mettez "lourd" dès qu’il y a rédaction officielle, compte rendu, ou explication longue.',
        },
        { role: "user", content: question },
      ],
    }),
  });

  const routerJson = await routerRes.json();
  const routerContent =
    routerJson &&
    routerJson.choices &&
    routerJson.choices[0] &&
    routerJson.choices[0].message &&
    routerJson.choices[0].message.content
      ? routerJson.choices[0].message.content
      : '{"mode":"léger"}';

  let mode = "léger";
  try {
    const parsed = JSON.parse(routerContent);
    mode = parsed.mode || "léger";
  } catch (e) {
    mode = "léger";
  }

  // 3. modèle final
  const finalModel =
    mode === "lourd"
      ? process.env.OPENAI_HEAVY_MODEL || "gpt-4.1"
      : smallModel;

  const answerRes = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: finalModel,
      temperature: mode === "lourd" ? 0.2 : 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    }),
  });

  const answerJson = await answerRes.json();
  const answer =
    answerJson &&
    answerJson.choices &&
    answerJson.choices[0] &&
    answerJson.choices[0].message &&
    answerJson.choices[0].message.content
      ? answerJson.choices[0].message.content.trim()
      : "Je n’ai pas trouvé de réponse.";

  return {
    statusCode: 200,
    body: JSON.stringify({
      answer,
      sources: [],
      cached: false,
      provider: "openai",
      model: finalModel,
      mode,
    }),
  };
}

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

    const hfApiKey = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    if (!hfApiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error:
            "HF_TOKEN manquant. Définissez-le dans Netlify (ou utilisez HUGGINGFACE_API_KEY).",
        }),
      };
    }

    const modelAliases = {
      "mistral-7b-instruct-v0.1": "mistralai/Mistral-7B-Instruct-v0.1",
      "mistral-7b-instruct-v0.2": "mistralai/Mistral-7B-Instruct-v0.2",
      "mistral-large-2": "mistralai/Mistral-Large-Instruct",
      "mixtral-8x7b-instruct": "mistralai/Mixtral-8x7B-Instruct-v0.1",
      "llama-3-8b-instruct": "meta-llama/Meta-Llama-3-8B-Instruct",
      "llama-3-70b-instruct": "meta-llama/Meta-Llama-3-70B-Instruct",
    };
    const resolveModel = (alias) => modelAliases[alias] || alias;

    const requestedProvider = process.env.HF_CHAT_PROVIDER || "hf-inference";
    const requestedModel =
      resolveModel(
        process.env.HF_CHAT_MODEL || "meta-llama/Meta-Llama-3-8B-Instruct"
      );

    // on ajoute OpenAI en premier seulement s’il y a une clé
    const fallbacks = [
      ...(process.env.OPENAI_API_KEY
        ? [
            {
              provider: "openai",
              model: process.env.OPENAI_SMALL_MODEL || "gpt-4.1-mini",
            },
          ]
        : []),
      { provider: requestedProvider, model: requestedModel },
      {
        provider: "hf-inference",
        model: resolveModel("meta-llama/Meta-Llama-3-8B-Instruct"),
      },
      { provider: "together", model: resolveModel("mixtral-8x7b-instruct") },
      { provider: "together", model: resolveModel("llama-3-8b-instruct") },
      { provider: "groq", model: "groq/llama3-8b-8192" },
    ].filter((pair, index, arr) => {
      if (!pair.provider || !pair.model) return false;
      const firstIndex = arr.findIndex(
        (other) =>
          other.provider === pair.provider && other.model === pair.model
      );
      return index === firstIndex;
    });

    if (fallbacks.length === 0) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error:
            "Aucun couple provider/modèle disponible. Configurez HF_CHAT_PROVIDER et HF_CHAT_MODEL ou activez un provider dans Hugging Face.",
        }),
      };
    }

    const systemPrompt = (() => {
      if (process.env.HF_SYSTEM_PROMPT) return process.env.HF_SYSTEM_PROMPT;

      const promptPath =
        process.env.HF_SYSTEM_PROMPT_PATH ||
        path.resolve("public", "prompts", "bob-system.md");

      try {
        const content = fs.readFileSync(promptPath, "utf-8").trim();
        if (content) return content;
      } catch (readError) {
        console.warn(
          `[HF] Impossible de lire le prompt système (${promptPath}) : ${readError.message}`
        );
      }

      const city = process.env.CITY_NAME || "Corte";
      const movement = process.env.MOVEMENT_NAME || "Pertitellu";
      const party = process.env.PARTY_NAME || "Petit Parti";
      const bot = process.env.BOT_NAME || "Ophélie";
      const hashtag = process.env.HASHTAG || "#PERTITELLU";

      return `Tu es l’assistant citoyen ${bot} du mouvement/parti ${movement} (${party}) ${hashtag} pour la commune de ${city}. Réponds uniquement en français, de façon factuelle, concise et structurée en Markdown (titres, listes, tableaux, liens) en citant les ressources officielles pertinentes quand c’est possible.`;
    })();

    const client = new InferenceClient(hfApiKey);
    const attempts = [];

    for (const { provider, model } of fallbacks) {
      console.info(`[HF] tentative provider="${provider}" model="${model}"`);
      try {
        // branche GPT → OpenAI direct
        if (isGPTModel(provider, model) && process.env.OPENAI_API_KEY) {
          return await runOpenAIAgent({ question, systemPrompt });
        }

        // branche Hugging Face inchangée
        let out = "";
        const stream = client.chatCompletionStream({
          provider,
          model,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: question,
            },
          ],
        });

        for await (const chunk of stream) {
          const delta =
            chunk &&
            chunk.choices &&
            chunk.choices[0] &&
            chunk.choices[0].delta &&
            chunk.choices[0].delta.content
              ? chunk.choices[0].delta.content
              : "";
          if (delta) out += delta;
        }

        const answer =
          out.trim() || "Je n'ai pas trouvé de réponse à votre question.";
        const sources = [];
        const cached = false;

        console.info(
          `[HF] réponse générée par provider="${provider}" model="${model}"`
        );
        return {
          statusCode: 200,
          body: JSON.stringify({ answer, sources, cached, provider, model }),
        };
      } catch (streamError) {
        console.error(
          `Erreur Hugging Face (${provider}/${model}):`,
          streamError
        );
        const message =
          (streamError && streamError.message) ||
          "Provider ou modèle indisponible.";
        const hint = message.includes("Repository not found")
          ? "Vérifiez l’identifiant complet du modèle (ex. `mistralai/Mistral-7B-Instruct-v0.1`) et l’accès du provider."
          : message.includes("inference provider information")
          ? "Activez ce provider dans https://huggingface.co/settings/inference-providers ou utilisez un provider que vous avez relié."
          : undefined;

        attempts.push({
          provider,
          model,
          message,
          ...(hint ? { hint } : {}),
        });
      }
    }

    return {
      statusCode: 502,
      body: JSON.stringify({
        error:
          "Aucun provider/modèle n’a pu répondre. Configurez un provider depuis Hugging Face ou fournissez HF_CHAT_PROVIDER / HF_CHAT_MODEL.",
        attempts,
      }),
    };
  } catch (error) {
    console.error("Erreur lors du traitement de la requête :", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: (error && error.message) || "Erreur interne du serveur.",
      }),
    };
  }
};

import { InferenceClient } from "@huggingface/inference";
import fs from "fs";
import path from "path";

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Méthode non autorisée. Utilisez POST.' }),
    };
  }

  try {
    const { question, user_id, settings } = JSON.parse(event.body);

    if (!question) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'La question est requise.' }),
      };
    }

    const apiKey = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'HF_TOKEN manquant. Définissez-le dans Netlify (ou utilisez HUGGINGFACE_API_KEY).' }),
      };
    }

    const modelAliases = {
      "mistral-7b-instruct-v0.1": "mistralai/Mistral-7B-Instruct-v0.1",
      "mistral-7b-instruct-v0.2": "mistralai/Mistral-7B-Instruct-v0.2",
      "mistral-large-2": "mistralai/Mistral-Large-Instruct",
      "mixtral-8x7b-instruct": "mistralai/Mixtral-8x7B-Instruct-v0.1",
      "llama-3-8b-instruct": "meta-llama/Meta-Llama-3-8B-Instruct",
      "llama-3-70b-instruct": "meta-llama/Meta-Llama-3-70B-Instruct"
    };
    const resolveModel = (alias) => modelAliases[alias] || alias;

    const requestedProvider = process.env.HF_CHAT_PROVIDER || "hf-inference";
    const requestedModel = resolveModel(process.env.HF_CHAT_MODEL || "meta-llama/Meta-Llama-3-8B-Instruct");

    const fallbacks = [
      { provider: requestedProvider, model: requestedModel },
      { provider: "hf-inference", model: resolveModel("meta-llama/Meta-Llama-3-8B-Instruct") },
      { provider: "together", model: resolveModel("mixtral-8x7b-instruct") },
      { provider: "together", model: resolveModel("llama-3-8b-instruct") },
      { provider: "groq", model: "groq/llama3-8b-8192" }
    ].filter((pair, index, arr) =>
      pair.provider && pair.model &&
      index === arr.findIndex(other => other.provider === pair.provider && other.model === pair.model)
    );

    if (fallbacks.length === 0) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Aucun couple provider/modèle disponible. Configurez HF_CHAT_PROVIDER et HF_CHAT_MODEL ou activez un provider dans Hugging Face."
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
        console.warn(`[HF] Impossible de lire le prompt système (${promptPath}) : ${readError.message}`);
      }

      return "Tu es l’assistant citoyen Pertitellu du Petit Parti pour la ville de Corte (Corse). Réponds uniquement en français, de façon factuelle, concise et structurée en Markdown (titres, listes, tableaux, liens) en citant les ressources officielles pertinentes quand c’est possible.";
    })();

    const client = new InferenceClient(apiKey);
    const attempts = [];

    for (const { provider, model } of fallbacks) {
      console.info(`[HF] tentative provider="${provider}" model="${model}"`);
      try {
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
          const delta = chunk?.choices?.[0]?.delta?.content;
          if (delta) out += delta;
        }

        const answer = out.trim() || "Je n'ai pas trouvé de réponse à votre question.";
        const sources = [];
        const cached = false;

        console.info(`[HF] réponse générée par provider="${provider}" model="${model}"`);
        console.info(`[HF] provider retenu="${provider}" model retenu="${model}"`);
        return {
          statusCode: 200,
          body: JSON.stringify({ answer, sources, cached, provider, model }),
        };
      } catch (streamError) {
        console.error(`Erreur Hugging Face (${provider}/${model}):`, streamError);
        const message = streamError?.message || 'Provider ou modèle indisponible.';
        const hint =
          message.includes('Repository not found')
            ? "Vérifiez l’identifiant complet du modèle (ex. `mistralai/Mistral-7B-Instruct-v0.1`) et l’accès du provider."
            : message.includes('inference provider information')
              ? "Activez ce provider dans https://huggingface.co/settings/inference-providers ou utilisez un provider que vous avez relié."
              : undefined;

        attempts.push({
          provider,
          model,
          message,
          ...(hint ? { hint } : {})
        });
      }
    }

    return {
      statusCode: 502,
      body: JSON.stringify({
        error: "Aucun provider/modèle n’a pu répondre. Configurez un provider depuis Hugging Face ou fournissez HF_CHAT_PROVIDER / HF_CHAT_MODEL.",
        attempts
      }),
    };
  } catch (error) {
    console.error('Erreur lors du traitement de la requête :', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error?.message || 'Erreur interne du serveur.' }),
    };
  }
};

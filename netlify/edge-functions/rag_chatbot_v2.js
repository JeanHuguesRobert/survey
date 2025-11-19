// ============================================================================
// RAG CHATBOT - HANDLER PRINCIPAL (VERSION MODULAIRE)
// ============================================================================

// Imports des modules
import { MistralProvider } from './lib/providers/mistral.js';
import { OpenAIProvider } from './lib/providers/openai.js';
import { AnthropicProvider } from './lib/providers/anthropic.js';
import { HuggingFaceProvider } from './lib/providers/huggingface.js';
import { GrokProvider } from './lib/providers/grok.js';
import { GeminiProvider } from './lib/providers/gemini.js';
import { getSystemPrompt } from './lib/utils/system-prompt.js';
import { formatProvidersStatusSSE, generateProvidersStatus }
    from './lib/utils/provider-status.js';
import { resolveModelForProvider } from './lib/utils/model-resolver.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROVIDER_META_PREFIX = "__PROVIDER_INFO__";
const PROVIDERS = ["openai", "gemini", "grok", "mistral", "anthropic", "huggingface"];

// Directives regex
const MODEL_MODE_DIRECTIVE_REGEX = /model_mode\s*=\s*([^\s;]+)/i;
const MODEL_DIRECTIVE_REGEX = /model\s*=\s*([^\s;]+)/i;
const PROVIDER_DIRECTIVE_REGEX = /provider\s*=\s*(anthropic|openai|huggingface|mistral|grok|gemini)/i;
const MODE_DIRECTIVE_REGEX = /mode\s*=\s*(debug)/i;

// Patterns pour détecter le provider depuis le nom du modèle
const MODEL_PROVIDER_PATTERNS = {
    anthropic: ["claude", "anthropic"],
    openai: ["gpt-", "gpt", "openai", "oai"],
    mistral: ["mistral"],
    huggingface: ["huggingface", "hf"],
    grok: ["grok"],
    gemini: ["gemini"]
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse les directives utilisateur (model=, provider=, etc.)
 */
function parseDirectives(rawQuestion = "") {
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
        directiveModel: modelMatch ? modelMatch[1].toLowerCase() : null
    };
}

/**
 * Détecte le provider depuis le nom du modèle
 */
function detectModelProvider(model) {
    if (!model) return null;
    const target = model.toLowerCase();
    return PROVIDERS.find(provider =>
        MODEL_PROVIDER_PATTERNS[provider]?.some(pattern => target.includes(pattern))
    );
}

/**
 * Construit l'ordre des providers à essayer
 */
function buildProviderOrder(modelProvider, failedProviders = new Set()) {
    const order = [...PROVIDERS];
    if (modelProvider && order.includes(modelProvider)) {
        return [modelProvider, ...order.filter(p => p !== modelProvider)];
    }
    // Prioriser OpenAI si non échoué
    if (!failedProviders.has("openai") && order.includes("openai")) {
        return ["openai", ...order.filter(p => p !== "openai")];
    }
    return order;
}

/**
 * Mélange l'ordre des providers (randomisation)
 * Garde le premier provider (OpenAI) en première position
 */
function shuffleProviders(providers) {
    if (providers.length <= 1) return providers;

    const first = providers[0];  // OpenAI
    const rest = providers.slice(1);

    // Shuffle le reste
    for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
    }

    return [first, ...rest];
}

/**
 * Vérifie si une erreur est une erreur de capacité Mistral
 */
function isMistralCapacityError(error) {
    const msg = error?.message || "";
    return /service_tier_capacity_exceeded|capacity|3505|429/i.test(msg);
}

/**
 * Vérifie si une erreur est une rate limit error
 */
function isRateLimitError(error) {
    const msg = error?.message || "";
    return /rate.?limit|429/i.test(msg) && /tokens?|requests?/i.test(msg);
}

/**
 * Parse le retry-after depuis le message d'erreur
 */
function parseRetryAfter(errorMessage) {
    const match = errorMessage.match(/Please try again in (\d+(?:\.\d+)?)s/);
    return match ? parseFloat(match[1]) * 1000 : 5000;
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

const handler = async (request) => {

    // Health check mode - retourner juste le statut du cache
    const url = new URL(request.url);
    if (url.searchParams.get('healthcheck') === 'true') {
        const providers = {
            mistral: new MistralProvider(Deno.env.get("MISTRAL_API_KEY")),
            anthropic: new AnthropicProvider(Deno.env.get("ANTHROPIC_API_KEY")),
            openai: new OpenAIProvider(Deno.env.get("OPENAI_API_KEY")),
            huggingface: new HuggingFaceProvider(Deno.env.get("HUGGINGFACE_API_KEY")),
            grok: new GrokProvider(Deno.env.get("GROK_API_KEY")),
            gemini: new GeminiProvider(Deno.env.get("GEMINI_API_KEY"))
        };

        const status = generateProvidersStatus(providers);
        return new Response(JSON.stringify({ providers: status }), {
            headers: { 'Content-Type': 'application/json' }
        });
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

    // 3. Valide la question
    const rawQuestion = String(body?.question || "").trim();
    if (!rawQuestion) {
        return new Response("Question manquante", { status: 400 });
    }

    // 4. Récupère l'historique de conversation
    const conversation_history = Array.isArray(body?.conversation_history)
        ? body.conversation_history
        : [];

    // 5. Parse les directives
    const {
        rawDirective,
        userQuestion,
        directiveModelMode,
        directiveProvider,
        directiveModel
    } = parseDirectives(rawQuestion);

    const bodyModelMode = typeof body?.modelMode === 'string'
        ? body.modelMode.trim().toLowerCase()
        : null;
    const effectiveModelMode = directiveModelMode || bodyModelMode;

    // 6. Détermine le provider
    let forcedProvider = directiveProvider;
    let modelProvider = directiveModel ? detectModelProvider(directiveModel) : null;
    const enforcedProvider = forcedProvider || modelProvider;

    // 7. Détermine l'ordre des providers
    const failedProviders = new Set();
    const SHOULD_RANDOMIZE_PROVIDERS = Deno.env.get("DISABLE_PROVIDER_RANDOMIZATION") !== "1";
    let providerOrder = buildProviderOrder(enforcedProvider, failedProviders);
    if (!enforcedProvider && SHOULD_RANDOMIZE_PROVIDERS) {
        providerOrder = shuffleProviders(providerOrder);
    }

    console.log(`[EdgeFunction] ========================================`);
    console.log(`[EdgeFunction] 🎯 Question: "${rawQuestion}"`);
    console.log(`[EdgeFunction] 📚 Historique: ${conversation_history.length} messages`);
    console.log(`[EdgeFunction] 🔧 Provider order: ${providerOrder.join(",")}`);

    // 8. Charge le prompt système
    const systemPrompt = await getSystemPrompt();
    console.log(`[EdgeFunction] 📏 System prompt: ${systemPrompt.length} caractères`);

    // 9. Construit les messages
    const messages = [
        { role: "system", content: systemPrompt },
        ...conversation_history,
        { role: "user", content: userQuestion }
    ];

    // 10. Initialize providers
    const providers = {
        mistral: new MistralProvider(Deno.env.get("MISTRAL_API_KEY")),
        openai: new OpenAIProvider(Deno.env.get("OPENAI_API_KEY")),
        anthropic: new AnthropicProvider(Deno.env.get("ANTHROPIC_API_KEY")),
        huggingface: new HuggingFaceProvider(Deno.env.get("HUGGINGFACE_API_KEY")),
        grok: new GrokProvider(Deno.env.get("GROK_API_KEY")),
        gemini: new GeminiProvider(Deno.env.get("GEMINI_API_KEY"))
    };

    // 11. Crée le stream de réponse
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
        async start(controller) {
            const emitProviderMeta = (meta) =>
                controller.enqueue(encoder.encode(`${PROVIDER_META_PREFIX}${JSON.stringify(meta)}\n`));

            const errorPrefix = "❌ [ERREUR] ";
            let handled = false;
            let lastError = null;

            // Émettre le statut des providers au début du stream
            const providersStatus = formatProvidersStatusSSE(providers);
            controller.enqueue(encoder.encode(providersStatus));

            // 12. Essaie chaque provider dans l'ordre
            for (const providerName of providerOrder) {
                const provider = providers[providerName];

                // Skip si le provider n'est pas disponible
                if (!provider.isAvailable()) {
                    console.log(`[EdgeFunction] ⏭️ Skipping ${providerName} (no API key)`);
                    continue;
                }

                let retries = 0;
                const maxRetries = 2;

                while (retries <= maxRetries) {
                    try {
                        // Résoudre le modèle qui sera utilisé
                        const resolvedModel = resolveModelForProvider(providerName, effectiveModelMode) || provider.config.defaultModel;

                        emitProviderMeta({ provider: providerName, model: resolvedModel });
                        console.log(`[EdgeFunction] 🚀 Trying ${providerName} with model ${resolvedModel}...`);

                        for await (const chunk of provider.chat({
                            messages,
                            maxToolCalls: 2,
                            modelMode: effectiveModelMode,
                            question: userQuestion
                        })) {
                            controller.enqueue(encoder.encode(chunk));
                        }

                        handled = true;

                        // ✅ Ré-émettre le statut des providers avec métriques à jour
                        const updatedStatus = formatProvidersStatusSSE(providers);
                        controller.enqueue(encoder.encode(updatedStatus));

                        break;

                    } catch (error) {
                        const isForcedProvider = forcedProvider === providerName;
                        const capacityError = providerName === "mistral" && isMistralCapacityError(error);
                        const rateLimitError = providerName === "openai" && isRateLimitError(error);

                        if (capacityError && !isForcedProvider) {
                            const fallbackMessage = `${errorPrefix}${providerName} indisponible (crédit/limite atteinte). Tentative avec un autre fournisseur...\n\n`;
                            console.warn(`[EdgeFunction] ⚠️ ${providerName} capacity error, trying next provider`);
                            controller.enqueue(encoder.encode(fallbackMessage));
                            failedProviders.add(providerName);
                            break;
                        } else if (rateLimitError && retries < maxRetries) {
                            const delayMs = parseRetryAfter(error.message);
                            console.warn(`[EdgeFunction] ⏳ ${providerName} rate limit, retrying in ${delayMs}ms (attempt ${retries + 1}/${maxRetries + 1})`);
                            await new Promise(resolve => setTimeout(resolve, delayMs));
                            retries++;
                            continue;
                        } else {
                            lastError = error;
                            const errorMessage = `${errorPrefix}${providerName} a échoué: ${error.message}\n\n`;
                            console.error(errorMessage, error.stack);
                            controller.enqueue(encoder.encode(errorMessage));
                            failedProviders.add(providerName);
                            break;
                        }
                    }
                }

                if (handled) break;
            }

            // 13. Gestion finale
            if (!handled) {
                const message = lastError?.message || "Aucun fournisseur disponible.";
                controller.enqueue(encoder.encode(`${errorPrefix}${message}\n\n`));
            }

            controller.close();
        }
    });

    // 14. Retourne la réponse streamée
    return new Response(readable, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff"
        }
    });
};

export default handler;
export const config = { path: "/api/chat-stream-v2" };

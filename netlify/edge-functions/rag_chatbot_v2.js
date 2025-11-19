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
 * Utilise les métriques pour prioriser les providers performants
 */
function buildProviderOrder(modelProvider, failedProviders = new Set(), providersStatus = null) {
    const order = [...PROVIDERS];
    
    // Si un provider spécifique est demandé, le mettre en premier
    if (modelProvider && order.includes(modelProvider)) {
        return [modelProvider, ...order.filter(p => p !== modelProvider)];
    }
    
    // Si on a des métriques, trier par performance
    if (providersStatus?.providers) {
        const scored = order.map(name => {
            const providerData = providersStatus.providers.find(p => p.name === name);
            if (!providerData || providerData.status === 'not_configured') {
                return { name, score: -1000 };
            }
            
            let score = 0;
            
            // Pénalités selon le statut
            if (providerData.status === 'rate_limited') score -= 500;
            else if (providerData.status === 'degraded') score -= 200;
            else if (providerData.status === 'available') score += 300;
            else if (providerData.status === 'unknown') score += 100;
            
            const mainModel = providerData.models?.[0];
            
            // Bonus pour providers récemment utilisés avec succès
            if (mainModel?.recentlyUsed && mainModel.successRate > 90) {
                score += 200;
            }
            
            // Score basé sur le temps de réponse
            if (mainModel?.avgResponseTime) {
                const avgSeconds = mainModel.avgResponseTime / 1000;
                if (avgSeconds < 2) score += 150;
                else if (avgSeconds < 5) score += 100;
                else if (avgSeconds < 10) score += 50;
                else score -= 50;
            }
            
            // Bonus pour taux de succès élevé
            if (mainModel?.successRate != null) {
                score += Math.floor(mainModel.successRate * 2);
            }
            
            // Pénalité pour erreurs consécutives
            if (mainModel?.consecutiveErrors > 0) {
                score -= mainModel.consecutiveErrors * 50;
            }
            
            // Pénalité si retry_after défini
            if (mainModel?.retryAfter) {
                score -= 300;
            }
            
            // Pénalité si déjà échoué dans cette session
            if (failedProviders.has(name)) {
                score -= 400;
            }
            
            return { name, score };
        });
        
        // Trier par score décroissant
        scored.sort((a, b) => b.score - a.score);
        return scored.map(item => item.name);
    }
    
    // Prioriser OpenAI si non échoué et pas de métriques
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
 * Vérifie si une erreur est une erreur de capacité/quota (pour tous les providers)
 */
function isCapacityError(error) {
    const msg = error?.message || "";
    return /quota.*?exceeded|capacity.*?exceeded|resource.*?exhausted|service_tier_capacity_exceeded|3505/i.test(msg);
}

/**
 * Vérifie si une erreur est une rate limit error (pour tous les providers)
 */
function isRateLimitError(error) {
    const msg = error?.message || "";
    return (/rate.?limit|429/i.test(msg) && /tokens?|requests?/i.test(msg)) 
        || /too.?many.?requests/i.test(msg);
}

/**
 * Vérifie si une erreur est transitoire (5xx, timeout, network)
 */
function isTransientError(error) {
    const msg = error?.message || "";
    return /5\d{2}|timeout|network|ECONNRESET|ETIMEDOUT/i.test(msg);
}

/**
 * Parse le retry-after depuis le message d'erreur (supporte plusieurs formats)
 */
function parseRetryAfter(errorMessage) {
    // Supporte: "Please try again in 5s", "retry in 5s", "wait 5s", etc.
    const match = errorMessage.match(/(?:try.?again|retry|wait).*?(\d+(?:\.\d+)?)\s*s/i);
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

    // 7. Initialize providers
    const providers = {
        mistral: new MistralProvider(Deno.env.get("MISTRAL_API_KEY")),
        openai: new OpenAIProvider(Deno.env.get("OPENAI_API_KEY")),
        anthropic: new AnthropicProvider(Deno.env.get("ANTHROPIC_API_KEY")),
        huggingface: new HuggingFaceProvider(Deno.env.get("HUGGINGFACE_API_KEY")),
        grok: new GrokProvider(Deno.env.get("GROK_API_KEY")),
        gemini: new GeminiProvider(Deno.env.get("GEMINI_API_KEY"))
    };

    // 8. Détermine l'ordre des providers
    const failedProviders = new Set();
    const SHOULD_RANDOMIZE_PROVIDERS = Deno.env.get("DISABLE_PROVIDER_RANDOMIZATION") !== "1";
    
    // Récupérer les métriques pour prioriser les providers
    const providersStatusData = generateProvidersStatus(providers);
    const providersStatus = { providers: providersStatusData };
    
    let providerOrder = buildProviderOrder(enforcedProvider, failedProviders, providersStatus);
    if (!enforcedProvider && SHOULD_RANDOMIZE_PROVIDERS) {
        providerOrder = shuffleProviders(providerOrder);
    }

    console.log(`[EdgeFunction] ========================================`);
    console.log(`[EdgeFunction] 🎯 Question: "${rawQuestion}"`);
    console.log(`[EdgeFunction] 📚 Historique: ${conversation_history.length} messages`);
    console.log(`[EdgeFunction] 🔧 Provider order: ${providerOrder.join(",")}`);

    // 9. Charge le prompt système
    const systemPrompt = await getSystemPrompt();
    console.log(`[EdgeFunction] 📏 System prompt: ${systemPrompt.length} caractères`);

    // 10. Construit les messages
    const messages = [
        { role: "system", content: systemPrompt },
        ...conversation_history,
        { role: "user", content: userQuestion }
    ];

    // 11. Crée le stream de réponse
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
        async start(controller) {
            const emitProviderMeta = (meta) =>
                controller.enqueue(encoder.encode(`${PROVIDER_META_PREFIX}${JSON.stringify(meta)}\n`));

            const errorPrefix = "❌ [ERREUR] ";
            let handled = false;
            let lastError = null;
            let isFirstProvider = true;

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

                        // Émettre message de changement de provider (sauf pour le premier)
                        if (!isFirstProvider) {
                            const switchMessage = `🔄 Bascule vers ${providerName}...\n\n`;
                            controller.enqueue(encoder.encode(switchMessage));
                            console.log(`[EdgeFunction] 🔄 Switching to ${providerName} (model: ${resolvedModel})`);
                        } else {
                            console.log(`[EdgeFunction] 🚀 Starting with ${providerName} (model: ${resolvedModel})`);
                        }
                        
                        isFirstProvider = false;

                        emitProviderMeta({ provider: providerName, model: resolvedModel });

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
                        const capacityError = isCapacityError(error);
                        const rateLimitError = isRateLimitError(error);
                        const transientError = isTransientError(error);

                        // Déterminer le prochain provider disponible
                        const currentIndex = providerOrder.indexOf(providerName);
                        const remainingProviders = providerOrder.slice(currentIndex + 1).filter(
                            p => providers[p].isAvailable() && !failedProviders.has(p)
                        );
                        const nextProvider = remainingProviders[0] || null;

                        // 1. Erreur de capacité/quota -> fallback immédiat
                        if (capacityError) {
                            const fallbackMessage = nextProvider 
                                ? `⚠️ ${providerName} a atteint sa limite de capacité. Bascule vers ${nextProvider}...\n\n`
                                : `${errorPrefix}${providerName} a atteint sa limite de capacité. Aucun autre fournisseur disponible.\n\n`;
                            
                            console.warn(`[EdgeFunction] ⚠️ ${providerName} capacity exceeded:`, {
                                error: error.message,
                                isForcedProvider,
                                nextProvider,
                                remainingProviders: remainingProviders.length
                            });
                            
                            controller.enqueue(encoder.encode(fallbackMessage));
                            failedProviders.add(providerName);
                            break;
                        } 
                        
                        // 2. Rate limit -> retry avec délai
                        else if (rateLimitError && retries < maxRetries) {
                            const delayMs = parseRetryAfter(error.message);
                            const retryMessage = `⏳ ${providerName} rate limit atteint. Nouvelle tentative dans ${Math.ceil(delayMs/1000)}s (${retries + 1}/${maxRetries + 1})...\n\n`;
                            console.warn(`[EdgeFunction] ⏳ ${providerName} rate limit, retrying in ${delayMs}ms (attempt ${retries + 1}/${maxRetries + 1})`);
                            controller.enqueue(encoder.encode(retryMessage));
                            await new Promise(resolve => setTimeout(resolve, delayMs));
                            retries++;
                            continue;
                        } 
                        
                        // 3. Erreur transitoire (5xx, timeout) -> retry rapide
                        else if (transientError && retries < maxRetries) {
                            const delayMs = 2000; // 2s pour erreurs transitoires
                            const retryMessage = `⏳ ${providerName}: erreur transitoire. Nouvelle tentative dans 2s (${retries + 1}/${maxRetries + 1})...\n\n`;
                            console.warn(`[EdgeFunction] ⏳ ${providerName} transient error, retrying in ${delayMs}ms (attempt ${retries + 1}/${maxRetries + 1})`);
                            controller.enqueue(encoder.encode(retryMessage));
                            await new Promise(resolve => setTimeout(resolve, delayMs));
                            retries++;
                            continue;
                        } 
                        
                        // 4. Autre erreur -> fallback ou échec
                        else {
                            lastError = error;
                            
                            // Message utilisateur concis
                            let userMessage = `${errorPrefix}${providerName}: ${error.message}`;
                            
                            // Ajouter info sur le fallback si disponible
                            if (nextProvider) {
                                userMessage += `\n🔄 Bascule vers ${nextProvider}...`;
                            } else if (remainingProviders.length === 0) {
                                userMessage += `\n⚠️ Aucun autre fournisseur disponible.`;
                            }
                            
                            userMessage += `\n\n`;
                            
                            // Log détaillé pour la console développeur
                            console.error(`[EdgeFunction] ❌ ${providerName} failed:`, {
                                message: error.message,
                                stack: error.stack?.split('\n').slice(0, 3).join('\n'),
                                wasRequestedProvider: isForcedProvider,
                                nextProvider,
                                remainingProviders: remainingProviders.length,
                                retries,
                                errorType: capacityError ? 'capacity' : rateLimitError ? 'rate_limit' : transientError ? 'transient' : 'other'
                            });
                            
                            controller.enqueue(encoder.encode(userMessage));
                            failedProviders.add(providerName);
                            break;
                        }
                    }
                }

                if (handled) break;
            }

            // 13. Gestion finale
            if (!handled) {
                const failedList = Array.from(failedProviders).join(', ');
                let finalMessage = `${errorPrefix}`;
                
                if (lastError) {
                    finalMessage += `Aucun provider disponible. Dernière erreur: ${lastError.message}`;
                } else {
                    finalMessage += "Aucun fournisseur disponible.";
                }
                
                if (failedList) {
                    finalMessage += `\n📋 Providers échoués: ${failedList}`;
                }
                
                finalMessage += `\n\n`;
                
                console.error('[EdgeFunction] ❌ All providers failed:', {
                    failedProviders: Array.from(failedProviders),
                    lastError: lastError?.message,
                    providerOrder
                });
                
                controller.enqueue(encoder.encode(finalMessage));
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

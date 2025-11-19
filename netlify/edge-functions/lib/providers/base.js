// ============================================================================
// BASE PROVIDER - Interface commune pour tous les providers LLM
// ============================================================================

import { providerMetrics } from '../utils/provider-metrics.js';

/**
 * Classe de base pour tous les providers LLM
 * Définit l'interface commune et la logique partagée
 */
export class BaseProvider {
    constructor(name, apiKey, config = {}) {
        this.name = name;
        this.apiKey = apiKey;
        this.config = config;
    }

    /**
     * Vérifie si le provider est disponible (API key présente)
     */
    isAvailable() {
        return Boolean(this.apiKey);
    }

    /**
     * Wrapper pour tracker les métriques autour d'un appel API
     */
    async _trackCall(model, callFn) {
        const startTime = Date.now();

        try {
            const result = await callFn();
            const responseTime = Date.now() - startTime;

            // Enregistrer le succès
            providerMetrics.recordSuccess(this.name, model, responseTime);

            return result;
        } catch (error) {
            // Déterminer le type d'erreur
            let errorType = 'error';
            if (/rate.?limit|429/i.test(error?.message)) {
                errorType = 'rate_limited';
            } else if (/quota|capacity|exceeded/i.test(error?.message)) {
                errorType = 'quota_exceeded';
            }

            // Enregistrer l'erreur
            providerMetrics.recordError(this.name, model, error, errorType);

            throw error;
        }
    }

    /**
     * Normalise un tool call en format standard
     */
    normalizeToolCall(call, idx = 0) {
        const fnShape = call.function || call.tool || call.action || call.intent || call.metadata || {};
        let name = fnShape.name || call.name || call.tool?.name || call.action?.name || call.intent?.name || call.metadata?.name || "";
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
                arguments: args
            }
        };
    }

    /**
     * Normalise une liste de tool calls
     */
    normalizeToolCalls(calls = []) {
        return calls.map((call, idx) => this.normalizeToolCall(call, idx));
    }

    /**
     * Vérifie si un objet est async iterable
     */
    isAsyncIterable(value) {
        return Boolean(value && typeof value[Symbol.asyncIterator] === "function");
    }

    /**
     * Méthode abstraite - doit être implémentée par chaque provider
     * Appelle le LLM avec les messages et tools fournis
     * 
     * @param {Object} options - Options d'appel
     * @param {Array} options.messages - Messages de la conversation
     * @param {Array} options.tools - Outils disponibles
     * @param {boolean} options.stream - Utiliser le streaming
     * @param {string} options.modelMode - Mode du modèle (fast, strong, etc.)
     * @returns {AsyncIterator|Object} Stream de chunks ou réponse directe
     */
    async call(options) {
        throw new Error(`${this.name}: call() must be implemented by subclass`);
    }

    /**
     * Méthode principale pour converser avec le LLM (avec gestion des tools)
     * 
     * @param {Object} options - Options de conversation
     * @returns {AsyncGenerator} Stream de chunks de réponse
     */
    async* chat(options) {
        throw new Error(`${this.name}: chat() must be implemented by subclass`);
    }
}

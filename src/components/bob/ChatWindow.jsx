// src/components/ChatWindow.jsx
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { createPropositionWithTags } from "../../lib/propositions";
import { marked } from "marked";
import DOMPurify from "dompurify";
import AuthModal from "../common/AuthModal";
import SiteFooter from "../layout/SiteFooter";
import {
  CITY_NAME,
  BOT_NAME,
  HASHTAG,
  MOVEMENT_NAME,
  PARTY_NAME,
  VOLUNTEER_URL,
} from "../../constants";
import "./ChatWindow.css";
import ProviderStatus from './ProviderStatus';
import { getDisplayName } from '../../lib/userDisplay';
// import RealTimeNotifications from './RealTimeNotifications';

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
    main: "gpt-4.1-mini",
    reasoning: "gpt-5.1",
    cheap: "gpt-4.1-nano",
  },
  huggingface: {
    // Chat généraliste (non limité au reasoning)
    main: "deepseek-ai/DeepSeek-V3",

    // Version plus légère (distill, toujours capable de reasoning mais moins coûteuse)
    small: "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",

    // Gros modèle reasoning quand tu veux l’artillerie lourde
    reasoning: "deepseek-ai/DeepSeek-R1",
  },
  grok: {
    main: "grok-4-fast-reasoning",
    fast: "grok-4-fast-non-reasoning",
    reasoning: "grok-4-fast-reasoning",
  },
  gemini: {
    main: "gemini-2.5-pro",
    fast: "gemini-2.5-flash",
    reasoning: "gemini-3-pro",
    cheap: "gemini-2.5-flash-lite",
  },
};

const DEFAULT_MODEL_MODE = {
  mistral: "fast",
  anthropic: "main",
  openai: "main",
  huggingface: "main",
  grok: "main",
  gemini: "main",
};

const MODEL_MODE_LABELS = {
  fast: "Rapide",
  strong: "Puissant",
  reasoning: "Raisonnement",
  main: "Standard",
  cheap: "Éco",
  small: "Petit",
};

const quickPresets = [
  {
    label: "Plus puissant (OpenAI)",
    provider: "openai",
    mode: "reasoning",
  },
  {
    label: "Rapide et équilibré (Mistral)",
    provider: "mistral",
    mode: "strong",
  },
  {
    label: "Économique (HuggingFace)",
    provider: "huggingface",
    mode: "main",
  },
];
const AVAILABLE_PROVIDERS = ["openai", "mistral", "huggingface", "anthropic"];
const getProviderLabel = (provider) =>
  ({
    mistral: "Mistral",
    anthropic: "Anthropic",
    openai: "OpenAI",
    huggingface: "HuggingFace",
    grok: "Grok (xAI)",
    gemini: "Gemini (Google)",
  })[provider] || provider;

const PROVIDER_META_PREFIX = "__PROVIDER_INFO__";
const PROVIDERS_STATUS_PREFIX = "__PROVIDERS_STATUS__";

export default function ChatWindow({ user }) {
  // États principaux
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isFooterExpanded, setIsFooterExpanded] = useState(true);
  const [chatbotSettings, setChatbotSettings] = useState({
    welcome_message: `Bonjour ! Comment puis-je vous aider concernant la vie locale à ${CITY_NAME} ?`,
    fallback_message:
      "Désolé, je n'ai pas trouvé de réponse à votre question. Souhaitez-vous créer une nouvelle proposition sur ce sujet ?",
    similarity_threshold: 0.65,
    max_sources: 3,
    enable_proposition_creation: true,
  });
  const [showPropositionForm, setShowPropositionForm] = useState(false);
  const [newPropositionTitle, setNewPropositionTitle] = useState("");
  const [newPropositionDescription, setNewPropositionDescription] =
    useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [relatedPropositions, setRelatedPropositions] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [hasConsent, setHasConsent] = useState(null);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [modelMode, setModelMode] = useState(DEFAULT_MODEL_MODE.mistral);
  const [providerMeta, setProviderMeta] = useState(null);
  const [providersStatus, setProvidersStatus] = useState(null);
  const timerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const formatElapsed = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  // Fonction pour parser et formater les erreurs API
  const parseApiError = (error) => {
    const msg = error?.message || "";
    
    // Détection des erreurs de quota (429)
    const quotaMatch = msg.match(/(?:quota|limit).*?exceeded/i);
    const retryMatch = msg.match(/(?:retry|wait|try\s+again).*?(\d+(?:\.\d+)?)\s*s/i);
    const providerMatch = msg.match(/^(\w+)\s+API\s+(\d+):/i);
    
    if (quotaMatch || msg.includes('429')) {
      const provider = providerMatch ? providerMatch[1] : 'Provider';
      const retrySeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;
      
      let userMsg = `⚠️ ${provider} : Quota/limite dépassé(e)`;
      if (retrySeconds) {
        const mins = Math.floor(retrySeconds / 60);
        const secs = retrySeconds % 60;
        userMsg += mins > 0 
          ? ` — Réessayez dans ${mins}min ${secs}s`
          : ` — Réessayez dans ${secs}s`;
      }
      
      return {
        userMessage: userMsg,
        consoleMessage: `[${provider}] Quota exceeded${retrySeconds ? ` (retry in ${retrySeconds}s)` : ''}`,
        detailedLog: msg,
        shouldRetry: false
      };
    }
    
    // Détection des erreurs de rate limit (sans quota)
    if (msg.includes('rate') && msg.includes('limit')) {
      const provider = providerMatch ? providerMatch[1] : 'Provider';
      const retrySeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 5;
      
      return {
        userMessage: `⏱️ ${provider} : Trop de requêtes — Réessayez dans ${retrySeconds}s`,
        consoleMessage: `[${provider}] Rate limited (retry in ${retrySeconds}s)`,
        detailedLog: msg,
        shouldRetry: true,
        retryAfter: retrySeconds * 1000
      };
    }
    
    // Erreur générique
    const provider = providerMatch ? providerMatch[1] : null;
    const statusCode = providerMatch ? providerMatch[2] : null;
    
    // Extraire juste le premier message d'erreur sans tout le JSON
    let cleanMsg = msg;
    let hasJson = false;
    try {
      const jsonMatch = msg.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const errorObj = JSON.parse(jsonMatch[0]);
        cleanMsg = errorObj?.error?.message || errorObj?.message || msg;
        hasJson = true;
        // Limiter à 200 caractères
        if (cleanMsg.length > 200) {
          cleanMsg = cleanMsg.substring(0, 197) + '...';
        }
      }
    } catch (e) {
      // Garder le message original
    }
    
    const userMsg = provider 
      ? `❌ ${provider}${statusCode ? ` (${statusCode})` : ''} : ${cleanMsg}`
      : `❌ ${cleanMsg}`;
    
    // Pour la console, afficher le message complet si c'était du JSON
    const consoleMsg = hasJson 
      ? `[${provider || 'Error'}] Full error: ${msg}`
      : msg;
    
    return {
      userMessage: userMsg,
      consoleMessage: consoleMsg,
      detailedLog: msg,
      shouldRetry: false
    };
  };

  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modalProvider, setModalProvider] = useState("mistral");
  const [modalMode, setModalMode] = useState(
    DEFAULT_MODEL_MODE["mistral"] || "fast",
  );
  const [customModel, setCustomModel] = useState("");
  const [directivePrefix, setDirectivePrefix] = useState("");
  const [activeProviderInfo, setActiveProviderInfo] = useState({
    provider: null,
    model: null,
  });
  const availableProviders = useMemo(() => {
    if (providersStatus?.providers) {
      return providersStatus.providers
        .filter(p => p.status !== 'not_configured')
        .map(p => p.name);
    }
    return AVAILABLE_PROVIDERS;
  }, [providersStatus]);

  // Fonction pour calculer un score de priorité pour chaque provider
  const getProviderPriorityScore = useCallback((providerName) => {
    if (!providersStatus?.providers) return 0;
    
    const provider = providersStatus.providers.find(p => p.name === providerName);
    if (!provider || provider.status === 'not_configured') return -1000;
    
    let score = 0;
    
    // Pénalités/bonus selon le statut
    if (provider.status === 'rate_limited') score -= 500;
    else if (provider.status === 'degraded') score -= 200;
    else if (provider.status === 'available') score += 300;
    else if (provider.status === 'unknown') score += 100;
    
    const mainModel = provider.models?.[0];
    
    // Bonus pour providers récemment utilisés avec succès
    if (mainModel?.recentlyUsed && mainModel.successRate > 90) {
      score += 200;
    }
    
    // Score basé sur le temps de réponse (plus rapide = meilleur)
    if (mainModel?.avgResponseTime) {
      const avgSeconds = mainModel.avgResponseTime / 1000;
      if (avgSeconds < 2) score += 150;
      else if (avgSeconds < 5) score += 100;
      else if (avgSeconds < 10) score += 50;
      else score -= 50;
    }
    
    // Bonus pour taux de succès élevé (0-200 points)
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
    
    return score;
  }, [providersStatus]);

  // Providers triés par priorité (disponibilité + vitesse)
  const sortedAvailableProviders = useMemo(() => {
    if (!availableProviders.length) return [];
    
    return [...availableProviders].sort((a, b) => {
      const scoreB = getProviderPriorityScore(b);
      const scoreA = getProviderPriorityScore(a);
      // En cas d'égalité, trier par ordre alphabétique
      if (scoreA === scoreB) {
        return a.toLowerCase().localeCompare(b.toLowerCase());
      }
      return scoreB - scoreA; // Ordre décroissant
    });
  }, [availableProviders, getProviderPriorityScore]);

  useEffect(() => {
    setModalProvider((prev) =>
      sortedAvailableProviders.includes(prev) ? prev : sortedAvailableProviders[0],
    );
  }, [sortedAvailableProviders]);
  useEffect(() => {
    const providerModes = MODEL_MODES[modalProvider] || {};
    const fallbackMode =
      DEFAULT_MODEL_MODE[modalProvider] || Object.keys(providerModes)[0] || "";
    setModalMode(fallbackMode);
  }, [modalProvider]);

  const buildDirective = ({ provider, mode, manualModel }) => {
    if (!provider) return "";
    const parts = [`provider=${provider}`];
    if (manualModel) {
      parts.push(`model=${manualModel}`);
    } else if (mode) {
      parts.push(`model_mode=${mode}`);
    }
    return parts.join(" ; ");
  };

  const handleModelSelection = ({ provider, mode, manualModel }) => {
    const prefix = buildDirective({ provider, mode, manualModel });
    if (!prefix) return;
    setDirectivePrefix(prefix);
    setModelMode(manualModel ? "" : mode || DEFAULT_MODEL_MODE[provider] || "");
    setCustomModel("");
    setModelModalOpen(false);
  };

  const handleQuickPreset = (preset) => {
    if (!sortedAvailableProviders.includes(preset.provider)) return;
    setModalProvider(preset.provider);
    setModalMode(preset.mode);
    handleModelSelection({
      provider: preset.provider,
      mode: preset.mode,
    });
  };

  const handleNotUsefulClick = (msg) => {
    handleFeedback(msg.id, "not_useful");
    if (!sortedAvailableProviders.length) return;

    const lastUserQuestion = [...messages]
      .reverse()
      .find((m) => m.sender === "user" && typeof m.text === "string");
    setInput(lastUserQuestion?.text || msg.text || "");

    // Utiliser le dernier provider utilisé (providerMeta) ou le meilleur disponible
    const lastProvider = providerMeta?.provider || "openai";
    const provider = sortedAvailableProviders.includes(lastProvider)
      ? lastProvider
      : sortedAvailableProviders[0];

    setModalProvider(provider);

    // Essayer de déterminer le mode depuis le modèle utilisé
    if (providerMeta?.model && MODEL_MODES[provider]) {
      const modes = MODEL_MODES[provider];
      console.log('[handleNotUsefulClick] Matching model:', providerMeta.model, 'against modes:', modes);
      const matchingMode = Object.entries(modes).find(([mode, modelName]) =>
        modelName === providerMeta.model
      );
      if (matchingMode) {
        setModalMode(matchingMode[0]);
      } else {
        setModalMode(DEFAULT_MODEL_MODE[provider] || "");
      }
    } else {
      setModalMode(DEFAULT_MODEL_MODE[provider] || "");
    }

    setCustomModel("");
    setModelModalOpen(true);
  };

  const handleModelConfirm = () => {
    handleModelSelection({
      provider: modalProvider,
      mode: customModel ? null : modalMode,
      manualModel: customModel || null,
    });
  };

  const prefixedQuestion = (message) =>
    directivePrefix ? `${directivePrefix} ; ${message}` : message;

  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  // Charger les paramètres du chatbot
  useEffect(() => {
    const fetchChatbotSettings = async () => {
      const { data, error } = await supabase.rpc("get_chatbot_settings");
      if (data && data.length > 0) {
        setChatbotSettings(data[0]);
      }
    };
    fetchChatbotSettings();

    // Charger le statut initial des providers
    fetch('/api/chat-stream-v2?healthcheck=true')
      .then(r => r.json())
      .then(data => {
        setProvidersStatus(data);
        console.log('[ChatWindow] Initial providers status loaded:', data);
      })
      .catch(err => console.warn('[ChatWindow] Failed to load initial provider status:', err));
  }, []);

  // Indique si une conversation est en cours (au moins un message non notification)
  const hasConversation = messages.some((m) => !m.isNotification);

  // Charger l'historique des conversations (Local + Supabase)
  useEffect(() => {
    const syncLocalHistory = async () => {
      const localHistory = localStorage.getItem("anonymous_chat_history");

      if (user && localHistory) {
        try {
          const parsedHistory = JSON.parse(localHistory);
          if (parsedHistory.length > 0) {
            console.log("Syncing local history to Supabase...", parsedHistory.length);

            // Préparer les messages pour l'insertion
            // Note: On doit reconstruire les paires question/réponse
            const interactionsToInsert = [];
            let currentInteraction = {};

            // On parcourt les messages du plus vieux au plus récent pour reconstruire les interactions
            const sortedMessages = [...parsedHistory].sort((a, b) => a.id - b.id);

            for (const msg of sortedMessages) {
              if (msg.sender === 'user') {
                currentInteraction = {
                  user_id: user.id,
                  question: msg.text,
                  created_at: new Date(msg.id).toISOString(), // Utiliser le timestamp de l'ID
                };
              } else if (msg.sender === 'bot' && currentInteraction.question) {
                currentInteraction.answer = msg.text;
                currentInteraction.sources = msg.sources || [];
                currentInteraction.feedback = msg.feedback || null;
                interactionsToInsert.push({ ...currentInteraction });
                currentInteraction = {};
              }
            }

            if (interactionsToInsert.length > 0) {
              const { error } = await supabase
                .from("chat_interactions")
                .insert(interactionsToInsert);

              if (error) {
                console.error("Error syncing history:", error);
              } else {
                console.log("Local history synced successfully!");
                localStorage.removeItem("anonymous_chat_history");
              }
            } else {
              localStorage.removeItem("anonymous_chat_history");
            }
          }
        } catch (e) {
          console.error("Error parsing local history:", e);
          localStorage.removeItem("anonymous_chat_history");
        }
      }
    };

    if (user) {
      // 1. D'abord essayer de synchroniser l'historique local si existant
      syncLocalHistory().then(() => {
        // 2. Ensuite charger l'historique complet depuis Supabase
        const fetchChatHistory = async () => {
          const { data, error } = await supabase
            .from("chat_interactions")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", {
              ascending: false,
            })
            .limit(50);

          if (error) {
            console.error("Erreur lors du chargement de l'historique:", error);
            return;
          }

          if (data && data.length > 0) {
            const formattedHistory = data.flatMap((item) => {
              const entries = [
                {
                  id: `history-user-${item.id}`,
                  text: item.question,
                  sender: "user",
                  timestamp: item.created_at,
                  related: {
                    answer: item.answer,
                    sources: item.sources,
                    feedback: item.feedback,
                  },
                },
              ];
              if (item.answer) {
                entries.push({
                  id: `history-bot-${item.id}`,
                  text: item.answer,
                  sender: "bot",
                  sources: item.sources,
                  feedback: item.feedback,
                  timestamp: item.created_at,
                });
              }
              return entries;
            });

            setMessages((prev) => {
              const withoutHistory = prev.filter(
                (msg) =>
                  !(typeof msg.id === "string" && msg.id.startsWith("history-")),
              );
              return [...formattedHistory.reverse(), ...withoutHistory];
            });
          }
        };
        fetchChatHistory();
      });
    } else {
      // Si pas connecté, charger depuis le localStorage
      const localHistory = localStorage.getItem("anonymous_chat_history");
      if (localHistory) {
        try {
          const parsed = JSON.parse(localHistory);
          setMessages(parsed);
        } catch (e) {
          console.error("Error loading local history:", e);
        }
      }
    }
  }, [user]);

  // Sauvegarder dans le localStorage si non connecté
  useEffect(() => {
    if (!user && messages.length > 0) {
      // Ne sauvegarder que les messages qui ne sont pas des notifications système
      const messagesToSave = messages.filter(m => !m.isNotification);
      localStorage.setItem("anonymous_chat_history", JSON.stringify(messagesToSave));
    }
  }, [messages, user]);

  // Détecter les nouvelles propositions créées
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("new_propositions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "propositions",
          filter: `created_from=eq.chatbot`,
        },
        (payload) => {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1000,
              text: `🔔 Nouvelle proposition créée depuis le chatbot : "${payload.new.title}"`,
              sender: "system",
              timestamp: new Date(),
              isNotification: true,
              link: `/propositions/${payload.new.id}`,
            },
          ]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Faire défiler vers le bas à chaque nouveau message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fonction pour envoyer un message
  const handleSend = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    setElapsedMs(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedMs((prev) => prev + 1000);
    }, 1000);

    abortControllerRef.current = new AbortController();

    const userMessage = {
      id: Date.now(),
      text: input,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const currentQuestion = input;
    setInput("");

    try {
      // 1. Chercher des propositions liées
      const related = await findRelatedPropositions(currentQuestion);
      setRelatedPropositions(related);

      // 2. Créer un message bot vide pour le streaming
      const botMessageId = Date.now() + 1;
      setMessages((prev) => [
        ...prev,
        {
          id: botMessageId,
          text: "",
          sender: "bot",
          timestamp: new Date(),
          isStreaming: true,
        },
      ]);

      // ✅ 3. Construire l'historique conversationnel (max 10 derniers messages)
      const conversationHistory = messages
        .filter((m) => !m.isNotification && !m.error) // Exclure notifications et erreurs
        .slice(-10) // Max 10 derniers messages (5 échanges)
        .map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text,
        }));

      console.log(
        `[ChatWindow] 📚 Envoi historique: ${conversationHistory.length} messages`,
      );

      // 4. Appeler l'Edge Function avec streaming + historique
      const response = await fetch("/api/chat-stream-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: prefixedQuestion(currentQuestion),
          user_id: user?.id,
          conversation_history: conversationHistory,
          modelMode,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        let detail = "";
        try {
          detail = await response.text();
        } catch { }
        let friendly = `Erreur serveur (${response.status})`;
        if (detail) {
          try {
            const j = JSON.parse(detail);
            friendly += j?.error ? ` — ${j.error}` : ` — ${detail}`;
          } catch {
            friendly += ` — ${detail}`;
          }
        }
        throw new Error(friendly);
      }

      // 5. Lire le stream progressivement
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        let chunk = decoder.decode(value, {
          stream: true,
        });
        let appendChunk = "";

        // Parse __PROVIDERS_STATUS__
        while (chunk.includes(PROVIDERS_STATUS_PREFIX)) {
          const [before, rest] = chunk.split(PROVIDERS_STATUS_PREFIX, 2);
          appendChunk += before;
          const newlineIndex = rest.indexOf("\n");
          const payload =
            newlineIndex >= 0 ? rest.slice(0, newlineIndex) : rest;
          try {
            const statusData = JSON.parse(payload);
            setProvidersStatus(statusData);
            console.log("[ChatWindow] Providers status updated:", statusData);
          } catch (err) {
            console.warn("[ChatWindow] providers status parse failed", err);
          }
          chunk = newlineIndex >= 0 ? rest.slice(newlineIndex + 1) : "";
        }

        // Parse __PROVIDER_INFO__
        while (chunk.includes(PROVIDER_META_PREFIX)) {
          const [before, rest] = chunk.split(PROVIDER_META_PREFIX, 2);
          appendChunk += before;
          const newlineIndex = rest.indexOf("\n");
          const payload =
            newlineIndex >= 0 ? rest.slice(0, newlineIndex) : rest;
          try {
            const meta = JSON.parse(payload);
            setProviderMeta(meta);
            console.log(
              `[ChatWindow] Provider info: ${meta.provider} (${meta.model})`,
            );
          } catch (err) {
            console.warn("[ChatWindow] metadata parse failed", err);
          }
          chunk = newlineIndex >= 0 ? rest.slice(newlineIndex + 1) : "";
        }
        appendChunk += chunk;
        fullResponse += appendChunk;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId
              ? {
                ...msg,
                text: fullResponse,
                isStreaming: true,
              }
              : msg,
          ),
        );
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? {
              ...msg,
              text: fullResponse,
              isStreaming: false,
            }
            : msg,
        ),
      );

      // 7. Sauvegarder dans l'historique si l'utilisateur est connecté
      if (user) {
        try {
          await supabase.from("chat_interactions").insert([
            {
              user_id: user.id,
              question: currentQuestion,
              answer: fullResponse,
              sources: [], // L'Edge Function ne retourne pas de sources pour l'instant
              created_at: new Date().toISOString(),
            },
          ]);
        } catch (dbError) {
          console.error("Erreur sauvegarde historique:", dbError);
        }
      }

      // 8. Mettre à jour l'historique local
      setChatHistory((prev) => [
        ...prev,
        {
          question: currentQuestion,
          answer: fullResponse,
        },
      ]);
    } catch (error) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const isAborted = error.name === "AbortError";
      
      let errText;
      if (isAborted) {
        errText = `⚠️ Requête annulée par l'utilisateur.`;
        console.log('[ChatWindow] Request aborted by user');
      } else {
        const parsedError = parseApiError(error);
        errText = parsedError.userMessage;
        
        // Afficher les détails complets dans la console
        console.error('[ChatWindow] API Error:', parsedError.consoleMessage);
        if (parsedError.detailedLog && parsedError.detailedLog !== parsedError.consoleMessage) {
          console.error('[ChatWindow] Full error details:', parsedError.detailedLog);
        }
      }

      // ⇩⇩ Nouveau: mettre à jour le message en streaming si présent
      setMessages((prev) => {
        let updated = false;
        const mapped = prev.map((m) => {
          if (m.isStreaming) {
            updated = true;
            return {
              ...m,
              isStreaming: false,
              error: true,
              text: errText,
            };
          }
          return m;
        });
        if (updated) return mapped;
        return [
          ...mapped,
          {
            id: Date.now(),
            text: errText,
            sender: "bot",
            timestamp: new Date(),
            error: true,
          },
        ];
      });
    } finally {
      setIsLoading(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      abortControllerRef.current = null;
    }
  };

  const handleAbortRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // ⇩⇩ Nouveau: arrêter proprement le placeholder en cours
      setMessages((prev) =>
        prev.map((m) =>
          m.isStreaming
            ? {
              ...m,
              isStreaming: false,
              error: true,
              text:
                (m.text && m.text.trim() ? m.text + "\n\n" : "") +
                "⚠️ Requête annulée par l'utilisateur.",
            }
            : m,
        ),
      );
      setIsLoading(false);
      setElapsedMs(0);
    }
  };

  // Normaliser un slug à partir d'un titre
  function normalizeSlug(str) {
    if (!str) return "";
    return String(str)
      .normalize("NFD")
      .replace(/\p{Diacritic}+/gu, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
  }

  // Déterminer un titre par défaut pour la page wiki
  function deriveDefaultTitle() {
    const firstUserMsg = messages.find(
      (m) => m.sender === "user" && typeof m.text === "string",
    );
    const base = firstUserMsg?.text || input || `Conversation avec ${BOT_NAME}`;
    const trimmed = base.trim().replace(/\s+/g, " ");
    return trimmed.length > 120 ? trimmed.slice(0, 117) + "…" : trimmed;
  }

  // Construire le payload de partage
  function buildSharePayload() {
    const items = messages.map((m) => ({
      sender: m.sender,
      text: typeof m.text === "string" ? m.text : "",
      sources: m.sources || null,
    }));
    const lastBot = [...messages].reverse().find((m) => m.sender === "bot");
    const meta = {
      generatedAt: new Date().toISOString(),
      provider: lastBot?.provider || null,
      model: lastBot?.model || null,
      debugTrace: lastBot?.debugTrace || null,
    };
    return {
      cityName: CITY_NAME,
      botName: BOT_NAME,
      meta,
      messages: items,
    };
  }

  // Construire le contenu Markdown à partir du payload
  function buildMarkdownFromPayload(payload, title) {
    const header = `# ${title}\n\n*Ville*: ${CITY_NAME}\n\n*Bot*: ${BOT_NAME}\n\n*Généré le*: ${payload.meta.generatedAt}\n\n`;
    const debug =
      payload.meta.provider || payload.meta.model
        ? `> Modèle: ${payload.meta.provider || "-"} / ${payload.meta.model || "-"}\n\n`
        : "";
    const body = payload.messages
      .map(
        (m) =>
          `**${m.sender === "user" ? "Utilisateur" : BOT_NAME}**\n\n${m.text || ""}`,
      )
      .join("\n\n");
    return header + debug + body + "\n";
  }

  // Publier la conversation comme page Wiki dans Supabase
  async function handlePublishWiki() {
    if (!hasConversation) return;
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      setIsLoading(true);
      // Construire le contenu à partir des messages actuels
      const conversationContent = messages
        .filter((m) => m.sender !== "system" || m.isNotification) // Inclure notifications si pertinent
        .map((m) => {
          const sender = m.sender === "user" ? "Utilisateur" : BOT_NAME;
          return `**${sender}**: ${m.text}`;
        })
        .join("\n\n");

      const defaultTitle = deriveDefaultTitle();

      // Appel de la fonction Netlify pour optimiser le titre et le slug
      const optimizeResponse = await fetch(
        "/.netlify/functions/optimize-wiki-title",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            defaultTitle,
            pageContent: conversationContent,
          }),
        },
      );

      if (!optimizeResponse.ok) {
        throw new Error(
          `Erreur lors de l'optimisation du titre: ${optimizeResponse.statusText}`,
        );
      }

      const { optimizedTitle, optimizedSlug } = await optimizeResponse.json();

      // Créer la page wiki
      const { data, error } = await supabase
        .from("wiki_pages")
        .insert([
          {
            title: optimizedTitle,
            content: conversationContent,
            slug: optimizedSlug,
            author_id: user.id,
          },
        ])
        .select();

      if (error) {
        console.error("Erreur création page Wiki :", error);
        alert("Impossible de créer la page Wiki. Êtes-vous connecté ?");
        return;
      }

      const pageUrl = `${window.location.origin}/wiki/${data[0].slug}`;

      // Générer un texte de partage
      const shareResponse = await fetch(
        "/.netlify/functions/generateShareText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pageTitle: optimizedTitle,
            pageUrl,
            pageContent: conversationContent,
            selectedDestinations: "Twitter", // Exemple, peut être dynamique
            currentShareText: "",
          }),
        },
      );

      let shareText = "";
      if (shareResponse.ok) {
        const shareData = await shareResponse.json();
        shareText = shareData.generatedText;
        // Copier dans le presse-papiers
        try {
          await navigator.clipboard.writeText(shareText);
        } catch (_) { }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          isNotification: true,
          text: `Page Wiki créée : ${pageUrl}${shareText ? `\n\nTexte de partage : ${shareText}` : ""}`,
          link: pageUrl,
        },
      ]);

      navigate(`/wiki/${data[0].slug}`);
    } catch (err) {
      console.error("Erreur inattendue lors de la publication Wiki :", err);
      alert(
        "Une erreur inattendue est survenue lors de la publication dans le Wiki.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  // Fonction pour trouver des propositions similaires
  const findRelatedPropositions = async (question) => {
    try {
      const apiKey = import.meta.env.VITE_HUGGINGFACE_API_KEY;
      if (!apiKey) {
        console.warn(
          "VITE_HUGGINGFACE_API_KEY non défini, la recherche de propositions similaires est ignorée.",
        );
        return [];
      }

      const embeddingResponse = await fetch(
        "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: question,
          }),
        },
      );

      const [embedding] = await embeddingResponse.json();

      const { data: similarProps, error } = await supabase.rpc(
        "match_propositions_by_embedding",
        {
          query_embedding: embedding,
          match_threshold: 0.65,
          match_count: 3,
        },
      );

      return similarProps || [];
    } catch (error) {
      console.error(
        "Erreur lors de la recherche de propositions similaires:",
        error,
      );
      return [];
    }
  };

  // Fonction pour gérer le feedback
  const handleFeedback = async (messageId, feedback) => {
    try {
      await supabase
        .from("chat_interactions")
        .update({ feedback })
        .eq("id", messageId);

      // Mettre à jour le message localement
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, feedback } : msg)),
      );

      // Mettre à jour le cache si la réponse était en cache
      const message = messages.find((m) => m.id === messageId);
      if (message?.cached) {
        await supabase
          .from("cached_queries")
          .update({
            feedback_count: supabase.rpc("increment_feedback_count", {
              query: message.text,
            }),
          })
          .eq("query", message.text);
      }
    } catch (error) {
      console.error("Erreur lors de l'envoi du feedback:", error);
    }
  };

  // Fonction pour créer une proposition
  const handleCreateProposition = async () => {
    if (!user) {
      alert("Vous devez être connecté pour créer une proposition");
      return;
    }

    setIsLoading(true);
    try {
      const lastBotMessage = messages.filter((m) => m.sender === "bot").pop();
      if (!lastBotMessage) return;

      const newProposition = await createPropositionWithTags({
        userId: user.id,
        title: newPropositionTitle || `Discussion: ${input.substring(0, 60)}`,
        description:
          newPropositionDescription ||
          `**Question originale:** ${input}\n\n**Réponse initiale du chatbot:**\n${lastBotMessage.text}\n\n---
          Cette proposition a été créée automatiquement à partir d'une discussion avec l'assistant citoyen.`,
        status: "active",
        selectedTags,
      });

      // Ajouter un message de confirmation
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          text: `✅ Votre proposition "${newProposition.title}" a été créée avec succès !`,
          sender: "system",
          timestamp: new Date(),
          link: `/propositions/${newProposition.id}`,
        },
      ]);

      // Réinitialiser le formulaire
      setShowPropositionForm(false);
      setNewPropositionTitle("");
      setNewPropositionDescription("");
      setSelectedTags([]);
      setTagInput("");

      // Rediriger vers la nouvelle proposition (React Router)
      navigate(`/propositions/${newProposition.id}`);
    } catch (error) {
      console.error("Erreur lors de la création de la proposition:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          text: `❌ Une erreur est survenue lors de la création de la proposition: ${error.message}`,
          sender: "system",
          timestamp: new Date(),
          error: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour suggérer des tags
  const suggestTags = async (question) => {
    try {
      const apiKey = import.meta.env.VITE_HUGGINGFACE_API_KEY;
      if (!apiKey) {
        console.warn(
          "VITE_HUGGINGFACE_API_KEY non défini, la suggestion de tags est ignorée.",
        );
        return;
      }

      const embeddingResponse = await fetch(
        "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: question,
          }),
        },
      );

      const [embedding] = await embeddingResponse.json();

      const { data: similarTags, error } = await supabase.rpc(
        "find_similar_tags",
        {
          query_embedding: embedding,
          limit: 5,
        },
      );

      if (!error && similarTags) {
        setSuggestedTags(similarTags);
      }
    } catch (error) {
      console.error("Erreur lors de la suggestion de tags:", error);
    }
  };

  // Charger les tags suggérés quand le formulaire s'ouvre
  useEffect(() => {
    if (showPropositionForm && input) {
      suggestTags(input);
    }
  }, [showPropositionForm, input]);

  useEffect(() => {
    const stored = window.localStorage.getItem("bob_chat_consent");
    if (stored === "true") setHasConsent(true);
    else if (stored === "false") setHasConsent(false);
    else setHasConsent(false);
  }, []);

  const handleClearHistory = async () => {
    if (isClearingHistory) return;
    if (!window.confirm("Effacer tout l'historique de vos échanges ?")) return;

    try {
      setIsClearingHistory(true);
      
      if (user) {
        // Effacer l'historique Supabase pour les utilisateurs connectés
        await supabase.from("chat_interactions").delete().eq("user_id", user.id);
      } else {
        // Effacer l'historique local pour les utilisateurs non connectés
        localStorage.removeItem("anonymous_chat_history");
      }
      
      setMessages([]); // Réinitialiser tous les messages
      setInput(""); // Réinitialiser le champ de saisie
      setRelatedPropositions([]);
      setChatHistory([]);
    } catch (error) {
      console.error("Erreur lors de l'effacement de l'historique:", error);
      alert("Impossible d’effacer l’historique pour le moment.");
    } finally {
      setIsClearingHistory(false);
    }
  };

  // Helper pour obtenir les métriques d'un provider  
  const getProviderMetrics = (providerName) => {
    if (!providersStatus?.providers) return null;
    const provider = providersStatus.providers.find(p => p.name === providerName);
    if (!provider || provider.status === 'not_configured') return null;

    const mainModel = provider.models?.[0];

    return {
      status: provider.status,
      avgTime: mainModel?.avgResponseTime,
      successRate: mainModel?.successRate,
      recentlyUsed: mainModel?.recentlyUsed,
      retryAfter: mainModel?.retryAfter,
    };
  };

  const ProviderMetricsBadge = ({ provider }) => {
    const m = getProviderMetrics(provider);
    if (!m) return null;

    return (
      <div className="provider-metrics-inline">
        {/* Statut */}
        {m.status === 'unknown' && <span className="metric-badge" style={{ opacity: 0.5 }}>⚪ Jamais utilisé</span>}
        {m.status === 'available' && <span className="metric-badge metric-success">🟢 Disponible</span>}
        {m.status === 'degraded' && <span className="metric-badge metric-warning">🟡 Dégradé</span>}
        {m.status === 'rate_limited' && <span className="metric-badge metric-retry">⏳ Rate limited</span>}

        {/* Métriques de performance */}
        {m.avgTime && <span className="metric-badge metric-time">⚡ {(m.avgTime / 1000).toFixed(2)}s</span>}
        {m.successRate != null && <span className={`metric-badge metric-${m.successRate < 90 ? 'warning' : 'success'}`}>✓ {m.successRate}%</span>}
        {m.recentlyUsed && <span className="metric-badge metric-hot">🔥</span>}
        {m.retryAfter && <span className="metric-badge metric-retry">dans {m.retryAfter}s</span>}
      </div>
    );
  };

  const ModelMetricsBadge = ({ provider, mode }) => {
    if (!providersStatus?.providers || !provider || !mode) return null;

    const providerData = providersStatus.providers.find(p => p.name === provider);
    if (!providerData) {
      return null;
    }

    const modelData = providerData.models?.find(m => m.mode === mode);
    if (!modelData) {
      return null;
    }

    return (
      <div className="provider-metrics-inline" style={{ marginTop: '8px' }}>
        {/* Statut du modèle */}
        {modelData.status === 'unknown' && <span className="metric-badge" style={{ opacity: 0.5 }}>⚪ Jamais utilisé</span>}
        {modelData.status === 'available' && <span className="metric-badge metric-success">🟢 Disponible</span>}
        {modelData.status === 'degraded' && <span className="metric-badge metric-warning">🟡 Dégradé</span>}
        {modelData.status === 'rate_limited' && <span className="metric-badge metric-retry">⏳ Rate limited</span>}

        {/* Métriques de performance */}
        {modelData.avgResponseTime && <span className="metric-badge metric-time">⚡ {(modelData.avgResponseTime / 1000).toFixed(2)}s</span>}
        {modelData.successRate != null && (
          <span className={`metric-badge metric-${modelData.successRate < 90 ? 'warning' : 'success'}`}>
            ✓ {modelData.successRate}%
          </span>
        )}
        {modelData.recentlyUsed && <span className="metric-badge metric-hot">🔥 Récent</span>}
        {modelData.retryAfter && <span className="metric-badge metric-retry">dans {modelData.retryAfter}s</span>}
        {modelData.consecutiveErrors > 0 && (
          <span className="metric-badge" style={{ background: 'rgba(239, 83, 80, 0.2)', color: '#ef5350' }}>
            ⚠️ {modelData.consecutiveErrors} erreur(s)
          </span>
        )}
      </div>
    );
  };

  const [isMobile, setIsMobile] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Dark mode management
  useEffect(() => {
    const stored = window.localStorage.getItem("chat_dark_mode");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = stored === "true" || (stored === null && prefersDark);
    setIsDarkMode(shouldBeDark);
    document.documentElement.setAttribute("data-theme", shouldBeDark ? "dark" : "light");
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    window.localStorage.setItem("chat_dark_mode", String(newMode));
    document.documentElement.setAttribute("data-theme", newMode ? "dark" : "light");
  };

  return (
    <div className="chat-interface">
      {hasConsent === false && (
        <div className="consent-overlay">
          <div className="consent-modal">
            <h3>Consentement requis</h3>
            <p>
              Pour utiliser l’assistant et sauvegarder vos échanges, nous avons
              besoin de votre accord. Les conversations sont enregistrées pour
              améliorer le service Pertitellu. Vous pourrez les effacer à tout
              moment.
            </p>
            <div className="consent-actions">
              <button
                onClick={() => {
                  window.localStorage.setItem("bob_chat_consent", "true");
                  setHasConsent(true);
                }}
                className="accept-btn"
              >
                J’accepte
              </button>
              <button
                onClick={() => {
                  window.localStorage.setItem("bob_chat_consent", "false");
                  setHasConsent(false);
                  navigate("/");
                }}
                className="decline-btn"
              >
                Je refuse
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="chat-container" aria-disabled={!hasConsent}>
        {/* En-tête du chat */}
        <div className={`chat-header ${isMobile ? "mobile" : ""}`}>
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center">
              <div className="chat-avatar">🤖</div>
              <div className="chat-info">
                <h2>
                  {isMobile
                    ? BOT_NAME
                    : `${BOT_NAME} — Assistant citoyen ${CITY_NAME}`}
                </h2>
                {!isMobile && <p>{chatbotSettings.welcome_message}</p>}
              </div>
            </div>
            <div>
              {user ? (
                <div className="flex items-center gap-3">
                  {!isMobile && (
                    <span className="text-sm text-gray-600">
                      Connecté en tant que {getDisplayName(user)}
                    </span>
                  )}
                  <button
                    onClick={toggleDarkMode}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
                    title={isDarkMode ? "Mode clair" : "Mode sombre"}
                  >
                    {isDarkMode ? "☀️" : "🌙"}
                  </button>
                  <button
                    onClick={async () => await supabase.auth.signOut()}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
                  >
                    {isMobile ? "↪" : "Déconnexion"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleDarkMode}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
                    title={isDarkMode ? "Mode clair" : "Mode sombre"}
                  >
                    {isDarkMode ? "☀️" : "🌙"}
                  </button>
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="px-3 py-1 bg-orange-500 text-white rounded-md hover:bg-orange-600 text-sm"
                  >
                    {isMobile ? "🔐" : "Se connecter"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal d'authentification */}
        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => {
              setShowAuthModal(false);
            }}
          />
        )}

        {/* Zone scrollable contenant messages + footer */}
        <div className="chat-scrollable-area">
          {/* Zone des messages */}
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="welcome-message">
                <p>Je peux vous aider avec :</p>
                <ul className="example-questions">
                  <li
                    onClick={() =>
                      setInput(
                        "Quels sont les projets urbains en cours dans mon quartier ?",
                      )
                    }
                  >
                    🏗️ Projets urbains en cours
                  </li>
                  <li
                    onClick={() =>
                      setInput("Comment participer aux décisions locales ?")
                    }
                  >
                    👥 Participation citoyenne
                  </li>
                  <li
                    onClick={() =>
                      setInput(
                        "Où puis-je trouver les comptes-rendus des dernières réunions ?",
                      )
                    }
                  >
                    📄 Comptes-rendus municipaux
                  </li>
                  <li
                    onClick={() =>
                      setInput(
                        "Quelles sont les prochaines consultations citoyennes ?",
                      )
                    }
                  >
                    🗓️ Prochaines consultations
                  </li>
                </ul>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={msg.id}
                  className={`message ${msg.sender} ${msg.error ? "error" : ""} ${msg.isNotification ? "notification" : ""
                    }`}
                >
                  {msg.sender !== "system" && (
                    <div className="message-avatar">
                      {msg.sender === "user" ? "👤" : "🤖"}
                    </div>
                  )}

                  <div className="message-content">
                    {msg.isNotification ? (
                      <div className="notification-message">
                        {msg.link ? (
                          <a href={msg.link} className="notification-link">
                            {msg.text}
                          </a>
                        ) : (
                          <p>{msg.text}</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div
                          className="message-text"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(
                              marked.parse(msg.text ?? ""),
                            ),
                          }}
                        />

                        {/* Indicateur de streaming */}
                        {msg.isStreaming && (
                          <div className="streaming-indicator">
                            <span className="typing-dots">
                              <span>.</span>
                              <span>.</span>
                              <span>.</span>
                            </span>
                          </div>
                        )}

                        {msg.sources?.length > 0 && (
                          <div className="message-sources">
                            <h5>Sources :</h5>
                            <div className="sources-list">
                              {msg.sources.map((source, j) => (
                                <div key={j} className="source-item">
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="source-link"
                                  >
                                    {source.type === "wiki_page" && (
                                      <span className="source-icon">📖</span>
                                    )}
                                    {source.type === "proposition" && (
                                      <span className="source-icon">🗳️</span>
                                    )}
                                    {source.type === "pdf" && (
                                      <span className="source-icon">📄</span>
                                    )}
                                    {source.type === "wiki_page" &&
                                      "Wiki communautaire"}
                                    {source.type === "proposition" &&
                                      "Proposition citoyenne"}
                                    {source.type === "pdf" &&
                                      "Document officiel"}
                                  </a>
                                  <p className="source-preview">
                                    {source.content}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {msg.sender === "bot" && !msg.error && (
                          <div className="message-actions">
                            <div className="feedback-buttons">
                              <button
                                onClick={() => handleFeedback(msg.id, "useful")}
                                className={`feedback-btn useful ${msg.feedback === "useful" ? "active" : ""
                                  }`}
                                disabled={msg.feedback === "useful"}
                              >
                                ✅{" "}
                                {msg.feedback === "useful"
                                  ? "Merci pour votre avis !"
                                  : "Utile"}
                              </button>
                              <button
                                onClick={() => handleNotUsefulClick(msg)}
                                className={`feedback-btn ${msg.feedback === "not_useful" ? "active" : ""
                                  }`}
                                title={msg.feedback === "not_useful" ? "Cliquez pour essayer un autre modèle" : ""}
                              >
                                👎{" "}
                                {msg.feedback === "not_useful"
                                  ? "Merci ! (Réessayer ?)"
                                  : "Pas assez"}
                              </button>
                            </div>

                            {chatbotSettings.enable_proposition_creation && (
                              <button
                                onClick={() => {
                                  setShowPropositionForm(true);
                                  setNewPropositionTitle(
                                    `Discussion: ${input.substring(0, 60)}`,
                                  );
                                  setNewPropositionDescription(
                                    `**Question originale:** ${input}\n\n` +
                                    `**Réponse initiale du chatbot:**\n${msg.text}\n\n` +
                                    `---\nCette proposition a été créée automatiquement à partir d'une discussion avec l'assistant citoyen.`,
                                  );
                                }}
                                className="create-proposition-btn"
                              >
                                💡 Créer une proposition
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Propositions liées pour la dernière question utilisateur */}
                  {i === messages.length - 1 &&
                    msg.sender === "user" &&
                    relatedPropositions.length > 0 && (
                      <div className="related-propositions">
                        <h5>Discussions similaires :</h5>
                        <ul>
                          {relatedPropositions.map((prop, index) => (
                            <li key={index}>
                              <a
                                href={`/propositions/${prop.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {prop.title}
                              </a>
                              <div className="prop-meta">
                                <span>
                                  👥{" "}
                                  {prop.author_id
                                    ? "Proposition citoyenne"
                                    : "Document officiel"}
                                </span>
                                <span>🗳️ {prop.votes?.length || 0} votes</span>
                                <span>
                                  💬 {prop.comments?.length || 0} commentaires
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              ))
            )}

            {/* Formulaire de création de proposition */}
            {showPropositionForm && (
              <div className="proposition-form-overlay">
                <div className="proposition-form">
                  <div className="form-header">
                    <h3>Créer une nouvelle proposition</h3>
                    <button
                      onClick={() => setShowPropositionForm(false)}
                      className="close-btn"
                    >
                      ×
                    </button>
                  </div>

                  <div className="form-group">
                    <label htmlFor="proposition-title">Titre</label>
                    <input
                      id="proposition-title"
                      type="text"
                      value={newPropositionTitle}
                      onChange={(e) => setNewPropositionTitle(e.target.value)}
                      placeholder="Titre clair et concis"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="proposition-description">Description</label>
                    <textarea
                      id="proposition-description"
                      value={newPropositionDescription}
                      onChange={(e) =>
                        setNewPropositionDescription(e.target.value)
                      }
                      placeholder="Décrivez votre proposition en détail"
                      rows="6"
                      className="form-textarea"
                    />
                  </div>

                  <div className="form-group tags-group">
                    <label>Tags</label>
                    <div className="tags-input-container">
                      {selectedTags.map((tag) => (
                        <span key={tag.id} className="tag-item">
                          {tag.name}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedTags(
                                selectedTags.filter((t) => t.id !== tag.id),
                              )
                            }
                            className="remove-tag-btn"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && tagInput.trim()) {
                            e.preventDefault();
                            // Vérifier si le tag existe déjà
                            const existingTag = suggestedTags.find(
                              (t) =>
                                t.name.toLowerCase() ===
                                tagInput.trim().toLowerCase(),
                            );

                            if (
                              existingTag &&
                              !selectedTags.some((t) => t.id === existingTag.id)
                            ) {
                              setSelectedTags([...selectedTags, existingTag]);
                            } else if (!existingTag) {
                              // Créer un nouveau tag temporaire
                              const newTag = {
                                id: `new-${Date.now()}`,
                                name: tagInput.trim(),
                              };
                              setSelectedTags([...selectedTags, newTag]);
                            }
                            setTagInput("");
                          }
                        }}
                        placeholder="Ajouter un tag..."
                        className="tag-input"
                      />
                    </div>
                    {suggestedTags.length > 0 && (
                      <div className="suggested-tags">
                        {suggestedTags
                          .filter(
                            (tag) =>
                              !selectedTags.some((st) => st.id === tag.id),
                          )
                          .map((tag) => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => {
                                if (
                                  !selectedTags.some((t) => t.id === tag.id)
                                ) {
                                  setSelectedTags([...selectedTags, tag]);
                                }
                              }}
                              className="suggested-tag-btn"
                            >
                              {tag.name}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={handleCreateProposition}
                      disabled={!newPropositionTitle.trim() || isLoading}
                      className="submit-btn"
                    >
                      {isLoading ? (
                        <>
                          <span className="loading-dots">⠋</span> Création en
                          cours...
                        </>
                      ) : (
                        "Créer la proposition"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPropositionForm(false);
                        setNewPropositionTitle("");
                        setNewPropositionDescription("");
                        setSelectedTags([]);
                        setTagInput("");
                      }}
                      className="cancel-btn"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Zone de contrôle fixe en bas */}
        <div className={`chat-controls-area ${isMobile ? "mobile" : ""}`}>
          {/* Zone de saisie */}
          <div className="input-area flex items-center gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) =>
                hasConsent && e.key === "Enter" && !e.shiftKey && handleSend()
              }
              placeholder={
                isMobile
                  ? `Question...`
                  : `Posez votre question sur la vie locale à ${CITY_NAME}...`
              }
              disabled={isLoading || !hasConsent}
              className="chat-input resize-none flex-grow w-full px-4 py-2 border border-gray-300 rounded-md"
              rows={isMobile ? "2" : "3"}
            />
            {messages.length > 0 && !isMobile && (
              <button
                onClick={handleClearHistory}
                disabled={isClearingHistory}
                title="Effacer tout l'historique"
                className="px-3 py-2 border border-red-500 text-red-500 rounded-md hover:bg-red-50 disabled:opacity-50"
              >
                {isClearingHistory ? "Nettoyage..." : "Effacer l'historique"}
              </button>
            )}
            {hasConversation && !isMobile && (
              <button
                onClick={handlePublishWiki}
                title="Publier la conversation dans le Wiki"
                className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Publier dans le Wiki
              </button>
            )}
            {hasConversation && isMobile && (
              <button
                onClick={handlePublishWiki}
                title="Publier dans le Wiki"
                className="px-2 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                📄
              </button>
            )}
            <button
              onClick={isLoading ? handleAbortRequest : handleSend}
              disabled={!isLoading && (!input.trim() || !hasConsent)}
              className="send-btn px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              title={isLoading ? "Cliquer pour annuler" : "Envoyer"}
            >
              {isLoading ? (
                <>
                  <span
                    aria-live="polite"
                    className="inline-flex items-center gap-2 cursor-pointer"
                    title="Cliquer pour annuler"
                  >
                    <span role="img" aria-label="chronomètre">
                      ⏱
                    </span>
                    <span>{formatElapsed(elapsedMs)}</span>
                  </span>
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.646 7.904a.5.5 0 0 1-.192-.192L15.854.146ZM3.854 5.606a.5.5 0 0 0-.708.708L4.793 8.346 3.146 9.992a.5.5 0 1 0 .708.708L5.5 9.039l6.456 6.456a.5.5 0 1 0 .708-.708L6.207 8.346l1.647-1.646a.5.5 0 0 0-.708-.708L5.5 6.701l-1.646 1.647Z" />
                  </svg>
                </>
              )}
            </button>
          </div>

          {/* Disclaimer - hide on mobile and when footer is closed */}
          {!isMobile && isFooterExpanded && (
            <div className="chat-disclaimer" role="note" aria-live="polite">
              ⚠️ Cette IA peut commettre des erreurs. Il est recommandé de
              vérifier les informations importantes.
            </div>
          )}
          <SiteFooter 
            showWiki={true} 
            showVersionInfo={!isMobile} 
            onExpandedChange={setIsFooterExpanded}
          />
        </div>

        {/* Modal de sélection de modèle */}
        {modelModalOpen && (
          <div className="model-mode-overlay" role="dialog" aria-modal="true">
            <div className="model-mode-panel">
              <header>
                <h3>Changer de modèle</h3>
              </header>
              {providerMeta?.provider && (
                <div className="current-provider-info">
                  <strong>Dernier modèle :</strong>{" "}
                  {getProviderLabel(providerMeta.provider)} —{" "}
                  {providerMeta.model}
                </div>
              )}

              <section className="model-mode-presets">
                <button
                  type="button"
                  onClick={() => {
                    setDirectivePrefix("");
                    setCustomModel("");
                    setModelMode(DEFAULT_MODEL_MODE[modalProvider] || "");
                    setProviderMeta(null);
                    setModelModalOpen(false);
                  }}
                >
                  Mode automatique
                </button>
                {quickPresets
                  .filter((preset) =>
                    sortedAvailableProviders.includes(preset.provider)
                  )
                  .map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleQuickPreset(preset)}
                    >
                      {preset.label}
                    </button>
                  ))}
              </section>
              <section className="model-mode-control">
                <label>Provider</label>
                <select
                  value={modalProvider}
                  onChange={(e) => setModalProvider(e.target.value)}
                >
                  {sortedAvailableProviders.length > 0 ? (
                    sortedAvailableProviders.map((provider) => (
                      <option key={provider} value={provider}>
                        {getProviderLabel(provider)}
                      </option>
                    ))
                  ) : (
                    <option value="aucun">Aucun provider configuré</option>
                  )}
                </select>
                {/* Afficher les métriques du provider sélectionné */}
                {modalProvider && (
                  <div style={{ marginBottom: '8px' }}>
                    <ProviderMetricsBadge provider={modalProvider} />
                  </div>
                )}
              </section>
              <section className="model-mode-control">
                <label>Mode prédéfini</label>
                <select
                  value={modalMode}
                  onChange={(e) => setModalMode(e.target.value)}
                >
                  {Object.entries(MODEL_MODES[modalProvider] || {}).map(
                    ([key, modelId]) => (
                      <option key={key} value={key}>
                        {MODEL_MODE_LABELS[key] || key} — {modelId}
                      </option>
                    ),
                  )}
                </select>
                {/* Métriques du modèle sélectionné */}
                {modalProvider && modalMode && (
                  <ModelMetricsBadge provider={modalProvider} mode={modalMode} />
                )}
              </section>
              <section className="model-mode-control">
                <label>Modèle personnalisé (facultatif)</label>
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value.trim())}
                  placeholder="Ex: gpt-4o-mini"
                />
              </section>
              <footer className="model-mode-actions">
                <button type="button" onClick={handleModelConfirm}>
                  Valider
                </button>
                <button type="button" onClick={() => setModelModalOpen(false)}>
                  Annuler
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

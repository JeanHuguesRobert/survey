import React, { useRef, useEffect, useMemo } from "react";
import "./chat-v2.css";
import Header from "./Header";
import Messages from "./Messages";
import Controls from "./Controls";
import PropositionForm from "./PropositionForm";
import ProviderStatus from "./ProviderStatus";
import ModelBadge from "./ModelBadge";
import useChatLogic from "./useChatLogic";
import AuthModal from "../../common/AuthModal";
import ProviderIcon from "./ProviderIcon";
import { useGlobalStatus as useOpStatus } from "../../../lib/useStatusOperations";
import SiteFooter from "../../layout/SiteFooter";
import { supabase } from "../../../lib/supabase";

/**
 * ChatWindowV2
 * Composed v2 chat UI: uses `useChatLogic` and small v2 modules
 * (Header, Messages, Controls, ProviderBadges, PropositionForm).
 * Intended for incremental migration and feature-parity testing.
 */
export default function ChatWindowV2({ useV2 = true, ...props }) {
  // If enabled, render the v2 composed layout wired to the hook.
  const logic = useChatLogic({ user: props.user, chatId: props.chatId });
  const messagesEndRef = useRef(null);
  const { operations } = useOpStatus();

  // Local question pool (copied from legacy v1 ChatWindow)
  const QUESTION_POOL = [
    {
      emoji: "👥",
      label: "Participation citoyenne",
      text: "Comment participer aux décisions locales ?",
    },
    {
      emoji: "🗓️",
      label: "Prochaines consultations",
      text: "Quelles sont les prochaines consultations citoyennes ?",
    },
    {
      emoji: "📄",
      label: "Comptes-rendus municipaux",
      text: "Où puis-je trouver les comptes-rendus des dernières réunions ?",
    },
    {
      emoji: "🏗️",
      label: "Projets urbains en cours",
      text: "Quels sont les projets urbains en cours dans mon quartier ?",
    },
    {
      emoji: "🌉",
      label: "Passerelle piétons-cycles",
      text: "Où en est le projet de passerelle piétons et cycles ?",
    },
    {
      emoji: "🏰",
      label: "Citadelle de Corte",
      text: "Quels sont les aménagements prévus pour la Citadelle ?",
    },
    {
      emoji: "🏛️",
      label: "Services municipaux",
      text: "Quels sont les horaires et services de la mairie ?",
    },
    {
      emoji: "🚌",
      label: "Transports publics",
      text: "Comment fonctionnent les transports en commun à Corte ?",
    },
    {
      emoji: "🅿️",
      label: "Stationnement",
      text: "Où se trouvent les parkings et zones de stationnement à Corte ?",
    },
    {
      emoji: "💧",
      label: "Service de l'eau",
      text: "Comment fonctionne la régie municipale de l'eau Cort'Acqua ?",
    },
    {
      emoji: "🎭",
      label: "Culture & événements",
      text: "Quels sont les prochains événements culturels à Corte ?",
    },
    {
      emoji: "🌳",
      label: "Initiatives écologiques",
      text: "Quelles sont les initiatives environnementales de la ville ?",
    },
    {
      emoji: "🏛️",
      label: "Patrimoine historique",
      text: "Comment est valorisé le patrimoine historique de Corte ?",
    },
    {
      emoji: "🌲",
      label: "Forêt communale",
      text: "Comment est gérée la forêt communale de Corte ?",
    },
    {
      emoji: "🏫",
      label: "Vie étudiante",
      text: "Quelles sont les activités et services pour les étudiants ?",
    },
    {
      emoji: "🏠",
      label: "Logement étudiant",
      text: "Comment trouver un logement étudiant à Corte ?",
    },
    { emoji: "🤖", label: "Qui est Ophélia ?", text: "Qui es-tu Ophélia et quel est ton rôle ?" },
    {
      emoji: "🎯",
      label: "Le mouvement Pertitellu",
      text: "C'est quoi Pertitellu et quels sont ses objectifs ?",
    },
    {
      emoji: "🗳️",
      label: "Propositions citoyennes",
      text: "Comment proposer une idée pour améliorer Corte ?",
    },
    {
      emoji: "📚",
      label: "Wiki communautaire",
      text: "Comment contribuer au wiki de Pertitellu ?",
    },
    {
      emoji: "📍",
      label: "Les quartiers de Corte",
      text: "Quels sont les différents quartiers de Corte ?",
    },
    { emoji: "🏞️", label: "La Restonica", text: "Comment accéder à la vallée de la Restonica ?" },
  ];

  const displayedQuestions = useMemo(() => {
    return [...QUESTION_POOL].sort(() => Math.random() - 0.5).slice(0, 4);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logic.messages]);

  return (
    <div className="chat-interface">
      <Header
        botName={props.botName}
        welcomeMessage={props.welcomeMessage}
        isMobile={props.isMobile}
        user={props.user}
        onSignIn={() => logic.openAuthModal()}
        onSignOut={async () => {
          try {
            await supabase.auth.signOut();
          } catch (_) {}
        }}
      />
      {/* Inline operation indicator (simple) */}
      {operations && operations.size > 0 && (
        <div className="op-operations">
          {Array.from(operations.values()).map((op) => (
            <div key={op.id}>{op.description || op.type}</div>
          ))}
        </div>
      )}
      {/* Provider badges are shown inside the model modal now (merged UI) */}
      <div className="chat-scrollable-area">
        <Messages
          messages={logic.messages}
          messagesEndRef={messagesEndRef}
          onFeedback={logic.handleFeedback}
          onNotUsefulClick={logic.handleNotUsefulClick}
          handlePublishWiki={logic.handlePublishWiki}
          chatbotSettings={{ enable_proposition_creation: true }}
          relatedPropositions={logic.relatedPropositions}
          ModelMetricsBadge={ModelBadge}
          providersStatus={logic.providersStatus}
          exampleQuestions={displayedQuestions}
          onExampleClick={(q) => logic.setInput(q)}
          onCreateProposition={(msg) => {
            const lastUser = [...logic.messages]
              .slice()
              .reverse()
              .find((m) => m.sender === "user");
            const question = logic.input || (lastUser ? lastUser.text : "");
            const title = `Discussion: ${String(question).slice(0, 60)}`;
            const description = `**Question originale:** ${question}\n\n**Réponse initiale du chatbot:**\n${msg.text}\n\n---\nCette proposition a été créée automatiquement à partir d'une discussion avec l'assistant citoyen.`;
            logic.openPropositionForm({ title, description });
          }}
        />
      </div>

      <Controls
        input={logic.input}
        setInput={logic.setInput}
        onSend={() => logic.sendMessage()}
        onAbort={logic.abort}
        isLoading={logic.isLoading}
        onClearHistory={logic.handleClearHistory}
        onPublish={logic.handlePublishWiki}
        hasConversation={logic.hasConversation}
        isMobile={props.isMobile}
        messagesLength={logic.messages.length}
        exampleQuestions={displayedQuestions}
        onExampleClick={(q) => logic.setInput(q)}
        onOpenModelModal={() => logic.openModelModal()}
        elapsedMs={logic.elapsedMs}
      />

      {/* Per-operation status bar (footer) */}
      {operations && operations.size > 0 && (
        <div className="chat-op-status-bar" aria-live="polite">
          {Array.from(operations.values()).map((op) => (
            <div key={op.id} className="op-item">
              {op.description || op.type}{" "}
              {op.state === "ERROR" || op.state === "error"
                ? "⚠️"
                : op.state === "RUNNING" || op.state === "running"
                  ? "⏳"
                  : ""}
            </div>
          ))}
        </div>
      )}

      <PropositionForm
        show={logic.showPropositionForm}
        onClose={() => logic.setShowPropositionForm(false)}
        title={logic.newPropositionTitle}
        description={logic.newPropositionDescription}
        setTitle={logic.setNewPropositionTitle}
        setDescription={logic.setNewPropositionDescription}
        onCreate={logic.createProposition}
        suggestedTags={logic.suggestedTags}
        selectedTags={logic.selectedTags}
        setSelectedTags={logic.setSelectedTags}
      />

      {logic.showAuthModal && (
        <AuthModal
          onClose={() => logic.setShowAuthModal(false)}
          onSuccess={() => logic.setShowAuthModal(false)}
        />
      )}

      {/* Model / provider modal (minimal port) */}
      {logic.modelModalOpen && (
        <div className="model-mode-overlay" role="dialog" aria-modal="true">
          <div className="model-mode-panel model-mode-grid">
            <header>
              <h3>Changer de modèle IA</h3>
            </header>

            {logic.providerMeta?.provider && (
              <div className="current-provider-info">
                <strong>Dernier modèle :</strong> {logic.providerMeta.provider} —{" "}
                {logic.providerMeta.model}
              </div>
            )}

            <div className="model-modal-centered">
              <div className="model-modal-card">
                <div className="model-modal-body">
                  <div className="model-mode-presets">
                    <label className="preset-label" htmlFor="preset-select">
                      Conseillés :
                    </label>
                    <select
                      id="preset-select"
                      className="preset-select"
                      style={{ color: "#000000" }}
                      aria-label="Presets modèles"
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        if (v === "automatic") {
                          logic.setModalProvider?.("");
                          logic.setModalMode?.("");
                          logic.setDirectivePrefix?.("");
                          logic.setModelModalOpen?.(false);
                          return;
                        }
                        // composite value provider::mode
                        const [provider, mode] = String(v).split("::");
                        if (provider && mode) {
                          const preset = logic.quickPresets?.find(
                            (pp) => pp.provider === provider && pp.mode === mode
                          );
                          if (preset) logic.handleQuickPreset?.(preset);
                        }
                      }}
                    >
                      <option>Choisissez</option>
                      <option value="automatic">Automatique</option>
                      {logic.quickPresets
                        ?.filter((p) => logic.sortedAvailableProviders.includes(p.provider))
                        .map((preset, i) => (
                          <option
                            key={`${preset.provider}-${preset.mode}-${i}`}
                            value={`${preset.provider}::${preset.mode}`}
                          >
                            {preset.label}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="provider-row">
                    <label className="selector-label" htmlFor="provider-select">
                      Fournisseur
                    </label>
                    <select
                      id="provider-select"
                      className="selector-select"
                      style={{ color: "#000000" }}
                      value={logic.modalProvider || ""}
                      onChange={(e) => logic.setModalProvider?.(e.target.value)}
                    >
                      {((logic.providersStatus?.providers || []).length
                        ? logic.providersStatus.providers
                        : logic.availableProviders || []
                      ).map((p) => {
                        const name = p.name || p;
                        const label = p.label || p.name || p;
                        return (
                          <option key={name} value={name} disabled={p.status === "not_configured"}>
                            {label}
                            {p.status === "not_configured" ? " (non configuré)" : ""}
                          </option>
                        );
                      })}
                    </select>

                    <div className="provider-metrics">
                      {(() => {
                        const sel = (logic.providersStatus?.providers || []).find(
                          (x) => x.name === logic.modalProvider
                        );
                        if (!sel) return "";
                        const m = sel.models?.[0] || {};
                        const latencyMs =
                          m.avgResponseTime != null ? Number(m.avgResponseTime) : null;
                        const latencyLabel =
                          latencyMs == null
                            ? "—"
                            : latencyMs < 1000
                              ? `${Math.round(latencyMs)}ms`
                              : `${(latencyMs / 1000).toFixed(2)}s`;
                        const latencyClass =
                          latencyMs == null
                            ? "metric-latency-na"
                            : latencyMs < 500
                              ? "metric-latency-good"
                              : latencyMs < 1500
                                ? "metric-latency-warn"
                                : "metric-latency-bad";

                        const success = m.successRate != null ? Number(m.successRate) : null;
                        const successLabel = success == null ? "—" : `${Math.round(success)}%`;
                        const successClass =
                          success == null
                            ? "metric-success-na"
                            : success >= 90
                              ? "metric-success-good"
                              : success >= 70
                                ? "metric-success-warn"
                                : "metric-success-bad";

                        return (
                          <div className="provider-metrics-inline">
                            {sel.status === "available" && (
                              <span className="metric-badge metric-success">🟢</span>
                            )}
                            {sel.status === "degraded" && (
                              <span className="metric-badge metric-warning">🟡</span>
                            )}
                            {sel.status === "rate_limited" && (
                              <span className="metric-badge metric-retry">⏳</span>
                            )}

                            <span
                              className={`metric-badge metric-latency ${latencyClass}`}
                              title={`Latence : ${latencyLabel}`}
                            >
                              ⚡ {latencyLabel}
                            </span>
                            <span
                              className={`metric-badge metric-success-rate ${successClass}`}
                              title={`Taux de succès : ${successLabel}`}
                            >
                              ✓ {successLabel}
                            </span>

                            {m.recentlyUsed && (
                              <span className="metric-badge metric-hot" title="Récemment utilisé">
                                🔥
                              </span>
                            )}
                            {m.retryAfter && (
                              <span className="metric-badge metric-retry">
                                dans {m.retryAfter}s
                              </span>
                            )}
                            {m.consecutiveErrors > 0 && (
                              <span className="metric-badge">⚠️ {m.consecutiveErrors}</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="model-row">
                    <label className="selector-label" htmlFor="model-select">
                      Modèle
                    </label>
                    <select
                      id="model-select"
                      className="selector-select"
                      style={{ color: "#000000" }}
                      value={logic.modalMode || ""}
                      onChange={(e) => logic.setModalMode?.(e.target.value)}
                    >
                      {(logic.MODEL_MODES[logic.modalProvider]
                        ? Object.keys(logic.MODEL_MODES[logic.modalProvider])
                        : []
                      ).map((modeKey) => (
                        <option key={modeKey} value={modeKey}>
                          {logic.MODEL_MODES[logic.modalProvider][modeKey] || modeKey}
                        </option>
                      ))}
                    </select>

                    <div className="model-metrics">
                      {(() => {
                        const sel = (logic.providersStatus?.providers || []).find(
                          (x) => x.name === logic.modalProvider
                        );
                        if (!sel)
                          return <div className="metric-hint">Aucune métrique disponible.</div>;
                        const selectedModelName =
                          logic.MODEL_MODES[logic.modalProvider]?.[logic.modalMode];
                        const modelData = selectedModelName
                          ? (sel.models || []).find((mm) => mm.name === selectedModelName)
                          : null;
                        const latencyMs =
                          modelData?.avgResponseTime != null
                            ? Number(modelData.avgResponseTime)
                            : null;
                        const latencyLabel =
                          latencyMs == null
                            ? "—"
                            : latencyMs < 1000
                              ? `${Math.round(latencyMs)}ms`
                              : `${(latencyMs / 1000).toFixed(2)}s`;
                        const latencyClass =
                          latencyMs == null
                            ? "metric-latency-na"
                            : latencyMs < 500
                              ? "metric-latency-good"
                              : latencyMs < 1500
                                ? "metric-latency-warn"
                                : "metric-latency-bad";

                        const success =
                          modelData?.successRate != null ? Number(modelData.successRate) : null;
                        const successLabel = success == null ? "—" : `${Math.round(success)}%`;
                        const successClass =
                          success == null
                            ? "metric-success-na"
                            : success >= 90
                              ? "metric-success-good"
                              : success >= 70
                                ? "metric-success-warn"
                                : "metric-success-bad";

                        if (!modelData)
                          return <div className="metric-hint">Aucune métrique pour ce modèle.</div>;
                        return (
                          <div className="provider-metrics-inline">
                            {modelData.avgResponseTime != null && (
                              <span className={`metric-badge metric-latency ${latencyClass}`}>
                                ⚡ {latencyLabel}
                              </span>
                            )}
                            {modelData.successRate != null && (
                              <span className={`metric-badge metric-success-rate ${successClass}`}>
                                ✓ {successLabel}
                              </span>
                            )}
                            {modelData.retryAfter && (
                              <span className="metric-badge metric-retry">
                                dans {modelData.retryAfter}s
                              </span>
                            )}
                            {modelData.consecutiveErrors > 0 && (
                              <span className="metric-badge">⚠️ {modelData.consecutiveErrors}</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <footer className="model-modal-footer">
                  <button className="btn btn-ghost" onClick={() => logic.setModelModalOpen(false)}>
                    Annuler
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      logic.handleModelSelection?.({
                        provider: logic.modalProvider,
                        mode: logic.modalMode,
                        manualModel: logic.customModel || null,
                      })
                    }
                  >
                    Appliquer
                  </button>
                </footer>
              </div>
            </div>
          </div>
        </div>
      )}
      <SiteFooter />
    </div>
  );
}

// Re-export small modules for incremental adoption.
export { Header, Messages, Controls, PropositionForm, ProviderStatus, ModelBadge, useChatLogic };

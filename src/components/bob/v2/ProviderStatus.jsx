import React, { useState } from "react";

const ProviderStatus = ({ providersData, onSelectProvider }) => {
  const [displayMode, setDisplayMode] = useState("compact"); // hidden | compact | detailed
  const [expandedProviders, setExpandedProviders] = useState(new Set());

  // Cycle entre les modes d'affichage
  const cycleDisplayMode = () => {
    const modes = ["hidden", "compact", "detailed"];
    const currentIndex = modes.indexOf(displayMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setDisplayMode(modes[nextIndex]);
  };

  // Toggle expansion d'un provider
  const toggleProvider = (providerName) => {
    const newExpanded = new Set(expandedProviders);
    if (newExpanded.has(providerName)) {
      newExpanded.delete(providerName);
    } else {
      newExpanded.add(providerName);
    }
    setExpandedProviders(newExpanded);
  };

  // Select a provider (optionally with a model/mode)
  const selectProvider = (providerName, mode = null) => {
    const p = providersData?.providers?.find((x) => x.name === providerName);
    if (!p || p.status === "not_configured") return;
    if (onSelectProvider) onSelectProvider(providerName, mode);
  };

  // Icons pour status
  const getStatusIcon = (status) => {
    switch (status) {
      case "available":
        return "🟢";
      case "degraded":
        return "🟡";
      case "rate_limited":
        return "⏳";
      case "error":
        return "🔴";
      case "not_configured":
        return "🔒";
      default:
        return "⚪";
    }
  };

  // Format temps
  const formatTime = (ms) => {
    if (!ms) return "";
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  if (displayMode === "hidden") return null;

  return (
    <div className={`provider-status provider-status--${displayMode}`}>
      {/* Header avec toggle */}
      <div className="provider-status__header" onClick={cycleDisplayMode}>
        <span className="provider-status__title">
          Providers (
          {providersData?.providers?.filter((p) => p.status !== "not_configured").length || 0})
        </span>
        <button className="provider-status__toggle" title="Changer l'affichage">
          {displayMode === "compact" ? "▼" : "▲"}
        </button>
      </div>

      {/* Liste des providers */}
      <div className="provider-status__list">
        {providersData?.providers?.map((provider) => {
          const isExpanded = expandedProviders.has(provider.name);
          const hasModels = provider.models && provider.models.length > 0;

          return (
            <div key={provider.name} className={`provider-item provider-item--${provider.status}`}>
              {/* Nom du provider */}
              <div className="provider-item__header">
                <span className="provider-item__icon">{getStatusIcon(provider.status)}</span>
                <span className="provider-item__name">{provider.name}</span>

                {/* Compact mode: show quick stats */}
                {displayMode === "compact" && hasModels && (
                  <span className="provider-item__quick-stats">
                    {provider.models.find((m) => m.recentlyUsed) && "🔥"}
                    {provider.models[0]?.avgResponseTime && (
                      <span className="stat">
                        ⚡{formatTime(provider.models[0].avgResponseTime)}
                      </span>
                    )}
                  </span>
                )}

                {/* Quick select button */}
                <button
                  className="provider-item__use"
                  onClick={() => selectProvider(provider.name, provider.models?.[0]?.mode || null)}
                  title={
                    provider.status === "not_configured"
                      ? "Non configuré"
                      : `Sélectionner ${provider.name}`
                  }
                  aria-disabled={provider.status === "not_configured"}
                >
                  {provider.status === "not_configured" ? "🔒" : "Sélectionner"}
                </button>

                {hasModels && (
                  <button
                    className="provider-item__expand"
                    onClick={() => toggleProvider(provider.name)}
                  >
                    {isExpanded ? "−" : "+"}
                  </button>
                )}
              </div>

              {/* Models list (detailed mode or when expanded) */}
              {hasModels && (displayMode === "detailed" || isExpanded) && (
                <div className="provider-item__models">
                  {provider.models.map((model) => (
                    <div
                      key={model.name}
                      className={`model-item model-item--${model.status} ${model.recentlyUsed ? "model-item--recent" : ""}`}
                      onClick={() =>
                        onSelectProvider && onSelectProvider(provider.name, model.mode)
                      }
                    >
                      <div className="model-item__header">
                        <span className="model-item__name">{model.mode}</span>
                        {model.recentlyUsed && <span className="model-item__badge">🔥</span>}
                      </div>

                      <div className="model-item__stats">
                        {model.avgResponseTime && (
                          <span className="stat stat--time" title="Temps de réponse moyen">
                            ⚡ {formatTime(model.avgResponseTime)}
                          </span>
                        )}
                        {model.successRate !== undefined && (
                          <span
                            className={`stat stat--success ${model.successRate < 90 ? "stat--warning" : ""}`}
                            title="Taux de succès"
                          >
                            ✓ {model.successRate}%
                          </span>
                        )}
                        {model.retryAfter && (
                          <span className="stat stat--retry" title="Réessayer dans...">
                            ⏳ {model.retryAfter}s
                          </span>
                        )}
                        {model.consecutiveErrors > 0 && (
                          <span className="stat stat--errors" title="Erreurs consécutives">
                            ⚠️ {model.consecutiveErrors}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Not configured message */}
              {provider.status === "not_configured" && displayMode === "detailed" && (
                <div className="provider-item__not-configured">API key manquante</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProviderStatus;

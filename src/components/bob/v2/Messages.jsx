// src/components/bob/v2/Messages.jsx

import React, { useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

// Helper to extract <Think>...</Think> content
const extractThought = (text) => {
  if (!text) return { thought: null, content: "" };

  // Match <Think>...</Think> (case insensitive)
  // Handles both complete tags and streaming (incomplete) tags
  const match = text.match(/<Think>([\s\S]*?)(?:<\/Think>|$)/i);

  if (match) {
    const thought = match[1];
    // Remove the thought block from the content
    const content = text.replace(/<Think>[\s\S]*?(?:<\/Think>|$)/i, "").trim();
    return { thought, content };
  }

  return { thought: null, content: text };
};

// Component to display thought
const ThoughtBlock = ({ thought }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!thought) return null;

  return (
    <div className="thought-block">
      <div
        className="thought-summary"
        onClick={() => setIsOpen(!isOpen)}
        title="Cliquez pour voir le raisonnement du modèle"
      >
        <span className={`thought-toggle-icon ${isOpen ? "open" : ""}`}>▶</span>
        <span>Processus de réflexion</span>
      </div>
      {isOpen && <div className="thought-content">{thought}</div>}
    </div>
  );
};

export default function Messages({
  messages = [],
  onFeedback = () => {},
  onNotUsefulClick = () => {},
  handlePublishWiki = () => {},
  chatbotSettings = {},
  relatedPropositions = [],
  ModelMetricsBadge = null,
  providersStatus = null,
  exampleQuestions = [],
  onExampleClick = null,
  messagesEndRef = null,
  onCreateProposition = null,
}) {
  return (
    <div className="messages-container">
      {messages.length === 0 ? (
        <div className="welcome-message">
          <p>Je peux vous aider avec :</p>
          <ul className="example-questions">
            {exampleQuestions.map((q, i) => {
              const isObj = q && typeof q === "object" && q.text;
              const label = isObj ? `${q.emoji || ""} ${q.label || ""}`.trim() : q;
              const text = isObj ? q.text : q;
              return (
                <li key={i} onClick={() => (onExampleClick ? onExampleClick(text) : null)}>
                  {label}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <>
          {messages.map((msg, i) => (
            <div
              key={msg.id}
              className={`message ${msg.sender} ${msg.error ? "error" : ""} ${msg.isNotification ? "notification" : ""}`}
            >
              {msg.sender !== "system" && (
                <div className="message-avatar">
                  {msg.sender === "user" ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="11" width="18" height="10" rx="2" />
                      <circle cx="12" cy="5" r="2" />
                      <path d="M12 7v4" />
                    </svg>
                  )}
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
                    {(() => {
                      const { thought, content } = extractThought(msg.text);
                      return (
                        <>
                          {thought && <ThoughtBlock thought={thought} />}
                          <div
                            className="message-text"
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(marked.parse(String(content || ""))),
                            }}
                          />
                        </>
                      );
                    })()}
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
                                {source.type === "pdf" && <span className="source-icon">📄</span>}
                                {source.type === "wiki_page" && "Wiki communautaire"}
                                {source.type === "proposition" && "Proposition citoyenne"}
                                {source.type === "pdf" && "Document officiel"}
                              </a>
                              <p className="source-preview">{source.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.sender === "bot" && !msg.isStreaming && (
                      <div className="message-actions">
                        <div className="feedback-buttons">
                          <button
                            onClick={() => onFeedback(msg.id, "useful")}
                            className={`feedback-btn useful ${msg.feedback === "useful" ? "active" : ""}`}
                            disabled={msg.feedback === "useful"}
                          >
                            {msg.feedback === "useful" ? "Merci pour votre avis !" : "Utile"}
                          </button>
                          <button
                            onClick={() => onNotUsefulClick(msg)}
                            className={`feedback-btn ${msg.feedback === "not_useful" ? "active" : ""}`}
                          >
                            {msg.feedback === "not_useful" ? "Merci ! (Réessayer ?)" : "Pas assez"}
                          </button>
                        </div>
                        {chatbotSettings.enable_proposition_creation && (
                          <button
                            onClick={() => onCreateProposition && onCreateProposition(msg)}
                            className="btn btn-secondary"
                          >
                            💡 Formuler une proposition
                          </button>
                        )}
                        <button
                          onClick={handlePublishWiki}
                          className="btn btn-primary btn-publish-wiki"
                          title="Publier cette conversation comme page Wiki"
                        >
                          📖 Publier Wiki
                        </button>
                      </div>
                    )}

                    <div className="message-meta">
                      {msg.provider && msg.model && ModelMetricsBadge && (
                        <ModelMetricsBadge
                          provider={msg.provider}
                          mode={msg.model}
                          providersStatus={providersStatus}
                        />
                      )}
                      {msg.cached && (
                        <span
                          className="cached-badge"
                          title={msg.cacheKey ? `Cache key: ${msg.cacheKey}` : "Réponse en cache"}
                        >
                          🗄️ En cache
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Related propositions after last user message */}
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
                            <span>🗳️ {prop.votes?.length || 0} votes</span>
                            <span>💬 {prop.comments?.length || 0} commentaires</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          ))}
          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
}

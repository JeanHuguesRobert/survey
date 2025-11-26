import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { APP_VERSION, DEPLOY_DATE, VOLUNTEER_URL } from "../../constants";
import { supabase } from "../../lib/supabase";
import { useCurrentUser } from "../../lib/useCurrentUser";
import AuthModal from "../common/AuthModal";

export default function SiteFooter({
  showWiki = true,
  showVersionInfo = true,
  onExpandedChange,
  hidden = false,
}) {
  // Récupérer l'état depuis localStorage
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem("siteFooterExpanded");
    const hasBeenSeen = localStorage.getItem("siteFooterHasBeenSeen");
    // Si jamais vu, ouvrir par défaut pour raisons légales
    if (!hasBeenSeen) return true;
    // Sinon utiliser l'état sauvegardé (par défaut fermé)
    return saved === "true";
  });
  const [hasBeenSeenExpanded, setHasBeenSeenExpanded] = useState(() => {
    return localStorage.getItem("siteFooterHasBeenSeen") === "true";
  });
  const [isManualControl, setIsManualControl] = useState(() => {
    return localStorage.getItem("siteFooterManualControl") === "true";
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { currentUser, userStatus, loading } = useCurrentUser();
  const footerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const lastScrollY = useRef(0);
  const scrollAttempts = useRef(0);
  const wheelAttempts = useRef(0);
  const wheelTimeoutRef = useRef(null);
  // Touch drag support for mobile
  const touchStartY = useRef(null);
  const touchAttempts = useRef(0);
  const touchTimeoutRef = useRef(null);
  const touchTotalDistance = useRef(0);

  // Touch drag handlers for mobile
  // Improved mobile drag logic
  const touchActive = useRef(false);
  const lastTouchY = useRef(null);
  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartY.current = e.touches[0].clientY;
      lastTouchY.current = e.touches[0].clientY;
      touchActive.current = true;
      touchTotalDistance.current = 0;
    }
  };

  const handleTouchMove = (e) => {
    if (!touchActive.current || !touchStartY.current) return;
    if (e.touches && e.touches.length === 1) {
      const currentY = e.touches[0].clientY;
      const deltaY = touchStartY.current - currentY;
      lastTouchY.current = currentY;
      // Only consider upward drag
      if (deltaY > 0) {
        touchTotalDistance.current += deltaY;
        const scrollHeight = document.documentElement.scrollHeight;
        const windowHeight = window.innerHeight;
        const currentScrollY = window.scrollY;
        const scrolledToBottom = currentScrollY + windowHeight >= scrollHeight - 5;
        if (!isExpanded && scrolledToBottom) {
          // If single long drag (>100px), open immediately
          if (touchTotalDistance.current > 100) {
            setIsExpanded(true);
            touchAttempts.current = 0;
            touchTotalDistance.current = 0;
            return;
          }
          // Otherwise, count short upward drags >30px
          if (deltaY > 30) {
            touchAttempts.current += 1;
            if (touchAttempts.current >= 3) {
              setIsExpanded(true);
              touchAttempts.current = 0;
              touchTotalDistance.current = 0;
              return;
            }
            // Reset after 800ms inactivity
            if (touchTimeoutRef.current) {
              clearTimeout(touchTimeoutRef.current);
            }
            touchTimeoutRef.current = setTimeout(() => {
              touchAttempts.current = 0;
              touchTotalDistance.current = 0;
            }, 800);
          }
        }
        // Reset startY so only one upward drag per touchmove
        touchStartY.current = currentY;
      }
    }
  };

  const handleTouchEnd = () => {
    touchActive.current = false;
    touchStartY.current = null;
    lastTouchY.current = null;
    touchTotalDistance.current = 0;
  };

  // Notifier le parent quand l'état change
  useEffect(() => {
    if (onExpandedChange) {
      onExpandedChange(isExpanded);
    }
  }, [isExpanded, onExpandedChange]);

  // Sauvegarder l'état dans localStorage
  useEffect(() => {
    localStorage.setItem("siteFooterExpanded", isExpanded.toString());
  }, [isExpanded]);

  useEffect(() => {
    localStorage.setItem("siteFooterManualControl", isManualControl.toString());
  }, [isManualControl]);

  useEffect(() => {
    // Marquer comme vu après un court délai (pour s'assurer que le rendu est complet)
    const timer = setTimeout(() => {
      setHasBeenSeenExpanded(true);
      localStorage.setItem("siteFooterHasBeenSeen", "true");
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Auto-collapse only if footer has been seen and not in manual control
    // But allow auto-unfold on wheel at bottom even in manual mode
    if (!hasBeenSeenExpanded) return;

    const handleScroll = () => {
      if (isExpanded && !isManualControl) {
        // Fermer le footer au scroll
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
          setIsExpanded(false);
        }, 100);
      }
    };

    const handleWheel = (e) => {
      if (!isExpanded) {
        const scrollHeight = document.documentElement.scrollHeight;
        const windowHeight = window.innerHeight;
        const currentScrollY = window.scrollY;
        const scrolledToBottom = currentScrollY + windowHeight >= scrollHeight - 5;

        // Si on est en bas et qu'on scroll vers le bas (deltaY > 0)
        if (scrolledToBottom && e.deltaY > 0) {
          wheelAttempts.current += 1;

          // Après 3 tentatives, ouvrir le footer
          if (wheelAttempts.current >= 3) {
            setIsExpanded(true);
            wheelAttempts.current = 0;
          }

          // Reset après 800ms d'inactivité
          if (wheelTimeoutRef.current) {
            clearTimeout(wheelTimeoutRef.current);
          }
          wheelTimeoutRef.current = setTimeout(() => {
            wheelAttempts.current = 0;
          }, 800);
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
      }
    };
  }, [isExpanded, hasBeenSeenExpanded, isManualControl]);

  const handleToggle = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    setIsManualControl(true); // Dès qu'on touche manuellement, plus d'auto-close

    // Si on ouvre, scroller vers le bas pour voir le footer complètement
    if (newExpandedState && footerRef.current) {
      setTimeout(() => {
        // Scroller pour que le footer soit complètement visible
        footerRef.current.scrollIntoView({
          behavior: "smooth",
          block: "end",
          inline: "nearest",
        });
      }, 350); // Attendre la fin de l'animation d'ouverture (300ms + marge)
    }
  };

  // Inline style variables
  const styles = {
    footer: {
      position: "relative",
      width: "100%",
      background: "var(--color-bg-app)",
      borderTop: "3px solid var(--color-border-strong)",
      transition: "transform var(--duration-normal) var(--ease-smooth)",
      marginTop: "auto",
      ...(hidden ? { transform: "translateY(100%)" } : {}),
    },
    toggle: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "2px 8px", // minimal
      background: "var(--color-surface-secondary)",
      border: "none",
      borderBottom: "1px solid var(--color-border-medium)", // thinner
      cursor: "pointer",
      transition: "background var(--duration-fast) ease",
    },
    toggleLabel: {
      fontWeight: 700,
      fontSize: "0.9rem", // smaller
      color: "var(--color-content-primary)",
      fontFamily: "var(--font-display)",
    },
    toggleIcon: {
      width: 20,
      height: 20,
      color: "var(--color-content-primary)",
      transition: "transform var(--duration-normal) var(--ease-smooth)",
      ...(isExpanded ? { transform: "rotate(180deg)" } : {}),
    },
    panel: {
      maxHeight: isExpanded ? 400 : 0, // much smaller
      overflow: "hidden",
      transition: "max-height var(--duration-normal) var(--ease-smooth)",
    },
    inner: {
      padding: "6px 8px 10px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      alignItems: "center", // center horizontally
      justifyContent: "center", // center vertically
      textAlign: "center", // center text
    },
    auth: {
      display: "flex",
      flexDirection: "column",
      gap: "2px", // minimal
      padding: "4px", // minimal
      background: "var(--color-bg-app)", // changed from var(--color-surface-tertiary)
      border: "1px solid var(--color-border-medium)", // thinner
      borderRadius: "var(--radius-sm)",
      margin: "0",
      alignItems: "center", // center horizontally
      justifyContent: "center", // center vertically
      textAlign: "center", // center text
    },
    authMain: {
      display: "flex",
      alignItems: "center",
      gap: "4px", // minimal
      flexWrap: "wrap",
      justifyContent: "center", // center horizontally
      textAlign: "center", // center text
    },
    authUser: {
      display: "flex",
      flexDirection: "column",
      gap: "2px", // minimal
      alignItems: "center", // center horizontally
      textAlign: "center", // center text
    },
    authName: {
      fontWeight: 600,
      color: "var(--color-content-primary)",
      fontSize: "0.85em", // smaller
      textAlign: "center", // center text
    },
    authButton: {
      padding: "2px 8px", // minimal
      border: "1px solid var(--color-border-strong)", // thinner
      borderRadius: "var(--radius-sm)",
      fontWeight: 600,
      cursor: "pointer",
      transition: "all var(--duration-fast) ease",
      textDecoration: "none",
      display: "inline-block",
      background: "var(--color-action-primary)",
      color: "var(--color-bg-app)",
      borderColor: "var(--color-border-strong)",
      fontSize: "0.85em", // smaller
    },
    authButtonPrimary: {
      background: "var(--color-action-primary)",
      color: "var(--color-bg-app)",
      borderColor: "var(--color-border-strong)",
    },
    authButtonPrimaryHover: {
      background: "var(--color-action-accent)",
      transform: "translateY(-2px)",
    },
    authButtonDanger: {
      background: "transparent",
      color: "var(--color-content-primary)",
      borderColor: "var(--color-content-primary)",
    },
    authButtonDangerHover: {
      background: "var(--color-action-accent)",
      color: "var(--color-bg-app)",
      borderColor: "var(--color-action-accent)",
    },
    metaLabel: {
      fontSize: "0.7rem",
      fontWeight: 600,
      color: "var(--color-content-secondary)",
      marginBottom: "2px",
      textAlign: "center", // center text
      width: "100%", // ensure full width for centering
    },
    links: {
      display: "flex",
      flexWrap: "wrap",
      gap: "12px", // increased horizontal space between links
      alignItems: "center",
      justifyContent: "center",
      margin: "2px 0",
      width: "100%", // ensure full width for centering
      textAlign: "center", // center text
    },
    version: {
      fontSize: "0.40rem", // smaller
      color: "var(--color-content-secondary)",
      padding: "2px", // minimal
      borderRadius: "var(--radius-sm)",
      textAlign: "center",
      margin: "0",
    },
    legal: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "4px",
      paddingTop: "4px",
      borderTop: "1px solid var(--color-border-medium)",
      fontSize: "0.75rem",
      color: "var(--color-content-secondary)",
      margin: "0",
      width: "100%", // ensure full width for centering
      textAlign: "center", // center text
    },
    legalSpan: {
      color: "var(--color-content-secondary)",
      width: "100%",
      textAlign: "center",
      display: "inline-block",
    },
  };

  return (
    <footer ref={footerRef} style={styles.footer}>
      {/* Toggle bar */}
      <button
        onClick={handleToggle}
        style={styles.toggle}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Réduire le pied de page" : "Développer le pied de page"}
      >
        <span style={styles.toggleLabel}>Le Petit Parti — #Pertitellu</span>
        <svg
          className="site-footer-toggle-icon"
          style={styles.toggleIcon}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible panel */}
      <div style={styles.panel}>
        <div style={styles.inner}>
          {/* Auth section */}
          <div style={styles.auth}>
            {loading ? (
              <div style={styles.authMain}>
                <div className="loading-spinner"></div>
                <span>Chargement utilisateur...</span>
              </div>
            ) : currentUser ? (
              <div style={styles.authUser}>
                <div style={styles.authMain}>
                  <span style={styles.authName}>
                    👤 {currentUser.display_name || currentUser.email}
                  </span>
                  <Link to="/profile" style={{ ...styles.authButton, ...styles.authButtonPrimary }}>
                    Votre profil
                  </Link>
                  <button
                    onClick={async () => await supabase.auth.signOut()}
                    style={{ ...styles.authButton, ...styles.authButtonDanger }}
                  >
                    Déconnexion
                  </button>
                </div>
              </div>
            ) : userStatus === "signing_in" ? (
              <div style={styles.authMain}>
                <div className="loading-spinner"></div>
                <span>Connexion en cours...</span>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                style={{ ...styles.authButton, ...styles.authButtonPrimary }}
              >
                🔐 Connexion / Inscription
              </button>
            )}
          </div>
          <div style={styles.links}>
            <Link to="/" style={styles.link}>
              Accueil
            </Link>
            <Link to="/survey" style={styles.link}>
              Présentation Survey
            </Link>
            <Link to="/transparence" style={styles.link}>
              Enquête Transparence
            </Link>
            <Link to="/methodologie" style={styles.link}>
              Méthodologie
            </Link>
          </div>

          <p style={styles.metaLabel}>Autres services (proto)</p>
          <div style={styles.links}>
            <a
              href="https://app.tooljet.ai/applications/133a5d8d-9268-4813-8a46-0126a309b52a"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              Incidents
            </a>
            <a
              href="https://events-agenda-social.deploypad.app/"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              Agenda
            </a>
            <Link to="/kudocracy" style={styles.link}>
              Propositions
            </Link>
            {showWiki && (
              <Link to="/wiki" style={styles.link}>
                Wiki
              </Link>
            )}
            <Link to="/social" style={styles.link}>
              Café
            </Link>
            <Link to="/bob" style={styles.link}>
              IA
            </Link>
            <a href={VOLUNTEER_URL} target="_blank" rel="noopener noreferrer" style={styles.link}>
              Bénévolat
            </a>
            <a
              href="https://www.facebook.com/groups/1269635707349220"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              Réseaux sociaux
            </a>
          </div>

          {showVersionInfo && (
            <div style={styles.version}>
              Version {APP_VERSION}, déployée le {DEPLOY_DATE}
            </div>
          )}

          <div style={styles.legal}>
            <span style={styles.legalSpan}>
              <Link to="/legal/terms" style={styles.link}>
                Conditions d'utilisation
              </Link>
              &nbsp;| &nbsp;
              <Link to="/legal/privacy" style={styles.link}>
                Politique de confidentialité
              </Link>
            </span>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      )}
    </footer>
  );
}

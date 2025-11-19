import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { APP_VERSION, DEPLOY_DATE, VOLUNTEER_URL } from "../../constants";
import { useAuth, supabase } from "../../lib/supabase";
import { useUserProfile } from "../../lib/useUserProfile";
import AuthModal from "../common/AuthModal";

export default function SiteFooter({ showWiki = true, showVersionInfo = true, onExpandedChange }) {
  // Récupérer l'état depuis localStorage
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('siteFooterExpanded');
    const hasBeenSeen = localStorage.getItem('siteFooterHasBeenSeen');
    // Si jamais vu, ouvrir par défaut pour raisons légales
    if (!hasBeenSeen) return true;
    // Sinon utiliser l'état sauvegardé (par défaut fermé)
    return saved === 'true';
  });
  const [hasBeenSeenExpanded, setHasBeenSeenExpanded] = useState(() => {
    return localStorage.getItem('siteFooterHasBeenSeen') === 'true';
  });
  const [isManualControl, setIsManualControl] = useState(() => {
    return localStorage.getItem('siteFooterManualControl') === 'true';
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id);
  const footerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const lastScrollY = useRef(0);
  const scrollAttempts = useRef(0);
  const wheelAttempts = useRef(0);
  const wheelTimeoutRef = useRef(null);

  // Notifier le parent quand l'état change
  useEffect(() => {
    if (onExpandedChange) {
      onExpandedChange(isExpanded);
    }
  }, [isExpanded, onExpandedChange]);

  // Sauvegarder l'état dans localStorage
  useEffect(() => {
    localStorage.setItem('siteFooterExpanded', isExpanded.toString());
  }, [isExpanded]);

  useEffect(() => {
    localStorage.setItem('siteFooterManualControl', isManualControl.toString());
  }, [isManualControl]);

  useEffect(() => {
    // Marquer comme vu après un court délai (pour s'assurer que le rendu est complet)
    const timer = setTimeout(() => {
      setHasBeenSeenExpanded(true);
      localStorage.setItem('siteFooterHasBeenSeen', 'true');
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Ne gérer l'auto-collapse que si le footer a déjà été vu en entier et pas en contrôle manuel
    if (!hasBeenSeenExpanded || isManualControl) return;

    const handleScroll = () => {
      if (isExpanded) {
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

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wheel', handleWheel);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
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
        const footerBottom = footerRef.current.getBoundingClientRect().bottom;
        const windowHeight = window.innerHeight;
        
        // Scroller jusqu'à la fin du document pour voir le footer en entier
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: 'smooth'
        });
      }, 350); // Attendre la fin de l'animation d'ouverture (300ms + marge)
    }
  };

  return (
    <footer ref={footerRef} className="bg-gray-800 text-white mt-4">
      {/* Barre de toggle toujours visible */}
      <button
        onClick={handleToggle}
        className="w-full py-2 px-4 flex items-center justify-center gap-2 hover:bg-gray-700 transition-colors"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Réduire le pied de page" : "Développer le pied de page"}
      >
        <span className="text-sm">Le Petit Parti — #Pertitellu</span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Contenu pliable */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="max-w-4xl mx-auto px-4 pb-3 text-center space-y-2">
          {/* Auth section */}
          <div className="py-2 border-b border-gray-700">
            {user ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-300">
                    👤 {profile?.display_name || user.email}
                  </span>
                  <Link
                    to="/profile"
                    className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white"
                  >
                    Mon profil
                  </Link>
                  <button
                    onClick={async () => await supabase.auth.signOut()}
                    className="text-xs px-3 py-1 bg-orange-600 hover:bg-orange-700 rounded text-white"
                  >
                    Déconnexion
                  </button>
                </div>
                {profile?.neighborhood && (
                  <span className="text-xs text-gray-400">
                    📍 {profile.neighborhood}
                  </span>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="text-sm px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded text-white font-semibold"
              >
                🔐 Connexion / Inscription
              </button>
            )}
          </div>
          <div className="flex flex-col md:flex-row md:flex-wrap justify-center gap-1.5 text-sm">
            <Link to="/" className="text-orange-400 hover:text-orange-300">
              Accueil
            </Link>
            <Link to="/survey" className="text-orange-400 hover:text-orange-300">
              Présentation Survey
            </Link>
            <Link to="/transparence" className="text-orange-400 hover:text-orange-300">
              Enquête Transparence
            </Link>
            <Link to="/methodologie" className="text-orange-400 hover:text-orange-300">
              Méthodologie
            </Link>
          </div>

          <p className="text-gray-400 text-xs">Autres services (proto)</p>
          <div className="flex flex-col md:flex-row md:flex-wrap justify-center gap-1.5 text-sm">
            <a
              href="https://app.tooljet.ai/applications/133a5d8d-9268-4813-8a46-0126a309b52a"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300"
            >
              Incidents
            </a>
            <a
              href="https://events-agenda-social.deploypad.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300"
            >
              Agenda
            </a>
            <Link to="/kudocracy" className="text-orange-400 hover:text-orange-300">
              Propositions
            </Link>
            {showWiki && (
              <Link to="/wiki" className="text-orange-400 hover:text-orange-300">
                Wiki
              </Link>
            )}
            <Link to="/social" className="text-orange-400 hover:text-orange-300">
              Café
            </Link>
            <Link to="/bob" className="text-orange-400 hover:text-orange-300">
              IA
            </Link>
            <a
              href={VOLUNTEER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300"
            >
              Bénévolat
            </a>
            <a
              href="https://www.facebook.com/groups/1269635707349220"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300"
            >
              Réseaux sociaux
            </a>
          </div>

          {showVersionInfo && (
            <div className="text-xs text-gray-500 mt-0.5 cursor-help">
              Version {APP_VERSION}, déployée le {DEPLOY_DATE}
            </div>
          )}

          <div className="mt-1 text-xs text-gray-400">
            <Link to="/legal/terms" className="hover:text-orange-300 underline mr-2">
              Conditions d'utilisation
            </Link>
            <span>|</span>
            <Link to="/legal/privacy" className="hover:text-orange-300 underline ml-2">
              Politique de confidentialité
            </Link>
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

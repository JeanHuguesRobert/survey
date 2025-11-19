import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { APP_VERSION, DEPLOY_DATE, VOLUNTEER_URL } from "../../constants";

export default function SiteFooter({ showWiki = true, showVersionInfo = true, onExpandedChange }) {
  const [isExpanded, setIsExpanded] = useState(true); // Ouvert par défaut pour raisons légales
  const [hasBeenSeenExpanded, setHasBeenSeenExpanded] = useState(false);
  const [isManualControl, setIsManualControl] = useState(false);
  const footerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  // Notifier le parent quand l'état change
  useEffect(() => {
    if (onExpandedChange) {
      onExpandedChange(isExpanded);
    }
  }, [isExpanded, onExpandedChange]);

  useEffect(() => {
    // Marquer comme vu après un court délai (pour s'assurer que le rendu est complet)
    const timer = setTimeout(() => {
      setHasBeenSeenExpanded(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Ne gérer l'auto-collapse que si le footer a déjà été vu en entier et pas en contrôle manuel
    if (!hasBeenSeenExpanded || isManualControl) return;

    // Fermer le footer au scroll
    const handleScroll = () => {
      if (isExpanded) {
        // Débounce pour éviter trop d'appels
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
          setIsExpanded(false);
        }, 100);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
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
    </footer>
  );
}

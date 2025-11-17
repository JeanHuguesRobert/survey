import React from "react";
import { Link } from "react-router-dom";
import { APP_VERSION, DEPLOY_DATE, VOLUNTEER_URL } from "../../constants";

export default function SiteFooter({ showWiki = true, showVersionInfo = true }) {
  return (
    <footer className="bg-gray-800 text-white py-2 mt-4">
      <div className="max-w-4xl mx-auto px-4 text-center space-y-1">
        <p className="text-sm">Le Petit Parti — déclinaison locale #Pertitellu</p>

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
    </footer>
  );
}

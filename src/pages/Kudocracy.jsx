import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import PropositionList from '../components/kudocracy/PropositionList';
import CreateProposition from '../components/kudocracy/CreateProposition';
import DelegationManager from '../components/kudocracy/DelegationManager';
import VotingDashboard from '../components/kudocracy/VotingDashboard';
import AuthModal from '../components/common/AuthModal';
import { Link } from 'react-router-dom';
import { PRIMARY_COLOR, SECONDARY_COLOR } from '../constants';
import SiteFooter from '../components/layout/SiteFooter';

export default function Kudocracy() {
  const [activeTab, setActiveTab] = useState('browse');
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isHowItWorksExpanded, setIsHowItWorksExpanded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        setUser(session?.user ?? null);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Utilisation du composant AuthModal pour gérer l'authentification

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b-4 border-blue-900">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Kudocracy</h1>
              <p className="text-gray-600 mt-1">Démocratie délégative</p>
            </div>
            <div>
              {user ? (
                <div className="flex items-center gap-4">
                  <span className="text-gray-700">Connecté</span>
                  <button
                    onClick={handleSignOut}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    Déconnexion
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800"
                >
                  Se connecter
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden mb-8">
          <button
            onClick={() => setIsHowItWorksExpanded(!isHowItWorksExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between bg-blue-100 hover:bg-blue-200 transition-colors"
          >
            <h2 className="text-xl font-bold text-blue-900">Comment fonctionne Kudocracy ?</h2>
            <svg
              className={`w-6 h-6 text-blue-900 transition-transform ${isHowItWorksExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isHowItWorksExpanded && (
            <div className="px-6 py-4">
              <ul className="space-y-2 text-gray-700">
                <li><strong>Votez directement</strong> : Approuvez ou désapprouvez les propositions qui vous intéressent</li>
                <li><strong>Déléguez votre vote</strong> : Sur certains sujets, confiez votre voix à quelqu'un en qui vous avez confiance</li>
                <li><strong>Changez d'avis</strong> : Tous les votes sont réversibles, modifiez-les à tout moment</li>
                <li><strong>Transparence totale</strong> : Tous les votes sont publics pour éviter la fraude</li>
                <li><strong>Résultats en temps réel</strong> : Suivez l'évolution des opinions au fil du temps</li>
              </ul>
            </div>
          )}
        </div>

        <nav className="flex gap-2 mb-6 border-b border-gray-200">
          {[
            { id: 'browse', label: 'Propositions' },
            { id: 'create', label: 'Créer une proposition' },
            { id: 'delegations', label: 'Mes délégations' },
            { id: 'dashboard', label: 'Tableau de bord' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-900 border-b-2 border-blue-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div>
          {activeTab === 'browse' && <PropositionList user={user} />}
          {activeTab === 'create' && (
            user ? <CreateProposition user={user} /> : <AuthRequired onAuth={() => setShowAuthModal(true)} />
          )}
          {activeTab === 'delegations' && (
            user ? <DelegationManager user={user} /> : <AuthRequired onAuth={() => setShowAuthModal(true)} />
          )}
          {activeTab === 'dashboard' && <VotingDashboard />}
        </div>
      </div>

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      )}

      <div className="mt-12">
        <SiteFooter />
      </div>
    </div>
  );
}

function AuthRequired({ onAuth }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-12 text-center">
      <h3 className="text-2xl font-bold text-gray-800 mb-4">Connexion requise</h3>
      <p className="text-gray-600 mb-6">Vous devez être connecté pour accéder à cette fonctionnalité</p>
      <button
        onClick={onAuth}
        className="px-6 py-3 bg-blue-900 text-white rounded-md hover:bg-blue-800"
      >
        Se connecter
      </button>
    </div>
  );
}


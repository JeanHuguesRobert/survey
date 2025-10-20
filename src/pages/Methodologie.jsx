import React from 'react';
import { Link } from 'react-router-dom';

export default function Methodologie() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header identique au reste du site */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <div className="mb-4">
              <div className="text-5xl font-bold" style={{ color: '#FF5722' }}>#PERTITELLU</div>
              <div className="h-1 bg-blue-900 my-3 max-w-2xl mx-auto"></div>
              <div className="text-4xl font-bold text-blue-900">CORTI<br/>CAPITALE</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Méthodologie</h1>

          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Objectifs de la consultation</h2>
              <p className="text-gray-600">
                Cette consultation citoyenne vise à recueillir l'opinion des Cortenais sur la démocratie locale 
                et leur vision de l'avenir de la ville. Les résultats serviront à orienter nos propositions
                pour les élections municipales.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Traitement des données</h2>
              <ul className="list-disc list-inside text-gray-600 space-y-2">
                <li>Toutes les réponses sont anonymes</li>
                <li>Les emails ne sont collectés que sur accord explicite</li>
                <li>Les données sont stockées sur des serveurs sécurisés Google</li>
                <li>Les résultats sont actualisés en temps réel</li>
                <li>Les commentaires sont modérés pour retirer tout contenu inapproprié</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Calcul des statistiques</h2>
              <ul className="list-disc list-inside text-gray-600 space-y-2">
                <li>Les moyennes sont calculées sur l'ensemble des réponses</li>
                <li>Les échelles de 1 à 5 utilisent des valeurs numériques entières</li>
                <li>Les pourcentages sont arrondis à une décimale</li>
                <li>Les données aberrantes sont exclues du calcul</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Transparence</h2>
              <div className="space-y-4">
                <p className="text-gray-600">
                  Le code source de cette application est disponible publiquement sur GitHub :
                </p>
                <a 
                  href="https://github.com/jeanhuguesrobert/survey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline block"
                >
                  github.com/jeanhuguesrobert/survey
                </a>
                <p className="text-gray-600">
                  Les données brutes anonymisées peuvent être consultées sur demande.
                </p>
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <h3 className="font-semibold mb-2">Audit éthique</h3>
                  <p className="text-gray-600 mb-2">
                    Un rapport d'audit éthique complet est disponible :
                  </p>
                  <a 
                    href="/audit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" />
                    </svg>
                    Consulter le rapport d'audit éthique
                  </a>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Contact</h2>
              <p className="text-gray-600">
                Pour toute question sur la méthodologie ou pour signaler un problème :
                <a href="mailto:jeanhuguesrobert@gmail.com" className="text-blue-600 hover:underline ml-2">
                  jeanhuguesrobert@gmail.com
                </a>
              </p>
            </section>
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/"
              className="px-4 py-2 bg-gray-100 text-blue-900 font-semibold rounded-md hover:bg-gray-200"
            >
              Retour à la consultation
            </Link>
          </div>
        </div>
      </div>

      <footer className="bg-gray-800 text-white py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="mb-2">Une initiative #PERTITELLU - Corti Capitale</p>
          <a 
            href="https://www.facebook.com/groups/1269635707349220"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:text-orange-300"
          >
            Rejoignez-nous sur Facebook
          </a>
        </div>
      </footer>
    </div>
  );
}

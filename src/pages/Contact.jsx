import React from 'react';
import { Link } from 'react-router-dom';
import { HASHTAG, CITY_NAME } from '../constants';
import CommentSection from '../components/common/CommentSection';
import { useCurrentUser } from '../lib/useCurrentUser';

export default function Contact() {

  const email = import.meta.env.VITE_CONTACT_EMAIL || 'jeanhuguesrobert@gmail.com';
  console.log('Contact page: using contact email', email);
  const { currentUser, loading, error, userStatus } = useCurrentUser();

  const isAdmin = currentUser && currentUser.email === email;

  // UI for loading, error, and signed_out states
  if (userStatus === 'signing_in' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-700">Chargement du profil utilisateur...</div>
      </div>
    );
  }
  if (userStatus === 'signed_out') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-orange-700">Vous devez être connecté pour accéder à la page de contact.<br/>
          <a href="/login" className="text-primary-600 hover:underline">Se connecter</a>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-red-700">Erreur lors du chargement du profil utilisateur : {String(error)}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header identique au reste du site */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <div className="mb-4">
              <div className="text-5xl font-bold text-accent-orange">{HASHTAG}</div>
              <div className="h-1 bg-blue-900 my-3 max-w-2xl mx-auto"></div>
              <div className="text-4xl font-bold text-blue-900">{CITY_NAME.toUpperCase()}<br/>CAPITALE</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Contact</h1>

          <div className="space-y-6">
            <section>
              <p className="text-gray-600">
                Pour nous contacter, écrivez à&nbsp;
                <a href={`mailto:${email}`} className="text-blue-600 hover:underline">{email}</a>.
              </p>
              <p className="text-gray-500 text-sm mt-2">
                Configurable via la variable d'environnement <code>VITE_CONTACT_EMAIL</code> dans votre fichier <code>.env</code>.
              </p>
            </section>
          </div>

          {/* Admin section visible only to the configured contact email */}
          {isAdmin && (
            <div className="mt-8 border-t pt-6">
              <h2 className="text-xl font-semibold text-blue-800 mb-4">Admin</h2>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/admin/document-management"
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Gérer les documents (Document Management)
                  </Link>
                </li>
              </ul>
            </div>
          )}

          <div className="mt-8 text-center">
            <Link
              to="/"
              className="px-4 py-2 bg-gray-100 text-blue-900 font-semibold rounded-md hover:bg-gray-200"
            >
              Retour à la consultation
            </Link>
          </div>
        </div>

        {/* Section de questions et discussions */}
        {true && (
          <div className="mt-6">
            <CommentSection
              linkedType="contact_page"
              linkedId="main"
              currentUser={currentUser}
              defaultExpanded={false}
            />
          </div>
        )}
      </div>

      <footer className="bg-gray-800 text-white py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="mb-2">Une initiative {HASHTAG} - {CITY_NAME} Capitale</p>
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
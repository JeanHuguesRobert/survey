import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCurrentUser } from '../lib/useCurrentUser';
import SiteFooter from '../components/layout/SiteFooter';

export default function UserProfile() {
  const { currentUser, loading: authLoading, updateProfile } = useCurrentUser();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    display_name: '',
    neighborhood: '',
    interests: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Rediriger si non connecté
  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate('/');
    }
  }, [currentUser, authLoading, navigate]);

  // Charger les données du profil dans le formulaire
  useEffect(() => {
    if (currentUser) {
      setFormData({
        display_name: currentUser.display_name || '',
        neighborhood: currentUser.neighborhood || '',
        interests: currentUser.interests || '',
      });
    }
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    const result = await updateProfile(formData);

    if (result.success) {
      setMessage({ type: 'success', text: 'Profil mis à jour avec succès !' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Erreur lors de la mise à jour' });
    }

    setSaving(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Chargement du profil...</div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Votre profil</h1>
            <Link
              to="/user-dashboard"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-semibold flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
              Votre tableau de bord
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email (non modifiable) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={currentUser.email}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">
                L'email ne peut pas être modifié
              </p>
            </div>

            {/* Nom d'affichage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom d'affichage *
              </label>
              <input
                type="text"
                name="display_name"
                value={formData.display_name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Comment souhaitez-vous être appelé ?"
              />
            </div>

            {/* Quartier */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quartier / Localisation
              </label>
              <input
                type="text"
                name="neighborhood"
                value={formData.neighborhood}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Ex: Centre-ville, Porette, etc."
              />
            </div>

            {/* Centres d'intérêt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Centres d'intérêt / Expertises
              </label>
              <textarea
                name="interests"
                value={formData.interests}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Ex: urbanisme, culture, environnement, éducation..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Cela aide à vous connecter avec des personnes partageant les mêmes intérêts
              </p>
            </div>

            {/* RGPD Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                🔒 Confidentialité
              </h3>
              <p className="text-xs text-blue-800">
                Vos informations personnelles sont protégées et ne seront jamais vendues.
                Seul votre nom d'affichage est visible publiquement dans vos contributions.
              </p>
              {currentUser?.rgpd_consent_date && (
                <p className="text-xs text-blue-700 mt-2">
                  Consentement RGPD accepté le {new Date(currentUser.rgpd_consent_date).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>

            {/* Message de confirmation/erreur */}
            {message.text && (
              <div
                className={`rounded-md p-4 ${
                  message.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Boutons */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-orange-600 text-white py-3 px-6 rounded-md font-semibold hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </form>

          {/* Statistiques du compte */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations du compte</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Membre depuis:</span>
                <div className="font-medium text-gray-900">
                  {currentUser?.created_at ? new Date(currentUser.created_at).toLocaleDateString('fr-FR') : 'N/A'}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Dernière modification:</span>
                <div className="font-medium text-gray-900">
                  {currentUser?.updated_at ? new Date(currentUser.updated_at).toLocaleDateString('fr-FR') : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}

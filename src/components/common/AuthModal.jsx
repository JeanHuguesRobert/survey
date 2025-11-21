import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      console.log('[DIAG] AuthModal: onSuccess called after signIn');
      onSuccess?.();
      console.log('[DIAG] AuthModal: onClose called after signIn');
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError('');
    try {
      if (!displayName) {
        setError('Veuillez entrer un nom d\'affichage');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      if (data.user) {
        const { error: insertError } = await supabase.from('users').insert({
          id: data.user.id,
          email: data.user.email,
          display_name: displayName
        });
        
        if (insertError) {
          console.error('Erreur cr\u00e9ation user dans table users:', insertError);
          throw insertError;
        }
      }
      console.log('[DIAG] AuthModal: onSuccess called after signUp');
      onSuccess?.();
      console.log('[DIAG] AuthModal: onClose called after signUp');
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur d\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            {mode === 'signin' ? 'Connexion' : 'Créer un compte'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form className="space-y-4">
          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Nom d'affichage
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700">
              {error}
            </div>
          )}

          {mode === 'signin' ? (
            <button
              onClick={handleSignIn}
              className="w-full py-3 px-6 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-md border-2 border-orange-600 shadow-lg"
              disabled={loading}
            >
              {loading ? 'Connexion en cours...' : '🔐 Se connecter'}
            </button>
          ) : (
            <button
              onClick={handleSignUp}
              className="w-full py-3 px-6 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 border-2 border-green-700 shadow-lg"
              disabled={loading}
            >
              {loading ? 'Inscription en cours...' : '✨ S\'inscrire'}
            </button>
          )}
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-orange-600 hover:underline"
          >
            {mode === 'signin' ? 'Créer un compte' : 'Déjà un compte ? Se connecter'}
          </button>
        </div>
      </div>
    </div>
  );
}
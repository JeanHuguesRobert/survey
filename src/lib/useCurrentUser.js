import { useState, useEffect } from 'react';
import { supabase } from './supabase';

/**
 * Hook pour récupérer l'utilisateur actuellement connecté
 * Combine les données d'authentification avec le profil utilisateur
 * 
 * @returns {Object} { currentUser, loading, error }
 */
export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCurrentUser();

    // Écoute les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await fetchCurrentUser();
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  async function fetchCurrentUser() {
    try {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) throw authError;

      if (!user) {
        setCurrentUser(null);
        return;
      }

      // Tente de récupérer le profil complet depuis la table users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (userError) {
        console.warn('Could not fetch user profile:', userError);
        // Fallback sur les données d'auth
        setCurrentUser(user);
      } else {
        setCurrentUser(userData || user);
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
      setError(err.message);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }

  return { currentUser, loading, error, refetch: fetchCurrentUser };
}

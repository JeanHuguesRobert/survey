import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useDataLoader } from './useStatusOperations';

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
  const getStoredSession = () => {
    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      if (!projectRef) return null;
      
      const key = `sb-${projectRef}-auth-token`;
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      
      const session = JSON.parse(stored);
      if (!session || !session.access_token || !session.user) return null;
      
      // Check if token is expired
      const expiresAt = session.expires_at;
      if (!expiresAt || Date.now() / 1000 > expiresAt) return null;
      
      return session;
    } catch (err) {
      console.error('Error getting stored session:', err);
      return null;
    }
  };

  useEffect(() => {
    if (!supabase) {
      console.error('No supabase client in useCurrentUser');
      setLoading(false);
      return;
    }

    console.log('useCurrentUser: Checking for stored session');
    
    // Check for stored session
    const storedSession = getStoredSession();
    if (storedSession) {
      console.log('useCurrentUser: Found stored session, fetching profile');
      fetchUserProfile(storedSession.user);
    } else {
      console.log('useCurrentUser: No stored session');
      setCurrentUser(null);
      setLoading(false);
    }

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('useCurrentUser: Auth state changed:', event, !!session);
      
      if (session?.user) {
        await fetchUserProfile(session.user);
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function fetchUserProfile(authUser) {
    console.log('useCurrentUser: Fetching profile for:', authUser.id);
    try {
      const userData = await loadUserProfile(async () => {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (error) throw error;
        return data;
      });

      console.log('useCurrentUser: Profile result:', { userData: !!userData });

      setCurrentUser(userData || authUser);
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setCurrentUser(authUser);
    } finally {
      setLoading(false);
    }
  }

  const updateProfile = async (updates) => {
    try {
      if (!currentUser?.id) {
        return { success: false, error: 'No user logged in' };
      }
      
      setLoading(true);
      const data = await loadUserProfile(async () => {
        const { data, error } = await supabase
          .from('users')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentUser.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      });

      setCurrentUser(data);
      return { success: true, data };
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  return { currentUser, loading, error, updateProfile };
}

/**
 * Hook pour récupérer le profil d'un utilisateur spécifique (pas forcément l'utilisateur connecté)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Object} { profile, loading, error }
 */
export function useUserProfileById(userId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadProfile = useDataLoader();

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await loadProfile(async () => {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) throw error;
        return data;
      });

      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { profile, loading, error, refetch: fetchProfile };
}

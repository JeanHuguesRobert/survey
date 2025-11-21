import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';
import { useDataLoader } from './useStatusOperations';


// Shared profile fetching function
async function fetchUserProfileById(userId, loader) {
  try {
    const data = await loader(async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      // Debug log: print query result and error
      // eslint-disable-next-line no-console
      console.log('[fetchUserProfileById] userId:', userId, 'data:', data, 'error:', error);
      if (error) throw error;
      return data;
    });
    return { profile: data, error: null };
  } catch (err) {
    console.error('Error fetching profile:', err);
    return { profile: null, error: err.message || String(err) };
  }
}

/**
 * Hook pour récupérer l'utilisateur actuellement connecté
 * Combine les données d'authentification avec le profil utilisateur
 * @returns {Object} { currentUser, loading, error, userStatus, updateProfile }
 */
export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userStatus, setUserStatus] = useState('signed_out'); // 'signed_out' | 'signing_in' | 'signed_in'
  // Debug: log userStatus changes
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[useCurrentUser] userStatus changed:', userStatus);
  }, [userStatus]);
  const loadUserProfile = useDataLoader();
  const lastFetchedUserIdRef = useRef(null);
  const isSigningInRef = useRef(false);
  const hasProfileRef = useRef(false);

  // Helper to get stored session
  const getStoredSession = useCallback(() => {
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
  }, []);

  // Centralized profile fetch logic
  const handleProfileFetch = useCallback(async (authUser) => {
    console.log('[handleProfileFetch] CALLED with userId:', authUser?.id, 'lastFetched:', lastFetchedUserIdRef.current, 'hasProfile:', hasProfileRef.current);
    if (!authUser || !authUser.id) {
      setError('Impossible de charger le profil utilisateur (id manquant)');
      setCurrentUser(null);
      setUserStatus('signed_out');
      setLoading(false);
      isSigningInRef.current = false;
      hasProfileRef.current = false;
      return;
    }
    // Skip if we already have this user's profile loaded
    if (lastFetchedUserIdRef.current === authUser.id && hasProfileRef.current) {
      console.log('[handleProfileFetch] SKIPPING - profile already loaded');
      setLoading(false);
      setUserStatus('signed_in');
      isSigningInRef.current = false;
      return;
    }

    // Prevent concurrent fetches for the same user
    if (isSigningInRef.current && lastFetchedUserIdRef.current === authUser.id) {
      return;
    }

    setLoading(true);
    setUserStatus('signing_in');
    isSigningInRef.current = true;
    lastFetchedUserIdRef.current = authUser.id;

    // Track if timeout has fired
    let timedOut = false;

    // Start a 10s timeout: if still signing_in, set to signed_out and alert
    const timeoutId = setTimeout(() => {
      if (isSigningInRef.current) {
        timedOut = true;
        isSigningInRef.current = false;
        setUserStatus('signed_out');
        setLoading(false);
        // eslint-disable-next-line no-alert
        alert("Désolé, la connexion a pris trop de temps. Veuillez réessayer plus tard.");
      }
    }, 10000);

    const { profile, error: fetchError } = await fetchUserProfileById(authUser.id, loadUserProfile);
    isSigningInRef.current = false;
    clearTimeout(timeoutId);

    // Even if timeout fired, update state with the fetch result
    // If profile loaded successfully, sign the user in
    if (profile) {
      console.log('[handleProfileFetch] SUCCESS - setting currentUser with profile:', profile.display_name);
      setCurrentUser({ ...authUser, profile });
      setUserStatus('signed_in');
      setError(null);
      setLoading(false);
      hasProfileRef.current = true;
    } else if (!timedOut) {
      // Only update to signed_out if timeout hasn't already done so
      setCurrentUser(null);
      setUserStatus('signed_out');
      setError(fetchError);
      setLoading(false);
      hasProfileRef.current = false;
    }
    // If timedOut and no profile, the timeout already set the correct state
  }, [loadUserProfile]);

  // Store handleProfileFetch in a ref to prevent auth subscription recreation
  const handleProfileFetchRef = useRef(handleProfileFetch);
  useEffect(() => {
    handleProfileFetchRef.current = handleProfileFetch;
  }, [handleProfileFetch]);

  // Auth state management
  useEffect(() => {
    console.log('[useCurrentUser] AUTH EFFECT RUNNING - setting up subscription');
    if (!supabase) {
      setError('Supabase client not initialized');
      setLoading(false);
      setUserStatus('signed_out');
      return;
    }
    // Check for stored session
    const storedSession = getStoredSession();
    if (storedSession) {
      handleProfileFetchRef.current(storedSession.user);
    } else {
      setCurrentUser(null);
      setUserStatus('signed_out');
      setLoading(false);
    }
    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // eslint-disable-next-line no-console
      console.log('[useCurrentUser] onAuthStateChange event:', event, session?.user?.id);
      if (session?.user) {
        const newUserId = session.user.id;
        const shouldFetch = event === 'SIGNED_IN' || lastFetchedUserIdRef.current !== newUserId;
        if (shouldFetch) {
          await handleProfileFetchRef.current(session.user);
        } else {
          setLoading(false);
          setUserStatus('signed_in');
        }
      } else {
        setCurrentUser(null);
        setUserStatus('signed_out');
        setLoading(false);
        hasProfileRef.current = false; // Reset flag on sign-out
      }
    });
    return () => {
      console.log('[useCurrentUser] AUTH EFFECT CLEANUP - unsubscribing');
      subscription.unsubscribe();
    };
  }, [getStoredSession, supabase]);

  // Update profile function (unchanged)
  const updateProfile = async (updates) => {
    try {
      if (!currentUser?.id) {
        return { success: false, error: 'No user logged in' };
      }
      setLoading(true);
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

  return { currentUser, loading, error, userStatus, updateProfile };
}

/**
 * Hook pour récupérer le profil d'un utilisateur spécifique (pas forcément l'utilisateur connecté)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Object} { profile, loading, error, refetch }
 */
export function useUserProfileById(userId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadProfile = useDataLoader();

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const { profile: fetchedProfile, error: fetchError } = await fetchUserProfileById(userId, loadProfile);
    setProfile(fetchedProfile);
    setError(fetchError);
    setLoading(false);
  }, [userId, loadProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refetch: fetchProfile };
}

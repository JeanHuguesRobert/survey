import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const SupabaseContext = createContext(undefined);

export function SupabaseProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [realtimeStatus, setRealtimeStatus] = useState('disconnected');
  const [authEvent, setAuthEvent] = useState(null);
  // Job monitoring state
  const [activeJobs, setActiveJobs] = useState(new Map());

  // Job monitoring functions
  const createJob = async (type, payload = {}) => {
    console.log('SupabaseContext: Creating job:', type, payload);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          type,
          payload,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      console.log('SupabaseContext: Created job:', data.id);
      return data;
    } catch (err) {
      console.error('SupabaseContext: Error creating job:', err);
      throw err;
    }
  };

  const updateJobProgress = async (jobId, progress, message, status) => {
    console.log('SupabaseContext: Updating job progress:', jobId, progress, status);
    try {
      const { error } = await supabase.rpc('update_job_progress', {
        job_id: jobId,
        new_progress: progress,
        new_message: message,
        new_status: status
      });

      if (error) throw error;
    } catch (err) {
      console.error('SupabaseContext: Error updating job progress:', err);
      throw err;
    }
  };

  const getJob = async (jobId) => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('SupabaseContext: Error fetching job:', err);
      throw err;
    }
  };

  const cancelJob = async (jobId) => {
    console.log('SupabaseContext: Cancelling job:', jobId);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'cancelled' })
        .eq('id', jobId);

      if (error) throw error;
    } catch (err) {
      console.error('SupabaseContext: Error cancelling job:', err);
      throw err;
    }
  };

  const testConnection = async () => {
    console.log('SupabaseContext: Testing database connection...');
    try {
      const startTime = Date.now();
      
      // Test 1: Basic connection to propositions table
      const { data: propositionsData, error: propositionsError } = await supabase
        .from('propositions')
        .select('id')
        .limit(1);
      
      if (propositionsError) {
        console.error('SupabaseContext: Propositions table test failed:', propositionsError);
        // Check if it's a permissions issue
        if (propositionsError.code === '42501' || propositionsError.message?.includes('permission denied')) {
          setConnectionError('Database access denied. Check Row Level Security (RLS) policies on your tables.');
        } else if (propositionsError.code === '42P01') {
          setConnectionError('Table "propositions" does not exist. Please check your database schema.');
        } else if (propositionsError.message?.includes('JWT') || propositionsError.message?.includes('invalid') || propositionsError.code === '401') {
          setConnectionError('Invalid Supabase API key. Please check your VITE_SUPABASE_ANON_KEY in .env file.');
        } else {
          setConnectionError(`Database connection issue: ${propositionsError.message} (Code: ${propositionsError.code})`);
        }
        return;
      }
      
      // Test 2: Test user profile access (critical for app functionality)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();
          
        if (userError && userError.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is OK
          console.warn('SupabaseContext: User profile access test failed:', userError);
          setConnectionError(`User data access issue: ${userError.message}. Check RLS policies for users table.`);
          return;
        }
      }
      
      // Test 3: Test wiki pages access
      const { data: wikiData, error: wikiError } = await supabase
        .from('wiki_pages')
        .select('id')
        .limit(1);
        
      if (wikiError && wikiError.code !== 'PGRST116') {
        console.warn('SupabaseContext: Wiki pages access test failed:', wikiError);
        setConnectionError(`Wiki access issue: ${wikiError.message}. Check RLS policies for wiki_pages table.`);
        return;
      }
      
      const duration = Date.now() - startTime;
      console.log(`SupabaseContext: Connection test completed in ${duration}ms - All tests passed`);
      console.log('SupabaseContext: Found records - propositions:', propositionsData?.length || 0, 'wiki:', wikiData?.length || 0);
      setConnectionError(null);
    } catch (err) {
      console.error('SupabaseContext: Connection test exception:', err);
      setConnectionError('Unable to connect to Supabase. Check your configuration.');
    }
  };

  useEffect(() => {
    console.log('SupabaseContext: Initializing with URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('SupabaseContext: Initializing with key:', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...');
    
    if (!supabase) {
      console.error('SupabaseContext: Supabase client is null');
      setConnectionError('Supabase client not initialized. Check your environment variables.');
      setLoading(false);
      return;
    }

    // Monitor realtime connection state with detailed status tracking
    const channel = supabase.channel('connection-monitor');
    
    channel.subscribe((status, err) => {
      console.log('SupabaseContext: Realtime channel status:', status, err);
      setRealtimeStatus(status.toLowerCase());
      
      if (status === 'SUBSCRIBED') {
        setConnectionState('connected');
        console.log('SupabaseContext: Realtime connected and subscribed');
        // Test database connection when realtime connects
        testConnection();
      } else if (status === 'SUBSCRIBING') {
        setConnectionState('connecting');
        console.log('SupabaseContext: Realtime connecting...');
      } else if (status === 'CHANNEL_ERROR' || status === 'ERROR') {
        setConnectionState('error');
        console.warn('SupabaseContext: Realtime connection error:', err);
        if (!connectionError) {
          setConnectionError(`Realtime connection failed: ${err?.message || 'Unknown error'}`);
        }
      } else if (status === 'TIMED_OUT') {
        setConnectionState('disconnected');
        console.warn('SupabaseContext: Realtime connection timed out');
        if (!connectionError) {
          setConnectionError('Connection timed out - attempting to reconnect...');
        }
      } else if (status === 'CLOSED') {
        setConnectionState('disconnected');
        console.warn('SupabaseContext: Realtime connection closed');
        if (!connectionError) {
          setConnectionError('Connection lost - attempting to reconnect...');
        }
      } else if (status === 'REJOINING') {
        setConnectionState('reconnecting');
        console.log('SupabaseContext: Realtime rejoining...');
        if (!connectionError) {
          setConnectionError('Reconnecting...');
        }
      }
    });

    // Note: realtime.on() is not available in Supabase JS v2
    // Connection monitoring is handled through channel subscriptions above

    // Initialize session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error);
        setError(error);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes with detailed event tracking
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('SupabaseContext: Auth state change:', event, session?.user?.id ? 'user:' + session.user.id.substring(0, 8) : 'no user');
      setAuthEvent(event);
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Clear connection error on successful auth
      if (event === 'SIGNED_IN' && connectionError) {
        setConnectionError(null);
      }
    });

    // Test connection after a short delay to allow auth to initialize
    setTimeout(testConnection, 1000);

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const value = {
    supabase,
    session,
    user,
    loading,
    error,
    connectionError,
    connectionState,
    realtimeStatus,
    authEvent,
    activeJobs,
    testConnection,
    createJob,
    updateJobProgress,
    getJob,
    cancelJob,
  };

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  if (context === null) {
    console.warn('useSupabase: context is null, returning default value');
    return {
      supabase: null,
      session: null,
      user: null,
      loading: true,
      error: null,
      connectionError: 'Supabase client not initialized',
      connectionState: 'disconnected',
      realtimeStatus: 'disconnected',
      authEvent: null,
      activeJobs: new Map(),
      testConnection: () => {},
      createJob: () => Promise.reject(new Error('Supabase not initialized')),
      updateJobProgress: () => Promise.reject(new Error('Supabase not initialized')),
      getJob: () => Promise.reject(new Error('Supabase not initialized')),
      cancelJob: () => Promise.reject(new Error('Supabase not initialized')),
    };
  }
  return context;
}

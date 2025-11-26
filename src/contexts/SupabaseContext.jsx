import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useCurrentUser } from "../lib/useCurrentUser";

const SupabaseContext = createContext(undefined);

export function SupabaseProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const {
    currentUser,
    loading: userLoading,
    error: userError,
    userStatus,
    updateProfile,
  } = useCurrentUser();
  const [connectionState, setConnectionState] = useState("disconnected");
  const [realtimeStatus, setRealtimeStatus] = useState("disconnected");
  const [authEvent, setAuthEvent] = useState(null);
  // Job monitoring state
  const [activeJobs, setActiveJobs] = useState(new Map());

  // Job monitoring functions
  const createJob = async (type, payload = {}) => {
    console.log("SupabaseContext: Creating job:", type, payload);
    try {
      const { data, error } = await supabase
        .from("jobs")
        .insert({
          type,
          payload,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      console.log("SupabaseContext: Created job:", data.id);
      return data;
    } catch (err) {
      console.error("SupabaseContext: Error creating job:", err);
      throw err;
    }
  };

  const updateJobProgress = async (jobId, progress, message, status) => {
    console.log("SupabaseContext: Updating job progress:", jobId, progress, status);
    try {
      const { error } = await supabase.rpc("update_job_progress", {
        job_id: jobId,
        new_progress: progress,
        new_message: message,
        new_status: status,
      });

      if (error) throw error;
    } catch (err) {
      console.error("SupabaseContext: Error updating job progress:", err);
      throw err;
    }
  };

  const getJob = async (jobId) => {
    try {
      const { data, error } = await supabase.from("jobs").select("*").eq("id", jobId).single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("SupabaseContext: Error fetching job:", err);
      throw err;
    }
  };

  const cancelJob = async (jobId) => {
    console.log("SupabaseContext: Cancelling job:", jobId);
    try {
      const { error } = await supabase.from("jobs").update({ status: "cancelled" }).eq("id", jobId);

      if (error) throw error;
    } catch (err) {
      console.error("SupabaseContext: Error cancelling job:", err);
      throw err;
    }
  };

  useEffect(() => {
    console.log("SupabaseContext: Initializing with URL:", import.meta.env.VITE_SUPABASE_URL);
    console.log(
      "SupabaseContext: Initializing with key:",
      import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + "..."
    );

    if (!supabase) {
      console.error("SupabaseContext: Supabase client is null");
      setLoading(false);
      return;
    }

    // Monitor realtime connection state with detailed status tracking
    const channel = supabase.channel("connection-monitor");

    channel.subscribe((status, err) => {
      console.log("SupabaseContext: Realtime channel status:", status, err);
      setRealtimeStatus(status.toLowerCase());

      if (status === "SUBSCRIBED") {
        setConnectionState("connected");
        console.log("SupabaseContext: Realtime connected and subscribed");
      } else if (status === "SUBSCRIBING") {
        setConnectionState("connecting");
        console.log("SupabaseContext: Realtime connecting...");
      } else if (status === "CHANNEL_ERROR" || status === "ERROR") {
        setConnectionState("error");
        console.warn("SupabaseContext: Realtime connection error:", {
          status,
          err,
          connectionState,
        });
      } else if (status === "TIMED_OUT") {
        setConnectionState("disconnected");
        console.warn("SupabaseContext: Realtime connection timed out");
      } else if (status === "CLOSED") {
        setConnectionState("disconnected");
        console.warn("SupabaseContext: Realtime connection closed");
      } else if (status === "REJOINING") {
        setConnectionState("reconnecting");
        console.log("SupabaseContext: Realtime rejoining...");
      }
    });

    // Initialize session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Error getting session:", error);
        setError(error);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes with detailed event tracking
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(
        "SupabaseContext: Auth state change:",
        event,
        session?.user?.id ? "user:" + session.user.id.substring(0, 8) : "no user"
      );
      setAuthEvent(event);

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const value = {
    supabase,
    session,
    user,
    currentUser,
    loading,
    error,
    userLoading,
    userError,
    userStatus,
    updateProfile,
    connectionState,
    realtimeStatus,
    authEvent,
    activeJobs,
    createJob,
    updateJobProgress,
    getJob,
    cancelJob,
  };

  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>;
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error("useSupabase must be used within a SupabaseProvider");
  }
  if (context === null) {
    console.warn("useSupabase: context is null, returning default value");
    return {
      supabase: null,
      session: null,
      user: null,
      loading: true,
      error: null,
      connectionState: "disconnected",
      realtimeStatus: "disconnected",
      authEvent: null,
      activeJobs: new Map(),
      createJob: () => Promise.reject(new Error("Supabase not initialized")),
      updateJobProgress: () => Promise.reject(new Error("Supabase not initialized")),
      getJob: () => Promise.reject(new Error("Supabase not initialized")),
      cancelJob: () => Promise.reject(new Error("Supabase not initialized")),
    };
  }
  return context;
}

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const rawSupabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storage: typeof window !== "undefined" ? window.localStorage : undefined,
        },
      })
    : null;

// Create a logging proxy around the supabase client
export const supabase = rawSupabase
  ? new Proxy(rawSupabase, {
      get(target, prop) {
        const value = target[prop];
        if (typeof value === "function") {
          return (...args) => {
            const startTime = Date.now();
            console.log(`Supabase: Calling ${prop}`, args.length > 0 ? args[0] : "");

            try {
              const result = value.apply(target, args);

              // If it's a promise, log the result
              if (result && typeof result.then === "function") {
                return result.then(
                  (data) => {
                    const duration = Date.now() - startTime;
                    if (data?.error) {
                      console.error(
                        `Supabase: ${prop} resolved in ${duration}ms Error: ${data.error.message}`
                      );
                      throw new Error(`Supabase error in ${prop}: ${data.error.message}`);
                    } else {
                      console.log(`Supabase: ${prop} resolved in ${duration}ms Success`);
                    }
                    return data;
                  },
                  (error) => {
                    const duration = Date.now() - startTime;
                    console.error(`Supabase: ${prop} rejected in ${duration}ms`, error);
                    throw error;
                  }
                );
              }

              // For non-promise returns (like channel creation)
              console.log(`Supabase: ${prop} returned synchronously`);
              return result;
            } catch (error) {
              const duration = Date.now() - startTime;
              console.error(`Supabase: ${prop} threw synchronously in ${duration}ms`, error);
              throw error;
            }
          };
        }
        return value;
      },
    })
  : null;

/**
 * Hook to get current authenticated user (deprecated - use useSupabase context instead)
 */
export function useAuth() {
  console.warn("useAuth is deprecated. Use useSupabase context instead.");
  return { user: null, loading: false };
}

import { useState, useEffect } from "react";
import { loadInstanceConfig, getConfig } from "../common/config/instanceConfig.core.js";

// A simple in-memory cache for the config to avoid re-fetching if already loaded
let configCache = null;

// Fallback config in case loading fails or is not yet complete
const getFallbackConfig = () => ({});

export function useInstanceConfig() {
  const [config, setConfig] = useState(configCache || getFallbackConfig());
  const [loading, setLoading] = useState(!configCache);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Only load if config is not already in cache
    if (!configCache) {
      setLoading(true);
      loadInstanceConfig()
        .then((cfg) => {
          configCache = cfg; // Cache the loaded config
          setConfig(cfg);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load instance config:", err);
          setError(err);
          setLoading(false);
        });
    }
  }, []); // Empty dependency array means this effect runs once on mount

  const refresh = async () => {
    setLoading(true);
    setError(null); // Clear previous errors on refresh
    try {
      const cfg = await loadInstanceConfig(true); // Force refresh
      configCache = cfg; // Update cache
      setConfig(cfg);
    } catch (err) {
      console.error("Failed to refresh instance config:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get a specific config value
  const get = (key, defaultValue = null) => {
    return getConfig(key, defaultValue);
  };

  return { config, loading, error, refresh, get };
}

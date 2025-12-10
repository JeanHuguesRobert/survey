// File: packages/cop-kernel/src/storage.js
// Description:
//   Storage abstraction layer for COP.
//   Define a COPStorage interface and a default Supabase-based implementation.
//
//   Goal: all other helpers (debugLog, events, artifacts, agentIdentity, etc.)
//   should depend on this module instead of creating their own Supabase client.
//
//   Later, you can implement alternative drivers (in-memory, other DB, etc.)
//   by providing another createStorage(...) implementation.

import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env.js";

let defaultStorage = null;

/**
 * @typedef {Object} COPDebugLogStorage
 * @property {(logRecord: object) => Promise<{ok: boolean, error?: string}>} insert
 */

/**
 * @typedef {Object} COPEventsStorage
 * @property {(eventRecord: object) => Promise<{ok: boolean, error?: string, event?: object}>} insert
 */

/**
 * @typedef {Object} COPArtifactsStorage
 * @property {(artifactRecord: object) => Promise<{ok: boolean, error?: string, artifact?: object}>} insert
 */

/**
 * @typedef {Object} COPAgentIdentityStorage
 * @property {(identity: object, conflictKey?: "agent_id"|"agent_name") => Promise<{ok: boolean, error?: string, identity?: object}>} upsert
 * @property {(agent_id: string) => Promise<{ok: boolean, error?: string, identity?: object|null}>} getById
 * @property {(agent_name: string) => Promise<{ok: boolean, error?: string, identity?: object|null}>} getByName
 * @property {(params: {status?: string, limit?: number}) => Promise<{ok: boolean, error?: string, identities: object[]}>} list
 * @property {(agent_id: string, status: string) => Promise<{ok: boolean, error?: string, identity?: object|null}>} updateStatus
 */

/**
 * @typedef {Object} COPStorage
 * @property {COPDebugLogStorage} debugLogs
 * @property {COPEventsStorage} events
 * @property {COPArtifactsStorage} artifacts
 * @property {COPAgentIdentityStorage} agentIdentities
 * // You can later add: nodes, agents, sessions, etc.
 */

/**
 * Create a Supabase-based COPStorage.
 *
 * @param {Object} [options]
 * @param {string} [options.supabaseUrl]
 * @param {string} [options.supabaseServiceKey]
 * @returns {COPStorage}
 */
export function createSupabaseStorage(options = {}) {
  const url = options.supabaseUrl || getEnv("SUPABASE_URL");
  const key = options.supabaseServiceKey || getEnv("SUPABASE_SERVICE_ROLE");
  if (!url || !key) {
    throw new Error("createSupabaseStorage: SUPABASE_URL or SUPABASE_SERVICE_ROLE not set");
  }
  const client = createClient(url, key);

  const debugLogs = {
    async insert(logRecord) {
      const { error } = await client.from("cop_debug_logs").insert(logRecord);
      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true };
    },
  };

  const events = {
    async insert(eventRecord) {
      const { data, error } = await client
        .from("cop_events")
        .insert(eventRecord)
        .select()
        .maybeSingle();
      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true, event: data };
    },
  };

  const artifacts = {
    async insert(artifactRecord) {
      const { data, error } = await client
        .from("cop_artifacts")
        .insert(artifactRecord)
        .select()
        .maybeSingle();
      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true, artifact: data };
    },
  };

  const agentIdentities = {
    async upsert(identity, conflictKey = "agent_name") {
      const { data, error } = await client
        .from("cop_agent_identities")
        .upsert(identity, { onConflict: conflictKey })
        .select()
        .maybeSingle();
      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true, identity: data };
    },
    async getById(agent_id) {
      const { data, error } = await client
        .from("cop_agent_identities")
        .select("*")
        .eq("agent_id", agent_id)
        .maybeSingle();
      if (error) {
        return { ok: false, error: error.message, identity: null };
      }
      return { ok: true, identity: data || null };
    },
    async getByName(agent_name) {
      const { data, error } = await client
        .from("cop_agent_identities")
        .select("*")
        .eq("agent_name", agent_name)
        .maybeSingle();
      if (error) {
        return { ok: false, error: error.message, identity: null };
      }
      return { ok: true, identity: data || null };
    },
    async list({ status, limit = 100 } = {}) {
      let q = client
        .from("cop_agent_identities")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(limit);
      if (status) {
        q = q.eq("status", status);
      }
      const { data, error } = await q;
      if (error) {
        return { ok: false, error: error.message, identities: [] };
      }
      return { ok: true, identities: data || [] };
    },
    async updateStatus(agent_id, status) {
      const { data, error } = await client
        .from("cop_agent_identities")
        .update({ status })
        .eq("agent_id", agent_id)
        .select()
        .maybeSingle();
      if (error) {
        return { ok: false, error: error.message, identity: null };
      }
      return { ok: true, identity: data || null };
    },
  };

  /** @type {COPStorage} */
  const storage = {
    debugLogs,
    events,
    artifacts,
    agentIdentities,
  };

  return storage;
}

/**
 * Get a process-wide default storage instance.
 * For most usages, this is enough.
 *
 * @returns {COPStorage}
 */
export function getDefaultStorage() {
  if (!defaultStorage) {
    defaultStorage = createSupabaseStorage();
  }
  return defaultStorage;
}

/**
 * Allow overriding the default storage (for tests, alternate backends, etc.).
 *
 * @param {COPStorage} storage
 */
export function setDefaultStorage(storage) {
  defaultStorage = storage;
}

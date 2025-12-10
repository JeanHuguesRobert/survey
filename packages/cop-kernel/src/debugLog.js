// File: packages/cop-kernel/src/debugLog.js
// Description:
//   Helper to insert debug logs into cop_debug_logs (Supabase).
//   Safe to call from both Node and Deno contexts.

import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env.js";

let supabase = null;

function getSupabase() {
  if (!supabase) {
    const url = getEnv("SUPABASE_URL");
    const key = getEnv("SUPABASE_SERVICE_ROLE");
    if (!url || !key) {
      throw new Error("logCopDebug: SUPABASE_URL or SUPABASE_SERVICE_ROLE not set");
    }
    supabase = createClient(url, key);
  }
  return supabase;
}

/**
 * Log a debug entry into cop_debug_logs.
 *
 * @param {Object} params
 * @param {string} [params.correlationId]
 * @param {string} [params.messageId]
 * @param {string} [params.eventId]
 * @param {string} params.location
 * @param {string} params.stage
 * @param {string} [params.direction]  // 'in', 'out', 'internal', ...
 * @param {Object} [params.metadata]   // arbitrary JSON-serializable object
 */
export async function logCopDebug(params) {
  const { correlationId, messageId, eventId, location, stage, direction, metadata } = params || {};

  if (!location || !stage) {
    console.warn("[logCopDebug] missing location or stage");
    return;
  }

  let sb;
  try {
    sb = getSupabase();
  } catch (err) {
    console.warn("[logCopDebug] cannot init Supabase:", err && err.message);
    return;
  }

  const row = {
    correlation_id: correlationId || null,
    message_id: messageId || null,
    event_id: eventId || null,
    location,
    stage,
    direction: direction || null,
    metadata: metadata || {},
  };

  try {
    await sb.from("cop_debug_logs").insert(row);
  } catch (err) {
    console.warn("[logCopDebug] insert failed:", err && err.message);
  }
}

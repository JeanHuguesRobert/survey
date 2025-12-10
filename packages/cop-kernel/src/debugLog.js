// File: packages/cop-kernel/src/debugLog.js
// Description:
//   Helper to insert debug logs into cop_debug_logs (Supabase).
//   Safe to call from both Node and Deno contexts.

import { getDefaultStorage } from "./storage.js";

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
/**
 * Insert a debug log into cop_debug_logs via storage layer.
 *
 * @param {object} log
 */
export async function logCopDebug(log) {
  const storage = getDefaultStorage();
  const record = {
    correlation_id: log.correlation_id || null,
    message_id: log.message_id || null,
    event_id: log.event_id || null,
    location: log.location || null,
    stage: log.stage || null,
    direction: log.direction || null,
    payload: log.payload || null,
    metadata: log.metadata || {},
  };

  const res = await storage.debugLogs.insert(record);
  if (!res.ok) {
    // optional: swallow, or throw, or console.error
    // for now, just ignore to avoid breaking flows
    // console.error("logCopDebug error:", res.error);
  }
}

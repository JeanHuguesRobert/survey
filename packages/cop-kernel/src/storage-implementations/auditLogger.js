import * as fs from "https://deno.land/std@0.208.0/fs/mod.ts";
import * as path from "https://deno.land/std@0.208.0/path/mod.ts";

export function createAuditLogger(options = {}) {
  const { auditLogPath = "./audit_logs.jsonl" } = options;
  const fullPath = path.join(Deno.cwd(), auditLogPath);

  async function logEvent(event) {
    const logEntry = JSON.stringify({ ...event, timestamp: new Date().toISOString() }) + "\n";
    await Deno.writeTextFile(fullPath, logEntry, { append: true });
  }

  return {
    logEvent,
  };
}

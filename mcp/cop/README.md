# mcp/cop

COP router and Supabase adapters for the MCP (COP core).

Usage:

- Mount the router at `/cop` in `mcp/server.js`.
- Use `mcp/cop/supabaseBus.js` to publish/subscribe events to/from `cop_event`.
- Use `mcp/cop/supabaseStore.js` to persist topics, jobs, steps, and artifacts.

Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`.

Note: This is a minimal starting point; implement robust job claiming/lock semantics in the store
for Deno Edge function workers.

See `mcp/cop/IDEMPOTENCY.md` for details on idempotency, write-ahead, and restartability practices.

Netlify Deno Edge functions pattern:

1. Use the `cop_claim_job` RPC to atomically claim a job and push the lease for your worker.
2. The Edge function processes a single step and reports status using `PATCH` to `cop_step` and
   `cop_job`.
3. On success, publish `artifact_created` or `assistant_update` events to `cop_event` to notify
   clients.
4. On failure, clear lease/worker_id so other workers can take it.

This design favors short-running stateless functions paired with DB-level job leasing for robustness
and auto-retry (Erlang-style supervision can be simulated by a worker supervisor that re-queues or
monitors job counts).

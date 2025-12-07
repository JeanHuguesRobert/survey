# WS Runner (COP Actor Runner)

This runner is a single-process, stateful Actor runner for COP jobs that:

- Subscribes to `cop_event` table via Supabase Realtime.
- Dispatches events to Agents (`onEvent`).
- Claims jobs atomically (`cop_claim_job`) and processes them via `onJob` handlers.
- Extends job leases while processing (heartbeat) to avoid other workers stealing mid-processing.
- Provides a health/metrics HTTP endpoint (default port 8123) for liveness monitoring.
- Provides reconnection/backoff logic for subscriptions and worker restarts.
- Contains a reclaimer that scans for stale lease jobs and clears them to unblock claims.

Operational notes

- The Runner uses Supabase for persistence (jobs, steps, artifacts) and to subscribe to events for
  UI notifications.
- Treat the runner as an ephemeral Actor host: it can be restarted quickly and will pick up progress
  from DB because all state is persisted.
- For production, launch multiple runner instances (e.g., systemd, process supervisor, or a host
  pool) to get actor-like distribution.

Flags and env vars

- `WS_RUNNER_CONCURRENCY`: number of concurrent worker tasks per process (default 2)
- `WS_RUNNER_PORT`: Health/metrics port (default 8123)
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` or `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` are
  required.

Quick run

```bash
SUPABASE_URL=https://... SUPABASE_SERVICE_KEY=... node mcp/ws-runner.js
```

Quick test

```bash
node mcp/ws-runner.js --quick-test
```

Notes

- This is a self-contained actor runner that adheres to the "pure actor" requirement: state
  persisted in DB, no in-memory state required for recovery.
- The process exposes a `/health` endpoint and metrics so simple host-level monitoring is possible.
  Use `systemd`, `pm2`, or OS supervisor to restart the runner on crash.

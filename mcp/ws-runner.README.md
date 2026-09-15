---
title: WS Runner (COP Actor Runner)
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: "2026-09-15"
last_modified_at: "2026-09-15"
version: "0.1"
status: working-paper
license: CC BY-SA 4.0
language: en
document_role: archive
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: unknown
  origin_ref: unknown
  origin_date: "2026-09-15"
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
---

# WS Runner (COP Actor Runner)

This runner is a single-process, stateful Actor runner for COP tasks that:

- Subscribes to `cop_event` table via Supabase Realtime.
- Dispatches events to Agents (`onEvent`).
- Claims tasks atomically (`cop_claim_task`) and processes them via `onTask` handlers.
- Extends task leases while processing (heartbeat) to avoid other workers stealing mid-processing.
- Provides a health/metrics HTTP endpoint (default port 8123) for liveness monitoring.
- Provides reconnection/backoff logic for subscriptions and worker restarts.
- Contains a reclaimer that scans for stale lease tasks and clears them to unblock claims.

Operational notes

- The Runner uses Supabase for persistence (tasks, steps, artifacts) and to subscribe to events for
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

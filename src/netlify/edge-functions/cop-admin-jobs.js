// File: netlify/edge-functions/cop-admin-jobs.js
// Description:
//   Netlify Edge Function exposing a minimal admin API for COP jobs.
//
//   GET /cop-admin-jobs
//     - List jobs (optionally filtered)
//       Query params:
//         ?status=pending|running|completed|failed|cancelled
//         &job_type=AUDIT_LEGAL_STATE
//         &worker_agent_name=Ophélia
//
//   GET /cop-admin-jobs?id=<job_id>
//     - Get a single job with its steps
//
//   (POST could be added later for admin actions like force-fail, retry, etc.)

import { getDefaultStorage } from "../../packages/cop-kernel/src/storage.js";

export default async function handler(request, context) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  try {
    if (method === "GET") {
      return await handleGet(url);
    }

    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "internal_error",
        detail: err && err.message ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function handleGet(url) {
  const id = url.searchParams.get("id");
  const storage = getDefaultStorage();

  // Cas 1 : détail d'un job
  if (id) {
    const jobRes = await storage.jobs.get(id);
    if (!jobRes.ok) {
      return new Response(JSON.stringify({ error: "job_load_error", detail: jobRes.error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!jobRes.job) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stepsRes = await storage.steps.listByJob(id);
    if (!stepsRes.ok) {
      return new Response(JSON.stringify({ error: "steps_load_error", detail: stepsRes.error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = {
      job: jobRes.job,
      steps: stepsRes.steps || [],
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Cas 2 : liste des jobs
  const status = url.searchParams.get("status") || undefined;
  const job_type = url.searchParams.get("job_type") || undefined;
  const worker_agent_name = url.searchParams.get("worker_agent_name") || undefined;

  const listRes = await storage.jobs.list({
    status,
    job_type,
    worker_agent_name,
  });

  if (!listRes.ok) {
    return new Response(JSON.stringify({ error: "jobs_list_error", detail: listRes.error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(listRes.jobs || []), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

import bus from "../cop/supabaseBus.js";
import store from "../cop/supabaseStore.js";

// TODO: jhr, should get that from the vault
const BOT_NAME = process.env.VITE_BOT_NAME || "Ophélia";

export const name = "ophelia-agent";
export const jobTypes = ["deep_reply"];

export async function onEvent(event, ctx) {
  try {
    if (!event || !event.type) return;
    const _bus = ctx?.bus || bus;
    const _store = ctx?.store || store;
    if (event.type === "user_message") {
      const topicId = event.topic_id || event.topicId || event.payload?.topicId;
      const userText = event.payload?.text || event.payload?.content || null;

      if (!topicId || !userText) return;

      // Idempotency: ensure we don't create duplicate jobs for same source event
      const sourceEventId = event.id || event.payload?.eventId || event.meta?.eventId || null;
      // Create a job for deep reply (write-ahead): persist job and step before publishing events
      const jobPayload = {
        topic_id: topicId,
        type: "deep_reply",
        status: "pending",
        created_by: null,
        source_event_id: sourceEventId,
      };
      const job = await _store.saveJob(jobPayload);
      if (!job) return;

      // Create initial step in idempotent way (job_id,name unique)
      await _store.saveStep({
        job_id: job.id,
        name: "compose",
        status: "pending",
        input: { text: userText },
        created_by: null,
      });

      // Fast reply (immediate small message) - publish *after* we persisted the intent
      const fastReply = `${BOT_NAME}: Merci — j'ai bien noté : ${userText.slice(0, 140)}`;
      await _bus.publish({
        topicId,
        type: "assistant_reflex",
        payload: { text: fastReply, kind: "fast" },
        createdBy: null,
      });

      // Publish job_state_changed event only if the job appears newly created (best-effort heuristic)
      const suggestNew =
        (job && job.status === "pending" && job.attempts === 0) ||
        (job && job.created_at && job.updated_at && job.created_at === job.updated_at);
      if (suggestNew) {
        await _bus.publish({
          topicId,
          type: "job_state_changed",
          payload: { jobId: job.id, state: job.status },
          createdBy: null,
        });
      }
    }
  } catch (e) {
    console.error("opheliaAgent.onEvent error", e.message);
  }
}

export async function onTick(ctx) {
  // onTick does not claim or force-run jobs in distributed mode; only used for lightweight periodic work
  try {
    // Optionally handle lightweight background tasks or health checks
    return;
  } catch (e) {
    console.error("opheliaAgent.onTick error", e.message);
  }
}

export async function onJob(job, ctx) {
  // Handle a single claimed job by delegating to onStep for sequential steps.
  try {
    if (!job || job.type !== "deep_reply") return;
    const _store = ctx?.store || store;
    const next = await _store.getNextPendingStep(job.id);
    if (!next) {
      // no pending steps, maybe it's done
      const finalSteps = await _store.getSteps(job.id);
      const allDone = finalSteps.every((s) => s.status === "done");
      if (allDone) {
        await (ctx?.store || store).saveJob({ id: job.id, status: "done" });
      }
      return;
    }
    // process single step via onStep
    await onStep(job, next, ctx);
  } catch (e) {
    console.error("onJob error", e?.message || e);
    try {
      await (ctx?.store || store).saveJob({
        id: job.id,
        status: "pending",
        last_error: e?.message || String(e),
        status_reason: "onJob failure",
      });
    } catch (_) {}
  }
}

export async function onStep(job, step, ctx) {
  try {
    if (!job || job.type !== "deep_reply") return;
    const _bus = ctx?.bus || bus;
    const _store = ctx?.store || store;

    // Skip if already done (idempotency)
    const refreshed = await _store.getSteps(job.id);
    const current = refreshed.find((s) => s.id === step.id);
    if (current && current.status === "done") return;

    // mark running (write-ahead checkpoint)
    await _store.saveStep({
      id: step.id,
      job_id: job.id,
      name: step.name,
      status: "running",
      input: step.input,
    });
    await _bus.publish({
      topicId: job.topic_id,
      type: "job_step_started",
      payload: { jobId: job.id, stepId: step.id, stepName: step.name },
    });

    // process step
    const prompt = step.input?.text || "";
    const deepReply = `${BOT_NAME} (deep): Analyse complète de: ${prompt.slice(0, 200)}...`;

    // Persist artifact idempotently
    const artifact = await _store.saveArtifact({
      topic_id: job.topic_id,
      source_job_id: job.id,
      source_step_id: step.id,
      type: "final_summary",
      format: "text",
      payload: { text: deepReply },
      created_by: null,
    });

    // Save step result
    await _store.saveStep({
      id: step.id,
      job_id: job.id,
      name: step.name,
      status: "done",
      input: step.input,
      output: { text: deepReply },
      checkpoint: {},
    });

    // Publish results
    await _bus.publish({
      topicId: job.topic_id,
      type: "artifact_created",
      payload: { artifactId: artifact.id, jobId: job.id },
      createdBy: null,
    });
    await _bus.publish({
      topicId: job.topic_id,
      type: "assistant_update",
      payload: { text: deepReply, kind: "deep" },
      createdBy: null,
    });
    await _bus.publish({
      topicId: job.topic_id,
      type: "job_state_changed",
      payload: { jobId: job.id, state: "step_done" },
      createdBy: null,
    });
  } catch (e) {
    console.error("ophelia onStep error", e?.message || e);
    try {
      await (ctx?.store || store).saveStep({
        id: step.id,
        job_id: job.id,
        status: "pending",
        attempts: (step.attempts || 0) + 1,
        checkpoint: step.checkpoint || {},
      });
    } catch (_) {}
  }
}

export default { name, jobTypes, onEvent, onTick, onJob, onStep };

import bus from "../cop/supabaseBus.js";
import store from "../cop/supabaseStore.js";

export const name = "rag-agent";
export const jobTypes = ["rag_answer"];

export async function onEvent(event, ctx) {
  // Optionally respond to events to create jobs
  if (event.type === "user_message") {
    const _store = ctx?.store || store;
    const _bus = ctx?.bus || bus;
    const topicId = event.topic_id || event.payload?.topicId;
    if (!topicId) return;
    const sourceEventId = event.id || event.payload?.eventId || event.meta?.eventId || null;
    // Create rag job to generate an answer (idempotent via source_event_id)
    const job = await _store.saveJob({
      topic_id: topicId,
      type: "rag_answer",
      status: "pending",
      created_by: null,
      source_event_id: sourceEventId,
    });
    if (!job) return;
    await _store.saveStep({
      job_id: job.id,
      name: "search",
      status: "pending",
      input: { text: event.payload?.text || "" },
      created_by: null,
    });
    // Optionally publish job_state_changed if new
    const suggestNew = job && job.status === "pending" && job.attempts === 0;
    if (suggestNew)
      await _bus.publish({
        topicId,
        type: "job_state_changed",
        payload: { jobId: job.id, state: "pending" },
        createdBy: null,
      });
  }
}

export async function onJob(job, ctx) {
  if (!job || job.type !== "rag_answer") return;
  try {
    const _store = ctx?.store || store;
    const _bus = ctx?.bus || bus;
    const jobInDb = await _store.getJob(job.id);
    if (!jobInDb) return;
    const next = await _store.getNextPendingStep(job.id);
    if (!next) {
      const finalSteps = await _store.getSteps(job.id);
      const allDone = finalSteps.every((s) => s.status === "done");
      if (allDone) await _store.saveJob({ ...jobInDb, status: "done" });
      return;
    }
    await onStep(job, next, ctx);
  } catch (e) {
    console.error("ragAgent onJob error", e?.message || e);
    await (ctx?.store || store).saveJob({ ...job, status: "failed", meta: { error: e.message } });
  }
}

export async function onStep(job, step, ctx) {
  const _store = ctx?.store || store;
  const _bus = ctx?.bus || bus;
  try {
    if (step.status === "done") return;
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

    if (step.name === "search") {
      const searchedDocs = [{ id: "doc1", snippet: "Extrait de document sur le sujet" }];
      await _store.saveStep({
        id: step.id,
        job_id: job.id,
        name: step.name,
        status: "done",
        output: { docs: searchedDocs },
      });
    }
    if (step.name === "compose") {
      const composed = `RAG composed answer based on previous steps`;
      await _store.saveStep({
        id: step.id,
        job_id: job.id,
        name: step.name,
        status: "done",
        output: { text: composed },
      });
      const artifact = await _store.saveArtifact({
        topic_id: job.topic_id,
        source_job_id: job.id,
        source_step_id: step.id,
        type: "rag_answer",
        format: "text",
        payload: { text: composed },
        created_by: null,
      });
      if (artifact) {
        await _bus.publish({
          topicId: job.topic_id,
          type: "artifact_created",
          payload: { artifactId: artifact.id },
          createdBy: null,
        });
        await _bus.publish({
          topicId: job.topic_id,
          type: "assistant_update",
          payload: { text: artifact.payload?.text || "" },
          createdBy: null,
        });
      }
    }
  } catch (e) {
    console.error("ragAgent onStep error", e?.message || e);
    await _store.saveStep({
      id: step.id,
      job_id: job.id,
      status: "pending",
      attempts: (step.attempts || 0) + 1,
    });
  }
}

export default { name, jobTypes, onEvent, onJob, onStep };

// File: packages/cop-kernel/src/jobs.js
// Description:
//   High-level helpers to create and update cop_jobs and cop_steps.

import { getDefaultStorage } from "./storage.js";

/**
 * Create a new job.
 *
 * @param {Object} params
 * @param {string} params.jobType
 * @param {string} params.workerAgentName
 * @param {string} [params.rootCorrelationId]
 * @param {string} [params.channel]
 * @param {string} [params.sourceEntityId]
 * @param {string} [params.sourceEntityType]
 * @param {string} [params.idempotencyHash]
 * @param {number} [params.priority=0]
 */
export async function createJob(params) {
  const {
    jobType,
    workerAgentName,
    rootCorrelationId,
    channel,
    sourceEntityId,
    sourceEntityType,
    idempotencyHash,
    priority = 0,
  } = params || {};

  if (!jobType) throw new Error("createJob: 'jobType' is required");
  if (!workerAgentName) {
    throw new Error("createJob: 'workerAgentName' is required");
  }

  const storage = getDefaultStorage();

  const record = {
    job_type: jobType,
    worker_agent_name: workerAgentName,
    root_correlation_id: rootCorrelationId || null,
    channel: channel || null,
    source_entity_id: sourceEntityId || null,
    source_entity_type: sourceEntityType || null,
    idempotency_hash: idempotencyHash || null,
    status: "pending",
    retry_count: 0,
    priority,
    last_error: null,
  };

  const res = await storage.jobs.insert(record);
  if (!res.ok) {
    throw new Error("createJob: " + res.error);
  }
  return res.job;
}

export async function markJobStarted(jobId) {
  const storage = getDefaultStorage();
  const patch = {
    status: "running",
    started_at: new Date().toISOString(),
    last_error: null,
  };
  const res = await storage.jobs.update(jobId, patch);
  if (!res.ok) {
    throw new Error("markJobStarted: " + res.error);
  }
  return res.job;
}

export async function markJobCompleted(jobId) {
  const storage = getDefaultStorage();
  const patch = {
    status: "completed",
    completed_at: new Date().toISOString(),
  };
  const res = await storage.jobs.update(jobId, patch);
  if (!res.ok) {
    throw new Error("markJobCompleted: " + res.error);
  }
  return res.job;
}

export async function markJobFailed(jobId, errorText) {
  const storage = getDefaultStorage();
  const nowIso = new Date().toISOString();
  const patch = {
    status: "failed",
    completed_at: nowIso,
    last_error: errorText || null,
  };
  const res = await storage.jobs.update(jobId, patch);
  if (!res.ok) {
    throw new Error("markJobFailed: " + res.error);
  }
  return res.job;
}

/**
 * Create a step for a given job.
 *
 * @param {Object} params
 * @param {string} params.jobId
 * @param {string} params.name
 * @param {number} [params.indexInJob=0]
 * @param {string} [params.inputHash]
 */
export async function createStep(params) {
  const { jobId, name, indexInJob = 0, inputHash } = params || {};
  if (!jobId) throw new Error("createStep: 'jobId' is required");
  if (!name) throw new Error("createStep: 'name' is required");

  const storage = getDefaultStorage();

  const record = {
    job_id: jobId,
    name,
    index_in_job: indexInJob,
    status: "running",
    input_hash: inputHash || null,
    last_error: null,
  };

  const res = await storage.steps.insert(record);
  if (!res.ok) {
    throw new Error("createStep: " + res.error);
  }
  return res.step;
}

export async function markStepCompleted(stepId) {
  const storage = getDefaultStorage();
  const patch = {
    status: "completed",
    completed_at: new Date().toISOString(),
    last_error: null,
  };
  const res = await storage.steps.update(stepId, patch);
  if (!res.ok) {
    throw new Error("markStepCompleted: " + res.error);
  }
  return res.step;
}

export async function markStepFailed(stepId, errorText) {
  const storage = getDefaultStorage();
  const patch = {
    status: "failed",
    completed_at: new Date().toISOString(),
    last_error: errorText || null,
  };
  const res = await storage.steps.update(stepId, patch);
  if (!res.ok) {
    throw new Error("markStepFailed: " + res.error);
  }
  return res.step;
}

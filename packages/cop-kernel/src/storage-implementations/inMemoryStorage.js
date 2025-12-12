/**
 * Creates an in-memory storage implementation that conforms to the StorageInterface.
 * @returns {StorageInterface} An in-memory storage object.
 */
export function createInMemoryStorage(ERROR_CODES) {
  const inMemoryData = {
    debugLogs: [],
    events: [],
    artifacts: [],
    agentIdentities: new Map(),
    jobs: new Map(),
    steps: new Map(),
    fileContent: new Map(),
  };

  const inMemoryStorage = {
    options: { type: "memory" },
    // Interfaces de métadonnées (CRUD)
    debugLogs: {
      async insert(logRecord) {
        inMemoryData.debugLogs.push(logRecord);
        return { ok: true };
      },
    },
    events: {
      async insert(eventRecord) {
        inMemoryData.events.push(eventRecord);
        return { ok: true, event: eventRecord };
      },
    },
    artifacts: {
      async insert(artifactRecord) {
        inMemoryData.artifacts.push(artifactRecord);
        return { ok: true, artifact: artifactRecord };
      },
    },

    agentIdentities: {
      async upsert(identity, conflictKey = "agent_name") {
        const existing = Array.from(inMemoryData.agentIdentities.values()).find(
          (a) => a[conflictKey] === identity[conflictKey]
        );
        if (existing) {
          Object.assign(existing, identity);
          inMemoryData.agentIdentities.set(existing.agent_id, existing);
          return { ok: true, identity: existing };
        } else {
          const newIdentity = {
            ...identity,
            agent_id: identity.agent_id || `agent_${inMemoryData.agentIdentities.size + 1}`,
          };
          inMemoryData.agentIdentities.set(newIdentity.agent_id, newIdentity);
          return { ok: true, identity: newIdentity };
        }
      },
      async getById(agent_id) {
        const identity = inMemoryData.agentIdentities.get(agent_id);
        return { ok: !!identity, identity: identity || null };
      },
      async getByName(agent_name) {
        const identity = Array.from(inMemoryData.agentIdentities.values()).find(
          (a) => a.agent_name === agent_name
        );
        return { ok: !!identity, identity: identity || null };
      },
      async list({ status, limit = 100 } = {}) {
        let identities = Array.from(inMemoryData.agentIdentities.values());
        if (status) {
          identities = identities.filter((a) => a.status === status);
        }
        return { ok: true, identities: identities.slice(0, limit) };
      },
      async updateStatus(agent_id, status) {
        const identity = inMemoryData.agentIdentities.get(agent_id);
        if (identity) {
          identity.status = status;
          return { ok: true, identity };
        }
        return { ok: false, error: "Agent not found", code: ERROR_CODES.NOT_FOUND };
      },
    },

    jobs: {
      async upsert(jobRecord) {
        const newJob = { ...jobRecord, id: jobRecord.id || `job_${inMemoryData.jobs.size + 1}` };
        newJob.version = (newJob.version || 0) + 1;
        inMemoryData.jobs.set(newJob.id, newJob);
        return { ok: true, job: newJob };
      },
      async get(jobId) {
        const job = inMemoryData.jobs.get(jobId);
        return { ok: !!job, job: job || null };
      },
      async list({ status, limit = 100 } = {}) {
        let jobs = Array.from(inMemoryData.jobs.values());
        if (status) {
          jobs = jobs.filter((j) => j.status === status);
        }
        return { ok: true, jobs: jobs.slice(0, limit) };
      },
      async update(jobId, patch) {
        const job = inMemoryData.jobs.get(jobId);
        if (job) {
          if (patch.version !== undefined && job.version !== patch.version) {
            return {
              ok: false,
              error: "Optimistic lock failed. Version mismatch.",
              code: ERROR_CODES.OPTIMISTIC_LOCK_FAIL,
            };
          }
          Object.assign(job, patch);
          job.version = (job.version || 0) + 1;
          return { ok: true, job };
        }
        return { ok: false, error: "Job not found", code: ERROR_CODES.NOT_FOUND };
      },
    },

    steps: {
      async upsert(stepRecord) {
        const newStep = {
          ...stepRecord,
          id: stepRecord.id || `step_${inMemoryData.steps.size + 1}`,
        };
        inMemoryData.steps.set(newStep.id, newStep);
        return { ok: true, step: newStep };
      },
      async listByJob(jobId) {
        const steps = Array.from(inMemoryData.steps.values()).filter((s) => s.job_id === jobId);
        return { ok: true, steps };
      },
      async update(jobId, stepId, patch) {
        const step = inMemoryData.steps.get(stepId);
        if (step && step.job_id === jobId) {
          Object.assign(step, patch);
          return { ok: true, step };
        }
        return { ok: false, error: "Step not found", code: ERROR_CODES.NOT_FOUND };
      },
    },

    // Implémentation fileStorage In-Memory (Simulée)
    fileStorage: {
      defaultBucket: "cop-artifacts",

      async uploadArtifact(bucketName, path, fileBody, options = {}) {
        const key = `${bucketName || this.defaultBucket}/${path}`;
        inMemoryData.fileContent.set(key, fileBody);
        return { ok: true, path };
      },

      async downloadArtifact(bucketName, path) {
        const key = `${bucketName || this.defaultBucket}/${path}`;
        const data = inMemoryData.fileContent.get(key);
        if (!data) {
          return { ok: false, error: "Artifact not found in memory", code: ERROR_CODES.NOT_FOUND };
        }
        return { ok: true, data };
      },

      async getPublicUrl(bucketName, path) {
        const key = `${bucketName || this.defaultBucket}/${path}`;
        if (!inMemoryData.fileContent.has(key)) {
          return { ok: false, error: "Artifact not found", code: ERROR_CODES.NOT_FOUND };
        }
        return { ok: true, url: `memory://fake-url/${key}` };
      },
    },

    getCacheContents: () => ({
      agentIdentities: Array.from(inMemoryData.agentIdentities.entries()),
      jobs: Array.from(inMemoryData.jobs.entries()),
      steps: Array.from(inMemoryData.steps.entries()),
      debugLogs: inMemoryData.debugLogs,
    }),
    clearCache: () => {
      inMemoryData.agentIdentities.clear();
      inMemoryData.jobs.clear();
      inMemoryData.steps.clear();
      inMemoryData.debugLogs = [];
      inMemoryData.events = [];
      inMemoryData.artifacts = [];
      inMemoryData.fileContent.clear(); // Vide le stockage de fichiers
    },
    ERROR_CODES,
  };

  return inMemoryStorage;
}

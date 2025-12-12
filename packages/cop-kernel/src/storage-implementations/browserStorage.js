const ERROR_CODES = {
  NOT_FOUND: "STORAGE_NOT_FOUND",
  DB_ERROR: "STORAGE_DATABASE_ERROR",
  CONFLICT: "STORAGE_CONFLICT_ERROR",
  OPTIMISTIC_LOCK_FAIL: "STORAGE_OPTIMISTIC_LOCK_FAILED",
};

function getLocalStorageKey(entityType) {
  return `cop_kernel_${entityType}`;
}

function readFromLocalStorage(entityType) {
  try {
    const data = localStorage.getItem(getLocalStorageKey(entityType));
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error(`Error reading from localStorage for ${entityType}:`, error);
    return {};
  }
}

function writeToLocalStorage(entityType, data, errorCodes) {
  try {
    localStorage.setItem(getLocalStorageKey(entityType), JSON.stringify(data));
  } catch (error) {
    console.error(`Error writing to localStorage for ${entityType}:`, error);
    throw new Error(errorCodes.DB_ERROR);
  }
}

export function createBrowserStorage(options = {}) {
  const { ERROR_CODES: customErrorCodes } = options;
  const currentErrorCodes = customErrorCodes || ERROR_CODES;

  const browserStorage = {
    options: { ...options, type: "browser" },
    ERROR_CODES: currentErrorCodes,

    debugLogs: {
      async insert(logRecord) {
        // For browser, debug logs might go to console or a separate in-memory buffer
        console.log("Browser Debug Log:", logRecord);
        return { ok: true };
      },
    },
    events: {
      async insert(eventRecord) {
        // Browser events might be handled differently, e.g., sent to a server
        console.log("Browser Event:", eventRecord);
        return { ok: true, event: eventRecord };
      },
    },
    artifacts: {
      async insert(artifactRecord) {
        // Artifacts are typically not stored in localStorage due to size limits
        console.warn("Artifacts cannot be stored in localStorage. Ignoring.", artifactRecord);
        return {
          ok: false,
          error: "Artifacts cannot be stored in localStorage",
          code: ERROR_CODES.DB_ERROR,
        };
      },
      async downloadArtifact() {
        return {
          ok: false,
          error: "Artifacts not supported in localStorage",
          code: ERROR_CODES.NOT_FOUND,
        };
      },
      async getPublicUrl() {
        return {
          ok: false,
          error: "Artifacts not supported in localStorage",
          code: ERROR_CODES.NOT_FOUND,
        };
      },
    },

    agentIdentities: {
      async upsert(identity, conflictKey = "agent_name") {
        const identities = readFromLocalStorage("agentIdentities");
        identities[identity.agent_id] = identity;
        writeToLocalStorage("agentIdentities", identities);
        return { ok: true, identity };
      },
      async getById(agent_id) {
        const identities = readFromLocalStorage("agentIdentities");
        const identity = identities[agent_id];
        return identity ? { ok: true, identity } : { ok: false, code: currentErrorCodes.NOT_FOUND };
      },
      async getByName(agent_name) {
        const identities = readFromLocalStorage("agentIdentities");
        const foundIdentity = Object.values(identities).find((id) => id.agent_name === agent_name);
        return foundIdentity
          ? { ok: true, identity: foundIdentity }
          : { ok: false, code: currentErrorCodes.NOT_FOUND };
      },
      async list({ status, limit = 100 } = {}) {
        const identities = readFromLocalStorage("agentIdentities");
        let filteredIdentities = Object.values(identities);
        if (status) {
          filteredIdentities = filteredIdentities.filter((id) => id.status === status);
        }
        return { ok: true, identities: filteredIdentities.slice(0, limit) };
      },
      async updateStatus(agent_id, status) {
        const identities = readFromLocalStorage("agentIdentities");
        const identity = identities[agent_id];
        if (identity) {
          identity.status = status;
          writeToLocalStorage("agentIdentities", identities);
          return { ok: true, identity };
        }
        return { ok: false, error: "Agent not found", code: currentErrorCodes.NOT_FOUND };
      },
    },

    jobs: {
      async upsert(jobRecord) {
        const jobs = readFromLocalStorage("jobs");
        const newJob = { ...jobRecord, id: jobRecord.id || `job_${Date.now()}` };
        newJob.version = (newJob.version || 0) + 1;
        jobs[newJob.id] = newJob;
        writeToLocalStorage("jobs", jobs);
        return { ok: true, job: newJob };
      },
      async get(jobId) {
        const jobs = readFromLocalStorage("jobs");
        const job = jobs[jobId];
        return job ? { ok: true, job } : { ok: false, code: currentErrorCodes.NOT_FOUND };
      },
      async list({ status, limit = 100 } = {}) {
        const jobs = readFromLocalStorage("jobs");
        let filteredJobs = Object.values(jobs);
        if (status) {
          filteredJobs = filteredJobs.filter((j) => j.status === status);
        }
        return { ok: true, jobs: filteredJobs.slice(0, limit) };
      },
      async update(jobId, patch) {
        const jobs = readFromLocalStorage("jobs");
        const job = jobs[jobId];
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
          jobs[jobId] = job;
          writeToLocalStorage("jobs", jobs, currentErrorCodes);
          return { ok: true, job };
        }
        return { ok: false, error: "Job not found", code: ERROR_CODES.NOT_FOUND };
      },
    },

    steps: {
      async upsert(stepRecord) {
        const steps = readFromLocalStorage("steps");
        const newStep = { ...stepRecord, id: stepRecord.id || `step_${Date.now()}` };
        steps[newStep.id] = newStep;
        writeToLocalStorage("steps", steps);
        return { ok: true, step: newStep };
      },
      async listByJob(jobId) {
        const steps = readFromLocalStorage("steps");
        const filteredSteps = Object.values(steps).filter((step) => step.job_id === jobId);
        return { ok: true, steps: filteredSteps };
      },
      async update(jobId, stepId, patch) {
        const steps = readFromLocalStorage("steps");
        const step = steps[stepId];
        if (step && step.job_id === jobId) {
          Object.assign(step, patch);
          steps[stepId] = step;
          writeToLocalStorage("steps", steps, currentErrorCodes);
          return { ok: true, step };
        }
        return { ok: false, error: "Step not found", code: ERROR_CODES.NOT_FOUND };
      },
    },

    fileStorage: {
      // Not applicable for browser storage
      async uploadArtifact() {
        return {
          ok: false,
          error: "File storage not applicable for browser storage",
          code: ERROR_CODES.DB_ERROR,
        };
      },
      async downloadArtifact() {
        return {
          ok: false,
          error: "File storage not applicable for browser storage",
          code: ERROR_CODES.NOT_FOUND,
        };
      },
      async getPublicUrl() {
        return {
          ok: false,
          error: "File storage not applicable for browser storage",
          code: ERROR_CODES.NOT_FOUND,
        };
      },
    },

    clearCache: async () => {
      try {
        localStorage.removeItem(getLocalStorageKey("agentIdentities"));
        localStorage.removeItem(getLocalStorageKey("jobs"));
        localStorage.removeItem(getLocalStorageKey("steps"));
        // No audit logs for browser storage in this simple implementation
      } catch (error) {
        console.error("Error clearing browser storage cache:", error);
        throw new Error(ERROR_CODES.DB_ERROR);
      }
    },
  };

  return browserStorage;
}

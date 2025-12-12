import fs from "node:fs/promises";
import path from "node:path";
import { createAuditLogger } from "./auditLogger.js";

// Define ERROR_CODES for consistency
const ERROR_CODES = {
  NOT_FOUND: "STORAGE_NOT_FOUND",
  DB_ERROR: "STORAGE_DATABASE_ERROR", // Generic error for file operations
  CONFLICT: "STORAGE_CONFLICT_ERROR",
  OPTIMISTIC_LOCK_FAIL: "STORAGE_OPTIMISTIC_LOCK_FAILED",
};

export function createFileBasedStorage(options = {}) {
  const { basePath = "./file_storage_data", auditLogPath = "./audit_logs.jsonl" } = options;
  const auditLogger = createAuditLogger({ auditLogPath });

  // Ensure the base directory exists
  async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
  }

  // Helper to get file path for an entity
  function getEntityFilePath(entityType, id) {
    return path.join(basePath, entityType, `${id}.json`);
  }

  // Helper to read a JSON file
  async function readJsonFile(filePath) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      if (error.code === "ENOENT") {
        return null; // File not found
      }
      throw error;
    }
  }

  // Helper to write a JSON file
  async function writeJsonFile(filePath, data) {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  }

  // Helper to get index file path
  function getIndexFilePath(entityType, indexName) {
    return path.join(basePath, `${entityType}_${indexName}_index.json`);
  }

  // Helper to read an index file
  async function readIndexFile(entityType, indexName) {
    const filePath = getIndexFilePath(entityType, indexName);
    try {
      const content = await fs.readFile(filePath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      if (error.code === "ENOENT") {
        return {}; // Return empty object if index file not found
      }
      throw error;
    }
  }

  // Helper to write an index file
  async function writeIndexFile(entityType, indexName, indexData) {
    const filePath = getIndexFilePath(entityType, indexName);
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(indexData, null, 2), "utf8");
  }

  // Implement the StorageInterface methods
  const fileBasedStorage = {
    options: { ...options, type: "file" },
    ERROR_CODES,

    // Metadata interfaces (simplified for file-based)
    debugLogs: {
      async insert(logRecord) {
        // For file-based, we might append to a log file or just return ok
        // For simplicity, let's just return ok for now.
        // A real implementation would write to a log file.
        return { ok: true };
      },
    },
    events: {
      async insert(eventRecord) {
        // Similar to debugLogs, for simplicity just return ok
        return { ok: true, event: eventRecord };
      },
    },
    artifacts: {
      async insert(artifactRecord) {
        // Similar to debugLogs, for simplicity just return ok
        return { ok: true, artifact: artifactRecord };
      },
    },

    agentIdentities: {
      async upsert(identity, conflictKey = "agent_name") {
        const filePath = getEntityFilePath("agentIdentities", identity.agent_id);
        await writeJsonFile(filePath, identity);

        // Update name index
        const nameIndex = await readIndexFile("agentIdentities", "name");
        nameIndex[identity.agent_name] = identity.agent_id;
        await writeIndexFile("agentIdentities", "name", nameIndex);

        await auditLogger.logEvent({
          eventType: "AgentIdentityUpserted",
          entityType: "agentIdentity",
          entityId: identity.agent_id,
          payload: identity,
        });
        return { ok: true, identity };
      },
      async getById(agent_id) {
        const filePath = getEntityFilePath("agentIdentities", agent_id);
        const identity = await readJsonFile(filePath);
        return { ok: !!identity, identity };
      },
      async getByName(agent_name) {
        const nameIndex = await readIndexFile("agentIdentities", "name");
        const agent_id = nameIndex[agent_name];
        if (agent_id) {
          return this.getById(agent_id);
        }
        return { ok: false, error: "Agent not found", code: ERROR_CODES.NOT_FOUND };
      },
      async list({ status, limit = 100 } = {}) {
        const dirPath = path.join(basePath, "agentIdentities");
        await ensureDir(dirPath);
        const files = await fs.readdir(dirPath);
        let identities = [];
        for (const file of files) {
          const identity = await readJsonFile(path.join(dirPath, file));
          if (identity) {
            identities.push(identity);
          }
        }
        if (status) {
          identities = identities.filter((a) => a.status === status);
        }
        return { ok: true, identities: identities.slice(0, limit) };
      },
      async updateStatus(agent_id, status) {
        const filePath = getEntityFilePath("agentIdentities", agent_id);
        const identity = await readJsonFile(filePath);
        if (identity) {
          const oldStatus = identity.status;
          identity.status = status;
          await writeJsonFile(filePath, identity);
          await auditLogger.logEvent({
            eventType: "AgentIdentityStatusUpdated",
            entityType: "agentIdentity",
            entityId: agent_id,
            payload: { oldStatus, newStatus: status },
          });
          return { ok: true, identity };
        }
        return { ok: false, error: "Agent not found", code: ERROR_CODES.NOT_FOUND };
      },
    },

    jobs: {
      async upsert(jobRecord) {
        const newJob = { ...jobRecord, id: jobRecord.id || `job_${Date.now()}` };
        newJob.version = (newJob.version || 0) + 1;
        const filePath = getEntityFilePath("jobs", newJob.id);
        await writeJsonFile(filePath, newJob);
        await auditLogger.logEvent({
          eventType: "JobUpserted",
          entityType: "job",
          entityId: newJob.id,
          payload: newJob,
        });
        return { ok: true, job: newJob };
      },
      async get(jobId) {
        const filePath = getEntityFilePath("jobs", jobId);
        const job = await readJsonFile(filePath);
        return { ok: !!job, job };
      },
      async list({ status, limit = 100 } = {}) {
        const dirPath = path.join(basePath, "jobs");
        await ensureDir(dirPath);
        const files = await fs.readdir(dirPath);
        let jobs = [];
        for (const file of files) {
          const job = await readJsonFile(path.join(dirPath, file));
          if (job) {
            jobs.push(job);
          }
        }
        if (status) {
          jobs = jobs.filter((j) => j.status === status);
        }
        return { ok: true, jobs: jobs.slice(0, limit) };
      },
      async update(jobId, patch) {
        const filePath = getEntityFilePath("jobs", jobId);
        const job = await readJsonFile(filePath);
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
          await writeJsonFile(filePath, job);
          await auditLogger.logEvent({
            eventType: "JobUpdated",
            entityType: "job",
            entityId: jobId,
            payload: { patch, newJob: job },
          });
          return { ok: true, job };
        }
        return { ok: false, error: "Job not found", code: ERROR_CODES.NOT_FOUND };
      },
    },

    steps: {
      async upsert(stepRecord) {
        const newStep = { ...stepRecord, id: stepRecord.id || `step_${Date.now()}` };
        const filePath = getEntityFilePath("steps", newStep.id);
        await writeJsonFile(filePath, newStep);
        await auditLogger.logEvent({
          eventType: "StepUpserted",
          entityType: "step",
          entityId: newStep.id,
          payload: newStep,
        });
        return { ok: true, step: newStep };
      },
      async listByJob(jobId) {
        const dirPath = path.join(basePath, "steps");
        await ensureDir(dirPath);
        const files = await fs.readdir(dirPath);
        let steps = [];
        for (const file of files) {
          const step = await readJsonFile(path.join(dirPath, file));
          if (step && step.job_id === jobId) {
            steps.push(step);
          }
        }
        return { ok: true, steps };
      },
      async update(jobId, stepId, patch) {
        const filePath = getEntityFilePath("steps", stepId);
        const step = await readJsonFile(filePath);
        if (step && step.job_id === jobId) {
          Object.assign(step, patch);
          await writeJsonFile(filePath, step);
          await auditLogger.logEvent({
            eventType: "StepUpdated",
            entityType: "step",
            entityId: stepId,
            payload: { jobId, patch, newStep: step },
          });
          return { ok: true, step };
        }
        return { ok: false, error: "Step not found", code: ERROR_CODES.NOT_FOUND };
      },
    },

    fileStorage: {
      defaultBucket: "cop-artifacts",

      async uploadArtifact(bucketName, filePath, fileBody, options = {}) {
        const fullPath = path.join(basePath, "artifacts", bucketName, filePath);
        await ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, fileBody, "utf8");
        return { ok: true, path: fullPath };
      },

      async downloadArtifact(bucketName, filePath) {
        const fullPath = path.join(basePath, "artifacts", bucketName, filePath);
        try {
          const data = await fs.readFile(fullPath, "utf8");
          return { ok: true, data };
        } catch (error) {
          if (error.code === "ENOENT") {
            return { ok: false, error: "Artifact not found", code: ERROR_CODES.NOT_FOUND };
          }
          throw error;
        }
      },

      async getPublicUrl(bucketName, filePath) {
        const fullPath = path.join(basePath, "artifacts", bucketName, filePath);
        try {
          await fs.access(fullPath); // Check if file exists
          return { ok: true, url: `file://${fullPath}` };
        } catch (error) {
          if (error.code === "ENOENT") {
            return { ok: false, error: "Artifact not found", code: ERROR_CODES.NOT_FOUND };
          }
          throw error;
        }
      },
    },

    // No direct cache contents for file-based, as it's always reading from disk.
    // But we can provide a way to "clear" the storage (delete all files).
    clearCache: async () => {
      // This is a destructive operation, use with caution.
      // For testing, it's fine.
      try {
        await fs.rm(basePath, { recursive: true, force: true });
        // Also remove index files
        await fs.unlink(getIndexFilePath("agentIdentities", "name")).catch(() => {}); // Ignore if file doesn't exist
        await ensureDir(basePath); // Recreate base directory
      } catch (error) {
        // Ignore if directory doesn't exist
        if (error.code !== "ENOENT") {
          throw error;
        }
      }
    },
  };

  return fileBasedStorage;
}

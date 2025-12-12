// File: packages/cop-kernel/src/artifacts.js
// Description:
//   Helper to persist high-level COP artifacts into the cop_artifacts table,
//   and optionally emit a COP_EVENT ("artifact.created") via /cop-events.
//

import { getDefaultStorage } from "./storage.js";
import { emitCopEvent } from "./events.js";
import { COP_VERSION } from "./message.js";

/**
 * Persist a high-level COP artifact into cop_artifacts and optionally emit
 * a COP_EVENT ("artifact.created").
 *
 * @param {Object} params
 * @param {string} params.artifactType  - Functional type (e.g. 'summary', 'decision', 'task_list', 'fact', 'file_ref')
 * @param {string} params.artifactKind  - High-level category (e.g. 'conversation', 'action', 'knowledge', 'media')
 *
 * @param {string} [params.correlationId] - Optional correlation_id of the interaction
 * @param {string} [params.messageId]     - Optional originating COP_MESSAGE id
 * @param {string} [params.eventId]       - Optional originating COP_EVENT id
 *
 * @param {Object} [params.agent]         - Optional agent identity:
 *   {
 *     networkId: string,
 *     nodeId: string,
 *     instanceId: string,
 *     agentName: string,
 *   }
 *
 * @param {Object} params.content         - Artifact content (JSON-serializable)
 * @param {Object} [params.metadata={}]   - Artifact metadata (JSON-serializable)
 *
 * @param {boolean} [params.emitEvent=false] - If true, also emit a COP_EVENT "artifact.created"
 * @param {string}  [params.from]            - COP_ADDR of emitting agent (required if emitEvent=true)
 *
 * For emitting the COP_EVENT, you can either provide:
 *   - endpoint: full URL to /cop-events
 *   OR
 *   - baseUrl: origin/base URL (e.g. "https://example.netlify.app")
 *     and optionally eventsPath (default "/cop-events")
 *
 * @param {string}  [params.endpoint]     - Full URL to /cop-events
 * @param {string}  [params.baseUrl]      - Base URL origin (if endpoint not provided)
 * @param {string}  [params.eventsPath="/cop-events"] - Events path when using baseUrl
 * @param {string}  [params.copVersion]   - COP version for the emitted event (default COP_VERSION)
 *
 * @param {boolean} [params.throwOnError=true] - If false, do not throw on DB or event error,
 *                                               just return ok=false with an error message.
 *
 * @param {string} [params.jobId]      - ID du job parent dans cop_jobs
 * @param {string} [params.jobStepId]  - ID de l'étape (step) dans cop_steps
 *
 * @returns {Promise<{
 *   artifact: object | null,
 *   ok: boolean,
 *   error?: string
 * }>}
 */

// TODO: handle jobId & jobStepId in all helpers

export async function emitCopArtifact(params) {
  const {
    artifactType,
    artifactKind,

    correlationId = null,
    messageId = null,
    eventId = null,

    // Nouveau : traçabilité Job / Step
    jobId = null,
    jobStepId = null,

    agent,
    content,
    metadata = {},

    emitEvent = false,
    from,
    endpoint,
    baseUrl,
    eventsPath = "/cop-events",
    copVersion = COP_VERSION,

    throwOnError = true,
  } = params || {};

  if (!artifactType) {
    throw new Error("emitCopArtifact: 'artifactType' is required");
  }
  if (!artifactKind) {
    throw new Error("emitCopArtifact: 'artifactKind' is required");
  }
  if (content == null) {
    throw new Error("emitCopArtifact: 'content' is required");
  }

  if (emitEvent) {
    if (!from) {
      throw new Error("emitCopArtifact: 'from' (COP_ADDR) is required when emitEvent=true");
    }
    if (!endpoint && !baseUrl) {
      throw new Error("emitCopArtifact: 'endpoint' or 'baseUrl' is required when emitEvent=true");
    }
  }

  const storage = getDefaultStorage();

  const row = {
    correlation_id: correlationId || null,
    message_id: messageId || null,
    event_id: eventId || null,

    // LIAISON AUX JOBS / STEPS
    job_id: jobId || null,
    job_step_id: jobStepId || null,

    network_id: agent?.networkId || null,
    node_id: agent?.nodeId || null,
    instance_id: agent?.instanceId || null,
    agent_name: agent?.agentName || null,

    artifact_type: artifactType,
    artifact_kind: artifactKind,

    content,
    metadata,
  };

  let inserted;
  try {
    const res = await storage.artifacts.insert(row);
    if (!res.ok) {
      const msg = "emitCopArtifact: DB insert failed: " + res.error;
      if (throwOnError) {
        throw new Error(msg);
      }
      return {
        artifact: null,
        ok: false,
        error: msg,
      };
    }
    inserted = res.artifact;
  } catch (err) {
    if (throwOnError) {
      throw err;
    }
    return {
      artifact: null,
      ok: false,
      error: "db_insert: " + (err && err.message),
    };
  }

  // Optionnel : émettre un COP_EVENT "artifact.created"
  if (emitEvent && inserted) {
    try {
      const eventPayload = {
        artifact_id: inserted.id,
        artifact_type: inserted.artifact_type,
        artifact_kind: inserted.artifact_kind,
        job_id: inserted.job_id,
        job_step_id: inserted.job_step_id,
      };

      // ici, on réutilise votre emitCopEvent existant
      const { emitCopEvent } = await import("./events.js");

      await emitCopEvent({
        endpoint,
        baseUrl,
        path: eventsPath,
        from,
        channel: `cop://artifact/${inserted.artifact_type}`,
        eventType: "artifact.created",
        payload: eventPayload,
        metadata: {
          correlation_id: inserted.correlation_id,
        },
        correlationId: inserted.correlation_id,
        copVersion,
        throwOnError,
      });
    } catch (err) {
      if (throwOnError) {
        throw err;
      }
      return {
        artifact: inserted,
        ok: false,
        error: "event_emit: " + (err && err.message),
      };
    }
  }

  return {
    artifact: inserted,
    ok: true,
  };
}

export async function saveConversationSummary(params) {
  const {
    correlationId,
    messageId,
    agent,

    text,
    level = "short",
    format = "markdown",
    speakers = [],
    language = "fr",

    metadata = {},

    jobId = null,
    jobStepId = null,

    emitEvent = false,
    from,
    endpoint,
    baseUrl,
    eventsPath,
    copVersion,
    throwOnError = true,
  } = params || {};

  if (!text) {
    throw new Error("saveConversationSummary: 'text' is required");
  }

  const content = {
    type: "conversation.summary",
    level,
    format,
    text,
    speakers,
    language,
  };

  return emitCopArtifact({
    artifactType: "summary",
    artifactKind: "conversation",
    correlationId,
    messageId,
    agent,
    content,
    metadata,
    jobId,
    jobStepId,
    emitEvent,
    from,
    endpoint,
    baseUrl,
    eventsPath,
    copVersion,
    throwOnError,
  });
}

/**
 * Helper: decision artifact
 *
 * For capturing decisions, resolutions, choices taken during a conversation or process.
 *
 * @param {Object} params
 * @param {string} [params.correlationId]
 * @param {string} [params.messageId]
 * @param {Object} [params.agent]
 *
 * @param {string} params.title
 * @param {string} [params.description]
 * @param {Array}  [params.options]        - list of { id, label, description }
 * @param {string} [params.chosenOptionId] - id of chosen option
 * @param {string} [params.rationale]
 * @param {string[]} [params.tags]         - e.g. ['traffic', 'budget']
 *
 * @param {Object} [params.metadata]
 *
 * @param {boolean} [params.emitEvent=false]
 * @param {string}  [params.from]
 * @param {string}  [params.endpoint]
 * @param {string}  [params.baseUrl]
 * @param {string}  [params.eventsPath]
 * @param {string}  [params.copVersion]
 * @param {boolean} [params.throwOnError=true]
 */
export async function saveDecisionArtifact(params) {
  const {
    correlationId,
    messageId,
    agent,

    title,
    description = "",
    options = [],
    chosenOptionId = null,
    rationale = "",
    tags = [],

    metadata = {},

    emitEvent = false,
    from,
    endpoint,
    baseUrl,
    eventsPath,
    copVersion,
    throwOnError = true,
  } = params || {};

  if (!title) {
    throw new Error("saveDecisionArtifact: 'title' is required");
  }

  const content = {
    type: "decision",
    title,
    description,
    options,
    chosenOptionId,
    rationale,
    tags,
  };

  return emitCopArtifact({
    artifactType: "decision",
    artifactKind: "action",
    correlationId,
    messageId,
    agent,
    content,
    metadata,
    emitEvent,
    from,
    endpoint,
    baseUrl,
    eventsPath,
    copVersion,
    throwOnError,
  });
}

/**
 * Helper: task list artifact
 *
 * For capturing TODOs / action items resulting from a discussion.
 *
 * @param {Object} params
 * @param {string} [params.correlationId]
 * @param {string} [params.messageId]
 * @param {Object} [params.agent]
 *
 * @param {Array} params.tasks - list of {
 *   id?: string,
 *   title: string,
 *   assignee?: string,
 *   dueDate?: string,      // ISO string
 *   status?: string,       // 'open' | 'in_progress' | 'done' | ...
 *   notes?: string
 * }
 *
 * @param {string} [params.title]       - Optional list title
 * @param {Object} [params.metadata]
 *
 * @param {boolean} [params.emitEvent=false]
 * @param {string}  [params.from]
 * @param {string}  [params.endpoint]
 * @param {string}  [params.baseUrl]
 * @param {string}  [params.eventsPath]
 * @param {string}  [params.copVersion]
 * @param {boolean} [params.throwOnError=true]
 */
export async function saveTaskListArtifact(params) {
  const {
    correlationId,
    messageId,
    agent,

    tasks,
    title = "",

    metadata = {},

    emitEvent = false,
    from,
    endpoint,
    baseUrl,
    eventsPath,
    copVersion,
    throwOnError = true,
  } = params || {};

  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error("saveTaskListArtifact: 'tasks' (non-empty array) is required");
  }

  const content = {
    type: "task_list",
    title,
    tasks,
  };

  return emitCopArtifact({
    artifactType: "task_list",
    artifactKind: "action",
    correlationId,
    messageId,
    agent,
    content,
    metadata,
    emitEvent,
    from,
    endpoint,
    baseUrl,
    eventsPath,
    copVersion,
    throwOnError,
  });
}

/**
 * Helper: file reference / media artifact
 *
 * For pointing to external files: audio recording, PDF, image, etc.
 *
 * @param {Object} params
 * @param {string} [params.correlationId]
 * @param {string} [params.messageId]
 * @param {Object} [params.agent]
 *
 * @param {string} params.uri        - URL or storage path
 * @param {string} params.mimeType   - e.g. 'audio/webm', 'application/pdf'
 * @param {string} [params.label]    - Human-readable label
 * @param {string} [params.mediaType]- 'audio' | 'video' | 'image' | 'document' | 'other'
 *
 * @param {Object} [params.metadata]
 *
 * @param {boolean} [params.emitEvent=false]
 * @param {string}  [params.from]
 * @param {string}  [params.endpoint]
 * @param {string}  [params.baseUrl]
 * @param {string}  [params.eventsPath]
 * @param {string}  [params.copVersion]
 * @param {boolean} [params.throwOnError=true]
 */
export async function saveFileRefArtifact(params) {
  const {
    correlationId,
    messageId,
    agent,

    uri,
    mimeType,
    label = "",
    mediaType = "other",

    metadata = {},

    emitEvent = false,
    from,
    endpoint,
    baseUrl,
    eventsPath,
    copVersion,
    throwOnError = true,
  } = params || {};

  if (!uri) {
    throw new Error("saveFileRefArtifact: 'uri' is required");
  }
  if (!mimeType) {
    throw new Error("saveFileRefArtifact: 'mimeType' is required");
  }

  const content = {
    type: "file_ref",
    uri,
    mimeType,
    label,
    mediaType,
  };

  return emitCopArtifact({
    artifactType: "file_ref",
    artifactKind: "media",
    correlationId,
    messageId,
    agent,
    content,
    metadata,
    emitEvent,
    from,
    endpoint,
    baseUrl,
    eventsPath,
    copVersion,
    throwOnError,
  });
}

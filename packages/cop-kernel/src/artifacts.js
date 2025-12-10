// File: packages/cop-kernel/src/artifacts.js
// Description:
//   Helper to persist high-level COP artifacts into the cop_artifacts table,
//   and optionally emit a COP_EVENT ("artifact.created") via /cop-events.
//
//   Typical usage from an agent (Edge / Deno):
//
//     import { emitCopArtifact } from "../../packages/cop-kernel/src/artifacts.js";
//
//     await emitCopArtifact({
//       artifactType: "summary",
//       artifactKind: "conversation",
//       correlationId: msg.correlation_id || msg.message_id,
//       messageId: msg.message_id,
//       agent: {
//         networkId: to.networkId,
//         nodeId: to.nodeId,
//         instanceId: to.instanceId,
//         agentName: to.agentName,
//       },
//       content: {
//         format: "markdown",
//         text: "Résumé de la discussion...",
//       },
//       metadata: {
//         source: "cafe_oral",
//         language: "fr",
//       },
//       // facultatif : émettre aussi un COP_EVENT artifact.created
//       emitEvent: true,
//       from: msg.to, // COP_ADDR de l'agent émetteur
//       baseUrl: new URL(context.request.url).origin,
//     });
//
// Prérequis côté SQL (exemple recommandé) :
//
//   create table public.cop_artifacts (
//     id uuid primary key default gen_random_uuid(),
//
//     correlation_id uuid,
//     message_id     uuid,
//     event_id       uuid,
//
//     network_id  text,
//     node_id     text,
//     instance_id text,
//     agent_name  text,
//
//     artifact_type text not null,
//     artifact_kind text not null,
//
//     content  jsonb not null,
//     metadata jsonb not null default '{}'::jsonb,
//
//     created_at timestamptz not null default now()
//   );
//
//   create index if not exists cop_artifacts_corr_idx
//     on public.cop_artifacts (correlation_id, created_at);
//
//   create index if not exists cop_artifacts_type_idx
//     on public.cop_artifacts (artifact_type, created_at);
//

import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env.js";
import { emitCopEvent } from "./events.js";
import { COP_VERSION } from "./message.js";

let supabaseArtifacts = null;

function getSupabaseArtifacts() {
  if (!supabaseArtifacts) {
    const url = getEnv("SUPABASE_URL");
    const key = getEnv("SUPABASE_SERVICE_ROLE");
    if (!url || !key) {
      throw new Error("emitCopArtifact: SUPABASE_URL or SUPABASE_SERVICE_ROLE not set");
    }
    supabaseArtifacts = createClient(url, key);
  }
  return supabaseArtifacts;
}

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
 * @returns {Promise<{
 *   artifact: object | null,
 *   ok: boolean,
 *   error?: string
 * }>}
 */
export async function emitCopArtifact(params) {
  const {
    artifactType,
    artifactKind,

    correlationId = null,
    messageId = null,
    eventId = null,

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

  let sb;
  try {
    sb = getSupabaseArtifacts();
  } catch (err) {
    if (throwOnError) {
      throw err;
    }
    return {
      artifact: null,
      ok: false,
      error: "supabase_init: " + (err && err.message),
    };
  }

  const row = {
    correlation_id: correlationId || null,
    message_id: messageId || null,
    event_id: eventId || null,

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
    const { data, error } = await sb.from("cop_artifacts").insert(row).select().maybeSingle();

    if (error) {
      const msg = "emitCopArtifact: DB insert failed: " + error.message;
      if (throwOnError) {
        throw new Error(msg);
      }
      return {
        artifact: null,
        ok: false,
        error: "db_insert: " + error.message,
      };
    }
    inserted = data;
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
      };

      await emitCopEvent({
        endpoint,
        baseUrl,
        path: eventsPath,
        from,
        channel: `cop://artifact/${inserted.artifact_type}`, // simple convention, ajustable
        eventType: "artifact.created",
        payload: eventPayload,
        metadata: {
          correlation_id: inserted.correlation_id,
        },
        correlationId: inserted.correlation_id,
        copVersion,
        // on considère qu'un échec d'event ne doit pas invalider l'artifact lui-même
        throwOnError: throwOnError,
      });
    } catch (err) {
      if (throwOnError) {
        throw err;
      }
      // artifact créé, mais event raté : on le signale dans le retour
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

/**
 * Helper: conversation summary artifact
 *
 * Typical use for Café Oral, debriefs, etc.
 *
 * @param {Object} params
 * @param {string} [params.correlationId]
 * @param {string} [params.messageId]
 * @param {Object} [params.agent] - { networkId, nodeId, instanceId, agentName }
 *
 * @param {string} params.text        - Summary text (markdown or plain)
 * @param {string} [params.level]     - 'short' | 'detailed' | 'per_speaker' | ...
 * @param {string} [params.format]    - 'markdown' (default) | 'plain'
 * @param {string[]} [params.speakers]- Optional list of participant ids/names
 * @param {string} [params.language]  - e.g. 'fr', 'en'
 *
 * @param {Object} [params.metadata]  - Extra metadata
 *
 * @param {boolean} [params.emitEvent=false]
 * @param {string}  [params.from]       - COP_ADDR of emitting agent (required if emitEvent)
 * @param {string}  [params.endpoint]   - full URL to /cop-events
 * @param {string}  [params.baseUrl]    - base URL if endpoint not provided
 * @param {string}  [params.eventsPath] - events path (default '/cop-events')
 * @param {string}  [params.copVersion]
 * @param {boolean} [params.throwOnError=true]
 */
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

/**
 * core/types.ts -COP core types.
 * v0.2 minimal implementation.
 */

// core/types.ts

export type EventType = string & {};

/**
 * Event : tout ce qui "arrive" dans un Topic.
 * Immuable, ordonné logiquement par topicSeq.
 */
export interface Event {
  id: string;
  topicId: string;

  // Type sémantique (profil-dépendant).
  type: EventType;

  // Ordre logique strict à l'intérieur d'un Topic (pour replay/projections).
  topicSeq: number;

  // Version de schéma de l'event/payload.
  schemaVersion: string; // ex: "cop.event.v0.2"

  // Tracing / causalité (optionnel).
  correlationId?: string;
  parentEventIds?: string[];

  createdAt: string; // ISO 8601

  // Contenu profil-dépendant.
  payload: unknown;

  // Métadonnées opaques pour le core.
  meta?: Record<string, unknown>;
}

export type TopicStatus = "open" | "in_progress" | "exhausted" | "closed";

export interface Topic {
  id: string;
  status: TopicStatus;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  meta?: Record<string, unknown>;
}

export type JobStatus =
  | "pending"
  | "running"
  | "needs_input"
  | "done"
  | "failed"
  | "cancelled";

export interface Job {
  id: string;
  topicId: string;
  type: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  lastEventAt?: string;
  meta?: Record<string, unknown>;
}

export type StepStatus = "pending" | "running" | "done" | "skipped" | "failed";

/**
 * Step : une étape dans la vie d'un Job.
 * Références vers des Artifacts, pas de données brutes.
 */
export interface Step {
  id: string;
  jobId: string;
  name: string;
  status: StepStatus;
  inputArtifactIds?: string[];
  outputArtifactIds?: string[];
  createdAt: string;
  updatedAt: string;
  meta?: Record<string, unknown>;
}

/**
 * Artifact : état durable, immuable.
 */
export interface Artifact {
  id: string;
  topicId: string;
  sourceJobId?: string;
  sourceStepId?: string;
  type: string;           // sémantique
  format: string;         // MIME-like
  schemaVersion: string;  // ex: "cop.artifact.v0.2"
  payload: unknown;       // valeur directe ou référence
  createdAt: string;
  meta?: Record<string, unknown>;
}

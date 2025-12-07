/**
 * COP core types.
 * v0.1 minimal implementation.
 */

export type COPEventType =
  | "user_message"
  | "assistant_reflex"
  | "assistant_update"
  | "topic_update"
  | "job_state_changed"
  | "artifact_created"
  | (string & {});

export interface COPEvent {
  id: string;
  topicId: string;
  type: COPEventType;
  createdAt: string; // ISO 8601
  payload: unknown;
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

export interface Step {
  id: string;
  jobId: string;
  name: string;
  status: StepStatus;
  inputRef?: unknown;
  outputRef?: unknown;
  meta?: Record<string, unknown>;
}

export interface Artifact {
  id: string;
  topicId: string;
  sourceJobId?: string;
  sourceStepId?: string;
  type: string;
  format: string;
  payload: unknown;
  createdAt: string;
  meta?: Record<string, unknown>;
}

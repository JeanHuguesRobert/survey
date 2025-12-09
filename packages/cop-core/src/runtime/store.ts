// runtime/store.ts

import type {
  Topic,
  Job,
  Step,
  Artifact,
  JobStatus,
} from "../core";

/**
 * Minimal persistence interfaces for topics, jobs, steps, artifacts.
 * This is a projection API over the immutable Event + Artifact log.
 */
export interface COPStore {
  // Topics
  getTopic(id: string): Promise<Topic | null>;
  saveTopic(topic: Topic): Promise<void>;

  // Jobs

  /**
   * Get a single job by id.
   */
  getJob(id: string): Promise<Job | null>;

  /**
   * Save/update a job projection.
   */
  saveJob(job: Job): Promise<void>;

  /**
   * List jobs, optionally filtered by status.
   * NOTE: generic listing, not scoped by topic.
   */
  listJobs(params: { status?: JobStatus[]; limit?: number }): Promise<Job[]>;

  /**
   * List jobs belonging to a given topic, optionally filtered by status.
   */
  listJobsByTopic(params: {
    topicId: string;
    status?: JobStatus[];
    limit?: number;
  }): Promise<Job[]>;

  // Steps

  /**
   * List all steps for a given job.
   */
  getSteps(jobId: string): Promise<Step[]>;

  /**
   * Save/update a step projection.
   */
  saveStep(step: Step): Promise<void>;

  // Artifacts

  /**
   * Save a new artifact projection.
   * Artifacts are immutable; "update" means adding a new artifact, not mutating.
   */
  saveArtifact(artifact: Artifact): Promise<void>;

  /**
   * Get a single artifact by id.
   */
  getArtifact(id: string): Promise<Artifact | null>;

  /**
   * List artifacts for a topic, optionally filtered by type.
   */
  listArtifacts(params: {
    topicId: string;
    type?: string;
    limit?: number;
  }): Promise<Artifact[]>;
}

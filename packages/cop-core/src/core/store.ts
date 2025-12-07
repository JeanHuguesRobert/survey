import { Topic, Job, Step, Artifact, JobStatus } from "./types";

/** Minimal persistence interfaces for topics, jobs, steps, artifacts. */
export interface COPStore {
  // Topics
  getTopic(id: string): Promise<Topic | null>;
  saveTopic(topic: Topic): Promise<void>;

  // Jobs
  getJob(id: string): Promise<Job | null>;
  saveJob(job: Job): Promise<void>;
  listJobs(params: { status?: JobStatus[]; limit?: number }): Promise<Job[]>;

  // Steps
  getSteps(jobId: string): Promise<Step[]>;
  saveStep(step: Step): Promise<void>;

  // Artifacts
  saveArtifact(artifact: Artifact): Promise<void>;
  listArtifacts(params: { topicId: string; type?: string; limit?: number }): Promise<Artifact[]>;
}

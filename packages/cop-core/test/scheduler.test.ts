import { describe, it, expect } from "vitest";
import { COPScheduler } from "../src/core/scheduler";
import type { COPAgent } from "../src/core/agent";
import type { COPBus } from "../src/core/bus";
import type { COPStore } from "../src/core/store";

class InMemoryBus implements COPBus {
  private events: any[] = [];
  async publish(event: any): Promise<void> {
    this.events.push(event);
  }
  async fetchSince(): Promise<any[]> {
    return this.events.slice();
  }
}

class InMemoryStore implements COPStore {
  private topics = new Map<string, any>();
  private jobs = new Map<string, any>();
  private steps = new Map<string, any[]>();
  private artifacts: any[] = [];

  async getTopic(id: string) {
    return this.topics.get(id) ?? null;
  }
  async saveTopic(topic: any) {
    this.topics.set(topic.id, topic);
  }
  async getJob(id: string) {
    return this.jobs.get(id) ?? null;
  }
  async saveJob(job: any) {
    this.jobs.set(job.id, job);
  }
  async listJobs() {
    return Array.from(this.jobs.values());
  }
  async getSteps(jobId: string) {
    return this.steps.get(jobId) ?? [];
  }
  async saveStep(step: any) {
    const arr = this.steps.get(step.jobId) ?? [];
    arr.push(step);
    this.steps.set(step.jobId, arr);
  }
  async saveArtifact(artifact: any) {
    this.artifacts.push(artifact);
  }
  async listArtifacts({ topicId }: any) {
    return this.artifacts.filter((a) => a.topicId === topicId);
  }
}

describe("COPScheduler", () => {
  it("calls agent onTick periodically", async () => {
    const bus = new InMemoryBus();
    const store = new InMemoryStore();
    let counter = 0;

    const agent: COPAgent = {
      name: "counter",
      async onEvent() {},
      async onTick() {
        counter++;
      },
    };

    const sched = new COPScheduler({ agents: [agent], bus, store, pollIntervalMs: 50 });
    sched.start();
    // wait 220ms -> expect at least 3 ticks
    await new Promise((r) => setTimeout(r, 220));
    await sched.stop();

    expect(counter).toBeGreaterThanOrEqual(3);
  }, 1000);
});

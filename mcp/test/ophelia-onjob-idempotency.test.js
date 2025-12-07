import assert from "assert";
import * as opheliaAgent from "../agents/opheliaAgent.js";

(async () => {
  const stepsDb = [
    {
      id: "step-1",
      job_id: "job-1",
      name: "compose",
      status: "pending",
      input: { text: "input text" },
    },
  ];
  const artifacts = [];
  const mockStore = {
    getJob: async (id) => ({ id: id, topic_id: "t1", status: "running" }),
    getSteps: async (jobId) => stepsDb,
    saveStep: async (s) => {
      const idx = stepsDb.findIndex((x) => x.id === s.id);
      if (idx >= 0) stepsDb[idx] = { ...stepsDb[idx], ...s };
      return stepsDb[idx];
    },
    saveArtifact: async (a) => {
      const existing = artifacts.find(
        (x) =>
          x.source_job_id === a.source_job_id &&
          x.source_step_id === a.source_step_id &&
          x.type === a.type
      );
      if (existing) return existing;
      const newArt = { id: "art-" + (artifacts.length + 1), ...a };
      artifacts.push(newArt);
      return newArt;
    },
    listArtifacts: async () => artifacts,
    saveJob: async (job) => job,
  };
  const publishes = [];
  const mockBus = { publish: async (e) => publishes.push(e) };

  const job = { id: "job-1", type: "deep_reply", topic_id: "t1" };
  await opheliaAgent.onJob(job, { store: mockStore, bus: mockBus });
  await opheliaAgent.onJob(job, { store: mockStore, bus: mockBus });

  assert.strictEqual(artifacts.length, 1, "Expected only one artifact");
  assert.strictEqual(stepsDb[0].status, "done");

  console.log("onJob idempotency test passed");
})();

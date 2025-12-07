import assert from "assert";
import * as opheliaAgent from "../agents/opheliaAgent.js";

(async () => {
  const savedJobs = [];
  const savedSteps = [];
  let publishCount = 0;
  const mockStore = {
    saveJob: async (job) => {
      const existing = savedJobs.find(
        (j) =>
          j.source_event_id &&
          job.source_event_id &&
          j.source_event_id === job.source_event_id &&
          j.topic_id === job.topic_id &&
          j.type === job.type
      );
      if (existing) return existing;
      const newJob = { id: "job-" + (savedJobs.length + 1), ...job };
      savedJobs.push(newJob);
      return newJob;
    },
    saveStep: async (step) => {
      const existing = savedSteps.find((s) => s.job_id === step.job_id && s.name === step.name);
      if (existing) return existing;
      const newStep = { id: "step-" + (savedSteps.length + 1), ...step };
      savedSteps.push(newStep);
      return newStep;
    },
  };
  const mockBus = {
    publish: async () => {
      publishCount++;
    },
  };

  const ev = { id: "evt-1", type: "user_message", topic_id: "t1", payload: { text: "hello" } };

  await opheliaAgent.onEvent(ev, { store: mockStore, bus: mockBus });
  await opheliaAgent.onEvent(ev, { store: mockStore, bus: mockBus });

  console.log(
    "Jobs saved",
    savedJobs.length,
    "Steps saved",
    savedSteps.length,
    "publishCount",
    publishCount
  );
  assert.strictEqual(savedJobs.length, 1, "Expected 1 job saved");
  assert.strictEqual(savedSteps.length, 1, "Expected 1 step saved");

  console.log("Idempotency test passed");
})();

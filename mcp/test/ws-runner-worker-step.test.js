import assert from "assert";
import * as runner from "../ws-runner.js";
import store from "../cop/supabaseStore.js";
import opheliaAgent from "../agents/opheliaAgent.js";

(async () => {
  // Mock store to simulate a claimed job and step
  let claimedJob = { id: "job-1", type: "deep_reply", topic_id: "t1" };
  let claimedStep = {
    id: "step-1",
    job_id: "job-1",
    name: "compose",
    status: "pending",
    input: { text: "hello" },
  };
  const origClaimJob = store.claimJob;
  const origClaimStep = store.claimStep;
  const origGetSteps = store.getSteps;
  let origOnStep = undefined;
  try {
    store.claimJob = async ({ workerId, leaseSeconds }) => claimedJob;
    store.claimStep = async ({ jobId, workerId, leaseSeconds }) => claimedStep;
    store.getSteps = async (jobId) => [claimedStep];

    // mock agent onStep to record call
    let called = 0;
    origOnStep = opheliaAgent.onStep;
    opheliaAgent.onStep = async (job, step, ctx) => {
      called++;
      return;
    };

    // run a single iteration of the workerLoop using workerIteration
    await runner.workerIteration("test-w1");

    assert.strictEqual(called, 1, "Expected agent onStep to be called once");
    console.log("ws-runner-worker-step test passed");
  } catch (e) {
    console.error("test failed", e);
    process.exit(1);
  } finally {
    store.claimJob = origClaimJob;
    store.claimStep = origClaimStep;
    store.getSteps = origGetSteps;
    opheliaAgent.onStep = origOnStep;
  }
})();

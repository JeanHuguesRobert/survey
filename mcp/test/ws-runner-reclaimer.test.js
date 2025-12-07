import assert from "assert";
import * as runner from "../ws-runner.js";
import store from "../cop/supabaseStore.js";

(async () => {
  let saved = [];
  const originalList = store.listJobs;
  const originalSave = store.saveJob;
  try {
    store.listJobs = async ({ status }) => {
      return [
        {
          id: "job-1",
          status: "running",
          lease_expires_at: new Date(Date.now() - 1000).toISOString(),
          worker_id: "ws-runner-1",
        },
      ];
    };
    store.saveJob = async (j) => {
      saved.push(j);
      return j;
    };

    await runner.reclaimStaleLeases();

    assert.strictEqual(saved.length, 1, "Expect one job to be reclaimed");
    assert.strictEqual(saved[0].id, "job-1");
    assert.strictEqual(saved[0].worker_id, null);
    console.log("reclaimer test passed");
  } finally {
    store.listJobs = originalList;
    store.saveJob = originalSave;
  }
  process.exit(0);
})();

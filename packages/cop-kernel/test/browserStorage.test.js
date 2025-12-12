import { assertStrictEquals, assertEquals } from "jsr:@std/assert";
import { createBrowserStorage } from "../src/storage-implementations/browserStorage.js";
import { ERROR_CODES } from "../src/storage.js";

// Mock localStorage for Deno environment
const localStorageMock = (() => {
  let store = {};
  return {
    getItem(key) {
      return store[key] || null;
    },
    setItem(key, value) {
      store[key] = value.toString();
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

function setup() {
  localStorage.clear(); // Clear localStorage before each test
  return createBrowserStorage({ ERROR_CODES });
}

Deno.test("Browser Storage (localStorage) Implementation", async (t) => {
  await t.step("should initialize with type 'browser'", () => {
    const storage = setup();
    assertStrictEquals(storage.options.type, "browser");
  });

  await t.step("agentIdentities", async (t) => {
    await t.step("should upsert and retrieve an agent identity by id", async () => {
      const storage = setup();
      const identity = { agent_id: "agent1", agent_name: "Agent One", status: "active" };
      const result = await storage.agentIdentities.upsert(identity);
      assertStrictEquals(result.ok, true);
      assertEquals(result.identity, identity);

      const retrieved = await storage.agentIdentities.getById("agent1");
      assertStrictEquals(retrieved.ok, true);
      assertEquals(retrieved.identity, identity);
    });

    await t.step("should retrieve an agent identity by name", async () => {
      const storage = setup();
      const identity = { agent_id: "agent2", agent_name: "Agent Two", status: "active" };
      await storage.agentIdentities.upsert(identity);

      const retrieved = await storage.agentIdentities.getByName("Agent Two");
      assertStrictEquals(retrieved.ok, true);
      assertEquals(retrieved.identity, identity);
    });

    await t.step("should list agent identities", async () => {
      const storage = setup();
      const identity1 = { agent_id: "agent3", agent_name: "Agent Three", status: "active" };
      const identity2 = { agent_id: "agent4", agent_name: "Agent Four", status: "inactive" };
      await storage.agentIdentities.upsert(identity1);
      await storage.agentIdentities.upsert(identity2);

      const result = await storage.agentIdentities.list();
      assertStrictEquals(result.ok, true);
      assertStrictEquals(result.identities.length, 2);
      assertEquals(
        result.identities.find((id) => id.agent_id === "agent3"),
        identity1
      );
    });

    await t.step("should update agent status", async () => {
      const storage = setup();
      const identity = { agent_id: "agent5", agent_name: "Agent Five", status: "active" };
      await storage.agentIdentities.upsert(identity);

      const result = await storage.agentIdentities.updateStatus("agent5", "inactive");
      assertStrictEquals(result.ok, true);
      assertStrictEquals(result.identity.status, "inactive");

      const retrieved = await storage.agentIdentities.getById("agent5");
      assertStrictEquals(retrieved.ok, true);
      assertStrictEquals(retrieved.identity.status, "inactive");
    });
  });

  await t.step("jobs", async (t) => {
    await t.step("should upsert and retrieve a job", async () => {
      const storage = setup();
      const job = { id: "job1", status: "pending", version: 0 };
      const result = await storage.jobs.upsert(job);
      assertStrictEquals(result.ok, true);
      assertStrictEquals(result.job.version, 1);

      const retrieved = await storage.jobs.get("job1");
      assertStrictEquals(retrieved.ok, true);
      assertEquals(retrieved.job.id, "job1");
      assertStrictEquals(retrieved.job.version, 1);
    });

    await t.step("should list jobs", async () => {
      const storage = setup();
      const job1 = { id: "job2", status: "pending", version: 0 };
      const job2 = { id: "job3", status: "completed", version: 0 };
      await storage.jobs.upsert(job1);
      await storage.jobs.upsert(job2);

      const result = await storage.jobs.list();
      assertStrictEquals(result.ok, true);
      assertStrictEquals(result.jobs.length, 2);
    });

    await t.step("should update a job with optimistic locking", async () => {
      const storage = setup();
      const job = { id: "job4", status: "pending", version: 0 };
      const upserted = await storage.jobs.upsert(job);

      const patch = { status: "running", version: upserted.job.version };
      const result = await storage.jobs.update("job4", patch);
      assertStrictEquals(result.ok, true);
      assertStrictEquals(result.job.status, "running");
      assertStrictEquals(result.job.version, upserted.job.version + 1);

      const failedPatch = { status: "failed", version: upserted.job.version }; // Old version
      const failedResult = await storage.jobs.update("job4", failedPatch);
      assertStrictEquals(failedResult.ok, false);
      assertStrictEquals(failedResult.code, storage.ERROR_CODES.OPTIMISTIC_LOCK_FAIL);
    });
  });

  await t.step("steps", async (t) => {
    await t.step("should upsert and list steps by job", async () => {
      const storage = setup();
      const step1 = { id: "step1", job_id: "job5", status: "created" };
      const step2 = { id: "step2", job_id: "job5", status: "running" };
      const step3 = { id: "step3", job_id: "job6", status: "created" };

      await storage.steps.upsert(step1);
      await storage.steps.upsert(step2);
      await storage.steps.upsert(step3);

      const result = await storage.steps.listByJob("job5");
      assertStrictEquals(result.ok, true);
      assertStrictEquals(result.steps.length, 2);
      assertEquals(
        result.steps.find((s) => s.id === "step1"),
        step1
      );
    });

    await t.step("should update a step", async () => {
      const storage = setup();
      const step = { id: "step4", job_id: "job7", status: "created" };
      await storage.steps.upsert(step);

      const patch = { status: "completed", output: "done" };
      const result = await storage.steps.update("job7", "step4", patch);
      assertStrictEquals(result.ok, true);
      assertStrictEquals(result.step.status, "completed");
      assertStrictEquals(result.step.output, "done");
    });
  });

  await t.step("should clear cache", async () => {
    const storage = setup();
    const identity = { agent_id: "agent6", agent_name: "Agent Six", status: "active" };
    await storage.agentIdentities.upsert(identity);

    await storage.clearCache();

    const retrieved = await storage.agentIdentities.getById("agent6");
    assertStrictEquals(retrieved.ok, false);
    assertStrictEquals(retrieved.code, ERROR_CODES.NOT_FOUND);
  });

  await t.step("should handle debugLogs insert", async () => {
    const storage = setup();
    const logRecord = { message: "Test log", level: "info" };
    const result = await storage.debugLogs.insert(logRecord);
    assertStrictEquals(result.ok, true);
    // In browserStorage, debug logs are just console.logged, so we just check the return value
  });

  await t.step("should handle events insert", async () => {
    const storage = setup();
    const eventRecord = { type: "testEvent", payload: { data: "test" } };
    const result = await storage.events.insert(eventRecord);
    assertStrictEquals(result.ok, true);
    assertEquals(result.event, eventRecord);
  });

  await t.step("should not support artifacts storage", async () => {
    const storage = setup();
    const artifactRecord = { name: "test.txt", path: "/path/to/test.txt" };
    const result = await storage.artifacts.insert(artifactRecord);
    assertStrictEquals(result.ok, false);
    assertStrictEquals(result.code, ERROR_CODES.DB_ERROR);
  });

  await t.step("should not support fileStorage operations", async () => {
    const storage = setup();
    const uploadResult = await storage.fileStorage.uploadArtifact();
    assertStrictEquals(uploadResult.ok, false);
    assertStrictEquals(uploadResult.code, ERROR_CODES.DB_ERROR);

    const downloadResult = await storage.fileStorage.downloadArtifact();
    assertStrictEquals(downloadResult.ok, false);
    assertStrictEquals(downloadResult.code, ERROR_CODES.NOT_FOUND);

    const getUrlResult = await storage.fileStorage.getPublicUrl();
    assertStrictEquals(getUrlResult.ok, false);
    assertStrictEquals(getUrlResult.code, ERROR_CODES.NOT_FOUND);
  });
});

import { describe, it } from "node:test";
import assert from "assert";
import { getStorage } from "../src/storage.js";

describe("Storage Module", () => {
  it("should return an in-memory storage instance when type is 'memory'", () => {
    const storage = getStorage({ type: "memory" });
    assert.strictEqual(storage.options.type, "memory");
    assert.ok(storage.agentIdentities); // Check for a basic property of the storage interface
  });

  it("should be able to upsert and retrieve an agent identity", async () => {
    const storage = getStorage({ type: "memory" });
    storage.clearCache(); // Clear cache before each test to ensure isolation
    const agent = { agent_id: "agent1", agent_name: "Test Agent", status: "active" };
    await storage.agentIdentities.upsert(agent);
    const retrievedAgent = await storage.agentIdentities.getById("agent1");
    assert.ok(retrievedAgent.ok);
    assert.deepStrictEqual(retrievedAgent.identity, agent);
  });

  it("should be able to list agent identities", async () => {
    const storage = getStorage({ type: "memory" });
    storage.clearCache();
    await storage.agentIdentities.upsert({
      agent_id: "agent2",
      agent_name: "Agent Two",
      status: "active",
    });
    await storage.agentIdentities.upsert({
      agent_id: "agent3",
      agent_name: "Agent Three",
      status: "inactive",
    });
    const { identities } = await storage.agentIdentities.list();
    assert.strictEqual(identities.length, 2);
    assert.ok(identities.some((a) => a.agent_name === "Agent Two"));
  });

  it("should be able to update agent identity status", async () => {
    const storage = getStorage({ type: "memory" });
    storage.clearCache();
    await storage.agentIdentities.upsert({
      agent_id: "agent4",
      agent_name: "Agent Four",
      status: "active",
    });
    const { ok, identity } = await storage.agentIdentities.updateStatus("agent4", "inactive");
    assert.ok(ok);
    assert.strictEqual(identity.status, "inactive");
  });

  it("should be able to upsert and retrieve a job", async () => {
    const storage = getStorage({ type: "memory" });
    storage.clearCache();
    const job = { id: "job1", name: "Test Job", status: "pending", version: 0 };
    await storage.jobs.upsert(job);
    const retrievedJob = await storage.jobs.get("job1");
    assert.ok(retrievedJob.ok);
    assert.deepStrictEqual(retrievedJob.job, { ...job, version: 1 }); // upsert increments version
  });

  it("should handle optimistic locking for jobs", async () => {
    const storage = getStorage({ type: "memory" });
    storage.clearCache();
    const job = { id: "job2", name: "Test Job 2", status: "pending", version: 0 };
    await storage.jobs.upsert(job); // version becomes 1
    const updateResult = await storage.jobs.update("job2", { status: "running", version: 0 }); // Mismatch
    assert.ok(!updateResult.ok);
    assert.strictEqual(updateResult.code, storage.ERROR_CODES.OPTIMISTIC_LOCK_FAIL);
  });

  it("should be able to upsert and retrieve a step", async () => {
    const storage = getStorage({ type: "memory" });
    storage.clearCache();
    const step = { id: "step1", job_id: "job1", name: "Test Step", status: "created" };
    await storage.steps.upsert(step);
    const { steps } = await storage.steps.listByJob("job1");
    assert.strictEqual(steps.length, 1);
    assert.deepStrictEqual(steps[0], step);
  });

  it("should be able to update a step", async () => {
    const storage = getStorage({ type: "memory" });
    storage.clearCache();
    const step = { id: "step2", job_id: "job2", name: "Test Step 2", status: "created" };
    await storage.steps.upsert(step);
    const { ok, step: updatedStep } = await storage.steps.update("job2", "step2", {
      status: "running",
    });
    assert.ok(ok);
    assert.strictEqual(updatedStep.status, "running");
  });

  it("should be able to upload and download an artifact", async () => {
    const storage = getStorage({ type: "memory" });
    storage.clearCache();
    const fileContent = "Hello World!";
    const { ok: uploadOk } = await storage.fileStorage.uploadArtifact(
      "test-bucket",
      "path/to/file.txt",
      fileContent
    );
    assert.ok(uploadOk);
    const { ok: downloadOk, data } = await storage.fileStorage.downloadArtifact(
      "test-bucket",
      "path/to/file.txt"
    );
    assert.ok(downloadOk);
    assert.strictEqual(data, fileContent);
  });

  it("should return NOT_FOUND for non-existent artifact", async () => {
    const storage = getStorage({ type: "memory" });
    storage.clearCache();
    const { ok, code } = await storage.fileStorage.downloadArtifact(
      "test-bucket",
      "non-existent.txt"
    );
    assert.ok(!ok);
    assert.strictEqual(code, storage.ERROR_CODES.NOT_FOUND);
  });

  it("should clear all in-memory data when clearCache is called", async () => {
    const storage = getStorage({ type: "memory" });
    storage.clearCache();
    await storage.agentIdentities.upsert({
      agent_id: "agent5",
      agent_name: "Agent Five",
      status: "active",
    });
    await storage.jobs.upsert({ id: "job3", name: "Job Three", status: "pending" });
    await storage.steps.upsert({
      id: "step3",
      job_id: "job3",
      name: "Step Three",
      status: "created",
    });
    await storage.fileStorage.uploadArtifact("test-bucket", "file.txt", "content");

    storage.clearCache();

    const { identities } = await storage.agentIdentities.list();
    assert.strictEqual(identities.length, 0);
    const { jobs } = await storage.jobs.list();
    assert.strictEqual(jobs.length, 0);
    const { steps } = await storage.steps.listByJob("job3");
    assert.strictEqual(steps.length, 0);
    const { ok: fileOk } = await storage.fileStorage.downloadArtifact("test-bucket", "file.txt");
    assert.ok(!fileOk);
  });

  it("should be able to insert and retrieve debug logs", async () => {
    const storage = getStorage({ type: "memory" });
    storage.clearCache();
    const logRecord = { level: "info", message: "Test debug log", timestamp: Date.now() };
    const { ok } = await storage.debugLogs.insert(logRecord);
    assert.ok(ok);
    const { debugLogs } = storage.getCacheContents();
    assert.strictEqual(debugLogs.length, 1);
    assert.deepStrictEqual(debugLogs[0], logRecord);
  });
});

describe("File-based Storage Module", () => {
  const testBasePath = `./test_file_storage_data_${Date.now()}`;

  it("should return a file-based storage instance when type is 'file'", async () => {
    const storage = getStorage({ type: "file", basePath: testBasePath });
    assert.strictEqual(storage.options.type, "file");
    assert.ok(storage.agentIdentities);
    await storage.clearCache(); // Clean up after test
  });

  it("should be able to upsert and retrieve an agent identity", async () => {
    const storage = getStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    const agent = { agent_id: "agent1", agent_name: "Test Agent", status: "active" };
    await storage.agentIdentities.upsert(agent);
    const retrievedAgent = await storage.agentIdentities.getById("agent1");
    assert.ok(retrievedAgent.ok);
    assert.deepStrictEqual(retrievedAgent.identity, agent);
    await storage.clearCache();
  });

  it("should be able to list agent identities", async () => {
    const storage = getStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    await storage.agentIdentities.upsert({
      agent_id: "agent2",
      agent_name: "Agent Two",
      status: "active",
    });
    await storage.agentIdentities.upsert({
      agent_id: "agent3",
      agent_name: "Agent Three",
      status: "inactive",
    });
    const { identities } = await storage.agentIdentities.list();
    assert.strictEqual(identities.length, 2);
    assert.ok(identities.some((a) => a.agent_name === "Agent Two"));
    await storage.clearCache();
  });

  it("should be able to update agent identity status", async () => {
    const storage = getStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    await storage.agentIdentities.upsert({
      agent_id: "agent4",
      agent_name: "Agent Four",
      status: "active",
    });
    const { ok, identity } = await storage.agentIdentities.updateStatus("agent4", "inactive");
    assert.ok(ok);
    assert.strictEqual(identity.status, "inactive");
    await storage.clearCache();
  });

  it("should be able to upsert and retrieve a job", async () => {
    const storage = getStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    const job = { id: "job1", name: "Test Job", status: "pending", version: 0 };
    await storage.jobs.upsert(job);
    const retrievedJob = await storage.jobs.get("job1");
    assert.ok(retrievedJob.ok);
    assert.deepStrictEqual(retrievedJob.job, { ...job, version: 1 });
    await storage.clearCache();
  });

  it("should handle optimistic locking for jobs", async () => {
    const storage = getStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    const job = { id: "job2", name: "Test Job 2", status: "pending", version: 0 };
    await storage.jobs.upsert(job);
    const updateResult = await storage.jobs.update("job2", { status: "running", version: 0 });
    assert.ok(!updateResult.ok);
    assert.strictEqual(updateResult.code, storage.ERROR_CODES.OPTIMISTIC_LOCK_FAIL);
    await storage.clearCache();
  });

  it("should be able to upsert and retrieve a step", async () => {
    const storage = getStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    const step = { id: "step1", job_id: "job1", name: "Test Step", status: "created" };
    await storage.steps.upsert(step);
    const { steps } = await storage.steps.listByJob("job1");
    assert.strictEqual(steps.length, 1);
    assert.deepStrictEqual(steps[0], step);
    await storage.clearCache();
  });

  it("should be able to update a step", async () => {
    const storage = getStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    const step = { id: "step2", job_id: "job2", name: "Test Step 2", status: "created" };
    await storage.steps.upsert(step);
    const { ok, step: updatedStep } = await storage.steps.update("job2", "step2", {
      status: "running",
    });
    assert.ok(ok);
    assert.strictEqual(updatedStep.status, "running");
    await storage.clearCache();
  });

  it("should be able to upload and download an artifact", async () => {
    const storage = getStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    const fileContent = "Hello File World!";
    const { ok: uploadOk } = await storage.fileStorage.uploadArtifact(
      "test-bucket",
      "path/to/file.txt",
      fileContent
    );
    assert.ok(uploadOk);
    const { ok: downloadOk, data } = await storage.fileStorage.downloadArtifact(
      "test-bucket",
      "path/to/file.txt"
    );
    assert.ok(downloadOk);
    assert.strictEqual(data, fileContent);
    await storage.clearCache();
  });

  it("should return NOT_FOUND for non-existent artifact", async () => {
    const storage = getStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    const { ok, code } = await storage.fileStorage.downloadArtifact(
      "test-bucket",
      "non-existent.txt"
    );
    assert.ok(!ok);
    assert.strictEqual(code, storage.ERROR_CODES.NOT_FOUND);
    await storage.clearCache();
  });

  it("should clear all file-based data when clearCache is called", async () => {
    const storage = getStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    await storage.agentIdentities.upsert({
      agent_id: "agent5",
      agent_name: "Agent Five",
      status: "active",
    });
    await storage.jobs.upsert({ id: "job3", name: "Job Three", status: "pending" });
    await storage.steps.upsert({
      id: "step3",
      job_id: "job3",
      name: "Step Three",
      status: "created",
    });
    await storage.fileStorage.uploadArtifact("test-bucket", "file.txt", "content");

    await storage.clearCache();

    const { identities } = await storage.agentIdentities.list();
    assert.strictEqual(identities.length, 0);
    const { jobs } = await storage.jobs.list();
    assert.strictEqual(jobs.length, 0);
    const { steps } = await storage.steps.listByJob("job3");
    assert.strictEqual(steps.length, 0);
    const { ok: fileOk } = await storage.fileStorage.downloadArtifact("test-bucket", "file.txt");
    assert.ok(!fileOk);
  });
});

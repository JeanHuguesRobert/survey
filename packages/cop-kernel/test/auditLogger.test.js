import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import fs from "fs/promises";
import path from "path";
import { createAuditLogger } from "../src/storage-implementations/auditLogger.js";
import { createFileBasedStorage } from "../src/storage-implementations/fileBasedStorage.js";

const TEST_AUDIT_LOG_PATH = "./test_audit_logs.jsonl";
const TEST_STORAGE_BASE_PATH = "./test_file_storage_data";

describe("AuditLogger Module", () => {
  let auditLogger;

  beforeEach(async () => {
    // Clear the audit log file before each test
    try {
      await fs.unlink(TEST_AUDIT_LOG_PATH);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    auditLogger = createAuditLogger({ auditLogPath: TEST_AUDIT_LOG_PATH });
  });

  it("should log events to a JSONL file", async () => {
    const event1 = {
      eventType: "TestEvent1",
      entityType: "test",
      entityId: "1",
      payload: { key: "value1" },
    };
    const event2 = {
      eventType: "TestEvent2",
      entityType: "test",
      entityId: "2",
      payload: { key: "value2" },
    };

    await auditLogger.logEvent(event1);
    await auditLogger.logEvent(event2);

    const content = await fs.readFile(TEST_AUDIT_LOG_PATH, "utf8");
    const lines = content.trim().split("\n");

    assert.strictEqual(lines.length, 2);

    const parsedEvent1 = JSON.parse(lines[0]);
    assert.strictEqual(parsedEvent1.eventType, event1.eventType);
    assert.strictEqual(parsedEvent1.entityId, event1.entityId);
    assert.deepStrictEqual(parsedEvent1.payload, event1.payload);
    assert.ok(parsedEvent1.timestamp);

    const parsedEvent2 = JSON.parse(lines[1]);
    assert.strictEqual(parsedEvent2.eventType, event2.eventType);
    assert.strictEqual(parsedEvent2.entityId, event2.entityId);
    assert.deepStrictEqual(parsedEvent2.payload, event2.payload);
    assert.ok(parsedEvent2.timestamp);
  });

  it("should append new events to the log file", async () => {
    const event1 = { eventType: "InitialEvent", entityType: "test", entityId: "1", payload: {} };
    await auditLogger.logEvent(event1);

    const event2 = { eventType: "SecondEvent", entityType: "test", entityId: "2", payload: {} };
    await auditLogger.logEvent(event2);

    const content = await fs.readFile(TEST_AUDIT_LOG_PATH, "utf8");
    const lines = content.trim().split("\n");
    assert.strictEqual(lines.length, 2);
  });
});

describe("FileBasedStorage Audit Integration", () => {
  let storage;

  beforeEach(async () => {
    // Clear storage and audit log before each test
    try {
      await fs.rm(TEST_STORAGE_BASE_PATH, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    try {
      await fs.unlink(TEST_AUDIT_LOG_PATH);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    storage = createFileBasedStorage({
      basePath: TEST_STORAGE_BASE_PATH,
      auditLogPath: TEST_AUDIT_LOG_PATH,
    });
  });

  after(async () => {
    // Clean up after all tests are done
    try {
      await fs.rm(TEST_STORAGE_BASE_PATH, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    try {
      await fs.unlink(TEST_AUDIT_LOG_PATH);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  });

  it("should log AgentIdentityUpserted event on agentIdentities.upsert", async () => {
    const identity = { agent_id: "agent1", agent_name: "Agent One", status: "active" };
    await storage.agentIdentities.upsert(identity);

    const content = await fs.readFile(TEST_AUDIT_LOG_PATH, "utf8");
    const lines = content.trim().split("\n");
    assert.strictEqual(lines.length, 1);

    const loggedEvent = JSON.parse(lines[0]);
    assert.strictEqual(loggedEvent.eventType, "AgentIdentityUpserted");
    assert.strictEqual(loggedEvent.entityType, "agentIdentity");
    assert.strictEqual(loggedEvent.entityId, "agent1");
    assert.deepStrictEqual(loggedEvent.payload, identity);
  });

  it("should log AgentIdentityStatusUpdated event on agentIdentities.updateStatus", async () => {
    const identity = { agent_id: "agent2", agent_name: "Agent Two", status: "active" };
    await storage.agentIdentities.upsert(identity);
    await storage.agentIdentities.updateStatus("agent2", "inactive");

    const content = await fs.readFile(TEST_AUDIT_LOG_PATH, "utf8");
    const lines = content.trim().split("\n");
    assert.strictEqual(lines.length, 2); // upsert + updateStatus

    const loggedEvent = JSON.parse(lines[1]); // Second event
    assert.strictEqual(loggedEvent.eventType, "AgentIdentityStatusUpdated");
    assert.strictEqual(loggedEvent.entityType, "agentIdentity");
    assert.strictEqual(loggedEvent.entityId, "agent2");
    assert.deepStrictEqual(loggedEvent.payload, { oldStatus: "active", newStatus: "inactive" });
  });

  it("should log JobUpserted event on jobs.upsert", async () => {
    const job = { id: "job1", name: "Test Job", status: "pending" };
    await storage.jobs.upsert(job);

    const content = await fs.readFile(TEST_AUDIT_LOG_PATH, "utf8");
    const lines = content.trim().split("\n");
    assert.strictEqual(lines.length, 1);

    const loggedEvent = JSON.parse(lines[0]);
    assert.strictEqual(loggedEvent.eventType, "JobUpserted");
    assert.strictEqual(loggedEvent.entityType, "job");
    assert.strictEqual(loggedEvent.entityId, "job1");
    assert.ok(loggedEvent.payload.version); // Version should be incremented
    assert.strictEqual(loggedEvent.payload.name, job.name);
  });

  it("should log JobUpdated event on jobs.update", async () => {
    const job = { id: "job2", name: "Test Job 2", status: "pending", version: 0 };
    await storage.jobs.upsert(job);
    await storage.jobs.update("job2", { status: "running", version: 1 });

    const content = await fs.readFile(TEST_AUDIT_LOG_PATH, "utf8");
    const lines = content.trim().split("\n");
    assert.strictEqual(lines.length, 2); // upsert + update

    const loggedEvent = JSON.parse(lines[1]); // Second event
    assert.strictEqual(loggedEvent.eventType, "JobUpdated");
    assert.strictEqual(loggedEvent.entityType, "job");
    assert.strictEqual(loggedEvent.entityId, "job2");
    assert.deepStrictEqual(loggedEvent.payload.patch, { status: "running", version: 1 });
    assert.strictEqual(loggedEvent.payload.newJob.status, "running");
    assert.strictEqual(loggedEvent.payload.newJob.version, 2); // Original version 0 + 1 (upsert) + 1 (update)
  });

  it("should log StepUpserted event on steps.upsert", async () => {
    const step = { id: "step1", job_id: "job1", name: "Step One", status: "created" };
    await storage.steps.upsert(step);

    const content = await fs.readFile(TEST_AUDIT_LOG_PATH, "utf8");
    const lines = content.trim().split("\n");
    assert.strictEqual(lines.length, 1);

    const loggedEvent = JSON.parse(lines[0]);
    assert.strictEqual(loggedEvent.eventType, "StepUpserted");
    assert.strictEqual(loggedEvent.entityType, "step");
    assert.strictEqual(loggedEvent.entityId, "step1");
    assert.deepStrictEqual(loggedEvent.payload, step);
  });

  it("should log StepUpdated event on steps.update", async () => {
    const step = { id: "step2", job_id: "job2", name: "Step Two", status: "created" };
    await storage.steps.upsert(step);
    await storage.steps.update("job2", "step2", { status: "running" });

    const content = await fs.readFile(TEST_AUDIT_LOG_PATH, "utf8");
    const lines = content.trim().split("\n");
    assert.strictEqual(lines.length, 2); // upsert + update

    const loggedEvent = JSON.parse(lines[1]); // Second event
    assert.strictEqual(loggedEvent.eventType, "StepUpdated");
    assert.strictEqual(loggedEvent.entityType, "step");
    assert.strictEqual(loggedEvent.entityId, "step2");
    assert.deepStrictEqual(loggedEvent.payload.patch, { status: "running" });
    assert.strictEqual(loggedEvent.payload.newStep.status, "running");
  });
});

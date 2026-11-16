import { describe, it, beforeEach, afterEach } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { assertEquals, assert } from "jsr:@std/assert";
import { createDenoSqliteConnection } from "../../sqlite/deno-sqlite.js";

// Mock the Worker and its interactions
class MockWorker {
  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.onmessage = null;
    this.postMessageCalls = [];
  }

  postMessage(message) {
    this.postMessageCalls.push(message);
    // Simulate worker response for init, run, get, all, exec, close
    if (message.method === "init") {
      this.onmessage({ data: { id: message.id, result: { ok: true } } });
    } else if (message.method === "run") {
      this.onmessage({ data: { id: message.id, result: { rowsAffected: 1, lastInsertId: 1 } } });
    } else if (message.method === "get") {
      this.onmessage({ data: { id: message.id, result: { id: 1, name: "test" } } });
    } else if (message.method === "all") {
      this.onmessage({
        data: {
          id: message.id,
          result: [
            { id: 1, name: "test" },
            { id: 2, name: "test2" },
          ],
        },
      });
    } else if (message.method === "exec") {
      this.onmessage({ data: { id: message.id, result: { ok: true } } });
    } else if (message.method === "close") {
      this.onmessage({ data: { id: message.id, result: { ok: true } } });
    }
  }

  terminate() {
    // Simulate worker termination
  }
}

// Override global Worker for testing
const OriginalWorker = globalThis.Worker;
globalThis.Worker = MockWorker;

let connection;
let mockWorker;

beforeEach(async () => {
  // Reset mockWorker before each test
  globalThis.Worker = MockWorker;
  connection = await createDenoSqliteConnection({ uri: ":memory:" });
  mockWorker = connection.worker;
  mockWorker.postMessageCalls = []; // Clear calls for each test
});

afterEach(() => {
  // Restore original Worker after each test
  globalThis.Worker = OriginalWorker;
});

describe("DenoSqliteConnection", () => {
  it("should connect and close", async () => {
    await connection.close();
    assert(mockWorker.postMessageCalls.some((call) => call.method === "close"));
  });

  it("should execute run operations", async () => {
    const sql = "INSERT INTO users (name) VALUES (?)";
    const params = ["John Doe"];
    const result = await connection.run(sql, params);
    assert(
      mockWorker.postMessageCalls.some(
        (call) => call.method === "run" && call.sql === sql && call.params[0] === params[0]
      )
    );
    assertEquals(result.rowsAffected, 1);
    assertEquals(result.lastInsertId, 1);
  });

  it("should execute get operations", async () => {
    const sql = "SELECT * FROM users WHERE id = ?";
    const params = [1];
    const result = await connection.get(sql, params);
    assert(
      mockWorker.postMessageCalls.some(
        (call) => call.method === "get" && call.sql === sql && call.params[0] === params[0]
      )
    );
    assertEquals(result, { id: 1, name: "test" });
  });

  it("should execute all operations", async () => {
    const sql = "SELECT * FROM users";
    const result = await connection.all(sql);
    assert(mockWorker.postMessageCalls.some((call) => call.method === "all" && call.sql === sql));
    assertEquals(result, [
      { id: 1, name: "test" },
      { id: 2, name: "test2" },
    ]);
  });

  it("should execute exec operations", async () => {
    const sql = "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)";
    await connection.exec(sql);
    assert(mockWorker.postMessageCalls.some((call) => call.method === "exec" && call.sql === sql));
  });

  it("should throw error for transaction method", async () => {
    let error;
    try {
      await connection.transaction(async (trx) => {});
    } catch (e) {
      error = e;
    }
    assert(error instanceof Error);
    assertEquals(
      error.message,
      "La méthode 'transaction' doit être implémentée par l'adaptateur spécifique."
    );
  });
});

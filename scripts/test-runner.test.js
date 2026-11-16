import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

test("test runner counts successful tests in quiet mode", () => {
  const child = spawnSync(process.execPath, ["scripts/test-runner.js", "--quiet", "mcp/test/wsBus.test.js"], {
    cwd: process.cwd(), encoding: "utf8", timeout: 12000,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== "NODE_TEST_CONTEXT")),
  });
  assert.equal(child.status, 0, child.stderr);
  const passed = Number(child.stdout.match(/Total Passed: (\d+)/)?.[1] ?? 0);
  assert.ok(passed > 0, child.stdout);
  assert.match(child.stdout, /Total Failed: 0/);
  assert.match(child.stdout, /Total Files Processed: 1/);
});

test("test runner reports an actual failed test even in quiet mode", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "survey-test-runner-"));
  try {
    const fixture = path.join(dir, "deliberate-failure.js");
    writeFileSync(fixture, 'import { test } from "node:test"; test("deliberate failure", () => { throw new Error("expected"); });\n');
    const child = spawnSync(process.execPath, ["scripts/test-runner.js", "--quiet", fixture], {
      cwd: process.cwd(), encoding: "utf8", timeout: 12000,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== "NODE_TEST_CONTEXT")),
    });
    assert.equal(child.status, 1);
    assert.match(child.stdout, /Total Failed: 1/);
    assert.match(child.stdout, /Total Files Processed: 1/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * scripts/workflow-id-token.mjs (V7.279). Hermetic: reads this repo's own
 * workflow files and planted YAML strings, nothing else.
 *
 * Every rule has a REFUSE case (a finding must be reported) paired with an
 * ALLOW case (no finding), so a checker that reports nothing, or everything,
 * cannot pass both. The two plan cases (rebuild-cadence-infra-2026-10-17.md,
 * F-1 and row 3.3c) are planted into copies of the REAL workflow text, so they
 * keep testing what the files actually say as the files change.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ID_TOKEN_WORKFLOWS,
  auditWorkflow,
  auditWorkflowDir,
} from "./workflow-id-token.mjs";

const WORKFLOW_DIR = fileURLToPath(new URL("../.github/workflows/", import.meta.url));

function realWorkflow(fileName) {
  return readFileSync(join(WORKFLOW_DIR, fileName), "utf8");
}

/** Replace once, and fail the test if the anchor is gone, so a plant can never silently no-op. */
function plant(text, anchor, replacement) {
  assert.match(text, anchor, `plant anchor ${anchor} not found; the workflow changed shape`);
  const planted = text.replace(anchor, replacement);
  assert.notEqual(planted, text);
  return planted;
}

const DISPATCH_ONLY = [
  "name: t",
  "on:",
  "  workflow_dispatch:",
  "jobs:",
  "  a:",
  "    runs-on: ubuntu-latest",
  "    steps:",
  "      - run: echo",
  "",
].join("\n");

function withWorkflowPermissions(permissionsBlock, on = "on:\n  workflow_dispatch:") {
  return `name: t\n${on}\n${permissionsBlock}\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo\n`;
}

function withJobPermissions(permissionsBlock) {
  return `name: t\non:\n  workflow_dispatch:\njobs:\n  a:\n    runs-on: ubuntu-latest\n${permissionsBlock}\n    steps:\n      - run: echo\n`;
}

// --- The repository as it stands -------------------------------------------

test("this repo: parses every workflow, finds exactly the two allowed id-token workflows, reports clean", () => {
  const result = auditWorkflowDir(WORKFLOW_DIR);
  // Assert we parsed something before trusting an empty findings list.
  assert.ok(result.parsed.length >= 3, `parsed only ${result.parsed.length} workflow(s)`);
  assert.ok(result.parsed.includes("free-year-package-check.yml"));
  // The positive control: the detector sees id-token in the two files that do request it.
  assert.deepEqual([...result.requesters].sort(), [...ID_TOKEN_WORKFLOWS].sort());
  assert.deepEqual(result.findings, []);
});

test("an empty workflow directory parses nothing, which the repo test above would catch", () => {
  const dir = mkdtempSync(join(tmpdir(), "wf-empty-"));
  try {
    const result = auditWorkflowDir(dir);
    assert.deepEqual(result.parsed, []);
    assert.deepEqual(result.requesters, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- Plan case 1: id-token added to free-year-package-check.yml ---------------

test("REFUSE: id-token: write added to free-year-package-check.yml (plan must-fail case 1)", () => {
  const text = plant(
    realWorkflow("free-year-package-check.yml"),
    /^permissions:\r?\n/m,
    "permissions:\n  id-token: write\n",
  );
  const result = auditWorkflow("free-year-package-check.yml", text);
  assert.equal(result.requestsIdToken, true);
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0], /free-year-package-check\.yml.*only promote-stable\.yml and demo-catchup\.yml/);
});

test("REFUSE: the same plant, run through the directory audit on a local copy of the workflows", () => {
  const dir = mkdtempSync(join(tmpdir(), "wf-plant-"));
  try {
    for (const name of ["promote-stable.yml", "demo-catchup.yml", "free-year-package-check.yml"]) {
      writeFileSync(join(dir, name), realWorkflow(name));
    }
    writeFileSync(
      join(dir, "free-year-package-check.yml"),
      plant(realWorkflow("free-year-package-check.yml"), /^permissions:\r?\n/m, "permissions:\n  id-token: write\n"),
    );
    const result = auditWorkflowDir(dir);
    assert.equal(result.parsed.length, 3);
    assert.equal(result.findings.length, 1);
    assert.match(result.findings[0], /free-year-package-check\.yml/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ALLOW: free-year-package-check.yml as it is requests no id-token", () => {
  const result = auditWorkflow("free-year-package-check.yml", realWorkflow("free-year-package-check.yml"));
  assert.equal(result.requestsIdToken, false);
  assert.deepEqual(result.findings, []);
});

// --- Plan case 2: pull_request_target added to a copy of demo-catchup.yml ---

test("REFUSE: pull_request_target added to demo-catchup.yml (plan must-fail case 2)", () => {
  const text = plant(realWorkflow("demo-catchup.yml"), /^on:\r?\n/m, "on:\n  pull_request_target:\n");
  const result = auditWorkflow("demo-catchup.yml", text);
  assert.equal(result.requestsIdToken, true);
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0], /demo-catchup\.yml.*pull_request_target/);
});

test("REFUSE: the same copy under another file name reports both rules", () => {
  const text = plant(realWorkflow("demo-catchup.yml"), /^on:\r?\n/m, "on:\n  pull_request_target:\n");
  const result = auditWorkflow("demo-catchup-copy.yml", text);
  assert.equal(result.findings.length, 2);
});

test("ALLOW: demo-catchup.yml and promote-stable.yml as they are", () => {
  for (const name of ID_TOKEN_WORKFLOWS) {
    const result = auditWorkflow(name, realWorkflow(name));
    assert.equal(result.requestsIdToken, true, `${name} should be seen requesting id-token`);
    assert.deepEqual(result.findings, [], name);
  }
});

// --- Where id-token can be requested ----------------------------------------

test("REFUSE: id-token at job level in a workflow that is not allowed", () => {
  const result = auditWorkflow("other.yml", withJobPermissions("    permissions:\n      id-token: write"));
  assert.equal(result.requestsIdToken, true);
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0], /jobs\.a/);
});

test("REFUSE: write-all grants id-token, at workflow level and at job level", () => {
  assert.equal(auditWorkflow("other.yml", withWorkflowPermissions("permissions: write-all")).findings.length, 1);
  assert.equal(auditWorkflow("other.yml", withJobPermissions("    permissions: write-all")).findings.length, 1);
});

test("REFUSE: an unrecognised permissions value fails closed", () => {
  assert.equal(auditWorkflow("other.yml", withWorkflowPermissions("permissions: everything")).findings.length, 1);
  assert.equal(auditWorkflow("other.yml", withWorkflowPermissions("permissions:\n  - id-token")).findings.length, 1);
});

test("REFUSE: id-token key in another case, or with a value other than none", () => {
  assert.equal(auditWorkflow("other.yml", withWorkflowPermissions("permissions:\n  ID-Token: write")).findings.length, 1);
  assert.equal(auditWorkflow("other.yml", withWorkflowPermissions("permissions:\n  id-token: read")).findings.length, 1);
});

test("REFUSE: id-token through a YAML anchor and alias", () => {
  const text = [
    "name: t",
    "on:",
    "  workflow_dispatch:",
    "x-perms: &perms",
    "  id-token: write",
    "jobs:",
    "  a:",
    "    runs-on: ubuntu-latest",
    "    permissions: *perms",
    "    steps:",
    "      - run: echo",
    "",
  ].join("\n");
  assert.equal(auditWorkflow("other.yml", text).findings.length, 1);
});

test("ALLOW: id-token: none, read-all, an empty block, and no permissions key at all", () => {
  for (const block of ["permissions:\n  id-token: none\n  contents: read", "permissions: read-all", "permissions: {}"]) {
    const result = auditWorkflow("other.yml", withWorkflowPermissions(block));
    assert.equal(result.requestsIdToken, false, block);
    assert.deepEqual(result.findings, [], block);
  }
  assert.deepEqual(auditWorkflow("other.yml", DISPATCH_ONLY).findings, []);
});

// --- Untrusted triggers on an allowed file ----------------------------------

const ALLOWED_PERMS = "permissions:\n  contents: read\n  id-token: write";

test("REFUSE: every untrusted trigger on an allowed file, in map, string and list form", () => {
  for (const trigger of [
    "pull_request_target",
    "workflow_run",
    "pull_request",
    "issue_comment",
    "workflow_call",
  ]) {
    for (const on of [`on:\n  ${trigger}:`, `on: ${trigger}`, `on: [workflow_dispatch, ${trigger}]`]) {
      const result = auditWorkflow("promote-stable.yml", withWorkflowPermissions(ALLOWED_PERMS, on));
      assert.equal(result.findings.length, 1, on);
      assert.match(result.findings[0], new RegExp(trigger), on);
    }
  }
});

test("ALLOW: workflow_dispatch, schedule and push on an allowed file", () => {
  for (const on of [
    "on:\n  workflow_dispatch:",
    "on:\n  schedule:\n    - cron: '0 0 * * 0'",
    "on: [push, workflow_dispatch]",
  ]) {
    assert.deepEqual(auditWorkflow("demo-catchup.yml", withWorkflowPermissions(ALLOWED_PERMS, on)).findings, [], on);
  }
});

test("ALLOW: an untrusted trigger is fine when the workflow requests no id-token", () => {
  const result = auditWorkflow("pr.yml", withWorkflowPermissions("permissions:\n  contents: read", "on:\n  pull_request_target:"));
  assert.deepEqual(result.findings, []);
});

test("REFUSE: an id-token workflow whose triggers cannot be read fails closed", () => {
  const text = `name: t\npermissions:\n  id-token: write\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo\n`;
  const result = auditWorkflow("promote-stable.yml", text);
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0], /trigger/);
});

// --- Files that cannot be read as a workflow --------------------------------

test("REFUSE: YAML that does not parse, or is not a mapping, is a finding, never a skip", () => {
  assert.equal(auditWorkflow("bad.yml", "on: [unclosed\n").findings.length, 1);
  assert.equal(auditWorkflow("bad.yml", "- just\n- a list\n").findings.length, 1);
  assert.equal(auditWorkflow("bad.yml", "").findings.length, 1);
});

test("the directory audit reads .yaml as well as .yml", () => {
  const dir = mkdtempSync(join(tmpdir(), "wf-ext-"));
  try {
    writeFileSync(join(dir, "other.yaml"), withWorkflowPermissions("permissions:\n  id-token: write"));
    writeFileSync(join(dir, "notes.txt"), "permissions:\n  id-token: write\n");
    const result = auditWorkflowDir(dir);
    assert.deepEqual(result.parsed, ["other.yaml"]);
    assert.equal(result.findings.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

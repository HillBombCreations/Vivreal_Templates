/**
 * V7.277. promote-stable.yml and demo-catchup.yml both start Amplify builds
 * across the fleet. With two groups a manual `tier: live` recovery could run
 * beside a promote: one run started a job at the old `stable` head and the
 * other then saw that app busy and went red.
 *
 * GitHub keeps ONE pending run per group and a newer run REPLACES it, so the
 * shared group holds only the runs that must not overlap: a real promote and
 * a manual live or all recovery. The review of PR 197 (C4) found the first
 * version put every run in it, so the Wednesday schedule, a demo run or a dry
 * run could cancel a waiting live recovery or promote. These tests evaluate
 * each workflow's group expression for every kind of run it can start.
 *
 * Hermetic: reads this repo's own workflow files and planted documents.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import yaml from "js-yaml";

import {
  RUN_KINDS, SHARED_GROUP, declaredRunKinds, evaluateExpression, fleetBuildConcurrencyIssues, resolveGroup, runKindCoverageIssues,
} from "./fleet-concurrency.mjs";

const WORKFLOW_DIR = fileURLToPath(new URL("../.github/workflows/", import.meta.url));

function workflow(fileName) {
  return yaml.load(readFileSync(join(WORKFLOW_DIR, fileName), "utf8"));
}

const promote = () => workflow("promote-stable.yml");
const catchup = () => workflow("demo-catchup.yml");
const queued = (group) => ({ concurrency: { group, "cancel-in-progress": false } });

test("[V7.277 REFUSE] only real promotes and live or all recoveries join the shared group", () => {
  assert.deepEqual(fleetBuildConcurrencyIssues(promote(), catchup()), []);
});

test("[V7.277 REFUSE] the schedule, a demo run or a dry run in the shared group is reported", () => {
  // The first version of this change: one literal group for every run.
  const issues = fleetBuildConcurrencyIssues(queued(SHARED_GROUP), queued(SHARED_GROUP));
  const outsiders = [
    "promote dry run", "promote all dry run", "catch-up manual demo", "catch-up live dry run",
    "catch-up all dry run", "catch-up demo dry run", "catch-up weekly schedule",
  ];
  for (const kind of outsiders) {
    assert.ok(issues.some((i) => i.startsWith(`${kind} `)), `${kind} must be reported: ${issues.join("; ")}`);
  }
  assert.equal(issues.length, outsiders.length, "and nothing that belongs there is reported");
});

test("[V7.277 REFUSE] a recovery or promote left out of the shared group is reported, and so is cancelling", () => {
  const issues = fleetBuildConcurrencyIssues(queued("promote-stable"), queued("demo-catchup"));
  for (const kind of ["promote live", "promote all", "catch-up recovery live", "catch-up recovery all"]) {
    assert.ok(issues.some((i) => i.startsWith(kind)), kind);
  }
  const cancelling = { concurrency: { group: SHARED_GROUP, "cancel-in-progress": true } };
  assert.ok(fleetBuildConcurrencyIssues(promote(), cancelling).some((i) => i.includes("cancel-in-progress")));
  assert.ok(fleetBuildConcurrencyIssues(promote(), {}).some((i) => i.includes("no concurrency group")));
});

test("[V7.277 ALLOW] the real files resolve each run to the group it should have", () => {
  const p = promote().concurrency.group;
  const c = catchup().concurrency.group;
  const dispatch = (inputs) => ({ github: { event_name: "workflow_dispatch", run_id: "42" }, inputs });
  assert.equal(resolveGroup(p, dispatch({ scope: "live", dry_run: false })), SHARED_GROUP);
  assert.equal(resolveGroup(p, dispatch({ scope: "live", dry_run: true })), "fleet-dry-run-42");
  assert.equal(resolveGroup(c, dispatch({ tier: "live", dry_run: false })), SHARED_GROUP);
  assert.equal(resolveGroup(c, dispatch({ tier: "all", dry_run: false })), SHARED_GROUP);
  assert.equal(resolveGroup(c, dispatch({ tier: "demo", dry_run: false })), "demo-catchup");
  assert.equal(resolveGroup(c, { github: { event_name: "schedule", run_id: "43" }, inputs: {} }), "demo-catchup");
  assert.equal(catchup().concurrency["cancel-in-progress"], false);
  assert.equal(promote().concurrency["cancel-in-progress"], false);
});

test("[V7.277 ALLOW] the evaluator follows GitHub's && and || value rules and refuses what it does not know", () => {
  const ctx = { github: { event_name: "schedule" }, inputs: {} };
  assert.equal(evaluateExpression("inputs.missing && 'a' || 'b'", ctx), "b", "a null input is falsy");
  assert.equal(evaluateExpression("github.event_name == 'SCHEDULE'", ctx), true, "string equality ignores case");
  assert.equal(evaluateExpression("format('x-{0}-{1}', 'a', 2)", ctx), "x-a-2");
  assert.equal(resolveGroup("plain-literal", ctx), "plain-literal");
  assert.throws(() => evaluateExpression("vars.X", ctx), /unsupported context/);
  assert.throws(() => evaluateExpression("contains(github.event_name, 's')", ctx), /unsupported context/);
});

// --- coverage: the list must name every run the workflows can start ---------
//
// RUN_KINDS is hand written, so a tier, scope or trigger added to either
// workflow later would never have its group evaluated and would fall into
// whatever the expression's fallback names. These read the declared triggers
// and inputs and fail on any combination the list does not name.

test("[V7.277 REFUSE] every trigger and input combination the real workflows declare is in RUN_KINDS", () => {
  assert.deepEqual(runKindCoverageIssues(promote(), catchup()), []);
});

test("[V7.277 ALLOW] the declared runs are the full cross product of the real inputs plus the schedule", () => {
  const p = declaredRunKinds(promote());
  const c = declaredRunKinds(catchup());
  assert.deepEqual(p.unenumerable, []);
  assert.deepEqual(c.unenumerable, []);
  assert.equal(p.kinds.length, 4, "scope live|all x dry_run true|false");
  assert.equal(c.kinds.length, 7, "tier demo|live|all x dry_run true|false, plus the schedule");
  assert.ok(c.kinds.some((k) => k.event_name === "schedule" && Object.keys(k.inputs).length === 0));
});

test("[V7.277 REFUSE] a new option planted in a copy of each workflow is reported as unlisted", () => {
  const p = structuredClone(promote());
  p.on.workflow_dispatch.inputs.scope.options.push("qa");
  const c = structuredClone(catchup());
  c.on.workflow_dispatch.inputs.tier.options.push("qa");
  const issues = runKindCoverageIssues(p, c);
  // Two dry_run values for each planted option, in each file.
  assert.equal(issues.length, 4, issues.join("; "));
  assert.ok(issues.some((i) => i.startsWith("promote:") && i.includes('"scope":"qa"')), issues.join("; "));
  assert.ok(issues.some((i) => i.startsWith("catchup:") && i.includes('"tier":"qa"')), issues.join("; "));
});

test("[V7.277 REFUSE] a new trigger, a new boolean input and an unenumerable input are all reported", () => {
  const withPush = structuredClone(catchup());
  withPush.on.push = { branches: ["stable"] };
  assert.ok(runKindCoverageIssues(promote(), withPush).some((i) => i.includes("push {}")), "a push trigger");

  const withBool = structuredClone(promote());
  withBool.on.workflow_dispatch.inputs.force = { type: "boolean", default: false };
  const boolIssues = runKindCoverageIssues(withBool, catchup());
  assert.ok(boolIssues.some((i) => i.includes('"force":true')), boolIssues.join("; "));

  const withString = structuredClone(promote());
  withString.on.workflow_dispatch.inputs.app_id = { type: "string" };
  assert.ok(runKindCoverageIssues(withString, catchup()).some((i) => i.includes('input "app_id"') && i.includes("no finite set")));

  // An input with no type is a string to GitHub, and so has no finite set either.
  const untyped = structuredClone(promote());
  untyped.on.workflow_dispatch.inputs.note = { description: "free text" };
  assert.ok(runKindCoverageIssues(untyped, catchup()).some((i) => i.includes('input "note"')));
});

test("[V7.277 REFUSE] a listed run the workflow cannot start, and a workflow with no triggers, are reported", () => {
  const qa = { name: "promote qa", shared: false, ctx: { github: { event_name: "workflow_dispatch" }, inputs: { scope: "qa", dry_run: false } } };
  const extra = { ...RUN_KINDS, promote: [...RUN_KINDS.promote, qa] };
  assert.ok(runKindCoverageIssues(promote(), catchup(), extra).some((i) => i.includes('"promote qa" is not a run')));
  assert.ok(runKindCoverageIssues({}, catchup()).some((i) => i === "promote: declares no triggers"));
});

test("[V7.277 ALLOW] the string and list forms of on: are read as triggers with no inputs", () => {
  assert.deepEqual(declaredRunKinds({ on: "push" }).kinds, [{ event_name: "push", inputs: {} }]);
  assert.deepEqual(declaredRunKinds({ on: ["push", "schedule"] }).kinds.map((k) => k.event_name), ["push", "schedule"]);
});

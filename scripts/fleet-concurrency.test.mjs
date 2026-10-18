/**
 * V7.277. promote-stable.yml and demo-catchup.yml both start Amplify builds
 * across the fleet. With two concurrency groups a manual `tier: live`
 * recovery could run beside a promote: one run started a job at the old
 * `stable` head and the other then saw that app busy and went red. One shared
 * group with cancel-in-progress false makes the second run wait instead.
 *
 * GitHub keeps at most ONE pending run per group: a third run queued while a
 * second is pending replaces the pending one. That is acceptable here (both
 * workflows build at `stable`'s head, and demo-catchup skips an app already
 * there), and it is why cancel-in-progress must stay false: true would kill a
 * RUNNING promote mid fan-out.
 *
 * Hermetic: reads this repo's own workflow files.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import yaml from "js-yaml";

import { fleetBuildConcurrencyIssues } from "./fleet-concurrency.mjs";

const WORKFLOW_DIR = fileURLToPath(new URL("../.github/workflows/", import.meta.url));

function workflow(fileName) {
  return yaml.load(readFileSync(join(WORKFLOW_DIR, fileName), "utf8"));
}

const promote = () => workflow("promote-stable.yml");
const catchup = () => workflow("demo-catchup.yml");

test("[V7.277 REFUSE] the two fleet-build workflows share one queueing concurrency group", () => {
  assert.deepEqual(fleetBuildConcurrencyIssues(promote(), catchup()), []);
});

test("[V7.277 REFUSE] the checker reports diverging groups and a cancelling group", () => {
  const a = { concurrency: { group: "templates-fleet-build", "cancel-in-progress": false } };
  assert.equal(fleetBuildConcurrencyIssues(a, { concurrency: { group: "demo-catchup", "cancel-in-progress": false } }).length, 1);
  assert.equal(fleetBuildConcurrencyIssues(a, { concurrency: { group: "templates-fleet-build", "cancel-in-progress": true } }).length, 1);
  assert.equal(fleetBuildConcurrencyIssues(a, {}).length, 1, "no concurrency at all");
  assert.equal(fleetBuildConcurrencyIssues(a, { concurrency: "templates-fleet-build" }).length, 0, "the short string form queues too");
});

test("[V7.277 ALLOW] identical queueing groups pass, and the real files parse", () => {
  const ok = { concurrency: { group: "templates-fleet-build", "cancel-in-progress": false } };
  assert.deepEqual(fleetBuildConcurrencyIssues(ok, structuredClone(ok)), []);
  assert.ok(promote().jobs && catchup().jobs, "positive control: both workflow files load with their jobs");
});

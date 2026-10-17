/**
 * scripts/fleet-build.mjs, against a stubbed Amplify client. Hermetic: no AWS
 * call, no network. Every guard has a REFUSE case (the build must NOT start)
 * paired with an ALLOW case (a build that must start), so a selector that
 * starts nothing, or everything, cannot pass both.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseArgs,
  resolveBuildTier,
  runFleetBuild,
  UsageError,
} from "./fleet-build.mjs";

const SHA = "a".repeat(40);
const OLD_SHA = "b".repeat(40);
const REPO = "https://github.com/HillBombCreations/Vivreal_Templates";

/** Known live customer app. The must-pass control in every default-scope test. */
const COMEDY = "d37nvwe48pi1dx";

function app(appId, name, repository = REPO) {
  return { appId, name, repository, appArn: `arn:aws:amplify:us-east-1:683422564693:apps/${appId}` };
}

/**
 * A fleet with one app per interesting case. `jobs` is newest-first per app,
 * the way ListJobs returns it; the stub shuffles nothing, so the sort in the
 * module is exercised separately below.
 */
function fleet() {
  return {
    apps: [
      app(COMEDY, "The Comedy Collective"),
      app("dvivrealio0001", "vivreal"),
      app("duntagged00001", "globaldropsupply"),
      app("ddemo00000001", "butter-bloom"),
      app("ddemo00000002", "windward-house"),
      app("dqa0000000001", "qa-scratch-1"),
      app("dportal000001", "Vivreal_Portal_Mobile", "https://github.com/HillBombCreations/Vivreal_Portal_Mobile"),
    ],
    tags: {
      [COMEDY]: { "vivreal:buildTier": "live" },
      dvivrealio0001: { "vivreal:buildTier": "live" },
      duntagged00001: { "vivreal:groupName": "GlobalDropSupply" },
      ddemo00000001: { "vivreal:buildTier": "demo" },
      ddemo00000002: { "vivreal:buildTier": "demo" },
      dqa0000000001: { "vivreal:buildTier": "qa" },
      dportal000001: { "vivreal:buildTier": "live" },
    },
    jobs: {},
  };
}

/** Records every call so a test can assert what was NOT done. */
function stubClient(state, { failStart = new Set(), failTags = new Set() } = {}) {
  const calls = { listApps: 0, listTags: [], listJobs: [], start: [] };
  let inFlight = 0;
  let maxInFlight = 0;
  const client = {
    async listApps() {
      calls.listApps += 1;
      return state.apps;
    },
    async listTagsForResource(arn) {
      calls.listTags.push(arn);
      const appId = arn.split("/").pop();
      if (failTags.has(appId)) throw new Error("AccessDenied");
      return state.tags[appId] ?? {};
    },
    async listJobs(appId, branch) {
      calls.listJobs.push({ appId, branch });
      return state.jobs[appId] ?? [];
    },
    async startJob(input) {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      calls.start.push(input);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      if (failStart.has(input.appId)) throw new Error("LimitExceededException");
      return { jobId: String(100 + calls.start.length), status: "PENDING" };
    },
  };
  return { client, calls, maxInFlight: () => maxInFlight };
}

function options(over = {}) {
  return { ...parseArgs(["--commit", SHA]), ...over };
}

const started = (calls) => calls.start.map((c) => c.appId).sort();

// ── tier resolution ─────────────────────────────────────────────────────

test("tier: an untagged app resolves to live, never to a skipped tier", () => {
  assert.deepEqual(resolveBuildTier({}), { tier: "live", source: "untagged" });
  assert.deepEqual(resolveBuildTier(undefined), { tier: "live", source: "untagged" });
});

test("tier: an unknown value resolves to live (fails toward building)", () => {
  assert.deepEqual(resolveBuildTier({ "vivreal:buildTier": "prod" }), { tier: "live", source: "unknown:prod" });
});

test("tier: demo and qa are read as written, trimmed and case-folded; scratch means qa", () => {
  assert.equal(resolveBuildTier({ "vivreal:buildTier": " Demo " }).tier, "demo");
  assert.equal(resolveBuildTier({ "vivreal:buildTier": "QA" }).tier, "qa");
  assert.equal(resolveBuildTier({ "vivreal:buildTier": "scratch" }).tier, "qa");
  assert.equal(resolveBuildTier({ "vivreal:buildTier": "live" }).source, "tag");
});

// ── scope ───────────────────────────────────────────────────────────────

test("default scope: live and untagged apps build; demo and qa are refused", async () => {
  const s = stubClient(fleet());
  const result = await runFleetBuild({ client: s.client, options: options() });

  // ALLOW, with the known live app as the must-pass control.
  assert.ok(started(s.calls).includes(COMEDY), "the known live app must build");
  assert.deepEqual(started(s.calls), [COMEDY, "duntagged00001", "dvivrealio0001"].sort());
  // REFUSE: no demo or qa app is started, and none of them even has its jobs read.
  for (const id of ["ddemo00000001", "ddemo00000002", "dqa0000000001"]) {
    assert.ok(!started(s.calls).includes(id), `${id} must not build on a live promote`);
    assert.ok(!s.calls.listJobs.some((c) => c.appId === id), `${id} jobs must not be read`);
  }
  assert.equal(result.exitCode, 0);
});

test("default scope: every start is pinned to the given commit on stable as RELEASE", async () => {
  const s = stubClient(fleet());
  await runFleetBuild({ client: s.client, options: options() });
  assert.ok(s.calls.start.length > 0);
  for (const c of s.calls.start) {
    assert.equal(c.commitId, SHA);
    assert.equal(c.branch, "stable");
    assert.equal(c.jobType, "RELEASE");
  }
});

test("an app on another repository is never touched, whatever its tag says", async () => {
  const s = stubClient(fleet());
  await runFleetBuild({ client: s.client, options: options({ tiers: new Set(["live", "demo", "qa"]) }) });
  assert.ok(!started(s.calls).includes("dportal000001"));
  assert.ok(!s.calls.listTags.some((arn) => arn.endsWith("/dportal000001")));
});

test("repository match tolerates case, a trailing slash and a .git suffix", async () => {
  const state = fleet();
  state.apps = [app(COMEDY, "cc", "https://github.com/hillbombcreations/vivreal_templates.git/")];
  const s = stubClient(state);
  await runFleetBuild({ client: s.client, options: options() });
  assert.deepEqual(started(s.calls), [COMEDY]);
});

test("--scope all builds every Templates app", async () => {
  const s = stubClient(fleet());
  const result = await runFleetBuild({ client: s.client, options: { ...parseArgs(["--commit", SHA, "--scope", "all"]) } });
  assert.deepEqual(
    started(s.calls),
    [COMEDY, "ddemo00000001", "ddemo00000002", "dqa0000000001", "duntagged00001", "dvivrealio0001"].sort(),
  );
  assert.equal(result.exitCode, 0);
});

test("--tier demo builds demos only and refuses live", async () => {
  const s = stubClient(fleet());
  const result = await runFleetBuild({ client: s.client, options: { ...parseArgs(["--commit", SHA, "--tier", "demo"]) } });
  assert.deepEqual(started(s.calls), ["ddemo00000001", "ddemo00000002"]);
  assert.ok(!started(s.calls).includes(COMEDY));
  assert.equal(result.exitCode, 0);
});

// ── idempotency ─────────────────────────────────────────────────────────

test("an app whose last successful build is this commit is skipped; one on an older commit builds", async () => {
  const state = fleet();
  state.jobs[COMEDY] = [{ jobId: "41", status: "SUCCEED", commitId: SHA }];
  state.jobs.dvivrealio0001 = [{ jobId: "40", status: "SUCCEED", commitId: OLD_SHA }];
  const s = stubClient(state);
  const result = await runFleetBuild({ client: s.client, options: options() });

  assert.ok(!started(s.calls).includes(COMEDY), "already current must be skipped");
  assert.ok(started(s.calls).includes("dvivrealio0001"), "behind must build");
  assert.equal(result.rows.find((r) => r.appId === COMEDY).action, "current");
  assert.equal(result.exitCode, 0);
});

test("a FAILED build of this commit does not count as current", async () => {
  const state = fleet();
  state.jobs[COMEDY] = [
    { jobId: "42", status: "FAILED", commitId: SHA },
    { jobId: "41", status: "SUCCEED", commitId: OLD_SHA },
  ];
  const s = stubClient(state);
  await runFleetBuild({ client: s.client, options: options() });
  assert.ok(started(s.calls).includes(COMEDY));
});

test("current is read from the newest SUCCEED job even when ListJobs is out of order", async () => {
  const state = fleet();
  state.jobs[COMEDY] = [
    { jobId: "9", status: "SUCCEED", commitId: SHA },
    { jobId: "12", status: "SUCCEED", commitId: OLD_SHA },
  ];
  const s = stubClient(state);
  await runFleetBuild({ client: s.client, options: options() });
  assert.ok(started(s.calls).includes(COMEDY), "job 12 is the deployed one, and it is behind");
});

test("an app already building this commit is skipped, not started twice", async () => {
  const state = fleet();
  state.jobs[COMEDY] = [{ jobId: "43", status: "RUNNING", commitId: SHA }];
  const s = stubClient(state);
  const result = await runFleetBuild({ client: s.client, options: options() });
  assert.ok(!started(s.calls).includes(COMEDY));
  assert.equal(result.rows.find((r) => r.appId === COMEDY).action, "building");
  assert.equal(result.exitCode, 0);
});

test("an app busy building ANOTHER commit is not started and fails the run loudly", async () => {
  const state = fleet();
  state.jobs[COMEDY] = [{ jobId: "43", status: "PENDING", commitId: OLD_SHA }];
  const s = stubClient(state);
  const result = await runFleetBuild({ client: s.client, options: options() });
  assert.ok(!started(s.calls).includes(COMEDY));
  assert.equal(result.rows.find((r) => r.appId === COMEDY).action, "busy");
  assert.equal(result.exitCode, 1);
  // The rest of the fleet still builds.
  assert.ok(started(s.calls).includes("dvivrealio0001"));
});

// ── dry run ─────────────────────────────────────────────────────────────

test("dry run starts nothing but still plans from real reads", async () => {
  const s = stubClient(fleet());
  const result = await runFleetBuild({ client: s.client, options: options({ dryRun: true }) });
  assert.equal(s.calls.start.length, 0, "dry run must never call StartJob");
  assert.ok(s.calls.listJobs.length > 0, "dry run must still read jobs to plan");
  assert.equal(result.rows.find((r) => r.appId === COMEDY).action, "would-start");
  assert.equal(result.exitCode, 0);
});

// ── failure modes ───────────────────────────────────────────────────────

test("zero Templates apps parsed fails loud (exit 2) and starts nothing", async () => {
  const state = fleet();
  state.apps = [app("dportal000001", "portal", "https://github.com/HillBombCreations/Vivreal_Portal_Mobile")];
  const s = stubClient(state);
  const result = await runFleetBuild({ client: s.client, options: options() });
  assert.equal(result.exitCode, 2);
  assert.equal(s.calls.start.length, 0);
});

test("zero apps in the live tier fails loud (exit 2)", async () => {
  const state = fleet();
  state.apps = [app("ddemo00000001", "butter-bloom")];
  const s = stubClient(state);
  const result = await runFleetBuild({ client: s.client, options: options() });
  assert.equal(result.exitCode, 2);
  assert.equal(s.calls.start.length, 0);
});

test("zero apps in a named demo tier fails loud (exit 2)", async () => {
  const state = fleet();
  state.apps = [app(COMEDY, "The Comedy Collective")];
  const s = stubClient(state);
  const result = await runFleetBuild({ client: s.client, options: parseArgs(["--commit", SHA, "--tier", "demo"]) });
  assert.equal(result.exitCode, 2);
  assert.equal(s.calls.start.length, 0);
});

test("--scope all on an untagged fleet builds everything and exits 0 (no tier is named)", async () => {
  const state = fleet();
  state.tags = {};
  const s = stubClient(state);
  const result = await runFleetBuild({ client: s.client, options: parseArgs(["--commit", SHA, "--scope", "all"]) });
  assert.equal(s.calls.start.length, 6);
  assert.equal(result.exitCode, 0);
});

test("one StartJob failure fails the run (exit 1) without stopping the others", async () => {
  const s = stubClient(fleet(), { failStart: new Set([COMEDY]) });
  const result = await runFleetBuild({ client: s.client, options: options() });
  assert.equal(result.exitCode, 1);
  assert.equal(result.rows.find((r) => r.appId === COMEDY).action, "failed");
  assert.equal(result.rows.find((r) => r.appId === "dvivrealio0001").action, "started");
});

test("a tag read failure fails the run rather than skipping the app silently", async () => {
  const s = stubClient(fleet(), { failTags: new Set(["ddemo00000001"]) });
  const result = await runFleetBuild({ client: s.client, options: options() });
  assert.equal(result.exitCode, 1);
  assert.equal(result.rows.find((r) => r.appId === "ddemo00000001").action, "failed");
});

test("StartJob concurrency never exceeds the bound", async () => {
  const s = stubClient(fleet());
  await runFleetBuild({ client: s.client, options: { ...parseArgs(["--commit", SHA, "--scope", "all", "--concurrency", "2"]) } });
  assert.equal(s.calls.start.length, 6);
  assert.ok(s.maxInFlight() <= 2, `saw ${s.maxInFlight()} in flight`);
  assert.ok(s.maxInFlight() >= 2, "the bound is reached, so the pool really runs in parallel");
});

// ── argument parsing ────────────────────────────────────────────────────

test("args: defaults are live scope, stable branch, not a dry run", () => {
  const o = parseArgs(["--commit", SHA]);
  assert.deepEqual([...o.tiers], ["live"]);
  assert.equal(o.branch, "stable");
  assert.equal(o.dryRun, false);
});

test("args: a short or non-hex commit is refused", () => {
  assert.throws(() => parseArgs(["--commit", "abc1234"]), UsageError);
  assert.throws(() => parseArgs(["--commit", "HEAD"]), UsageError);
  assert.throws(() => parseArgs([]), UsageError);
});

test("args: --scope and --tier together are refused as ambiguous", () => {
  assert.throws(() => parseArgs(["--commit", SHA, "--scope", "all", "--tier", "demo"]), UsageError);
});

test("args: an unknown scope, tier or flag is refused", () => {
  assert.throws(() => parseArgs(["--commit", SHA, "--scope", "demo"]), UsageError);
  assert.throws(() => parseArgs(["--commit", SHA, "--tier", "prod"]), UsageError);
  assert.throws(() => parseArgs(["--commit", SHA, "--force"]), UsageError);
  assert.throws(() => parseArgs(["--commit", SHA, "--concurrency", "0"]), UsageError);
});

test("args: --tier is repeatable and comma separated", () => {
  assert.deepEqual([...parseArgs(["--commit", SHA, "--tier", "demo,qa"]).tiers].sort(), ["demo", "qa"]);
  assert.deepEqual([...parseArgs(["--commit", SHA, "--tier", "demo", "--tier", "qa"]).tiers].sort(), ["demo", "qa"]);
});

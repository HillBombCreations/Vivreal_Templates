#!/usr/bin/env node
/**
 * fleet-build: start Amplify RELEASE builds of the Templates fleet, pinned to
 * one commit, for the build tiers asked for. Cost cut V7.247.
 *
 *   node scripts/fleet-build.mjs --commit <40-hex sha> [--scope live|all]
 *                                [--tier live|demo|qa ...] [--catchup demo|live|all]
 *                                [--dry-run]
 *                                [--concurrency N] [--branch stable]
 *                                [--region us-east-1]
 *
 * WHICH APPS. Every Amplify app whose repository is this repo, read from
 * ListApps, so a new site joins with no edit here. Each app's tier is its
 * `vivreal:buildTier` tag: `live` (paying customers, Vivreal-owned sites),
 * `demo` (the VivrealContent showcase sites) or `qa` (scratch). An UNTAGGED
 * app, or one with a value this file does not know, is treated as `live`. A
 * missing tag therefore costs a build, never leaves a customer on old code.
 *
 * WHICH TIERS. `--scope live` (the default) builds `live` only, which is what
 * a release promote needs. `--scope all` builds every tier, for a security
 * fix. `--tier demo` is the weekly demo catch-up. `--catchup` is
 * demo-catchup.yml's tier input (`demo`, `live` or `all`), forced to `demo` on
 * a scheduled run. `--scope`, `--tier` and `--catchup` are mutually
 * exclusive, so a command line cannot mean two things.
 *
 * IDEMPOTENT. An app is skipped when its newest SUCCEED job is already this
 * commit, or when a job for this commit is already active (a repeated fan-out, or the
 * git-push autobuild that is still on during rollout). An app busy building a
 * DIFFERENT commit is not started (Amplify runs one job per branch) and fails
 * the run; skipping it quietly would leave that site behind with a green run.
 * RECOVERY is demo-catchup.yml run by hand with tier `live` (or `all`), which
 * builds at stable's head. NEVER re-run the promote to recover: it re-reads
 * main and would move stable again to whatever has merged since.
 *
 * EXIT CODES. 0: every in-scope app was started or is already current or
 * building. 1: at least one app failed or was busy. 2: usage error, or a
 * fleet-level read came back empty (zero Templates apps, or zero apps in a
 * live or demo tier the caller named), because a fan-out that selects nothing is a broken
 * input, not a quiet week.
 *
 * NO DEPENDENCY. It shells out to the AWS CLI the GitHub runner ships with,
 * rather than adding `@aws-sdk/client-amplify` to a package.json whose
 * `npm ci` is every customer site's build.
 */
import { execFile } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const TIERS = Object.freeze(["live", "demo", "qa"]);
export const BUILD_TIER_TAG = "vivreal:buildTier";
const TEMPLATES_REPO = "github.com/hillbombcreations/vivreal_templates";

/** Job states that hold the branch. CANCELLING too: it has not released it yet. */
const ACTIVE_STATUSES = new Set(["CREATED", "PENDING", "PROVISIONING", "RUNNING", "CANCELLING"]);

/**
 * Tiers that must never come back empty when a caller names them. `qa` may
 * legitimately have no apps. `--scope all` names none: it means "everything
 * there is", and the empty-fleet check already covers zero apps.
 */
const MUST_EXIST_TIERS = Object.freeze(["live", "demo"]);

/** Values of `--catchup`, demo-catchup.yml's `tier` input. */
const CATCHUP_TIERS = Object.freeze(["demo", "live", "all"]);

const MAX_CONCURRENCY = 10;
const JOBS_TO_READ = 25;

export class UsageError extends Error {}

/**
 * @param {string[]} argv arguments after the script path
 * @returns {{ commit: string, tiers: Set<string>, requiredTiers: string[], scopeLabel: string,
 *             branch: string, dryRun: boolean, concurrency: number, region: string }}
 */
export function parseArgs(argv, env = process.env) {
  let commit = null;
  let scope = null;
  let catchup = null;
  const tierArgs = [];
  let branch = "stable";
  let dryRun = false;
  let concurrency = 4;
  let region = env.AWS_REGION || "us-east-1";

  const value = (i, flag) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new UsageError(`${flag} needs a value`);
    return v;
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    switch (flag) {
      case "--commit":
        commit = value(i, flag);
        i += 1;
        break;
      case "--scope":
        scope = value(i, flag);
        i += 1;
        break;
      case "--tier":
        tierArgs.push(...value(i, flag).split(",").map((t) => t.trim()).filter(Boolean));
        i += 1;
        break;
      case "--branch":
        branch = value(i, flag);
        i += 1;
        break;
      case "--region":
        region = value(i, flag);
        i += 1;
        break;
      case "--concurrency":
        concurrency = Number(value(i, flag));
        i += 1;
        break;
      case "--catchup":
        catchup = value(i, flag);
        i += 1;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      default:
        throw new UsageError(`unknown argument: ${flag}`);
    }
  }

  // A full SHA only. `HEAD` or a short SHA would build whatever the branch tip
  // is when Amplify gets round to it, which is not the commit that was promoted.
  if (!/^[0-9a-f]{40}$/.test(commit ?? "")) {
    throw new UsageError("--commit must be a full 40-character lowercase commit SHA");
  }
  if ([scope !== null, tierArgs.length > 0, catchup !== null].filter(Boolean).length > 1) {
    throw new UsageError("use one of --scope, --tier or --catchup");
  }
  if (catchup !== null) {
    // demo-catchup.yml's tier input. `demo` is the weekly job. `live` and `all`
    // are the recovery path for a promote whose fan-out failed or met a busy
    // app: they rebuild at stable's head without re-running the promote, which
    // would re-read main and move stable again.
    if (!CATCHUP_TIERS.includes(catchup)) {
      throw new UsageError(`--catchup must be one of ${CATCHUP_TIERS.join(", ")}, got ${catchup}`);
    }
    // The schedule is pinned to demo whatever it is handed. A cron nobody
    // watches must never become a weekly rebuild of every live site.
    if (env.GITHUB_EVENT_NAME === "schedule") catchup = "demo";
    if (catchup === "demo") tierArgs.push("demo");
    else scope = catchup;
  }
  if (scope !== null && scope !== "live" && scope !== "all") {
    throw new UsageError(`--scope must be live or all, got ${scope}`);
  }
  for (const t of tierArgs) {
    if (!TIERS.includes(t)) throw new UsageError(`--tier must be one of ${TIERS.join(", ")}, got ${t}`);
  }
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > MAX_CONCURRENCY) {
    throw new UsageError(`--concurrency must be an integer from 1 to ${MAX_CONCURRENCY}`);
  }

  let tiers;
  let scopeLabel;
  let named;
  if (tierArgs.length > 0) {
    tiers = new Set(tierArgs);
    named = [...tiers];
    scopeLabel = `tier ${named.join(",")}`;
  } else if (scope === "all") {
    tiers = new Set(TIERS);
    named = [];
    scopeLabel = "scope all";
  } else {
    tiers = new Set(["live"]);
    named = ["live"];
    scopeLabel = "scope live";
  }
  const requiredTiers = named.filter((t) => MUST_EXIST_TIERS.includes(t));

  return { commit, tiers, requiredTiers, scopeLabel, branch, dryRun, concurrency, region };
}

/**
 * The app's build tier from its tags. Missing or unrecognised means `live`.
 * `scratch` is read as `qa`: the cost-cut design names that tier `scratch`,
 * this script and its workflows name it `qa`, and whichever the tagging side
 * writes must not fall through to `live` and build on every promote.
 *
 * @param {Record<string, string> | undefined} tags
 * @returns {{ tier: string, source: string }}
 */
export function resolveBuildTier(tags) {
  const raw = tags?.[BUILD_TIER_TAG];
  if (typeof raw !== "string" || raw.trim() === "") return { tier: "live", source: "untagged" };
  const value = raw.trim().toLowerCase();
  if (value === "scratch") return { tier: "qa", source: "tag" };
  if (TIERS.includes(value)) return { tier: value, source: "tag" };
  return { tier: "live", source: `unknown:${raw}` };
}

/** True when the app builds from this repository, however the URL is spelled. */
function isTemplatesApp(app) {
  if (typeof app?.repository !== "string") return false;
  const normalised = app.repository
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
  return normalised === TEMPLATES_REPO;
}

/** Newest first by numeric jobId. ListJobs order is not something to lean on. */
function newestFirst(jobs) {
  return [...jobs].sort((a, b) => Number(b.jobId) - Number(a.jobId));
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Decide and, unless dry-running, act for one app. Never throws: a failure
 * becomes a `failed` row so one bad app cannot hide the rest of the fleet.
 */
async function buildOne({ client, app, options }) {
  const row = { appId: app.appId, name: app.name ?? "", tier: "?", tierSource: "", action: "", detail: "" };
  try {
    const { tier, source } = resolveBuildTier(await client.listTagsForResource(app.appArn));
    row.tier = tier;
    row.tierSource = source;
    if (!options.tiers.has(tier)) {
      row.action = "out-of-scope";
      return row;
    }

    const jobs = newestFirst(await client.listJobs(app.appId, options.branch));
    const active = jobs.find((j) => ACTIVE_STATUSES.has(j.status));
    if (active) {
      if (active.commitId === options.commit) {
        row.action = "building";
        row.detail = `job ${active.jobId} ${active.status}`;
      } else {
        row.action = "busy";
        row.detail = `job ${active.jobId} ${active.status} on ${String(active.commitId).slice(0, 12)}; when it finishes, run demo-catchup with tier live`;
      }
      return row;
    }

    const deployed = jobs.find((j) => j.status === "SUCCEED");
    if (deployed?.commitId === options.commit) {
      row.action = "current";
      row.detail = `job ${deployed.jobId}`;
      return row;
    }

    const from = deployed ? String(deployed.commitId).slice(0, 12) : "no successful build";
    if (options.dryRun) {
      row.action = "would-start";
      row.detail = `from ${from}`;
      return row;
    }

    const started = await client.startJob({
      appId: app.appId,
      branch: options.branch,
      jobType: "RELEASE",
      commitId: options.commit,
      // Labels the job so a later cost audit can tell a fan-out build from a
      // hand-run one; ListJobs returns no actor.
      jobReason: `fleet-build ${options.scopeLabel}`,
    });
    row.action = "started";
    row.detail = `job ${started.jobId} from ${from}`;
    return row;
  } catch (err) {
    row.action = "failed";
    row.detail = err instanceof Error ? err.message.split("\n")[0] : String(err);
    return row;
  }
}

const FAILING_ACTIONS = new Set(["failed", "busy"]);

/**
 * @param {{ client: object, options: ReturnType<typeof parseArgs>, log?: (line: string) => void }} input
 * @returns {Promise<{ rows: object[], exitCode: number, message: string }>}
 */
export async function runFleetBuild({ client, options, log = () => {} }) {
  const apps = (await client.listApps()).filter(isTemplatesApp);
  if (apps.length === 0) {
    return { rows: [], exitCode: 2, message: "ListApps returned zero Vivreal_Templates apps; refusing to report success on an empty fleet" };
  }
  log(`${apps.length} Templates apps; ${options.scopeLabel}; commit ${options.commit}${options.dryRun ? "; DRY RUN" : ""}`);

  const rows = await mapWithConcurrency(apps, options.concurrency, (app) => buildOne({ client, app, options }));
  rows.sort((a, b) => a.tier.localeCompare(b.tier) || a.name.localeCompare(b.name));

  for (const tier of options.requiredTiers) {
    // A row that failed before its tier was read could be this tier, so it
    // does not count as evidence the tier is empty.
    const inTier = rows.some((r) => r.tier === tier || r.tier === "?");
    if (!inTier) {
      return { rows, exitCode: 2, message: `zero apps in the ${tier} tier; check the ${BUILD_TIER_TAG} tags before trusting this run` };
    }
  }

  const failing = rows.filter((r) => FAILING_ACTIONS.has(r.action));
  if (failing.length > 0) {
    return { rows, exitCode: 1, message: `${failing.length} app(s) failed or busy: ${failing.map((r) => r.name || r.appId).join(", ")}` };
  }
  return { rows, exitCode: 0, message: "ok" };
}

function formatTable(rows) {
  const header = ["app", "appId", "tier", "action", "detail"];
  const body = rows.map((r) => [r.name, r.appId, r.tierSource === "tag" ? r.tier : `${r.tier} (${r.tierSource})`, r.action, r.detail]);
  const widths = header.map((h, i) => Math.max(h.length, ...body.map((b) => String(b[i]).length)));
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join("  ").trimEnd();
  return [line(header), ...body.map(line)].join("\n");
}

function formatMarkdown(rows, options, result) {
  const lines = [
    `## Fleet build, ${options.scopeLabel}${options.dryRun ? " (dry run)" : ""}`,
    "",
    `Commit \`${options.commit}\` on \`${options.branch}\`. Result: **${result.message}** (exit ${result.exitCode}).`,
    "",
    "| app | appId | tier | action | detail |",
    "|---|---|---|---|---|",
  ];
  for (const r of rows) {
    lines.push(`| ${r.name} | ${r.appId} | ${r.tier}${r.tierSource === "tag" ? "" : ` (${r.tierSource})`} | ${r.action} | ${r.detail} |`);
  }
  return `${lines.join("\n")}\n`;
}

/** The real client: the AWS CLI on PATH, JSON out, credentials from the environment. */
export function createAwsCliClient({ region }) {
  const aws = (args) =>
    new Promise((resolve, reject) => {
      execFile(
        "aws",
        ["amplify", ...args, "--region", region, "--output", "json"],
        { maxBuffer: 32 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            reject(new Error(`aws amplify ${args[0]} failed: ${(stderr || err.message).trim()}`));
            return;
          }
          resolve(stdout.trim() === "" ? {} : JSON.parse(stdout));
        },
      );
    });

  return {
    // The CLI follows nextToken itself for list-apps and list-jobs.
    async listApps() {
      return (await aws(["list-apps"])).apps ?? [];
    },
    async listTagsForResource(arn) {
      return (await aws(["list-tags-for-resource", "--resource-arn", arn])).tags ?? {};
    },
    async listJobs(appId, branch) {
      const res = await aws(["list-jobs", "--app-id", appId, "--branch-name", branch, "--max-items", String(JOBS_TO_READ)]);
      return res.jobSummaries ?? [];
    },
    async startJob({ appId, branch, jobType, commitId, jobReason }) {
      const res = await aws([
        "start-job",
        "--app-id", appId,
        "--branch-name", branch,
        "--job-type", jobType,
        "--commit-id", commitId,
        "--job-reason", jobReason,
      ]);
      return { jobId: res.jobSummary?.jobId, status: res.jobSummary?.status };
    },
  };
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    if (err instanceof UsageError) {
      console.error(`fleet-build: ${err.message}`);
      process.exitCode = 2;
      return;
    }
    throw err;
  }

  const client = createAwsCliClient({ region: options.region });
  let result;
  try {
    result = await runFleetBuild({ client, options, log: (l) => console.log(l) });
  } catch (err) {
    // ListApps itself failed: credentials, region, or the role. Nothing ran.
    console.error(`fleet-build: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 2;
    return;
  }

  if (result.rows.length > 0) console.log(formatTable(result.rows));
  console.log(`fleet-build: ${result.message} (exit ${result.exitCode})`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, formatMarkdown(result.rows, options, result));
  }
  process.exitCode = result.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

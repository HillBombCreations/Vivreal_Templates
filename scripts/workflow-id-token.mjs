/**
 * V7.279: which workflows may ask GitHub for an OIDC token (`id-token`).
 *
 * The AWS role `VivrealTemplatesFleetBuild` trusts this repository's `main`
 * ref, not a workflow file. So ANY workflow that runs in the `main` context
 * and requests `id-token` can assume it. This repo is public, and triggers
 * such as `pull_request_target`, `workflow_run` and `issue_comment` run in the
 * `main` context while a stranger decides when they fire. Two rules:
 *
 *   1. Only `promote-stable.yml` and `demo-catchup.yml` may request id-token,
 *      at workflow level or job level.
 *   2. A workflow that requests id-token may be triggered only by
 *      `workflow_dispatch`, `schedule` or `push`, which need write access to
 *      this repo. Every other trigger is refused, so an untrusted trigger that
 *      GitHub adds later is refused too, without anyone remembering to list it.
 *
 * Anything this cannot read (bad YAML, an unknown `permissions` value, a
 * workflow with no readable trigger) is a finding, never a skip.
 *
 * THIS FLAGS, IT CANNOT BLOCK. It runs in `npm test`. No GitHub Actions
 * workflow runs `npm test`, and `main` has no required status checks, so a
 * red result stops nothing on its own: it makes a new id-token workflow
 * visible to whoever runs the suite. See
 * vivreal-hq docs/projects/next-release-v7/rebuild-cadence-infra-2026-10-17.md,
 * F-1 and row 3.3c.
 *
 * js-yaml is not a declared dependency. It is already in the tree through
 * eslint (`@eslint/eslintrc`), and declaring it would change the lockfile
 * every customer site's `npm ci` installs from. If it ever leaves the tree,
 * this import fails and the suite goes red, which is the safe direction.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

/** Keep in step with the AWS role's purpose: these two run fleet-build.mjs. */
export const ID_TOKEN_WORKFLOWS = Object.freeze(["promote-stable.yml", "demo-catchup.yml"]);

/** Triggers that only someone with write access to this repo can fire. */
const TRUSTED_TRIGGERS = new Set(["workflow_dispatch", "schedule", "push"]);

const WORKFLOW_FILE = /\.ya?ml$/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Whether one `permissions:` value grants id-token. Unknown shapes count as a
 * grant, so a value this does not understand is reported rather than passed.
 */
function grantsIdToken(permissions) {
  if (permissions === undefined || permissions === null) return false;
  if (typeof permissions === "string") return permissions.trim() !== "read-all";
  if (!isPlainObject(permissions)) return true;
  return Object.entries(permissions).some(
    ([key, value]) => key.trim().toLowerCase() === "id-token" && value !== "none",
  );
}

/** The trigger names under `on:`, or null when they cannot be read. */
function triggersOf(doc) {
  const on = doc.on;
  if (typeof on === "string") return [on];
  if (Array.isArray(on) && on.length > 0 && on.every((t) => typeof t === "string")) return on;
  if (isPlainObject(on) && Object.keys(on).length > 0) return Object.keys(on);
  return null;
}

/**
 * Audit one workflow file's text.
 * @returns {{ requestsIdToken: boolean, findings: string[] }}
 */
export function auditWorkflow(fileName, text) {
  let doc;
  try {
    doc = yaml.load(text);
  } catch (error) {
    return { requestsIdToken: false, findings: [`${fileName}: could not parse as YAML (${error.message})`] };
  }
  if (!isPlainObject(doc)) {
    return { requestsIdToken: false, findings: [`${fileName}: is not a workflow mapping`] };
  }

  const grantedAt = [];
  if (grantsIdToken(doc.permissions)) grantedAt.push("workflow permissions");
  if (isPlainObject(doc.jobs)) {
    for (const [jobId, job] of Object.entries(doc.jobs)) {
      if (isPlainObject(job) && grantsIdToken(job.permissions)) grantedAt.push(`jobs.${jobId}.permissions`);
    }
  }
  if (grantedAt.length === 0) return { requestsIdToken: false, findings: [] };

  const where = grantedAt.join(", ");
  const findings = [];
  if (!ID_TOKEN_WORKFLOWS.includes(fileName)) {
    findings.push(
      `${fileName}: requests id-token (${where}); only ${ID_TOKEN_WORKFLOWS.join(" and ")} may`,
    );
  }
  const triggers = triggersOf(doc);
  if (triggers === null) {
    findings.push(`${fileName}: requests id-token (${where}) and its trigger list cannot be read`);
  } else {
    const untrusted = triggers.filter((t) => !TRUSTED_TRIGGERS.has(t));
    if (untrusted.length > 0) {
      findings.push(
        `${fileName}: requests id-token (${where}) and can be triggered by ${untrusted.join(", ")}; ` +
          `an id-token workflow may only use ${[...TRUSTED_TRIGGERS].join(", ")}`,
      );
    }
  }
  return { requestsIdToken: true, findings };
}

/**
 * Audit every .yml / .yaml file directly in `dir` (GitHub runs no workflow
 * from a subdirectory). Callers must check `parsed` is non-empty before
 * trusting an empty `findings`.
 * @returns {{ parsed: string[], requesters: string[], findings: string[] }}
 */
export function auditWorkflowDir(dir) {
  const parsed = [];
  const requesters = [];
  const findings = [];
  const files = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && WORKFLOW_FILE.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  for (const name of files) {
    const result = auditWorkflow(name, readFileSync(join(dir, name), "utf8"));
    parsed.push(name);
    if (result.requestsIdToken) requesters.push(name);
    findings.push(...result.findings);
  }
  return { parsed, requesters, findings };
}

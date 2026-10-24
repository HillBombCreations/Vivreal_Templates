#!/usr/bin/env node
/**
 * build-with-snapshot: `npm run build` for every Templates site. Runs
 * `next build` with the render-floor recorder on, then writes the build-time
 * site snapshot into the deploy artifact.
 * vivreal-hq docs/bugs/site-first-read-fallback/plan.md, section 5 and Change 6.
 *
 * WHY A WRAPPER. The stored Amplify buildSpec every site runs is
 * `npm ci`, `.env.production` from an allowlist, then `npm run build`, and
 * changing it means rewriting every app's stored spec (the class of fleet write
 * behind the 10-21 env incident). So the new step lives behind `npm run build`.
 *
 * STEPS, and each one's failure mode:
 *  1. PREFLIGHT. One siteDetails read, up to 3 attempts over about 30 s. None
 *     succeeds: exit 1 BEFORE `next build`, so a build during an upstream
 *     outage fails in seconds rather than after a full build, and Amplify keeps
 *     the last good deployment live.
 *  2. `next build`, with the record directory set (the recorder is inert in
 *     every process this variable does not reach). Its exit code is forwarded
 *     unchanged when it fails.
 *  3. MERGE the recorder's shards and the fill pass's manifest, drop every key
 *     naming a storefront collection (owner decision 2), trim past the size
 *     budget, and compute `snapshot_uncovered` (expected keys never recorded).
 *  4. VALIDATE (section 5.4). Any failure exits 1 and names the check, never
 *     the value: a valid siteDetails entry for this SITE_ID, no excluded or
 *     provider-product key, no secret value or secret-shaped string, a forced
 *     floor only with all three guards, never written under `static` or
 *     `public`.
 *  5. WRITE `site-snapshot.json` to `.next/server/app/` and, when standalone
 *     output exists, `.next/standalone/.next/server/app/`, then read each back
 *     and compare sha256.
 *  6. PRINT one job-log line:
 *     `site snapshot: <n> entries, <bytes> bytes, siteDetails ok, snapshot_uncovered: <n>`
 *     then one line per uncovered key (query stripped, plus a hash).
 *     Uncovered keys do not fail the build; validation failures do.
 *
 * PLAIN JAVASCRIPT, NO DEPENDENCY. The build image's Node cannot import
 * TypeScript, so the policy values this needs (the expected keys, excluded
 * collections, payments types and forced-floor sites) arrive in the fill
 * pass's manifest, written by the TypeScript that owns them. The three
 * constants below are pinned to their TypeScript twins by
 * `build-with-snapshot.test.mjs`.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

/** Twin of `SNAPSHOT_FILE_NAME` in src/lib/api/snapshot/constants.ts. */
export const SNAPSHOT_FILE_NAME = 'site-snapshot.json';
/** Twin of `SNAPSHOT_VERSION`. */
export const SNAPSHOT_VERSION = 1;
/** Twin of `RECORD_DIR_ENV`. */
export const RECORD_DIR_ENV = 'VIVREAL_SNAPSHOT_RECORD_DIR';

export const FORCE_FLOOR_ENV = 'VIVREAL_SNAPSHOT_FORCE_FLOOR';
export const SIZE_WARN_BYTES = 5 * 1024 * 1024;
export const SIZE_TRIM_BYTES = 25 * 1024 * 1024;

/**
 * Secret-shaped strings that must never be in the file. Named, so a refusal
 * prints the NAME and never the match.
 *
 * Each pattern needs the key BODY, not just the prefix: help.vivreal.io's
 * Stripe articles say "It starts with `rk_live_`", and a bare prefix refused
 * its build. Stripe documents the prefixes but no fixed length; real keys
 * carry 24 or more characters after the prefix (whsec_ 32 from the
 * dashboard, 64 hex from the CLI), so 16 is a conservative floor that no
 * real key falls under. whsec_ also admits base64 `+` and `/`, which
 * non-Stripe signing secrets with the same prefix use.
 */
export const SECRET_PATTERNS = Object.freeze([
  ['aws-access-key-id', /AKIA[0-9A-Z]{16}/],
  ['pem-block', /-----BEGIN [A-Z0-9 ]+-----/],
  ['stripe-live-secret', /sk_live_[A-Za-z0-9]{16,}/],
  ['stripe-live-restricted', /rk_live_[A-Za-z0-9]{16,}/],
  ['webhook-signing-secret', /whsec_[A-Za-z0-9+/]{16,}/],
]);

export class SnapshotRefusal extends Error {
  constructor(check, detail = '') {
    super(`site snapshot: REFUSED (${check})${detail ? `: ${detail}` : ''}`);
    this.check = check;
  }
}

const stripQuery = (p) => String(p).split('?')[0];
const hashKey = (p) => createHash('sha256').update(p).digest('hex').slice(0, 12);
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/* ---------------------------------------------------------------- preflight */

/**
 * One siteDetails read, up to `attempts` times. Resolves `{ ok: true }` or
 * `{ ok: false, reason }`. Never throws.
 */
export async function preflight({ fetchImpl, baseUrl, siteId, apiKey, attempts = 3, timeoutMs = 8000, sleep, waitsMs = [2000, 5000] }) {
  if (!siteId) return { ok: false, reason: 'SITE_ID is not set' };
  const url = `${baseUrl}/tenant/siteDetails?siteId=${encodeURIComponent(siteId)}`;
  let reason = 'no attempt made';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetchImpl(url, {
        headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await res.json().catch(() => null);
      const values = body?.data?.siteDetails?.values;
      if (res.ok && body?.success === true && values && typeof values === 'object' && Object.keys(values).length > 0) {
        return { ok: true, attempts: attempt };
      }
      reason = `status ${res.status}${body?.success === true ? ', no siteDetails.values' : ''}`;
    } catch (err) {
      reason = err?.name === 'TimeoutError' ? 'timed out' : `network (${err?.cause?.code ?? err?.name ?? 'error'})`;
    }
    if (attempt < attempts) await sleep(waitsMs[Math.min(attempt - 1, waitsMs.length - 1)]);
  }
  return { ok: false, reason };
}

/* -------------------------------------------------------------------- merge */

/** Read every shard and manifest the recorder and the fill pass wrote. */
export function readRecords(dir) {
  const entries = new Map();
  const manifests = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    if (name.startsWith('shard-')) {
      if (typeof parsed?.path === 'string' && parsed.data !== undefined && !entries.has(parsed.path)) {
        entries.set(parsed.path, parsed.data);
      }
    } else if (name.startsWith('manifest-')) {
      manifests.push(parsed);
    }
  }
  return { entries, manifests };
}

/** One manifest from however many the fill pass wrote (one per build worker that ran it). */
export function mergeManifests(manifests, siteId) {
  if (manifests.length === 0) throw new SnapshotRefusal('fill-manifest', 'the fill pass wrote no manifest');
  const keys = new Set();
  const excluded = new Set();
  const payments = new Set();
  const failedKeys = new Set();
  let fillError = false;
  let siteDetailsKey = null;
  let forceFloorSiteIds = null;
  for (const m of manifests) {
    if (m?.siteId !== siteId) throw new SnapshotRefusal('fill-manifest', 'a manifest names another site');
    if (siteDetailsKey !== null && m.siteDetailsKey !== siteDetailsKey) {
      throw new SnapshotRefusal('fill-manifest', 'manifests disagree on the siteDetails key');
    }
    siteDetailsKey = m.siteDetailsKey;
    forceFloorSiteIds ??= Array.isArray(m.forceFloorSiteIds) ? m.forceFloorSiteIds : [];
    for (const k of m.expectedKeys ?? []) keys.add(k);
    for (const id of m.excludedCollectionIds ?? []) excluded.add(id);
    for (const t of m.paymentsProviderTypes ?? []) payments.add(String(t).toLowerCase());
    for (const k of m.failedKeys ?? []) failedKeys.add(k);
    if (m.fillError === true) fillError = true;
  }
  return {
    failedKeys: [...failedKeys],
    fillError,
    siteDetailsKey,
    expectedKeys: [...keys],
    excludedCollectionIds: [...excluded],
    paymentsProviderTypes: [...payments],
    forceFloorSiteIds,
  };
}

function paramOf(key, name) {
  const q = key.indexOf('?');
  return q === -1 ? null : new URLSearchParams(key.slice(q + 1)).get(name);
}

/** True when `key` names a collection in `excluded`. */
export function namesExcludedCollection(key, excluded) {
  if (stripQuery(key) !== '/tenant/collectionObjects') return false;
  const id = paramOf(key, 'collectionId');
  return !!id && excluded.includes(id);
}

/** True when `key` is an integration read of a payments provider (products, prices). */
export function isProviderProductKey(key, paymentsTypes) {
  if (stripQuery(key) !== '/tenant/integrationObjects') return false;
  const type = paramOf(key, 'type');
  return !!type && paymentsTypes.includes(type.trim().toLowerCase());
}

/**
 * Size budget (5.3): warn above 5 MB; above 25 MB drop the largest
 * non-siteDetails entries, `skip=` windows (detail pages) first, then the rest,
 * never siteDetails. Returns the dropped keys.
 */
export function trimToBudget(entries, siteDetailsKey, limitBytes = SIZE_TRIM_BYTES) {
  const sizes = new Map([...entries].map(([k, v]) => [k, Buffer.byteLength(JSON.stringify(v)) + k.length]));
  let total = [...sizes.values()].reduce((a, b) => a + b, 0);
  const dropped = [];
  if (total <= limitBytes) return dropped;
  const rank = (k) => (paramOf(k, 'skip') !== null ? 0 : 1);
  const order = [...entries.keys()]
    .filter((k) => k !== siteDetailsKey)
    .sort((a, b) => rank(a) - rank(b) || sizes.get(b) - sizes.get(a));
  for (const k of order) {
    if (total <= limitBytes) break;
    total -= sizes.get(k);
    entries.delete(k);
    dropped.push(k);
  }
  return dropped;
}

/** The forced floor (plan 5.6): all three build-time guards, or false. */
export function decideForceFloor(env, siteId, forceFloorSiteIds) {
  return (
    env[FORCE_FLOOR_ENV] === '1' &&
    !!siteId &&
    Array.isArray(forceFloorSiteIds) &&
    forceFloorSiteIds.includes(siteId) &&
    typeof env.AWS_BRANCH === 'string' &&
    env.AWS_BRANCH !== '' &&
    env.AWS_BRANCH !== 'stable'
  );
}

/** The snapshot object, fields in the order the runtime's head read expects (entries last). */
export function buildSnapshot({ siteId, builtAt, commit, forceFloor, excludedCollectionIds, entries }) {
  return {
    version: SNAPSHOT_VERSION,
    siteId,
    builtAt,
    commit,
    forceFloor,
    excludedCollectionIds,
    entries: Object.fromEntries([...entries].map(([k, data]) => [k, { data }])),
  };
}

/* ----------------------------------------------------------------- validate */

/** Every 5.4 check on the serialised snapshot. Throws a SnapshotRefusal naming the first that fails. */
export function validateSnapshot(snapshot, json, { siteId, manifest, secrets, env, outputPaths, root }) {
  if (snapshot.siteId !== siteId || !siteId) throw new SnapshotRefusal('site-id', 'the snapshot is not for this SITE_ID');
  const sd = snapshot.entries[manifest.siteDetailsKey]?.data;
  const values = sd?.siteDetails?.values;
  if (!values || typeof values !== 'object' || Object.keys(values).length === 0) {
    throw new SnapshotRefusal('site-details', 'no siteDetails entry with a non-empty values object');
  }
  for (const key of Object.keys(snapshot.entries)) {
    if (namesExcludedCollection(key, snapshot.excludedCollectionIds)) {
      throw new SnapshotRefusal('storefront-collection', `${stripQuery(key)} ${hashKey(key)}`);
    }
    if (isProviderProductKey(key, manifest.paymentsProviderTypes)) {
      throw new SnapshotRefusal('provider-product', `${stripQuery(key)} ${hashKey(key)}`);
    }
  }
  for (const [name, value] of Object.entries(secrets)) {
    if (typeof value === 'string' && value.length >= 8 && json.includes(value)) {
      throw new SnapshotRefusal('secret-value', name);
    }
  }
  for (const [name, pattern] of SECRET_PATTERNS) {
    if (pattern.test(json)) throw new SnapshotRefusal('secret-pattern', name);
  }
  if (snapshot.forceFloor !== decideForceFloor(env, siteId, manifest.forceFloorSiteIds)) {
    throw new SnapshotRefusal('force-floor', 'forceFloor set without all three guards');
  }
  for (const out of outputPaths) {
    const rel = path.relative(root, path.resolve(out)).split(path.sep).join('/');
    if (rel.startsWith('..') || /(^|\/)(static|public)(\/|$)/.test(rel)) {
      throw new SnapshotRefusal('output-path', `${rel} is served from the CDN or outside the build`);
    }
  }
}

/* -------------------------------------------------------------------- write */

/** The locations the runtime can load the file from (plan 5.1). */
export function defaultOutputPaths(root) {
  const out = [path.join(root, '.next', 'server', 'app', SNAPSHOT_FILE_NAME)];
  const standalone = path.join(root, '.next', 'standalone');
  if (fs.existsSync(standalone)) out.push(path.join(standalone, '.next', 'server', 'app', SNAPSHOT_FILE_NAME));
  return out;
}

/** Write `json` to every path, read each back, and refuse unless every sha256 matches. */
export function writeEverywhere(paths, json) {
  const expected = sha256(json);
  for (const p of paths) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = `${p}.tmp`;
    fs.writeFileSync(tmp, json, 'utf8');
    fs.renameSync(tmp, p);
    if (sha256(fs.readFileSync(p, 'utf8')) !== expected) throw new SnapshotRefusal('read-back', p);
  }
  return expected;
}

/* --------------------------------------------------------------------- main */

function loadNextEnv(root) {
  try {
    const nextRequire = createRequire(createRequire(path.join(root, 'package.json')).resolve('next/package.json'));
    nextRequire('@next/env').loadEnvConfig(root, false, { info() {}, error: (...a) => console.error(...a) });
  } catch (err) {
    // Without @next/env the wrapper still has the process env, which is all
    // an Amplify build has anyway (`.env.production` is written FROM it).
    console.error(`site snapshot: could not load .env files (${err?.message ?? err})`);
  }
}

function defaultCommit(env, root) {
  if (env.AWS_COMMIT_ID) return env.AWS_COMMIT_ID;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    // No git in the build image or no repository: the field is informational.
    return 'unknown';
  }
}

function defaultSpawnBuild({ root, env }) {
  const nextBin = createRequire(path.join(root, 'package.json')).resolve('next/dist/bin/next');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [nextBin, 'build', '--turbopack'], { cwd: root, env, stdio: 'inherit' });
    child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    child.on('error', () => resolve(1));
  });
}

/**
 * Returns the process exit code. Every dependency is injectable so
 * `build-with-snapshot.test.mjs` runs the real control flow (T11, T12, T15).
 */
export async function main(deps = {}) {
  const root = deps.root ?? process.cwd();
  const env = deps.env ?? process.env;
  const log = deps.log ?? ((line) => console.log(line));
  const logError = deps.logError ?? ((line) => console.error(line));
  if (!deps.env) loadNextEnv(root);

  const siteId = env.SITE_ID || '';
  const baseUrl = env.NEXT_PUBLIC_CLIENT_API || 'https://client.vivreal.io';
  const started = Date.now();

  const pre = await preflight({
    fetchImpl: deps.fetchImpl ?? fetch,
    baseUrl,
    siteId,
    apiKey: env.API_KEY || '',
    sleep: deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
  });
  if (!pre.ok) {
    logError(`site snapshot: preflight FAILED (${pre.reason}); not starting next build, the previous deployment stays live`);
    return 1;
  }
  log(`site snapshot: preflight ok (siteDetails read in ${pre.attempts} attempt${pre.attempts === 1 ? '' : 's'})`);

  const recordDir = fs.mkdtempSync(path.join(deps.tmpDir ?? os.tmpdir(), 'vivreal-snapshot-'));
  try {
    const code = await (deps.spawnBuild ?? defaultSpawnBuild)({ root, env: { ...env, [RECORD_DIR_ENV]: recordDir }, recordDir });
    if (code !== 0) {
      logError(`site snapshot: next build exited ${code}; no snapshot written`);
      return code;
    }
    const mergeStarted = Date.now();
    const { entries, manifests } = readRecords(recordDir);
    const manifest = mergeManifests(manifests, siteId);

    let droppedExcluded = 0;
    for (const key of [...entries.keys()]) {
      if (namesExcludedCollection(key, manifest.excludedCollectionIds)) {
        entries.delete(key);
        droppedExcluded += 1;
      }
    }
    // Review-3 B2: the fill pass could not even plan (a malformed page config),
    // so the storefront collections are unknown. Keep only the site shell:
    // nothing that could carry a price survives, and the fault is counted below.
    if (manifest.fillError) {
      for (const key of [...entries.keys()]) if (key !== manifest.siteDetailsKey) entries.delete(key);
    }
    const trimmed = trimToBudget(entries, manifest.siteDetailsKey);
    const uncovered = manifest.expectedKeys.filter((k) => !entries.has(k));
    // A fill read that failed (after its retry) and that nothing else recorded
    // is a hole: counted, so the rollout gate (uncovered > 0) stops the app.
    for (const k of manifest.failedKeys) if (!entries.has(k) && !uncovered.includes(k)) uncovered.push(k);
    const uncoveredCount = uncovered.length + (manifest.fillError ? 1 : 0);
    const forceFloor = decideForceFloor(env, siteId, manifest.forceFloorSiteIds);

    const snapshot = buildSnapshot({
      siteId,
      builtAt: (deps.now ? new Date(deps.now()) : new Date()).toISOString(),
      commit: deps.commit ?? defaultCommit(env, root),
      forceFloor,
      excludedCollectionIds: manifest.excludedCollectionIds,
      entries,
    });
    const json = JSON.stringify(snapshot);
    const outputPaths = deps.outputPaths ?? defaultOutputPaths(root);
    validateSnapshot(snapshot, json, {
      siteId,
      manifest,
      secrets: { API_KEY: env.API_KEY, REVALIDATE_WEBHOOK_SECRET: env.REVALIDATE_WEBHOOK_SECRET },
      env,
      outputPaths,
      root,
    });
    const digest = writeEverywhere(outputPaths, json);

    const bytes = Buffer.byteLength(json);
    log(
      `site snapshot: ${entries.size} entries, ${bytes} bytes, siteDetails ok, snapshot_uncovered: ${uncoveredCount}` +
        (manifest.fillError ? ', snapshot_fill_error' : '') +
        (manifest.failedKeys.length ? `, snapshot_fill_failed: ${manifest.failedKeys.length}` : '') +
        ` (excluded ${manifest.excludedCollectionIds.length} storefront collection${manifest.excludedCollectionIds.length === 1 ? '' : 's'},` +
        ` dropped ${droppedExcluded} key${droppedExcluded === 1 ? '' : 's'}${forceFloor ? ', FORCED FLOOR' : ''},` +
        ` merge ${Date.now() - mergeStarted} ms, wrapper total ${Date.now() - started} ms, sha256 ${digest.slice(0, 12)})`,
    );
    for (const k of uncovered) log(`site snapshot: uncovered ${stripQuery(k)} ${hashKey(k)}`);
    if (bytes > SIZE_WARN_BYTES) log(`site snapshot: WARNING size ${bytes} bytes is over ${SIZE_WARN_BYTES}`);
    if (trimmed.length) log(`site snapshot: snapshot_trimmed ${trimmed.length} entries (${trimmed.map((k) => `${stripQuery(k)} ${hashKey(k)}`).join(', ')})`);
    for (const p of outputPaths) log(`site snapshot: wrote ${path.relative(root, p).split(path.sep).join('/')}`);
    return 0;
  } catch (err) {
    if (err instanceof SnapshotRefusal) {
      logError(err.message);
      return 1;
    }
    // Anything else is a wrapper defect; the message names it without values.
    logError(`site snapshot: FAILED (${err?.name ?? 'Error'}: ${err?.message ?? err})`);
    return 1;
  } finally {
    fs.rmSync(recordDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then((code) => process.exit(code));
}

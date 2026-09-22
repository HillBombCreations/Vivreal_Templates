import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`.
import {
  FREE_YEAR_OFFER,
  FREE_YEAR_SOURCE,
  formatCapUsd,
} from '../src/lib/domains/publicSearch.ts';

/**
 * D14-20: THE ONE CHECK THAT CATCHES THE PACKAGE MOVING.
 *
 * `FREE_YEAR_OFFER` names "$25", which tracks `DOMAIN_BUNDLE.maxCatalogPriceCents`
 * in `@hillbombcreations/tier-quotas`. The portal derives its copy from the
 * package. This page copies it as a literal, for a reason that is still good
 * (a second private GitHub Packages dependency in the fleet app's `npm ci` is
 * a known way to brick every customer site's build), and until now nothing
 * failed when the two drifted apart. vivreal.io would have gone on quoting an
 * old number to strangers, silently, for as long as nobody looked.
 *
 * ── WHY THIS ONE NEEDS THE NETWORK, AND ITS SIBLING DOES NOT ─────────────
 *
 * `src/lib/domains/publicSearch.test.ts` pins the SENTENCE against
 * `FREE_YEAR_SOURCE`, with no network at all. That catches someone editing one
 * and not the other, and it runs in `npm test`. It cannot catch the package
 * moving, because nothing in this repo re-reads the package: Templates does
 * not depend on it, so `npm ci` never fetches it and no local artefact ever
 * changes. **The registry is the only thing that knows.** A hermetic test of a
 * value that lives somewhere else is a round trip, and a round trip proves
 * nothing.
 *
 * ── WHY IT LIVES HERE, AND NOT IN `npm test` ─────────────────────────────
 *
 * This file is deliberately OUTSIDE `src/`, so the `src/**\/*.test.ts` glob in
 * the `test` script does not pick it up. `npm test` stays hermetic and works
 * offline.
 *
 * It was briefly inside that glob. That was wrong: it taxes every developer on
 * every run, forever, to catch a copy literal drifting, and it introduces a way
 * for the suite to go red for reasons that have nothing to do with the code. A
 * suite that fails when the wifi drops teaches people to distrust the suite,
 * and a distrusted suite is the same problem as an unrun one.
 *
 * It runs WEEKLY instead, from `.github/workflows/free-year-package-check.yml`,
 * which is the cadence the risk deserves: the cap moving is rare, and a week of
 * a stale sentence on a marketing page is survivable where a week of a broken
 * `npm test` is not.
 *
 * ── IT STILL FAILS RATHER THAN SKIPS, AND THAT NEEDED WORK ───────────────
 *
 * On a machine or runner that cannot reach the registry this FAILS. That
 * matters more in a scheduled job than it did in `npm test`: nobody is watching
 * a cron, so a skip is invisible, and an invisible skip is how a gate dies
 * quietly while still appearing to exist. A red weekly job gets looked at. A
 * green one that checked nothing does not.
 *
 * If it goes red on AUTH rather than on drift, the fix is a repository secret
 * (see the workflow), never deleting the schedule.
 *
 * ── WHAT IT MUST NOT DO ──────────────────────────────────────────────────
 *
 * It must never change this repo's install. The package is fetched into an OS
 * temp directory with its own manifest, and the last assertion in the file is
 * that `package.json` and `package-lock.json` are byte-identical to what they
 * were before it ran. That is not paranoia: an `npm install` in this repo
 * prunes the `@emnapi/*` entries out of the lockfile and takes the whole fleet
 * build down with it, which has happened.
 */

const PACKAGE = '@hillbombcreations/tier-quotas';
const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const PROBE_DIR = path.join(os.tmpdir(), 'vivreal-templates-tier-quotas-probe');

/** The shape this test reads. The package exports more; these are the four the sentence uses. */
interface DomainBundle {
  eligibleTiers: readonly string[];
  eligibleBillingPeriods: readonly string[];
  maxCatalogPriceCents: number;
  perGroupLimit: number;
}

function sha(file: string): string {
  return createRequire(import.meta.url)('node:crypto')
    .createHash('sha256')
    .update(fs.readFileSync(file))
    .digest('hex');
}

function npm(args: string[], cwd: string): string {
  return execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    // Windows resolves npm through the shell. Nothing here is caller-supplied.
    shell: process.platform === 'win32',
  });
}

/**
 * The version the registry currently calls `latest`.
 *
 * `--prefer-online` IS THE WHOLE POINT OF THIS FUNCTION, and leaving it off
 * made this check a gate-shaped object rather than a gate. Measured: against a
 * dead registry with no auth token, a bare `npm view` returned `5.2.0` from
 * npm's HTTP cache and exited 0. So the check would have reported "still
 * matches" on entirely stale data, and would never have seen a new publish,
 * which is the one event it exists to catch. `--prefer-online` forces
 * revalidation: same command exits 1 when it genuinely cannot reach the
 * registry, and still returns the right answer when it can.
 */
function latestPublishedVersion(): string {
  return npm(['view', `${PACKAGE}@latest`, 'version', '--prefer-online'], REPO_ROOT).trim();
}

/** Install `latest` into the probe directory, reusing it when it is already current. */
function installedProbe(version: string): string {
  const manifest = path.join(PROBE_DIR, 'node_modules', PACKAGE, 'package.json');
  if (fs.existsSync(manifest)) {
    const have = JSON.parse(fs.readFileSync(manifest, 'utf8')) as { version?: string };
    if (have.version === version) return manifest;
  }
  fs.rmSync(PROBE_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROBE_DIR, { recursive: true });
  // The repo's own .npmrc scopes @hillbombcreations to GitHub Packages and
  // reads NODE_AUTH_TOKEN. Copied rather than re-declared so there is one
  // registry configuration in this repo, not two.
  fs.copyFileSync(path.join(REPO_ROOT, '.npmrc'), path.join(PROBE_DIR, '.npmrc'));
  fs.writeFileSync(
    path.join(PROBE_DIR, 'package.json'),
    `${JSON.stringify({ name: 'vivreal-tier-quotas-probe', version: '0.0.0', private: true }, null, 2)}\n`,
  );
  npm(
    ['install', `${PACKAGE}@${version}`, '--prefer-online', '--no-audit', '--no-fund', '--silent'],
    PROBE_DIR,
  );
  return manifest;
}

test('the free-year sentence still matches the package it was copied from', async () => {
  const before = {
    manifest: sha(path.join(REPO_ROOT, 'package.json')),
    lock: sha(path.join(REPO_ROOT, 'package-lock.json')),
  };

  let version: string;
  let bundle: DomainBundle;
  try {
    version = latestPublishedVersion();
    const manifest = installedProbe(version);
    const entry = path.dirname(manifest);
    const loaded = createRequire(import.meta.url)(entry) as { DOMAIN_BUNDLE?: DomainBundle };
    assert.ok(loaded.DOMAIN_BUNDLE, `${PACKAGE}@${version} no longer exports DOMAIN_BUNDLE`);
    bundle = loaded.DOMAIN_BUNDLE;
  } catch (err) {
    // Loud and red, never a skip. If this repo can be installed, this can run:
    // @hillbombcreations/site-renderer comes from the same private registry.
    assert.fail(
      `Could not read ${PACKAGE} from the registry, so the free-year sentence is UNVERIFIED. ` +
        'This is the same credential `npm ci` needs (NODE_AUTH_TOKEN, see .npmrc). ' +
        `Underlying error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Control: a bundle that parsed as an empty object would satisfy every
  // "matches" assertion below by having nothing to disagree about.
  assert.ok(Array.isArray(bundle.eligibleTiers) && bundle.eligibleTiers.length > 0,
    'DOMAIN_BUNDLE.eligibleTiers came back empty, so nothing below would be checking anything');
  assert.equal(typeof bundle.maxCatalogPriceCents, 'number');

  const fix = `Read ${PACKAGE}@${version}, then update FREE_YEAR_SOURCE, FREE_YEAR_OFFER and the portal's copy together.`;

  assert.deepEqual([...bundle.eligibleTiers], [...FREE_YEAR_SOURCE.eligibleTiers],
    `eligibleTiers moved. ${fix}`);
  assert.deepEqual([...bundle.eligibleBillingPeriods], [...FREE_YEAR_SOURCE.eligibleBillingPeriods],
    `eligibleBillingPeriods moved. ${fix}`);
  assert.equal(bundle.maxCatalogPriceCents, FREE_YEAR_SOURCE.maxCatalogPriceCents,
    `maxCatalogPriceCents moved. ${fix}`);
  assert.equal(bundle.perGroupLimit, FREE_YEAR_SOURCE.perGroupLimit,
    `perGroupLimit moved. ${fix}`);

  // The sentence itself, against the LIVE value rather than the recorded one,
  // so a stale FREE_YEAR_SOURCE cannot launder a wrong price through.
  assert.ok(
    FREE_YEAR_OFFER.includes(formatCapUsd(bundle.maxCatalogPriceCents)),
    `the public sentence does not quote the package's cap of ` +
      `${formatCapUsd(bundle.maxCatalogPriceCents)}: "${FREE_YEAR_OFFER}"`,
  );

  assert.deepEqual(
    {
      manifest: sha(path.join(REPO_ROOT, 'package.json')),
      lock: sha(path.join(REPO_ROOT, 'package-lock.json')),
    },
    before,
    'this test changed the repo install, which is the outage it was written to avoid',
  );
});

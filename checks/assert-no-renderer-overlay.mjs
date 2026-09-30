#!/usr/bin/env node
/**
 * Refuse to build or test silently on top of a local renderer dev overlay.
 *
 * Added 2026-09-30, after a dev build of @hillbombcreations/site-renderer stood
 * in for the published package here for five days without anybody noticing. The
 * overlay is written by ../vivreal-site-renderer/scripts/dev-sync.js, which
 * copies that repo's dist/ and styles/ over the installed package but never
 * writes its package.json. The version string and the lockfile integrity
 * therefore stay authentic, so npm ls, the lockfile and the version all keep
 * passing. A green test suite under an overlay is exactly what happened.
 *
 * This check is deliberately marker-only and has NO dependency on the renderer
 * repo being checked out beside this one. Amplify clones this repo alone, the
 * marker is not committed, so in CI this passes in a millisecond and cannot
 * ENOENT.
 *
 * It does NOT run on `dev`. `npm run dev:linked` is the intended local
 * validation loop and must keep working untouched.
 *
 * Measured limit, state it rather than imply otherwise: this catches overlays
 * created by dev-sync.js from 2026-09-30 onward. It cannot see an overlay laid
 * down before the marker existed, or one whose marker was deleted. The check
 * that has no false negatives is a byte comparison against the published
 * tarball:  node ../vivreal-site-renderer/scripts/dev-status.js
 *
 * THIS FILE EXISTS IN THREE PLACES AND MUST STAY BYTE-IDENTICAL:
 *   vivreal-site-renderer/docs/consumer-guard/assert-no-renderer-overlay.mjs (source)
 *   Vivreal_Templates/checks/assert-no-renderer-overlay.mjs
 *   Vivreal_Portal_Mobile/scripts/assert-no-renderer-overlay.mjs
 * Edit the source, then re-copy. `node <this file> --self-test` proves the
 * acknowledgement semantics wherever the copy landed, with no dependencies and
 * no network, which is the whole point of keeping it dependency-free.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const MARKER = 'RENDERER-DEV-OVERLAY.json';
const OVERRIDE = 'ALLOW_RENDERER_OVERLAY';

/**
 * Does the override actually MEAN yes?
 *
 * Fixed 2026-09-30. This used to be a bare truthiness test on
 * `process.env[OVERRIDE]`, and every environment variable is a STRING, so the
 * one value a person is most likely to reach for to mean "off", `0`, is a
 * non-empty string and switched the guard ON. Setting it to `false` did the
 * same. The failure is silent and it is the wrong way round: you get the
 * overlay accepted at the exact moment you were trying to refuse it.
 *
 * Default-deny on anything unrecognised, and say so rather than ignoring it,
 * because a typo in an acknowledgement should read as "not acknowledged" and
 * not as "acknowledged". Proved by `--self-test`, which carries the `0` case
 * by name.
 */
const AFFIRMATIVE = new Set(['1', 'true', 'yes', 'on']);
const NEGATIVE = new Set(['', '0', 'false', 'no', 'off']);

function readAcknowledgement(raw) {
  if (raw === undefined || raw === null) return { acknowledged: false, unrecognised: null };
  const value = String(raw).trim().toLowerCase();
  if (AFFIRMATIVE.has(value)) return { acknowledged: true, unrecognised: null };
  if (NEGATIVE.has(value)) return { acknowledged: false, unrecognised: null };
  return { acknowledged: false, unrecognised: String(raw) };
}

/**
 * How to acknowledge, in the two shells this fleet is actually driven from.
 *
 * The bash form was the only one printed until 2026-09-30, and PowerShell is
 * the primary shell on the machines this runs on, where
 * `ALLOW_RENDERER_OVERLAY=1 npm test` is a CommandNotFoundException. The
 * MECHANISM worked in both all along; only the printed hint was wrong, which is
 * the kind of defect that costs somebody ten minutes and never gets reported.
 */
function escapeHatch(command) {
  return (
    `    acknowledge (bash/zsh/sh):  ${OVERRIDE}=1 ${command}\n` +
    `    acknowledge (PowerShell):   $env:${OVERRIDE}='1'; ${command}\n` +
    `    acknowledge (cmd.exe):      set ${OVERRIDE}=1 && ${command}\n`
  );
}

/* ------------------------------------------------------------------ */
/* Self-test: no deps, no network, runs anywhere this file lands.      */
/* ------------------------------------------------------------------ */

function selfTest() {
  const cases = [
    [undefined, false, 'unset'],
    [null, false, 'null'],
    ['', false, 'empty string'],
    ['0', false, 'THE defect: 0 must mean off, it used to mean on'],
    ['false', false, 'false means off'],
    ['FALSE', false, 'case-insensitive'],
    ['no', false, 'no means off'],
    ['off', false, 'off means off'],
    [' 0 ', false, 'padded 0 still means off'],
    ['1', true, 'the documented affirmative'],
    ['true', true, 'true means on'],
    ['TRUE', true, 'case-insensitive'],
    ['yes', true, 'yes means on'],
    ['on', true, 'on means on'],
    [' 1 ', true, 'padded 1 still means on'],
    ['banana', false, 'anything unrecognised is default-deny'],
  ];
  const failures = [];
  for (const [input, expected, why] of cases) {
    const got = readAcknowledgement(input).acknowledged;
    if (got !== expected) failures.push(`  ${JSON.stringify(input)} -> ${got}, expected ${expected} (${why})`);
  }
  // NON-VACUITY. A parser that refuses everything passes every negative case
  // above and breaks the escape hatch for everybody, so assert both directions
  // actually occur.
  const allowed = cases.filter(([i]) => readAcknowledgement(i).acknowledged).length;
  const refused = cases.length - allowed;
  if (allowed === 0) failures.push('  nothing is accepted, the escape hatch is dead');
  if (refused === 0) failures.push('  nothing is refused, the guard is dead');
  // And an unrecognised value must be REPORTED, not silently swallowed.
  if (readAcknowledgement('banana').unrecognised !== 'banana') {
    failures.push('  an unrecognised value must be reported back so a typo is visible');
  }
  if (readAcknowledgement('1').unrecognised !== null) failures.push('  a recognised value must not be reported');

  if (failures.length) {
    console.error(`\n  ${OVERRIDE} SELF-TEST FAILED, ${failures.length} case(s):\n${failures.join('\n')}\n`);
    process.exit(1);
  }
  console.log(`  ${OVERRIDE} self-test: ${cases.length} cases, ${allowed} accept, ${refused} refuse. OK`);
  process.exit(0);
}

if (process.argv.includes('--self-test')) selfTest();

/* ------------------------------------------------------------------ */
/* The check                                                           */
/* ------------------------------------------------------------------ */

const markerPath = path.resolve(process.cwd(), MARKER);
if (!fs.existsSync(markerPath)) process.exit(0);

let detail = '';
try {
  const m = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  detail =
    `      synced:   ${m.syncedAt || 'unknown'}\n` +
    `      renderer: ${String(m.rendererCommit || 'unknown').slice(0, 12)} on ${m.rendererBranch || '?'}` +
    `${m.rendererTreeDirty ? ' (tree was DIRTY, the commit does not describe the bytes)' : ''}\n` +
    `      claims:   ${m.claimsVersion || '?'}  <- authentic version string, and still a lie about the contents\n`;
} catch {
  detail = `      (${MARKER} is present but unreadable)\n`;
}

const { acknowledged, unrecognised } = readAcknowledgement(process.env[OVERRIDE]);

if (acknowledged) {
  console.warn(
    `\n  NOTE: running against a LOCAL RENDERER DEV OVERLAY, acknowledged via ${OVERRIDE}.\n` +
      `${detail}` +
      '  Results describe unpublished renderer code, not the published package.\n',
  );
  process.exit(0);
}

console.error(
  `\n${'='.repeat(78)}\n` +
    '  REFUSING TO RUN: this repo is on a LOCAL RENDERER DEV OVERLAY\n' +
    `${'='.repeat(78)}\n` +
    `  ${MARKER} is present, so node_modules/@hillbombcreations/site-renderer\n` +
    '  is a local build, not the published package. Its version string and its\n' +
    '  lockfile integrity are both still authentic, which is why nothing else\n' +
    '  here notices.\n\n' +
    `${detail}` +
    (unrecognised === null
      ? '\n'
      : `\n  ${OVERRIDE} is set to ${JSON.stringify(unrecognised)}, which is NOT an\n` +
        '  acknowledgement. Only 1/true/yes/on acknowledge; 0/false/no/off and\n' +
        '  anything unrecognised refuse, so a typo never reads as consent.\n\n') +
    '  Anything this run tells you is about unpublished renderer code. Pick one:\n\n' +
    '    revert:      node ../vivreal-site-renderer/scripts/dev-unlink.js\n' +
    '    verify:      node ../vivreal-site-renderer/scripts/dev-status.js\n\n' +
    `${escapeHatch('npm test')}` +
    `${'='.repeat(78)}\n`,
);
process.exit(1);

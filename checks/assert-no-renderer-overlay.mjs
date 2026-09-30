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
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const MARKER = 'RENDERER-DEV-OVERLAY.json';
const OVERRIDE = 'ALLOW_RENDERER_OVERLAY';

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

if (process.env[OVERRIDE]) {
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
    `${detail}\n` +
    '  Anything this run tells you is about unpublished renderer code. Pick one:\n\n' +
    '    revert:      node ../vivreal-site-renderer/scripts/dev-unlink.js\n' +
    '    verify:      node ../vivreal-site-renderer/scripts/dev-status.js\n' +
    `    acknowledge: ${OVERRIDE}=1 npm test\n` +
    `${'='.repeat(78)}\n`,
);
process.exit(1);

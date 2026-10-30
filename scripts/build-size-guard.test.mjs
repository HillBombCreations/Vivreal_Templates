/**
 * scripts/build-size-guard.mjs: the prerender output is measured from a real
 * directory tree and judged against the fail line before Amplify's cap.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AMPLIFY_OUTPUT_CAP_BYTES,
  PRERENDER_FAIL_BYTES,
  PRERENDER_WARN_BYTES,
  SITE_BASE_BYTES,
  judgePrerenderOutput,
  measurePrerenderOutput,
} from './build-size-guard.mjs';
import { PRERENDER_PAGE_BUDGET_BYTES } from '../src/lib/pages/prerenderBudget.ts';

/** A file of `size` bytes without writing them (truncate extends with zeros). */
function sized(file, size) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '');
  fs.truncateSync(file, size);
}

function appTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'build-size-'));
  return { root, app: path.join(root, '.next', 'server', 'app') };
}

test('measure: counts html, rsc, meta, body and every segment file, and nothing else', () => {
  const { root, app } = appTree();
  try {
    sized(path.join(app, 'index.html'), 1000);
    sized(path.join(app, 'index.rsc'), 900);
    sized(path.join(app, 'index.meta'), 10);
    sized(path.join(app, 'blog', 'post-a.html'), 500);
    sized(path.join(app, 'blog', 'post-a.rsc'), 400);
    sized(path.join(app, 'blog', 'post-a.segments', '_full.segment.rsc'), 300);
    sized(path.join(app, 'blog', 'post-a.segments', '$d$slug', '__PAGE__.segment.rsc'), 7);
    sized(path.join(app, 'robots.txt.body'), 50);
    // Code and the snapshot are not prerender output.
    sized(path.join(app, 'page.js'), 99_999);
    sized(path.join(app, 'page.js.nft.json'), 99_999);
    sized(path.join(app, 'site-snapshot.json'), 99_999);
    const m = measurePrerenderOutput(root);
    assert.equal(m.bytes, 1000 + 900 + 10 + 500 + 400 + 300 + 7 + 50);
    assert.equal(m.pages, 3);
    assert.deepEqual(m.largest[0], ['index', 1910]);
    assert.deepEqual(m.largest[1], ['blog', 1207]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('measure: a missing build directory measures zero', () => {
  const m = measurePrerenderOutput(path.join(os.tmpdir(), 'no-such-build-dir-xyz'));
  assert.deepEqual(m, { bytes: 0, pages: 0, largest: [] });
});

test('REFUSE: past the fail line the build fails, naming the largest pages and the fix', () => {
  // help.vivreal.io on 10-30 before the budget: 325 pages.
  const verdict = judgePrerenderOutput({ bytes: PRERENDER_FAIL_BYTES + 1, pages: 325, largest: [['getting-started', 93_875_805]] });
  assert.equal(verdict.ok, false);
  assert.match(verdict.line, /FAILED before Amplify's output cap/);
  assert.match(verdict.line, /\/getting-started 93875805/);
  assert.match(verdict.line, /prerenderBudget\.ts/);
});

test('ALLOW: at the fail line exactly, and under it, the build passes and prints its headroom', () => {
  assert.equal(judgePrerenderOutput({ bytes: PRERENDER_FAIL_BYTES, pages: 30, largest: [] }).ok, true);
  const quiet = judgePrerenderOutput({ bytes: 2_251_186, pages: 15, largest: [['index', 505_188]] });
  assert.equal(quiet.ok, true);
  assert.match(quiet.line, /^build size: prerendered 15 pages, 2251186 bytes .* largest: \/ 505188$/);
  assert.doesNotMatch(quiet.line, /WARNING/);
  const close = judgePrerenderOutput({ bytes: PRERENDER_WARN_BYTES + 1, pages: 30, largest: [] });
  assert.equal(close.ok, true);
  assert.match(close.line, /WARNING/);
});

test('the fail line keeps the fleet base under the cap, and the planned budget sits under the fail line', () => {
  assert.equal(AMPLIFY_OUTPUT_CAP_BYTES, 230_686_720);
  assert.ok(SITE_BASE_BYTES + PRERENDER_FAIL_BYTES < AMPLIFY_OUTPUT_CAP_BYTES);
  assert.ok(PRERENDER_PAGE_BUDGET_BYTES < PRERENDER_WARN_BYTES);
  assert.ok(PRERENDER_WARN_BYTES < PRERENDER_FAIL_BYTES);
});

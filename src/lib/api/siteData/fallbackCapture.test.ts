/**
 * TEMPLATES-5 R1 (vivreal-hq triage-sentry-clickup-2026-10-22.md): the
 * `getSiteData` fallback capture ran once per call, about nine per request,
 * and sent 90 events from one scanner burst. `index.tsx` imports
 * `server-only` and is a `.tsx` file, so the node runner cannot load it; the
 * gate's behaviour is pinned in `../captureThrottle.test.ts`, and this pins
 * that the fallback branch actually goes through it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');

function fallbackBranch(): string {
  const start = source.indexOf('if (!raw?.siteDetails?.values) {');
  const end = source.indexOf('return FALLBACK_SITE_DATA;', start);
  assert.ok(start >= 0 && end > start, 'the getSiteData fallback branch was not found');
  return source.slice(start, end);
}

test('control: the fallback branch still captures the fallback message', () => {
  assert.match(fallbackBranch(), /Sentry\.captureMessage\(\s*SITE_DETAILS_FALLBACK_MESSAGE/);
});

test('[R1 REFUSE] the fallback capture is sent only when the per-window, per-request gate says so', () => {
  const branch = fallbackBranch();
  assert.match(
    branch,
    /SITE_DETAILS_FALLBACK_CAPTURES\.take\(undefined, fallbackCapturesThisRequest\(\)\)/,
    'the gate is taken with the per-request marker',
  );
  const gateAt = branch.indexOf('if (gate.capture) {');
  const captureAt = branch.indexOf('Sentry.captureMessage(');
  assert.ok(gateAt >= 0 && captureAt > gateAt, 'captureMessage sits inside if (gate.capture)');
  assert.equal(branch.split('Sentry.captureMessage(').length - 1, 1, 'exactly one capture in the branch');
});

test('[R1 REFUSE] the capture carries the held-back count', () => {
  assert.match(fallbackBranch(), /buildSiteDetailsFallbackCapture\(\{ siteId: SITE_ID, suppressed: gate\.suppressed \}\)/);
});

test('[R1 ALLOW] the degraded render is still taken off the caches after the gate', () => {
  const branch = fallbackBranch();
  assert.ok(branch.indexOf('await bailOutOfCachingDegradedRender();') > branch.indexOf('if (gate.capture) {'));
});

test('[R1 ALLOW] the marker is request scoped through React cache, and the throttle is module scoped', () => {
  assert.match(source, /const fallbackCapturesThisRequest = cache\(\(\): Set<string> => new Set\(\)\);/);
  assert.match(source, /^const SITE_DETAILS_FALLBACK_CAPTURES = createCaptureThrottle\(\);$/m);
});

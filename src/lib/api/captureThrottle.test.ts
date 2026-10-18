/**
 * V7.319 acceptance: a planted upstream outage produces one event per window,
 * not one per call. Each REFUSE is paired with an ALLOW so a throttle that
 * sends nothing, or everything, cannot pass both.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FETCH_FAILURE_CAPTURE_WINDOW_MS, createCaptureThrottle } from './captureThrottle.ts';

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

test('[V7.319 REFUSE] a planted outage of 14 failed reads in one render sends one event, not 14', () => {
  const c = clock();
  const throttle = createCaptureThrottle(FETCH_FAILURE_CAPTURE_WINDOW_MS, c.now);
  const sent = Array.from({ length: 14 }, () => throttle.take()).filter((d) => d.capture);
  assert.equal(sent.length, 1);
});

test('[V7.319 REFUSE] repeats across the whole window stay held, up to the last millisecond', () => {
  const c = clock();
  const throttle = createCaptureThrottle(FETCH_FAILURE_CAPTURE_WINDOW_MS, c.now);
  assert.equal(throttle.take().capture, true);
  c.advance(FETCH_FAILURE_CAPTURE_WINDOW_MS - 1);
  assert.equal(throttle.take().capture, false);
});

test('[V7.319 ALLOW] the first failure is always sent, with nothing held before it', () => {
  const throttle = createCaptureThrottle(FETCH_FAILURE_CAPTURE_WINDOW_MS, clock().now);
  assert.deepEqual(throttle.take(), { capture: true, suppressed: 0 });
});

test('[V7.319 ALLOW] a failure in the next window is sent and carries the count it held back', () => {
  const c = clock();
  const throttle = createCaptureThrottle(FETCH_FAILURE_CAPTURE_WINDOW_MS, c.now);
  for (let i = 0; i < 14; i += 1) throttle.take();
  c.advance(FETCH_FAILURE_CAPTURE_WINDOW_MS);
  assert.deepEqual(throttle.take(), { capture: true, suppressed: 13 });
  assert.equal(throttle.take().suppressed, 1, 'the count restarts with the new window');
});

test('[V7.319 ALLOW] a clock that steps backwards opens a new window instead of holding forever', () => {
  const c = clock();
  const throttle = createCaptureThrottle(FETCH_FAILURE_CAPTURE_WINDOW_MS, c.now);
  throttle.take();
  c.advance(-60_000);
  assert.equal(throttle.take().capture, true);
});

test('[V7.319 ALLOW] two throttles (two sites, two processes) do not share a window', () => {
  const c = clock();
  const a = createCaptureThrottle(FETCH_FAILURE_CAPTURE_WINDOW_MS, c.now);
  const b = createCaptureThrottle(FETCH_FAILURE_CAPTURE_WINDOW_MS, c.now);
  assert.equal(a.take().capture, true);
  assert.equal(b.take().capture, true);
});

// Review of PR 197, C5: the window is per failure signature, not one per site.
test('[V7.319 REFUSE] a second, different failing path inside the window is not held behind the first', () => {
  const c = clock();
  const throttle = createCaptureThrottle(FETCH_FAILURE_CAPTURE_WINDOW_MS, c.now);
  assert.equal(throttle.take('/tenant/siteDetails').capture, true);
  c.advance(60_000);
  assert.equal(throttle.take('/tenant/collectionObjects').capture, true, 'its own Issue still reaches Sentry');
});

test('[V7.319 ALLOW] repeats of one path stay held while another path has its own count', () => {
  const c = clock();
  const throttle = createCaptureThrottle(FETCH_FAILURE_CAPTURE_WINDOW_MS, c.now);
  throttle.take('/a');
  throttle.take('/b');
  for (let i = 0; i < 5; i += 1) assert.equal(throttle.take('/a').capture, false);
  assert.equal(throttle.take('/b').capture, false);
  c.advance(FETCH_FAILURE_CAPTURE_WINDOW_MS);
  assert.deepEqual(throttle.take('/a'), { capture: true, suppressed: 5 });
  assert.deepEqual(throttle.take('/b'), { capture: true, suppressed: 1 });
});

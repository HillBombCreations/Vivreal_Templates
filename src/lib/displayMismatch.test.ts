import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createReportThrottle,
  displayMismatchReport,
  displayMismatchThrottleKey,
  DISPLAY_MISMATCH_MESSAGE,
  DISPLAY_MISMATCH_THROTTLE_MS,
} from './displayMismatch.ts';

const layout = (id: string, dispatchId: string, displayAs?: string) => ({
  id,
  order: 0,
  enabled: true,
  type: { kind: 'layout' as const, dispatchId },
  config: { bindings: [{ collectionId: 'c1', ...(displayAs === undefined ? {} : { displayAs }) }] },
});

// Cast: the fixture is the minimum a block carries for this reading; the
// renderer's Block type requires presentation fields the rule never reads.
const page = (blocks: unknown[]) => ({ blocks } as unknown as Parameters<typeof displayMismatchReport>[0]);

test('ALLOW (F-C7): a block whose displayAs disagrees with its type is reported once, with its block id', () => {
  const report = displayMismatchReport(page([layout('b1', 'cards', 'list'), layout('b2', 'cards', 'cards')]), {
    siteId: 'site1',
    slug: 'menu',
  });
  assert.ok(report);
  assert.equal(report.message, DISPLAY_MISMATCH_MESSAGE);
  assert.deepEqual(report.capture.extra.rows, [{ blockId: 'b1', dispatchId: 'cards', displayAs: 'list' }]);
  assert.equal(report.capture.tags.blockIds, 'b1');
  assert.deepEqual(report.capture.fingerprint, ['templates.render.displayMismatch', 'site1', 'menu']);
});

test('REFUSE (F-C7): an agreeing page sends nothing', () => {
  assert.equal(displayMismatchReport(page([layout('b2', 'cards', 'cards')]), { siteId: 's', slug: 'menu' }), null);
  assert.equal(displayMismatchReport(page([]), { siteId: 's', slug: 'menu' }), null);
  assert.equal(displayMismatchReport(undefined, { siteId: 's', slug: 'menu' }), null);
});

test('F-C7: an unset displayAs on a non-cards block is a mismatch (it draws a card grid)', () => {
  const report = displayMismatchReport(page([layout('b3', 'list')]), { siteId: 's', slug: 'x' });
  assert.deepEqual(report?.capture.extra.rows, [{ blockId: 'b3', dispatchId: 'list', displayAs: null }]);
});

// B2 (review of #190): the fleet renders per request, so the call site sends
// through a throttle. Driven with an injected clock.
function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

test('ALLOW (B2): the first report of a page is sent', () => {
  const c = clock();
  const throttle = createReportThrottle({ now: c.now });
  assert.equal(throttle.shouldSend('s|menu|b1'), true);
});

test('REFUSE (B2): a second report of the same page inside the hour is suppressed', () => {
  const c = clock();
  const throttle = createReportThrottle({ now: c.now });
  assert.equal(throttle.shouldSend('s|menu|b1'), true);
  c.advance(DISPLAY_MISMATCH_THROTTLE_MS - 1);
  assert.equal(throttle.shouldSend('s|menu|b1'), false);
});

test('ALLOW (B2): the same page after the hour is sent again, and once only', () => {
  const c = clock();
  const throttle = createReportThrottle({ now: c.now });
  throttle.shouldSend('s|menu|b1');
  c.advance(DISPLAY_MISMATCH_THROTTLE_MS);
  assert.equal(throttle.shouldSend('s|menu|b1'), true);
  assert.equal(throttle.shouldSend('s|menu|b1'), false);
});

test('ALLOW (B2): a different page, or a different block set on the same page, is its own key', () => {
  const c = clock();
  const throttle = createReportThrottle({ now: c.now });
  const a = displayMismatchReport(page([layout('b1', 'cards', 'list')]), { siteId: 's', slug: 'menu' });
  const b = displayMismatchReport(page([layout('b1', 'cards', 'list')]), { siteId: 's', slug: 'about' });
  const c2 = displayMismatchReport(page([layout('b1', 'cards', 'list'), layout('b3', 'cards', 'list')]), { siteId: 's', slug: 'menu' });
  assert.ok(a && b && c2);
  assert.equal(throttle.shouldSend(displayMismatchThrottleKey(a)), true);
  assert.equal(throttle.shouldSend(displayMismatchThrottleKey(a)), false);
  assert.equal(throttle.shouldSend(displayMismatchThrottleKey(b)), true);
  assert.equal(throttle.shouldSend(displayMismatchThrottleKey(c2)), true);
});

test('B2: the throttle is bounded; a full map evicts the oldest key', () => {
  const c = clock();
  const throttle = createReportThrottle({ now: c.now, maxKeys: 2 });
  throttle.shouldSend('k1');
  throttle.shouldSend('k2');
  throttle.shouldSend('k3');
  assert.equal(throttle.size, 2);
  assert.equal(throttle.shouldSend('k2'), false);
  assert.equal(throttle.shouldSend('k1'), true);
});

test('B2: the Sentry call site sends only after the throttle allows it (pin, the call site is server-only)', () => {
  const src = fs.readFileSync(new URL('./reportDisplayMismatch.ts', import.meta.url), 'utf8');
  const gate = src.indexOf('if (!SENT.shouldSend(displayMismatchThrottleKey(report))) return;');
  const capture = src.indexOf('Sentry.captureMessage(');
  assert.notEqual(gate, -1, 'throttle gate not found, this pin is vacuous');
  assert.notEqual(capture, -1, 'captureMessage not found, this pin is vacuous');
  assert.ok(gate < capture, 'the throttle must run before the capture');
});

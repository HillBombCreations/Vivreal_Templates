import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayMismatchReport, DISPLAY_MISMATCH_MESSAGE } from './displayMismatch.ts';

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

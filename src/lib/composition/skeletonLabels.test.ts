/**
 * V7.104 (W8 timing check, finding 1). A section header's subtitle is stored
 * twice: `page.labels.subtitle` and the Section header block's
 * `config.labels.subtitle`. Studio's Section header editor writes only the
 * block copy, and the loading placeholder read the PAGE copy, so after an edit
 * the old line stayed in the served HTML (the Suspense fallback): seen for a
 * moment on a slow phone, and by every reader that runs no scripts. The
 * placeholder now draws from the block the real page draws its header from.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skeletonLabelsFor } from './skeletonLabels.ts';

const OLD = 'Everybody welcome, and we mean the words on the door.';
const NEW = 'One price list, and every chair takes walk ins.';

function sectionHeader(labels: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { type: { kind: 'static', dispatchId: 'section-header' }, config: { labels }, ...extra };
}

/** The /about shape W8 measured: a hero first, the Section header second. */
const EDITED_ABOUT = {
  labels: { title: 'One price list, every chair', subtitle: OLD },
  blocks: [
    { type: { kind: 'home-section', dispatchId: 'hero' } },
    sectionHeader({ title: 'One price list, every chair', subtitle: NEW }),
    { type: { kind: 'layout', dispatchId: 'cards' }, config: { bindings: [] } },
  ],
};

test('[V7.104 REFUSE] after a Section header edit the placeholder never shows the old page-level line', () => {
  const labels = skeletonLabelsFor(EDITED_ABOUT);
  assert.notEqual(labels?.subtitle, OLD, 'the stale page copy must not reach the placeholder');
  assert.equal(labels?.subtitle, NEW, 'the placeholder reads the block the page renders');
  assert.equal(labels?.title, 'One price list, every chair');
});

test('[V7.104 REFUSE] a header the owner emptied in the block is not refilled from the page copy', () => {
  const page = { labels: { title: 'Gallery', subtitle: OLD }, blocks: [sectionHeader({ title: 'Gallery' })] };
  const labels = skeletonLabelsFor(page);
  assert.equal(labels?.subtitle, undefined, 'the block has no subtitle, so neither does the placeholder');
  assert.equal(labels?.title, 'Gallery');
});

test('[V7.104 ALLOW] a page with no enabled Section header block keeps its page labels, same object', () => {
  const labels = { title: 'Menu', subtitle: 'Fresh daily.' };
  assert.equal(skeletonLabelsFor({ labels }), labels, 'no blocks');
  assert.equal(skeletonLabelsFor({ labels, blocks: [] }), labels, 'empty blocks');
  assert.equal(
    skeletonLabelsFor({ labels, blocks: [sectionHeader({ title: 'Hidden', subtitle: NEW }, { enabled: false })] }),
    labels,
    'a disabled Section header draws nothing on the page, so it cannot feed the placeholder',
  );
  assert.equal(
    skeletonLabelsFor({ labels, blocks: [{ type: { kind: 'layout', dispatchId: 'cards' } }] }),
    labels,
    'other blocks only',
  );
  assert.equal(skeletonLabelsFor({}), undefined, 'no labels at all stays undefined');
});

test('[V7.104 ALLOW] the other page labels ride along unchanged (the catalog placeholder reads more than the masthead)', () => {
  const page = {
    labels: { title: 'Shop', subtitle: OLD, searchPlaceholder: 'Search the shop' },
    blocks: [sectionHeader({ title: 'Shop', subtitle: NEW, eyebrow: 'THE SHOP' })],
  };
  const labels = skeletonLabelsFor(page);
  assert.equal(labels?.searchPlaceholder, 'Search the shop');
  assert.equal(labels?.subtitle, NEW);
  assert.equal(page.labels.subtitle, OLD, 'the stored page config is not mutated');
});

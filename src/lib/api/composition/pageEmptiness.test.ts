/**
 * pageEmptiness predicates — the generic-format isEmpty → notFound() guard's
 * content detectors (A Bakeshop Weddings/Tea-Time mid-stream 404 regression).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decidePageEmptiness,
  hasAuthoredHeroOrSectionBlock,
  hasFormBlock,
  hasStaticContentBlock,
  pageCouldBeEmpty,
} from './pageEmptiness.ts';

test('hasStaticContentBlock: labels-bearing static block counts as content', () => {
  const blocks = [
    { id: 'hero', type: { kind: 'home-section', dispatchId: 'hero' }, enabled: true },
    {
      id: 'story',
      type: { kind: 'static', dispatchId: 'about' },
      enabled: true,
      config: { labels: { body: '<p>Congratulations – you are getting married!</p>' } },
    },
  ];
  assert.equal(hasStaticContentBlock(blocks), true);
});

test('hasStaticContentBlock: media-descriptor label counts as content', () => {
  const blocks = [
    {
      type: { kind: 'static', dispatchId: 'about' },
      config: { labels: { image: { key: 'groupObjects/x/y.jpg', name: 'y.jpg' } } },
    },
  ];
  assert.equal(hasStaticContentBlock(blocks), true);
});

test('hasStaticContentBlock: disabled / label-less / non-static blocks are NOT content', () => {
  assert.equal(
    hasStaticContentBlock([
      { type: { kind: 'static' }, enabled: false, config: { labels: { body: '<p>x</p>' } } },
    ]),
    false,
    'disabled static block must not count',
  );
  assert.equal(
    hasStaticContentBlock([{ type: { kind: 'static' }, config: { labels: { body: '   ' } } }]),
    false,
    'whitespace-only labels must not count',
  );
  assert.equal(
    hasStaticContentBlock([{ type: { kind: 'static' }, config: {} }]),
    false,
    'label-less static block must not count',
  );
  assert.equal(
    hasStaticContentBlock([{ type: { kind: 'layout', dispatchId: 'gallery' }, config: { labels: { title: 'x' } } }]),
    false,
    'non-static kinds are handled by the item-count check, not this predicate',
  );
  assert.equal(hasStaticContentBlock(undefined), false);
  assert.equal(hasStaticContentBlock([]), false);
});

test('hasFormBlock: finds a form block at the top level and nested in children', () => {
  assert.equal(hasFormBlock([{ type: { dispatchId: 'form' } }]), true);
  assert.equal(
    hasFormBlock([{ type: { dispatchId: 'group' }, config: { children: [{ type: { dispatchId: 'form' } }] } }]),
    true,
  );
  assert.equal(hasFormBlock([{ type: { dispatchId: 'hero' } }]), false);
});

/* ── ST3 (fix-plan 2026-10-07): a Blank page with a Split hero 404'd ────────── */

const heroBlock = { id: 'h', type: { kind: 'home-section', dispatchId: 'hero' }, enabled: true };
const emptyLongform = {
  id: 'l',
  type: { kind: 'layout', dispatchId: 'longform' },
  enabled: true,
  config: { bindings: [{ collectionId: 'c1', displayAs: 'longform' }] },
};
const noRowsBack = [{ sourceCount: 0, degraded: false }];

test('ST3: a Blank page with a Split hero titled "Hello" and an empty Long-form list is NOT empty', () => {
  const verdict = decidePageEmptiness({
    isHome: false,
    format: 'standard',
    blocks: [heroBlock, emptyLongform],
    hero: { title: 'Hello', variant: 'split-statement' },
    reads: noRowsBack,
  });
  assert.deepEqual(verdict, { isEmpty: false, emptinessUnknown: false });
});

test('ST3: hero photo, background media and a written home-section block each count as content', () => {
  assert.equal(hasAuthoredHeroOrSectionBlock([heroBlock], { title: '', heroImage: { key: 'g/m/a.jpg', name: 'a.jpg' } }), true);
  assert.equal(hasAuthoredHeroOrSectionBlock([heroBlock], { title: ' ', background: { type: 'image', image: { key: 'g/m/b.jpg' } } }), true);
  assert.equal(hasAuthoredHeroOrSectionBlock([heroBlock], { background: { type: 'carousel', slides: [{ image: { key: 'k' } }] } }), true);
  assert.equal(
    hasAuthoredHeroOrSectionBlock(
      [{ type: { kind: 'home-section', dispatchId: 'hero-split' }, config: { labels: { title: 'Fresh bread' } } }],
      undefined,
    ),
    true,
  );
});

test('ST3 REFUSE: a bound list with nothing live, alone, is still empty and still 404s', () => {
  const verdict = decidePageEmptiness({
    isHome: false,
    format: 'standard',
    blocks: [emptyLongform],
    hero: { title: 'Hello' },
    reads: noRowsBack,
  });
  assert.deepEqual(verdict, { isEmpty: true, emptinessUnknown: false }, 'page.hero without an enabled hero block renders nothing');
});

test('ST3 REFUSE: an unwritten, disabled, or gradient-only hero is not content', () => {
  assert.equal(hasAuthoredHeroOrSectionBlock([heroBlock], { title: '   ' }), false, 'a bare hero paints only the site name');
  assert.equal(hasAuthoredHeroOrSectionBlock([heroBlock], undefined), false);
  assert.equal(hasAuthoredHeroOrSectionBlock([heroBlock], { title: '', background: { type: 'gradient' } }), false);
  assert.equal(hasAuthoredHeroOrSectionBlock([{ ...heroBlock, enabled: false }], { title: 'Hello' }), false);
  assert.equal(
    hasAuthoredHeroOrSectionBlock(
      [{ type: { kind: 'home-section', dispatchId: 'photo-gallery' }, config: { labels: { images: [], title: '' } } }],
      undefined,
    ),
    false,
    'an empty gallery with no words is no content',
  );
  assert.equal(hasAuthoredHeroOrSectionBlock(null, { title: 'Hello' }), false);
});

test('ST3: a failed read on a page whose only content is the list still refuses rather than 404s', () => {
  const verdict = decidePageEmptiness({
    isHome: false,
    format: 'standard',
    blocks: [heroBlock, emptyLongform],
    hero: { title: '' },
    reads: [{ sourceCount: 0, degraded: true }],
  });
  assert.deepEqual(verdict, { isEmpty: false, emptinessUnknown: true });
});

// ── QA-G1-2: which pages read their data BEFORE the shell flushes ────────────
//
// `renderComposedPage` awaits the page's reads above its Suspense boundary only
// when `pageCouldBeEmpty` is true, so only those pages can answer a real 404.
// ALLOW and REFUSE in both directions: a page this says "could be empty" for
// gives up streaming, and a page it says "cannot" for can never 404.

test('QA-G1-2 ALLOW: a page whose whole body is a bound list could be empty, so it decides before streaming', () => {
  assert.equal(
    pageCouldBeEmpty({ isHome: false, format: 'standard', blocks: [emptyLongform], hero: { title: 'Hello' } }),
    true,
  );
  assert.equal(pageCouldBeEmpty({ isHome: false, format: 'standard', blocks: [] }), true, 'a page with no blocks at all');
  assert.equal(pageCouldBeEmpty({ isHome: false, format: 'list' }), true, 'blocks absent');
});

test('QA-G1-2 REFUSE: a page with a written hero and an empty list cannot be empty, so it keeps streaming and answers 200', () => {
  const page = { isHome: false, format: 'standard', blocks: [heroBlock, emptyLongform], hero: { title: 'Hello' } };
  assert.equal(pageCouldBeEmpty(page), false);
  assert.deepEqual(decidePageEmptiness({ ...page, reads: noRowsBack }), { isEmpty: false, emptinessUnknown: false });
});

test('QA-G1-2 REFUSE: the home page never could be empty, whatever it holds', () => {
  assert.equal(pageCouldBeEmpty({ isHome: true, format: 'standard', blocks: [emptyLongform] }), false);
  assert.equal(pageCouldBeEmpty({ isHome: true, format: 'home', blocks: [] }), false);
  assert.deepEqual(
    decidePageEmptiness({ isHome: true, format: 'standard', blocks: [emptyLongform], reads: noRowsBack }),
    { isEmpty: false, emptinessUnknown: false },
  );
});

test('QA-G1-2: the verdict never calls empty a page the structural test ruled out (the body guard is dead by construction)', () => {
  const shapes = [
    { isHome: false, format: 'static', blocks: [emptyLongform] },
    { isHome: false, format: 'standard', blocks: [heroBlock, emptyLongform], hero: { title: 'Hi' } },
    { isHome: false, format: 'standard', blocks: [{ type: { kind: 'static', dispatchId: 'about' }, config: { labels: { body: 'x' } } }] },
    { isHome: false, format: 'standard', blocks: [{ type: { kind: 'home-section', dispatchId: 'form' } }] },
  ];
  for (const shape of shapes) {
    assert.equal(pageCouldBeEmpty(shape), false);
    for (const reads of [noRowsBack, [{ sourceCount: 0, degraded: true }], []]) {
      assert.deepEqual(decidePageEmptiness({ ...shape, reads }), { isEmpty: false, emptinessUnknown: false });
    }
  }
});

/**
 * pageEmptiness predicates — the generic-format isEmpty → notFound() guard's
 * content detectors (A Bakeshop Weddings/Tea-Time mid-stream 404 regression).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasFormBlock, hasStaticContentBlock } from './pageEmptiness.ts';

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

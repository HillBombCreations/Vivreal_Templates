import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DetailPageLike } from '../detail/detailCollection.ts';
import { legacySubscribeCollectionId } from './subscribeCollection.ts';

/**
 * Review note N5 (vivreal-hq docs/projects/next-release-2026-10/
 * review-client-121-sitedetails-projection-2026-10-14.md): VR_Client_API #121
 * serves `collections: []` for every page with blocks, so the subscribe
 * fallback must read `collections[0]` only where the API still sends it.
 */

const heroBlock = {
  type: { kind: 'section' },
  config: {},
};

const subscribePage = (extra: DetailPageLike): DetailPageLike => ({
  collectionId: null,
  ...extra,
});

test('ALLOW: a block-less subscribe page still falls back to collections[0]', () => {
  const page = subscribePage({ collections: [{ collectionId: 'subs-list' }] });
  assert.equal(legacySubscribeCollectionId(page), 'subs-list');
});

test('ALLOW: an empty blocks array counts as block-less', () => {
  const page = subscribePage({ blocks: [], collections: [{ collectionId: 'subs-list' }] });
  assert.equal(legacySubscribeCollectionId(page), 'subs-list');
});

test('REFUSE: a subscribe page with blocks ignores collections[0]', () => {
  // The mirror is non-empty here on purpose: if the gate were missing this
  // would return 'stale-list', so the '' is the gate, not an empty fixture.
  const page = subscribePage({
    blocks: [heroBlock],
    collections: [{ collectionId: 'stale-list' }],
  });
  assert.equal(legacySubscribeCollectionId(page), '');
});

test('page.collectionId wins whether or not the page has blocks', () => {
  const withBlocks = subscribePage({
    collectionId: 'direct-list',
    blocks: [heroBlock],
    collections: [{ collectionId: 'stale-list' }],
  });
  const without = subscribePage({
    collectionId: 'direct-list',
    collections: [{ collectionId: 'other-list' }],
  });
  assert.equal(legacySubscribeCollectionId(withBlocks), 'direct-list');
  assert.equal(legacySubscribeCollectionId(without), 'direct-list');
});

test('no list anywhere, and no page config, resolve to the no-list path', () => {
  assert.equal(legacySubscribeCollectionId(subscribePage({})), '');
  assert.equal(legacySubscribeCollectionId(subscribePage({ collections: [] })), '');
  assert.equal(legacySubscribeCollectionId(undefined), '');
});

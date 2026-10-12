/**
 * W25f-2: Juniper, Meridian and salt + sage provider cards link to
 * `/about/providers/<id>`, which answered 404. `[...segments]/page.tsx` is JSX
 * and cannot load under `node --test`, so its decision, `nestedItemRoute`, is
 * called here with the page lists those sites carry.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NON_NESTABLE_FORMATS, nestedItemRoute } from './nestedItemRoute.ts';

const PAGES = [
  { slug: 'about', format: 'about' },
  { slug: 'about/providers', format: 'team' },
  { slug: 'features/ai-sites', format: 'standard' },
  { slug: 'moraga/dinner', format: 'menu' },
  { slug: 'shop/archive', format: 'products' },
];
const PROVIDER = '6ac02613112e57af3dd8e2d9';

test('ALLOW (W25f-2): a 3-part provider URL goes to the item route under its nested page', () => {
  assert.deepEqual(nestedItemRoute(PAGES, ['about', 'providers', PROVIDER]), { slug: 'about/providers', itemId: PROVIDER });
  assert.deepEqual(nestedItemRoute(PAGES, ['moraga', 'dinner', 'lasagne']), { slug: 'moraga/dinner', itemId: 'lasagne' });
});

test('REFUSE (W25f-2): a 3-part path under no real page stays with the catch-all, which 404s it', () => {
  assert.equal(nestedItemRoute(PAGES, ['about', 'nobody', PROVIDER]), undefined);
  assert.equal(nestedItemRoute(PAGES, ['santa-monica', 'injectables-fillers', 'botox']), undefined, 'a donor redirect path keeps its 301');
  assert.equal(nestedItemRoute([], ['about', 'providers', PROVIDER]), undefined);
  assert.equal(nestedItemRoute(undefined, ['about', 'providers', PROVIDER]), undefined);
});

test('REFUSE (W25f-2): a nested page the item route itself 404s publishes no item URLs', () => {
  assert.ok(NON_NESTABLE_FORMATS.has('products'));
  assert.equal(nestedItemRoute(PAGES, ['shop', 'archive', 'sku-1']), undefined);
});

test('REFUSE (W25f-2): only exactly 3 non-empty segments; 4 or more keep the old answer', () => {
  assert.equal(nestedItemRoute(PAGES, ['about', 'providers', PROVIDER, 'extra']), undefined);
  assert.equal(nestedItemRoute(PAGES, ['about', 'providers', '']), undefined);
  assert.equal(nestedItemRoute(PAGES, ['about', '', PROVIDER]), undefined);
});

test('UNCHANGED (W25f-2): 1- and 2-part paths are never claimed, they belong to [slug] and [slug]/[itemId]', () => {
  assert.equal(nestedItemRoute(PAGES, ['about']), undefined);
  assert.equal(nestedItemRoute(PAGES, ['about', 'providers']), undefined);
  assert.equal(nestedItemRoute(PAGES, []), undefined);
});

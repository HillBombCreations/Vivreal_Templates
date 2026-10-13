import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { providerMissIsFinal, readsProviderProduct, storefrontItemSources } from './storefrontSources.ts';
import { collectTargets } from '../api/composition/bindingTargets.ts';
import { productItemMetaText } from '../seo/productItemMeta.ts';
import { isPaymentsProvider } from '../payments.ts';
import type { PageConfig } from '@/types/SiteData';

const RESALE = { format: 'products', detailPage: { itemCollectionId: 'c-shop-catalog' } };
const STRIPE_SHOP = { format: 'products', detailPage: null };

test('Phase 0.1 (D1): the resale shop reads the provider, then its collection, and a provider miss is not final', () => {
  assert.deepEqual(storefrontItemSources(RESALE, undefined), ['provider', 'collection']);
  assert.equal(providerMissIsFinal(RESALE), false);
});

test('a provider storefront with no collection detail keeps its 404 on a miss', () => {
  assert.deepEqual(storefrontItemSources(STRIPE_SHOP, 'stripe'), ['provider']);
  assert.equal(providerMissIsFinal(STRIPE_SHOP), true);
});

test('a non-products page with a payments binding reads the provider, and its miss is never final here', () => {
  assert.deepEqual(storefrontItemSources({ format: 'standard' }, 'square'), ['provider']);
  assert.equal(providerMissIsFinal({ format: 'standard' }), false);
});

test('a recipes page reads only its collection; a plain page reads nothing', () => {
  assert.deepEqual(storefrontItemSources({ format: 'recipes' }, undefined), ['collection']);
  assert.deepEqual(storefrontItemSources({ format: 'standard' }, undefined), []);
});

// W25-10ca: Cobalt & Crumb's /shop as served (local Client API, 2026-10-11).
// A `catalog` page whose Stripe grid sits inside a group, with the legacy
// collection mirror still on the page.

// Cast: the fixture carries only the fields these readers touch.
const COBALT_SHOP = {
  slug: 'shop',
  name: 'Shop Cobalt & Crumb',
  format: 'catalog',
  detailPage: { enabled: true },
  collections: [
    { collectionId: '6ac03ee6278c92602011eaf1', role: 'primary' },
    { collectionId: '6ac03eee278c92602011eafd', role: 'sidebar' },
  ],
  integrations: [],
  blocks: [
    { id: 'h', type: { kind: 'static', dispatchId: 'section-header' }, config: { bindings: [] } },
    {
      id: 'g',
      type: { kind: 'group', dispatchId: 'group' },
      config: {
        bindings: [],
        children: [
          { id: 't', type: { kind: 'page-template', dispatchId: 'products-toolbar' }, config: { bindings: [] } },
          { id: 'f', type: { kind: 'page-template', dispatchId: 'products-filters' }, config: { bindings: [] } },
          { id: 'p', type: { kind: 'page-template', dispatchId: 'products-grid' }, config: { bindings: [{ integrationProvider: 'stripe', role: 'primary' }] } },
        ],
      },
    },
  ],
} as unknown as PageConfig;

const providerOf = (page: PageConfig) => collectTargets(page, null).integrationTypes.find((t) => isPaymentsProvider(t));

test('ALLOW (W25-10ca): Cobalt\'s catalog shop reads its products from Stripe, so its product pages title from the product', () => {
  assert.equal(providerOf(COBALT_SHOP), 'stripe');
  assert.equal(readsProviderProduct(COBALT_SHOP, providerOf(COBALT_SHOP)), true);
  const { title } = productItemMetaText({ itemTitle: 'Cookie box', itemDescription: undefined, siteName: 'Cobalt & Crumb', patternTitle: undefined, patternDescription: undefined, pageSubtitle: undefined, pageName: COBALT_SHOP.name });
  assert.equal(title, 'Cookie box | Cobalt & Crumb');
});

test('REFUSE (W25-10ca): a catalog with no payments binding does not read the provider (it stays on its collection)', () => {
  const page = { slug: 'menu', name: 'Menu', format: 'catalog', blocks: [{ id: 'c', type: { kind: 'page-template', dispatchId: 'catalog' }, config: { bindings: [{ collectionId: 'c1' }] } }] } as unknown as PageConfig;
  assert.equal(readsProviderProduct(page, providerOf(page)), false);
});

test('PIN (W25-10ca): the detail metadata gates the product title on readsProviderProduct, not on the format', () => {
  const route = fs.readFileSync(new URL('../../app/[slug]/[itemId]/page.tsx', import.meta.url), 'utf8');
  const meta = route.slice(route.indexOf('export async function generateMetadata'));
  assert.ok(meta.length > 100, 'generateMetadata not found, this pin is vacuous');
  assert.ok(meta.includes('if (readsProviderProduct(pageConfig, metaPaymentsProvider)) {'), 'metadata must ask the render arm\'s question');
  assert.ok(!meta.includes('if (pageConfig.format === "products") {'), 'the format gate is the W25-10ca defect');
});

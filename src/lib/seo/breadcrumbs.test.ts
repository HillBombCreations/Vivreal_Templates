import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SiteData } from '@/types/SiteData';
import { breadcrumbOrigin, detailCrumbs } from './breadcrumbs.ts';
// The renderer's own builder, by file path: its package entry point loads React
// components the plain-Node runner cannot, and this module is pure.
import { breadcrumbListJsonLd } from '../../../node_modules/@hillbombcreations/site-renderer/dist/lib/breadcrumbs.js';

// Cast: a fixture carries only the origin fields.
const LIVE = { lifecycleState: 'live', canonicalUrl: 'https://cobaltcrumb.com' } as SiteData;
const DEMO = { lifecycleState: 'demo', domainInformation: { live_url: 'https://cobalt-crumb.vivreal.io' } } as SiteData;

test('ALLOW (R3): a product page carries Home, the shop and the product', () => {
  const trail = detailCrumbs({ page: { name: 'shop', labels: { title: 'Shop' } }, slug: '/shop', itemSegment: 'p1', itemName: 'Cinnamon roll' });
  const ld = breadcrumbListJsonLd(breadcrumbOrigin(LIVE), trail);
  assert.deepEqual(ld?.itemListElement.map((c) => [c.position, c.name, c.item]), [
    [1, 'Home', 'https://cobaltcrumb.com/'],
    [2, 'Shop', 'https://cobaltcrumb.com/shop'],
    [3, 'Cinnamon roll', 'https://cobaltcrumb.com/shop/p1'],
  ]);
});

test('REFUSE (R3): an item with no name gives no breadcrumb rather than a partial one', () => {
  const trail = detailCrumbs({ page: { name: 'Shop', labels: {} }, slug: 'shop', itemSegment: 'p1', itemName: '  ' });
  assert.equal(breadcrumbListJsonLd(breadcrumbOrigin(LIVE), trail), null);
});

test('REFUSE (R3): a prospect demo emits no breadcrumb (no addresses on a demo)', () => {
  const trail = detailCrumbs({ page: { name: 'Shop', labels: {} }, slug: 'shop', itemSegment: 'p1', itemName: 'Roll' });
  assert.equal(breadcrumbOrigin(DEMO), '');
  assert.equal(breadcrumbListJsonLd(breadcrumbOrigin(DEMO), trail), null);
});

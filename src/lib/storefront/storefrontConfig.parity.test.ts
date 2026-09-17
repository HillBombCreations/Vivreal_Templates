import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storefrontSectionConfigOf } from './storefrontConfig.ts';
// The renderer's compiled resolver, imported by PATH: the package barrel pulls
// `next/link`, which plain Node cannot resolve (the siteFont.test.ts and
// productOffer.test.ts precedent). The module has no imports of its own.
import { resolveStorefrontSectionConfig } from '../../../node_modules/@hillbombcreations/site-renderer/dist/composition/storefrontConfig.js';

const IN = { purchaseMode: 'inquiry' };
const SHOP = { shell: 'vitrine-storefront' };
const products = (bindings: unknown[], extra: Record<string, unknown> = {}) => ({ type: { kind: 'page-template', dispatchId: 'products' }, config: { bindings }, ...extra });
const grid = (bindings: unknown[], extra: Record<string, unknown> = {}) => ({ type: { kind: 'layout', dispatchId: 'products-grid' }, config: { bindings }, ...extra });
const group = (children: unknown[], extra: Record<string, unknown> = {}, coordinated?: string) => ({
  type: { kind: 'group', dispatchId: 'group' },
  config: { children, ...(coordinated ? { coordinated } : {}) },
  ...extra,
});

const PAGES: Array<[string, { blocks?: unknown } | null | undefined]> = [
  ['no page', undefined],
  ['null page', null],
  ['no blocks', {}],
  ['blocks not a list', { blocks: 'x' }],
  ['monolith, first binding', { blocks: [products([{ sectionConfig: IN }, { sectionConfig: SHOP }])] }],
  ['monolith, first binding has no config', { blocks: [products([{}, { sectionConfig: IN }])] }],
  ['disabled monolith, then a live one', { blocks: [products([{ sectionConfig: IN }], { enabled: false }), products([{ sectionConfig: SHOP }])] }],
  ['coordinated grid', { blocks: [group([grid([{ sectionConfig: IN }])], {}, 'products')] }],
  ['coordinated, grid disabled, then a monolith', { blocks: [group([grid([{ sectionConfig: IN }], { enabled: false })], {}, 'products'), products([{ sectionConfig: SHOP }])] }],
  ['coordinated, no grid', { blocks: [group([], {}, 'products')] }],
  ['nested in a plain group', { blocks: [group([products([{ sectionConfig: IN }])])] }],
  ['nested in a disabled group, then a live one', { blocks: [group([products([{ sectionConfig: IN }])], { enabled: false }), products([{ sectionConfig: SHOP }])] }],
  ['junk blocks around a storefront', { blocks: [null, 7, { type: { kind: 'layout', dispatchId: 'faq' } }, products([{ sectionConfig: SHOP }])] }],
  ['array order differs from order', { blocks: [products([{ sectionConfig: IN }], { order: 2 }), products([{ sectionConfig: SHOP }], { order: 1 }), group([products([{ sectionConfig: IN }], { order: 4 }), products([{ sectionConfig: SHOP }], { order: 0 })], { order: 3 })] }],
];

test('the bag gate reads exactly the binding the renderer listing reads, for every shape', () => {
  assert.ok(PAGES.length >= 13, 'built the cases');
  for (const [name, page] of PAGES) {
    assert.deepEqual(storefrontSectionConfigOf(page), resolveStorefrontSectionConfig(page), name);
  }
});

test('the parity is not vacuous: the renderer finds a config in most cases', () => {
  const found = PAGES.filter(([, page]) => resolveStorefrontSectionConfig(page) !== undefined);
  assert.ok(found.length >= 7, `renderer found ${found.length} configs`);
});

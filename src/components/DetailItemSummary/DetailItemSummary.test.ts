import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
// The renderer's detail template and section resolver, imported by PATH for
// the reason `src/lib/titleBandAdoption.test.ts` documents: the package barrel
// pulls `next/link`, which Node's resolver rejects outside a Next build. These
// two modules load standalone. The first test below fails loudly if the
// template stops rendering, so a moved dist path cannot pass on nothing.
import DetailPageTemplateModule from '../../../node_modules/@hillbombcreations/site-renderer/dist/DetailPage/DetailPageTemplate.js';
import { resolveDetailSections } from '../../../node_modules/@hillbombcreations/site-renderer/dist/types/DetailPage.js';
import { renderItemDetail, resolveItemSummary } from './index.ts';
import { withoutUnsafeHeroLink } from '../../lib/detail/itemSummary.ts';
import type { LinkPage } from '../../lib/detail/linkedItems.ts';
import type { DetailPageConfig } from '@hillbombcreations/site-renderer';

/**
 * V7 F-D1, review C1: the item page's composition, rendered for real.
 *
 * The collection, menu and products arms of `[slug]/[itemId]/page.tsx` all
 * hand their template to `renderItemDetail` (pinned by that route's
 * `page.test.ts`), so rendering it here with the renderer's own
 * `DetailPageTemplate` and the walk's data renders what the visitor gets: the
 * role page's heading, then its location, then an Apply link to the authored
 * URL. Before this the only proof was a scratch harness that was not kept.
 */

// Cast: the dist module's declared props are the renderer's template props;
// the test passes the same props the route passes.
const DetailPageTemplate = DetailPageTemplateModule as unknown as ComponentType<Record<string, unknown>>;

const COLLECTION = '6ad6ec892d800eff033fa56d';
const APPLY = 'https://example.com/qa-test-apply-2026-10-20';
const ROLE_RAW = { title: 'QA TEST Baker role 2026-10-20', location: 'Knoxville', type: 'Full Time', link: APPLY };

// What the Studio switch writes: no fields, no sections.
const ROLE_DETAIL: DetailPageConfig = { enabled: true, itemCollectionId: COLLECTION };
const page: LinkPage = {
  slug: 'qa-test-careers-2026-10-20',
  format: 'standard',
  detailPage: ROLE_DETAIL,
  blocks: [{ type: { kind: 'layout', dispatchId: 'positions' }, config: { bindings: [{ collectionId: COLLECTION, displayAs: 'positions' }] } }],
};

function render(raw: Record<string, unknown>, opts: { source?: boolean } = {}) {
  const item = { id: '6ad6ec892d800eff033fa576', title: String(raw.title ?? ''), href: undefined, source: 'collection', raw };
  const props = {
    slug: page.slug,
    format: page.format,
    item: withoutUnsafeHeroLink(item),
    siteData: { primary: '#aa3333', pageConfigs: [{ slug: page.slug, name: 'QA TEST careers 2026-10-20' }] },
    detailPage: ROLE_DETAIL,
  };
  // As the route does: the summary is decided first, then handed to the render.
  const summary =
    opts.source === false
      ? undefined
      : resolveItemSummary({
          page,
          pages: [page],
          collectionId: COLLECTION,
          item,
          format: page.format,
          detailPage: props.detailPage,
          sections: resolveDetailSections(page.format, props.detailPage),
        });
  const element = renderItemDetail({
    Template: DetailPageTemplate,
    resolveSections: resolveDetailSections,
    format: page.format,
    props,
    summary,
    accent: '#aa3333',
  });
  return { html: renderToStaticMarkup(element), props };
}

test('ALLOW (F-D1): the role page renders its heading, then its location, then Apply to the authored URL', () => {
  const { html } = render(ROLE_RAW);
  const h1 = html.indexOf('<h1');
  assert.ok(h1 >= 0, 'the template rendered no heading; every assertion below would be vacuous');
  const anchor = /<a [^>]*data-detail-item-action[^>]*>([^<]*)<\/a>/.exec(html);
  assert.ok(anchor, 'no action link rendered');
  assert.equal(anchor[1], 'Apply');
  assert.match(anchor[0], new RegExp(`href="${APPLY.split('.').join('[.]')}"`));
  assert.match(anchor[0], /target="_blank"/);
  assert.match(anchor[0], /rel="noopener noreferrer"/);
  assert.match(anchor[0], /aria-label="Apply: QA TEST Baker role 2026-10-20 \(opens in a new tab\)"/);
  const location = html.indexOf('>Knoxville<');
  assert.ok(location > h1, 'the location renders under the heading');
  assert.ok(html.indexOf('data-detail-item-action') > location, 'the button follows the facts');
  assert.equal(html.match(/<h1/g)?.length, 1, 'the split renders the hero once');
});

test('REFUSE (F-D1): an item with nothing to draw renders the single template, byte for byte', () => {
  const plain = { title: 'Plain role' };
  const { html, props } = render(plain);
  assert.ok(html.includes('<h1'), 'non-vacuous: the template rendered');
  assert.equal(html, renderToStaticMarkup(createElement(DetailPageTemplate, props)));
  assert.doesNotMatch(html, /data-detail-item-summary/);
});

test('REFUSE (F-D1): no source, no summary, even for an item with a link', () => {
  const { html } = render(ROLE_RAW, { source: false });
  assert.ok(html.includes('<h1'));
  assert.doesNotMatch(html, /data-detail-item-action/);
  assert.doesNotMatch(html, new RegExp(APPLY.split('.').join('[.]')));
});

test('REFUSE: a javascript: link with a ctaLabel renders no javascript: href anywhere on the page', () => {
  const { html } = render({ title: 'Role', link: 'javascript:alert(1)', ctaLabel: 'Go' });
  assert.ok(html.includes('<h1'));
  assert.doesNotMatch(html, /href="javascript:/i);
});

// Delta 2 review, BLOCK 1: on a product page the hero draws the size picker
// and the buy box INSIDE itself, gated on its own instance listing `variants`
// and `addToCart`. A split that kept only `hero` in the first instance drew a
// product nobody could buy.
const PRODUCT_COLLECTION = 'c-products';
const PRODUCT_DETAIL: DetailPageConfig = { enabled: true, itemCollectionId: PRODUCT_COLLECTION };
const productPage: LinkPage = {
  slug: 'shop',
  format: 'products',
  detailPage: PRODUCT_DETAIL,
  blocks: [{ type: { kind: 'layout' }, config: { bindings: [{ collectionId: PRODUCT_COLLECTION, displayAs: 'product-tiles' }] } }],
};

function renderProduct(withSummary: boolean) {
  const raw = { title: 'Tour shirt', meta: 'Organic cotton', orderUrl: 'https://shop.example.com/tour-shirt' };
  const product = { _id: 'p1', name: 'Tour shirt', price: '25', imageUrl: '', usingVariant: { name: 'Size', values: ['S', 'M'] }, raw };
  const props = {
    slug: productPage.slug,
    format: 'products',
    item: product,
    siteData: { primary: '#1a1a2e', pageConfigs: [{ slug: productPage.slug, name: 'Shop' }] },
    detailPage: PRODUCT_DETAIL,
  };
  const sections = resolveDetailSections('products', props.detailPage);
  const summary = withSummary
    ? resolveItemSummary({ page: productPage, pages: [productPage], collectionId: PRODUCT_COLLECTION, item: { title: 'Tour shirt', raw }, format: 'products', detailPage: props.detailPage, sections })
    : undefined;
  return renderToStaticMarkup(
    renderItemDetail({ Template: DetailPageTemplate, resolveSections: resolveDetailSections, format: 'products', props, summary }),
  );
}

const sizeButtons = (html: string) => html.match(/<button[^>]*aria-label="(S|M)"/g) ?? [];
// The buy box: "Add to cart" with a cart adapter, "Cart unavailable" without
// one (this render has none). Either is the buy box; its absence is the bug.
const BUY_BOX = /Add to cart|Cart unavailable/;

test('REFUSE (delta 2 BLOCK 1): a product page that draws the summary keeps its size picker and its buy box', () => {
  const plain = renderProduct(false);
  assert.equal(sizeButtons(plain).length, 2, 'non-vacuous: without a summary the product has two size buttons');
  assert.match(plain, BUY_BOX, 'non-vacuous: without a summary the product has its buy box');
  const withSummary = renderProduct(true);
  assert.match(withSummary, /data-detail-item-action/, 'the summary drew');
  assert.equal(sizeButtons(withSummary).length, 2, 'the size buttons survive the summary');
  assert.match(withSummary, BUY_BOX, 'the buy box survives the summary');
  assert.ok(withSummary.search(BUY_BOX) < withSummary.indexOf('data-detail-item-summary'), 'the summary sits under the buy box');
});

// Delta 2 review D2-C1: a look's product page splits too, with the summary
// right under the look, not after the whole page.
function renderLook(lookShell: boolean) {
  const raw = { title: 'Tour shirt', orderUrl: 'https://shop.example.com/tour-shirt' };
  const product = { _id: 'p1', name: 'Tour shirt', price: '25', imageUrl: '', usingVariant: { name: 'Size', values: ['S', 'M'] }, raw };
  const detailPage: DetailPageConfig = { ...PRODUCT_DETAIL, sections: ['hero', 'variants', 'addToCart', 'vitals', 'related', 'cta'] };
  const props = {
    slug: productPage.slug,
    format: 'products',
    item: product,
    siteData: { primary: '#1a1a2e', pageConfigs: [{ slug: productPage.slug, name: 'Shop' }] },
    detailPage,
    storefrontConfig: { shell: 'cobalt-crumb-storefront' },
    productSource: raw,
    collectionItems: [],
  };
  const summary = resolveItemSummary({
    page: productPage,
    pages: [productPage],
    collectionId: PRODUCT_COLLECTION,
    item: { title: 'Tour shirt', raw },
    format: 'products',
    detailPage,
    sections: resolveDetailSections('products', detailPage),
  });
  return renderToStaticMarkup(
    renderItemDetail({ Template: DetailPageTemplate, resolveSections: resolveDetailSections, format: 'products', props, summary, lookShell }),
  );
}

const lookPages = (html: string) => (html.match(/data-vivreal-product-page/g) ?? []).length;

test('ALLOW (delta 2 D2-C1): a look product page draws its look once, with the summary right under it', () => {
  const html = renderLook(true);
  assert.equal(lookPages(html), 1);
  assert.match(html, /data-detail-item-action/, 'the summary drew');
  assert.ok(html.indexOf('data-vivreal-product-page') < html.indexOf('data-detail-item-summary'), 'the summary follows the look');
  // Control: without the look flag the second half claims `vitals`, and the
  // look draws a second time. This is what the flag exists to prevent.
  assert.equal(lookPages(renderLook(false)), 2, 'non-vacuous: the drop is what keeps the look single');
});

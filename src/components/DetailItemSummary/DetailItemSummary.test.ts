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
import { renderItemDetail } from './index.ts';
import { withoutUnsafeHeroLink } from '../../lib/detail/itemSummary.ts';
import type { LinkPage } from '../../lib/detail/linkedItems.ts';

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

const page: LinkPage = {
  slug: 'qa-test-careers-2026-10-20',
  format: 'standard',
  // What the Studio switch writes: no fields, no sections.
  detailPage: { enabled: true, itemCollectionId: COLLECTION },
  blocks: [{ type: { kind: 'layout', dispatchId: 'positions' }, config: { bindings: [{ collectionId: COLLECTION, displayAs: 'positions' }] } }],
};

function render(raw: Record<string, unknown>, opts: { source?: boolean; split?: boolean } = {}) {
  const item = { id: '6ad6ec892d800eff033fa576', title: String(raw.title ?? ''), href: undefined, source: 'collection', raw };
  const props = {
    slug: page.slug,
    format: page.format,
    item: withoutUnsafeHeroLink(item),
    siteData: { primary: '#aa3333', pageConfigs: [{ slug: page.slug, name: 'QA TEST careers 2026-10-20' }] },
    detailPage: page.detailPage,
  };
  const element = renderItemDetail({
    Template: DetailPageTemplate,
    resolveSections: resolveDetailSections,
    format: page.format,
    props,
    source: opts.source === false ? undefined : { page, pages: [page], collectionId: COLLECTION, item },
    accent: '#aa3333',
    split: opts.split,
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

test('split: false draws the summary after the whole template (a product page on a look shell)', () => {
  const { html, props } = render(ROLE_RAW, { split: false });
  const whole = renderToStaticMarkup(createElement(DetailPageTemplate, props));
  assert.ok(whole.includes('<h1'), 'non-vacuous: the template rendered');
  assert.ok(html.startsWith(whole), 'the unsplit template comes first, unchanged');
  assert.match(html.slice(whole.length), /^<section data-detail-item-summary=""/);
});

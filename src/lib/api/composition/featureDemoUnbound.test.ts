/**
 * Renderer 1.98.0 (open-backlog R-1c, Templates T-1): a Feature Demo section
 * with nothing bound to it draws NOTHING. At 1.97.0 and before, the layout fell
 * back to four built-in tabs that were this product's own tour, and an owner
 * who added the section to a Blank page and bound nothing saw that tour on
 * their own site.
 *
 * Every fixture runs through the REAL installed renderer (its composition
 * module, by path: the package entry imports `next/link`, which plain Node
 * cannot load), through Templates' own site-data hand-off and item mapper, and
 * through Templates' own "does the page draw" verdict, the way
 * `buildPageContext` and `renderComposedPage` decide what a visitor gets. The
 * REFUSE rows are red on a tree that installs 1.97.0 (the tour paints and the
 * page is served); the ALLOW rows hold on both.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PageConfig, SiteData } from '@/types/SiteData';
import * as composition from '../../../../node_modules/@hillbombcreations/site-renderer/dist/composition/composePage.js';
import { SiteRendererProvider } from '../../../../node_modules/@hillbombcreations/site-renderer/dist/context/SiteRendererContext.js';
import { decidePageEmptiness, emptinessIsDecidable, type PageDataRead } from './pageEmptiness.ts';
import { toRendererSiteData } from './rendererSiteData.ts';
import { toContentItem } from '../collections/mapItem.ts';

type Answer = '404' | '200' | 'refused';

const SITE = { name: 'Fixture Bakery', timezone: 'America/Chicago', socialLinks: [] } as unknown as SiteData; // Only the fields these pages read.

/** Words only the retired built-in tour drew (its fourth tab). */
const TOUR_MARKER = 'Integration Sync';

const FEATURES = '6a0000000000000000000f01';

/** A Feature Demo section as Studio stores it: bound to a list, or to nothing. */
const featureDemo = (collectionId?: string) => ({
  id: 'fd1',
  type: { kind: 'layout', dispatchId: 'feature-demo' },
  order: 0,
  enabled: true,
  config: { bindings: [{ ...(collectionId ? { collectionId } : {}), displayAs: 'feature-demo', role: 'primary' }] },
});

/** A section header, the control that a Blank page with one drawing section is served. */
const SECTION_HEADER = { id: 'sh1', type: { kind: 'static', dispatchId: 'section-header' }, order: 0, enabled: true, config: { labels: { title: 'What we do', subtitle: 'Three things' } } };

/** A Blank page made in Studio ("Add a page, Blank"), with these sections. */
const blankPage = (slug: string, blocks: unknown[]): PageConfig =>
  ({ name: slug, slug, format: 'standard', collectionId: null, blocks, collections: [], integrations: [], enabled: true }) as unknown as PageConfig;

const read = (sourceCount: number): PageDataRead => ({ sourceCount, degraded: false, fromFloor: false });

/** What `buildPageContext` hands `composePage` (its step 4), from stored rows. */
function composeInput(page: PageConfig, mode: 'live' | 'preview', rows: Record<string, Record<string, unknown>[]> = {}) {
  const items = new Map(Object.entries(rows).map(([id, list]) => [id, list.map((row) => toContentItem(row, 'collection'))]));
  return {
    page,
    pages: [page],
    data: {
      getItems: (id: string) => items.get(id) ?? [],
      getIntegrationItems: () => [],
      siteData: toRendererSiteData(SITE),
    },
    isHome: false,
    options: { mode, emitSectionAnchors: false },
  } as unknown as Parameters<typeof composition.composePage>[0]; // Templates' page and site types are the stored shapes the renderer reads.
}

/** The page answer, with the renderer's verdict wired the way `buildPageContext` wires it. */
function answer(page: PageConfig, reads: readonly PageDataRead[], input: ReturnType<typeof composeInput>): Answer {
  if (!emptinessIsDecidable(page)) return '200';
  const verdict = decidePageEmptiness({
    isHome: false,
    format: page.format,
    blocks: page.blocks,
    hero: (page as { hero?: unknown }).hero,
    reads,
    drawsContent: () => composition.pageDrawsContent(input),
  });
  if (verdict.emptinessUnknown) return 'refused';
  return verdict.isEmpty ? '404' : '200';
}

/** What the visitor would see, rendered by the real `composePage`. */
const rendered = (input: ReturnType<typeof composeInput>): string =>
  renderToStaticMarkup(createElement(SiteRendererProvider, { children: composition.composePage(input) } as never)); // JS leaf import: its props type is not resolved by path.

const sectionCount = (html: string): number => (html.match(/<section/g) ?? []).length;

test('REFUSE (R-1c): an unbound Feature Demo draws no tabs, on the live page and in the Studio preview', () => {
  // The section shell itself is the renderer's and unchanged: live, an
  // unbound binding shows its "nothing here yet" notice; in preview, the
  // empty slot the owner fills. What the layout drew INSIDE that shell at
  // 1.97.0 was the four built-in tour tabs; at 1.98.0 it draws nothing.
  const page = blankPage('features', [featureDemo()]);
  for (const mode of ['live', 'preview'] as const) {
    const html = rendered(composeInput(page, mode));
    assert.ok(!html.includes(TOUR_MARKER), `${mode}: the product's own tour never paints on a customer page`);
    assert.equal((html.match(/role="tab"/g) ?? []).length, 0, `${mode}: no tab is drawn for a section with no rows`);
  }
});

test('REFUSE (R-1c): a Feature Demo bound to an EMPTY list draws nothing on the live page', () => {
  const page = blankPage('features', [featureDemo(FEATURES)]);
  const input = composeInput(page, 'live', { [FEATURES]: [] });
  const html = rendered(input);
  assert.ok(!html.includes(TOUR_MARKER), 'an empty list is not an invitation to paint the tour');
  assert.equal(sectionCount(html), 0);
  assert.equal(answer(page, [read(0)], input), '404');
});

test('ALLOW: a Feature Demo bound to a list with rows draws those rows, and only those', () => {
  const page = blankPage('features', [featureDemo(FEATURES)]);
  const rows = [
    { _id: '6a0000000000000000000e01', objectValue: { title: 'Fresh bread daily', description: 'Baked before dawn.', demo: 'content' } },
    { _id: '6a0000000000000000000e02', objectValue: { title: 'Order ahead', description: 'Ready when you arrive.', demo: 'schedule' } },
  ];
  const input = composeInput(page, 'live', { [FEATURES]: rows });
  const html = rendered(input);
  assert.ok(html.includes('Fresh bread daily') && html.includes('Order ahead'), 'the owner\'s own tabs draw');
  assert.ok(!html.includes(TOUR_MARKER), 'never the built-in tour beside them');
  assert.ok(sectionCount(html) >= 1);
  assert.equal(answer(page, [read(rows.length)], input), '200');
});

test('ALLOW (control): a Blank page holding one section header is served and drawn', () => {
  const page = blankPage('about', [SECTION_HEADER]);
  const input = composeInput(page, 'live');
  assert.equal(answer(page, [], input), '200');
  assert.ok(rendered(input).includes('What we do'), 'the header draws its title');
});

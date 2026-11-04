/**
 * D-10 (local walk 3, 2026-11-04): a Blank page whose sections are an Opening
 * hours section and/or a "Your social posts" panel with follow links answered
 * "404 Oops! Page not found" to every visitor, while it draws both.
 *
 * Cause: the empty-page rule in `./pageEmptiness.ts` is a Templates copy of
 * "what draws". It counts forms, labelled static blocks, an authored hero and
 * list rows, and nothing else. Hours read from the business hours and a
 * panel's own follow links are none of those, so the page was "empty".
 *
 * Fix: serve when the current rule serves OR the renderer's own
 * `pageDrawsContent(input)` (1.96.4) says the page draws, over the same input
 * `composePage` renders. An OR, never a replacement: the renderer says a
 * privacy page whose list holds only kit starter text draws nothing (it hides
 * the text), and the current rule serves that page.
 *
 * Every fixture runs through the REAL renderer (its composition module, by
 * path: the package entry imports `next/link`, which plain Node cannot load)
 * and through Templates' own site-data hand-off and item mapper, the way
 * `buildPageContext` builds the input. `buildPageContext` itself imports
 * `server-only`, so its one wiring line is pinned by source at the end.
 *
 * "Answers" below is `renderComposedPage`'s order, above its Suspense
 * boundary: a page whose emptiness is not decidable is served, an unknown
 * verdict is refused, an empty one is a 404, anything else is served.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PageConfig, SiteData } from '@/types/SiteData';
// A namespace import, so this file still loads on a renderer without the
// export (1.96.3, where the red run happens) and fails on its assertions.
import * as composition from '../../../../node_modules/@hillbombcreations/site-renderer/dist/composition/composePage.js';
import { SiteRendererProvider } from '../../../../node_modules/@hillbombcreations/site-renderer/dist/context/SiteRendererContext.js';
import { isSeedOnlyPage } from '../../../../node_modules/@hillbombcreations/site-renderer/dist/composition/seedOnlyPage.js';
import { decidePageEmptiness, emptinessIsDecidable, type PageDataRead } from './pageEmptiness.ts';
import { toRendererSiteData } from './rendererSiteData.ts';
import { toContentItem } from '../collections/mapItem.ts';

type Answer = '404' | '200' | 'refused';

/** QA scratch-2's business hours shape (`businessInfo.hours.weekly`), with open days. */
const SITE_WITH_HOURS = {
  name: 'QA scratch-2 site',
  timezone: 'America/Phoenix',
  businessInfo: {
    name: 'QA scratch-2 site',
    hours: { weekly: ['Mon: 9am - 5pm', 'Tue: 9am - 5pm', 'Wed: 9am - 5pm', 'Thu: 9am - 5pm', 'Fri: 9am - 5pm', 'Sat: Closed', 'Sun: Closed'] },
  },
  socialLinks: [],
} as unknown as SiteData; // Only the fields these pages read.

/** The same site before the owner set any hours. */
const SITE_WITHOUT_HOURS = { name: 'QA scratch-2 site', timezone: 'America/Phoenix', socialLinks: [] } as unknown as SiteData;

const PANEL_X = 'https://x.com/e2e1103panel';

/** The stored D-10 Social panel block, byte for byte from QA2's `/e2e-1103-w3` (`[social-panel enabled, ...]`). */
const socialPanel = (links: { platform: string; href: string }[]) => ({
  id: '4f0fbae3-1f3a-4273-8deb-805419e327b2',
  type: { kind: 'layout', dispatchId: 'social-panel' },
  order: 0,
  enabled: true,
  config: {
    bindings: [
      {
        displayAs: 'social-panel',
        enabled: true,
        integrationProvider: 'instagram',
        sectionConfig: { followLabel: 'Follow us', newsletterLabel: 'Newsletter', emailPlaceholder: 'E-MAIL', submitLabel: 'OK', socialLinks: links },
      },
    ],
  },
});
const PANEL_WITH_X = socialPanel([{ platform: 'instagram', href: '' }, { platform: 'x', href: PANEL_X }]);
const PANEL_WITHOUT_LINKS = socialPanel([{ platform: 'instagram', href: '' }]);

/** The stored D-10 Opening hours block: no labels of its own, it draws the business hours. */
const OPENING_HOURS = { id: '77de4357-f302-4212-9442-960ae29d9715', type: { kind: 'static', dispatchId: 'opening-hours' }, order: 1, enabled: true };

/** A Blank page made in Studio ("Add a page, Blank"), with these sections. */
const blankPage = (slug: string, blocks: unknown[]): PageConfig =>
  ({ name: slug, slug, format: 'standard', collectionId: null, blocks, collections: [], integrations: [], enabled: true }) as unknown as PageConfig;

/** One read that answered with this many rows. */
const read = (sourceCount: number, degraded = false): PageDataRead => ({ sourceCount, degraded, fromFloor: false });

/** The instagram feed read the panel binds, as `buildPageContext` reports an empty feed. */
const EMPTY_FEED = [read(0)];

/** What `buildPageContext` hands `composePage` (its step 4), from stored rows. */
function composeInput(page: PageConfig, site: SiteData, rows: Record<string, Record<string, unknown>[]> = {}) {
  const items = new Map(Object.entries(rows).map(([id, list]) => [id, list.map((row) => toContentItem(row, 'collection'))]));
  return {
    page,
    pages: [page],
    data: {
      getItems: (id: string) => items.get(id) ?? [],
      getIntegrationItems: () => [],
      siteData: toRendererSiteData(site),
    },
    isHome: false,
    options: { mode: 'live', emitSectionAnchors: false },
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

/** The current rule alone: what the page answered before D-10. */
function answerWithoutRenderer(page: PageConfig, reads: readonly PageDataRead[]): Answer {
  const verdict = decidePageEmptiness({ isHome: false, format: page.format, blocks: page.blocks, reads, drawsContent: () => false });
  if (verdict.emptinessUnknown) return 'refused';
  return verdict.isEmpty ? '404' : '200';
}

/** What the visitor would see, rendered by the real `composePage`. */
const rendered = (input: ReturnType<typeof composeInput>): string =>
  renderToStaticMarkup(createElement(SiteRendererProvider, { children: composition.composePage(input) } as never)); // JS leaf import: its props type is not resolved by path.

const sectionCount = (html: string): number => (html.match(/<section/g) ?? []).length;

/** The hours section's own marker, and Monday's row drawn from the business hours. */
const HOURS_DRAWN = (html: string): boolean =>
  html.includes('data-vivreal-role="opening-hours"') && html.includes('>Mon</dt>') && html.includes('>9am - 5pm</dd>');

// ---------------------------------------------------------------------------
// ALLOW: the D-10 pages are served
// ---------------------------------------------------------------------------

test('D-10 ALLOW (a): a Blank page with only an Opening hours section is served', () => {
  const page = blankPage('e2e-1103-hours', [OPENING_HOURS]);
  const input = composeInput(page, SITE_WITH_HOURS);
  assert.equal(answer(page, [], input), '200', 'the page draws the business hours, so it is served');
  // Controls: the current rule alone 404s it (this is the D-10 shape), and the
  // real render draws the hours.
  assert.equal(answerWithoutRenderer(page, []), '404');
  assert.ok(HOURS_DRAWN(rendered(input)), 'the hours section renders the business hours');
});

test('D-10 ALLOW (b): a Blank page with only a Social panel with a follow link is served', () => {
  const page = blankPage('e2e-1103-panel', [PANEL_WITH_X]);
  const input = composeInput(page, SITE_WITH_HOURS);
  assert.equal(answer(page, EMPTY_FEED, input), '200', 'the panel draws its X follow link, so it is served');
  assert.equal(answerWithoutRenderer(page, EMPTY_FEED), '404');
  assert.ok(rendered(input).includes(`href="${PANEL_X}"`), 'the panel renders its X link');
});

test('D-10 ALLOW (c): QA2 "E2E-1103 W3", the Social panel and Opening hours together, is served', () => {
  const page = blankPage('e2e-1103-w3', [PANEL_WITH_X, OPENING_HOURS]);
  const input = composeInput(page, SITE_WITH_HOURS);
  assert.equal(answer(page, EMPTY_FEED, input), '200');
  assert.equal(answerWithoutRenderer(page, EMPTY_FEED), '404', 'the walk saw this page answer 404');
  const html = rendered(input);
  assert.ok(html.includes(`href="${PANEL_X}"`), 'the panel link renders');
  assert.ok(HOURS_DRAWN(html), 'the hours render');
});

test('D-10 ALLOW: the W3 page with a FAILED feed read is served, not refused, because it draws without the feed', () => {
  // A failed read on a page whose body is only its lists is refused (a 5xx,
  // "come back later"). This page draws its hours and link whatever the feed
  // says, like a page with authored copy beside a list: served, and the caller
  // renders the "part of this page could not load" notice (listReadFailed).
  const page = blankPage('e2e-1103-w3', [PANEL_WITH_X, OPENING_HOURS]);
  const input = composeInput(page, SITE_WITH_HOURS);
  assert.equal(answer(page, [read(0, true)], input), '200');
  assert.equal(answerWithoutRenderer(page, [read(0, true)]), 'refused', 'control: the current rule refuses it');
});

// ---------------------------------------------------------------------------
// REFUSE: an empty page still answers 404
// ---------------------------------------------------------------------------

test('D-10 REFUSE (d): a truly empty Blank page still answers 404', () => {
  const page = blankPage('e2e-1103-empty', []);
  const input = composeInput(page, SITE_WITH_HOURS);
  assert.equal(answer(page, [], input), '404');
  assert.equal(sectionCount(rendered(input)), 0, 'control: the real render draws no section');
});

test('D-10 REFUSE (d): the same two sections with nothing to draw still answer 404', () => {
  // No hours anywhere, a panel with no follow link and an empty feed: both
  // sections drop themselves, so the page is empty. Blocks alone never serve.
  const page = blankPage('e2e-1103-w3-bare', [PANEL_WITHOUT_LINKS, OPENING_HOURS]);
  const input = composeInput(page, SITE_WITHOUT_HOURS);
  assert.equal(answer(page, EMPTY_FEED, input), '404');
  assert.equal(sectionCount(rendered(input)), 0, 'control: the real render draws no section');
});

// ---------------------------------------------------------------------------
// REFUSE: the OR never takes a served page away
// ---------------------------------------------------------------------------

/** Kit starter text, as the privacy kits store it (clipper-lane-barbers `/privacy-policy`). */
const STARTER = '<p>Placeholder policy text. Replace with your own before you go live.</p>';
const STARTER_LIST = '6ac026a21934e918ac5ed8e6';
const starterRows = (shape: (heading: string) => Record<string, unknown>) =>
  ['Who sees it', 'Asking us to delete it', 'How long we keep it'].map((heading, i) => ({
    _id: `starter${i}`,
    objectValue: shape(heading),
    publishDate: '2026-08-03T16:09:27.225Z',
  }));
const listPage = (slug: string, dispatchId: string): PageConfig =>
  ({
    name: 'Privacy Policy',
    slug,
    format: 'standard',
    collectionId: null,
    labels: { title: 'Privacy Policy' },
    blocks: [
      {
        id: `blk_${slug}_layout_0`,
        type: { kind: 'layout', dispatchId },
        order: 0,
        enabled: true,
        config: { role: 'primary', bindings: [{ collectionId: STARTER_LIST, displayAs: dispatchId, role: 'primary' }] },
      },
    ],
    collections: [],
    integrations: [],
  }) as unknown as PageConfig;

test('D-10 REFUSE (e): a privacy page with only starter text, which the seed-only rule keeps, still answers 200', () => {
  // The starter text as FAQ answers. The seed-only rule (W25 C2) only hides a
  // page built from a hero, a header, an about block and editorial sections,
  // so the route serves this page, and the empty-page rule is what answers.
  const page = listPage('terms-of-use', 'faq');
  const rows = { [STARTER_LIST]: starterRows((question) => ({ question, answer: STARTER })) };
  const input = composeInput(page, SITE_WITH_HOURS, rows);
  assert.equal(answer(page, [read(3)], input), '200', 'its list read three rows: the current rule serves it, and the OR keeps it served');
  // Controls: the renderer hides all three starter rows, so the page draws no
  // section. A rule of "serve only what the renderer says draws" would 404 it.
  assert.equal(sectionCount(rendered(input)), 0, 'control: the starter text is hidden, no section draws');
  assert.equal(isSeedOnlyPage(page as never, { getItems: input.data.getItems } as never), false, 'control: the seed-only rule does not 404 this page first');
});

test('D-10 REFUSE (e): the kit privacy page (editorial sections of starter text) still gets the 200 from the empty-page rule', () => {
  // The fleet's own shape, 19 legal pages on 5 sites. On healthy data the
  // route's seed-only guard 404s it before this rule runs (W25 C2, owner
  // decision). That guard FAILS OPEN (a failed list read or a throw hides
  // nothing), and then this rule is what answers: it must still serve it.
  const page = listPage('privacy-policy', 'editorial-sections');
  const rows = { [STARTER_LIST]: starterRows((heading) => ({ heading, body: STARTER, mediaKeys: [] })) };
  const input = composeInput(page, SITE_WITH_HOURS, rows);
  assert.equal(answer(page, [read(3)], input), '200');
  assert.equal(sectionCount(rendered(input)), 0, 'control: no section draws');
  assert.equal(isSeedOnlyPage(page as never, { getItems: input.data.getItems } as never), true, 'control: this is the seed-only shape');
});

test('D-10 REFUSE: a page the current rule serves never runs the renderer predicate', (t) => {
  const page = blankPage('e2e-1103-list', [{ id: 'l', type: { kind: 'layout', dispatchId: 'cards' }, enabled: true, config: { bindings: [{ collectionId: 'abc' }] } }]);
  const drawsContent = t.mock.fn(() => false);
  const verdict = decidePageEmptiness({ isHome: false, format: 'standard', blocks: page.blocks, reads: [read(2)], drawsContent });
  assert.deepEqual(verdict, { isEmpty: false, emptinessUnknown: false });
  assert.equal(drawsContent.mock.callCount(), 0, 'a served page is not planned a second time');
});

// ---------------------------------------------------------------------------
// REFUSE: a malformed block keeps today's 404, never an earlier 500
// ---------------------------------------------------------------------------

test('D-10 REFUSE: a block the renderer cannot plan keeps the 404 it answers today, and is logged once', (t) => {
  // A block with no `type`: the renderer's plan throws on it, exactly where
  // composePage throws on the same input. This page answers 404 today without
  // ever being composed, so the throw must not turn that into a 500.
  const page = blankPage('e2e-1103-broken', [{ id: 'broken', enabled: true }]);
  const input = composeInput(page, SITE_WITH_HOURS);
  const logged = t.mock.method(console, 'error', () => {});
  assert.equal(answer(page, [], input), '404');
  assert.equal(logged.mock.callCount(), 1, 'the malformed block is reported, not swallowed');
  assert.equal(logged.mock.calls[0].arguments[0], '[pageEmptiness] pageDrawsContent threw, keeping the current verdict');
  assert.throws(() => composition.composePage(input), 'control: composePage throws on the same input');
});

// ---------------------------------------------------------------------------
// The wiring a plain-Node test cannot execute
// ---------------------------------------------------------------------------

test('SOURCE PIN (D-10): buildPageContext asks the renderer over the same input it hands composePage', () => {
  const code = readFileSync(new URL('./buildPageContext.ts', import.meta.url), 'utf8');
  assert.ok(code.includes('decidePageEmptiness('), 'sanity: this test read the verdict call');
  assert.ok(
    code.includes('drawsContent: () => pageDrawsContent(input),'),
    'the verdict must hear the renderer, lazily, over the exact composePage input',
  );
  assert.ok(code.includes("import { pageDrawsContent } from '@hillbombcreations/site-renderer';"), 'from the published package entry');
  assert.ok(code.includes("options: { mode: 'live', emitSectionAnchors: false },"), 'the input these fixtures copy');
});

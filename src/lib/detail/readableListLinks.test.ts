import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as readable from './readableSegment.ts';
import { resolveServingDetailRouteSlug } from '../../../node_modules/@hillbombcreations/site-renderer/dist/composition/detailRouteOwnership.js';
import { toContentItem } from '../api/collections/mapItem.ts';
import { composePage } from '../../../node_modules/@hillbombcreations/site-renderer/dist/composition/composePage.js';
import type { ContentItem, PageConfig as RendererPageConfig, SiteData as RendererSiteData } from '@hillbombcreations/site-renderer';

/**
 * Plan row T5 (4): the What's On cards and the team grid link a show or a team
 * member at its READABLE address directly, so a click costs no redirect. The
 * renderer (1.89.0, R1) links those lists by `itemSegment(item, itemKeyField)`;
 * Templates stamps each item with its T4 segment as `_system.slug` and sets the
 * binding's key field. The segment is the one the detail route answers on
 * (`resolveReadableSegment`), computed over the same list the route reads.
 *
 * Driven through the renderer's real `composePage` and rendered to HTML, so
 * what is asserted is the href a visitor clicks. Items go through the real list
 * mapper (`toContentItem`). On a tree without the change the lazy import
 * below is null and the page goes through untouched, so every ALLOW fails on
 * its href assertion, not on an import.
 */

type Items = ReadonlyMap<string, ContentItem[]>;
type Segments = ReadonlyMap<string, ReadonlyMap<string, string>>;
// Lazily imported so that, on a tree without the module, the page goes through
// untouched and the assertions fail rather than the import.
const mod = (await import('./readableListLinks.ts').catch(() => null)) as typeof import('./readableListLinks.ts') | null;
// Casts: the renderer's page type and this module's structural page type
// describe the same object; neither declares the other's optional keys.
const apply = (page: RendererPageConfig, items: Items, segments: Segments): { page: RendererPageConfig; itemsByCollection: Items } =>
  mod ? mod.applyReadableLinks(page as never, items, segments) as { page: RendererPageConfig; itemsByCollection: Items } : { page, itemsByCollection: items };
const plan = (page: RendererPageConfig, pages: readonly RendererPageConfig[]): ReadonlyMap<string, 'shows' | 'team'> =>
  mod ? mod.readableLinkCollections(page as never, pages as never) : new Map();

const SOON = '2099-07-24T05:00:00.000Z';
const fixture = JSON.parse(
  readFileSync(new URL('../seo/__fixtures__/liveDetailDates.json', import.meta.url), 'utf8'),
) as { shows: { _id: string; objectValue: Record<string, unknown> }[]; team: { _id: string; objectValue: Record<string, unknown> }[] };

// The live Comedy Collective rows (U4 capture), each show given a future date
// so What's On draws it.
const showDocs: typeof fixture.shows = fixture.shows.map((d) => ({ ...d, objectValue: { ...d.objectValue, date: SOON, time: '7:00 PM' } }));
const teamDocs = fixture.team;

/** The detail route's list, mapped the way `getShowsRead` / `getTeamMembersRead` map it. */
const detailShows = (docs: typeof showDocs) =>
  docs.map((d) => ({ id: d._id, title: d.objectValue.title as string, ...readable.cmsSlugField(d.objectValue) }));
const detailTeam = (docs: typeof teamDocs) =>
  docs.map((d) => ({ id: d._id, name: d.objectValue.name as string, ...readable.cmsSlugField(d.objectValue) }));

const siteData = {
  pages: {},
  pageConfigs: [],
  logo: { key: 'l', type: 'image', currentFile: { source: 's' } },
  primary: '#000',
} as unknown as RendererSiteData; // a minimal site shape; composition reads only these keys here

const whatsOn = (id = 'blk_whatson') => ({
  id,
  order: 0,
  enabled: true,
  type: { kind: 'layout', dispatchId: 'whats-on' },
  config: { bindings: [{ collectionId: 'shows1', displayAs: 'whats-on' }] },
});
const teamBlock = { id: 'blk_team', order: 0, enabled: true, type: { kind: 'page-template', dispatchId: 'team' }, config: { bindings: [{ collectionId: 'team1' }] } };

// Cast: page fixtures carry only the keys composition reads.
const pageOf = (p: Record<string, unknown>) => ({ labels: {}, collectionId: null, ...p }) as unknown as RendererPageConfig;
const showsPage = pageOf({ name: 'Shows', slug: 'shows', format: 'shows', blocks: [whatsOn()], detailPage: { enabled: true } });
const teamPage = pageOf({ name: 'Team', slug: 'team', format: 'team', blocks: [teamBlock], detailPage: { enabled: true } });
const homePage = pageOf({ name: 'Home', slug: 'home', format: 'home', blocks: [whatsOn('blk_home_whatson')] });

function render(page: RendererPageConfig, pages: RendererPageConfig[], items: Items): string {
  const node = composePage({
    page,
    pages,
    data: {
      siteData: { ...siteData, pageConfigs: pages } as RendererSiteData,
      getItems: (id: string) => items.get(id) ?? [],
      getIntegrationItems: () => [],
    },
    options: { mode: 'live' },
    isHome: page.slug === 'home',
  });
  return renderToStaticMarkup(createElement('div', null, node));
}

const hrefs = (html: string, prefix: string) =>
  [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]).filter((h) => h.startsWith(prefix));

/** Compose `page` as buildPageContext does: plan, read the detail lists, apply, render. */
function composeReadable(page: RendererPageConfig, pages: RendererPageConfig[], shows = showDocs, team = teamDocs) {
  const items = new Map<string, ContentItem[]>([
    ['shows1', shows.map((d) => toContentItem(d, 'collection') as ContentItem)],
    ['team1', team.map((d) => toContentItem(d, 'collection') as ContentItem)],
  ]);
  const segments = new Map<string, ReadonlyMap<string, string>>();
  for (const [collectionId, kind] of plan(page, pages)) {
    segments.set(collectionId, readable.readableSegments(kind === 'shows' ? detailShows(shows) : detailTeam(team)));
  }
  const applied = apply(page, items, segments);
  return { html: render(applied.page, pages, applied.itemsByCollection), applied, items };
}

/** Each href's segment is the canonical address the detail route serves (no redirect). */
function assertServedDirectly(links: string[], prefix: string, list: readable.ReadableItem[]) {
  assert.equal(links.length, list.length, 'sanity: one link per item');
  for (const href of links) {
    const resolved = readable.resolveReadableSegment(list, decodeURIComponent(href.slice(prefix.length)));
    assert.ok(resolved, `${href} resolves`);
    assert.equal(resolved.redirect, false, `${href} is served without a redirect`);
  }
}

const SITE = [homePage, showsPage, teamPage];

test("ALLOW: the shows page's What's On cards link each show at its readable address", () => {
  const { html } = composeReadable(showsPage, SITE);
  const links = hrefs(html, '/shows/');
  assert.ok(links.includes('/shows/hotshots-2fb644'), links.join(' '));
  assertServedDirectly(links, '/shows/', detailShows(showDocs));
});

test('ALLOW: the team grid links each member at the readable address', () => {
  const { html } = composeReadable(teamPage, SITE);
  const links = hrefs(html, '/team/');
  assert.ok(links.includes('/team/will-cunnington-ec7dca'), links.join(' '));
  assertServedDirectly(links, '/team/', detailTeam(teamDocs));
});

test("ALLOW: a What's On on the home page links into the shows page at the readable address", () => {
  const { html } = composeReadable(homePage, SITE);
  assertServedDirectly(hrefs(html, '/shows/'), '/shows/', detailShows(showDocs));
});

test('REFUSE: a CMS slug the detail route does not use (not one path step, or shared) never becomes the link', () => {
  const shows = showDocs.map((d, i) =>
    i === 0 ? { ...d, objectValue: { ...d.objectValue, slug: 'not usable' } }
    : i === 1 || i === 2 ? { ...d, objectValue: { ...d.objectValue, slug: 'twin' } }
    : d,
  );
  const { html } = composeReadable(showsPage, SITE, shows);
  const links = hrefs(html, '/shows/');
  assert.ok(!links.some((h) => h.includes('not%20usable') || h.endsWith('/twin')), links.join(' '));
  assertServedDirectly(links, '/shows/', detailShows(shows));
});

test("REFUSE: a page-level key field the readable route ignores does not take over the shows links", () => {
  const authored = pageOf({ ...showsPage, detailPage: { enabled: true, itemKeyField: 'Url Slug' } });
  const { html } = composeReadable(authored, [homePage, authored, teamPage]);
  assertServedDirectly(hrefs(html, '/shows/'), '/shows/', detailShows(showDocs));
});

test('REFUSE: a list that does not land on a shows or team page is left exactly as it was', () => {
  // A team grid on a standard page links to that page's own generic detail
  // route, which knows nothing of readable segments.
  const standard = pageOf({ name: 'About', slug: 'about', format: 'standard', blocks: [teamBlock] });
  const pages = [homePage, standard];
  assert.equal(plan(standard, pages).size, 0);
  const { html, applied } = composeReadable(standard, pages);
  assert.equal(applied.page, standard, 'the page object is passed through untouched');
  const links = hrefs(html, '/about/');
  assert.deepEqual(links, teamDocs.map((d) => `/about/${d._id}`), 'control: the grid links at all, by id');
});

test('REFUSE: with no readable segments (the detail read failed) nothing changes and the id links stay', () => {
  const items = new Map<string, ContentItem[]>([['shows1', showDocs.map((d) => toContentItem(d, 'collection') as ContentItem)]]);
  const applied = apply(showsPage, items, new Map());
  assert.equal(applied.page, showsPage);
  assert.equal(applied.itemsByCollection.get('shows1'), items.get('shows1'));
  assert.deepEqual(hrefs(render(applied.page, SITE, applied.itemsByCollection), '/shows/'), showDocs.map((d) => `/shows/${d._id}`));
});

test('REFUSE: the stamp is a copy; the list read the page was given is not mutated', () => {
  const { items } = composeReadable(showsPage, SITE);
  for (const item of items.get('shows1') ?? []) assert.equal(Object.hasOwn(item.raw ?? {}, '_system'), false);
  assert.equal(Object.hasOwn((showsPage.blocks?.[0]?.config?.bindings?.[0] ?? {}) as object, 'sectionConfig'), false);
});

test('PARITY: the landing page this module reads is the one the renderer links to', async () => {
  const linked = await import('./linkedItems.ts');
  assert.equal(typeof linked.servingDetailRouteSlug, 'function', 'linkedItems.ts exports servingDetailRouteSlug');
  const standard = pageOf({ name: 'About', slug: 'about', format: 'standard', blocks: [whatsOn('blk_about')] });
  const offShows = pageOf({ ...showsPage, detailPage: { enabled: false } });
  for (const pages of [SITE, [homePage, standard, showsPage], [homePage, standard, offShows], [homePage, teamPage]]) {
    for (const page of pages) {
      for (const collectionId of ['shows1', 'team1', 'nothing']) {
        // Casts: both functions take the same structural page shape.
        assert.equal(
          linked.servingDetailRouteSlug(page as never, pages as never, collectionId),
          resolveServingDetailRouteSlug(page, pages, collectionId),
          `${page.slug} ${collectionId}`,
        );
      }
    }
  }
});

/* ── Review of #212, item 9 ───────────────────────────────────────── */

test('REFUSE (a): two lists of one collection on one page landing on different pages plan nothing; the plain-page links stay id links', () => {
  // The team grid (a page template) links to this page's own generic route;
  // the cards layout sends the same collection to the team page.
  const cards = { id: 'blk_team_cards', order: 1, enabled: true, type: { kind: 'layout', dispatchId: 'cards' }, config: { bindings: [{ collectionId: 'team1', displayAs: 'cards' }] } };
  const mixed = pageOf({ name: 'About', slug: 'about', format: 'standard', blocks: [teamBlock, cards] });
  const pages = [homePage, mixed, teamPage];
  // Control: the second list really lands on /team, or this test could not fail.
  assert.equal(resolveServingDetailRouteSlug(mixed, pages, 'team1'), 'team');
  assert.equal(plan(mixed, pages).size, 0, 'a collection with one non-readable landing is not planned');
  // A looser plan would read the team segments and stamp them, and the grid
  // would then link /about/<segment>, which the generic route 404s.
  const { html } = composeReadable(mixed, pages);
  const ids = new Set(teamDocs.map((d) => d._id));
  const aboutLinks = hrefs(html, '/about/');
  assert.equal(aboutLinks.length, teamDocs.length, 'sanity: the grid links every member');
  for (const href of aboutLinks) assert.ok(ids.has(href.slice('/about/'.length)), `${href} is /about/<id>`);
  const teamLinks = hrefs(html, '/team/');
  assert.ok(teamLinks.length > 0, 'control: the cards link into /team');
});

test('ALLOW (b): two shows with the same title each link their own item, apart by the id tail', () => {
  const twinA = { _id: '6a01f2b3c4d5e6f7081aaa01', objectValue: { title: 'Open Mic', date: SOON, time: '7:00 PM', location: 'Venue Alpha' } };
  const twinB = { _id: '6a01f2b3c4d5e6f7081bbb02', objectValue: { title: 'Open Mic', date: '2099-08-24T05:00:00.000Z', time: '7:00 PM', location: 'Venue Beta' } };
  const shows = [...showDocs, twinA, twinB];
  const segments = readable.readableSegments(detailShows(shows));
  assert.equal(segments.get(twinA._id), `open-mic-${twinA._id.slice(-6)}`);
  assert.notEqual(segments.get(twinA._id), segments.get(twinB._id), 'the id tail keeps them apart');
  const { html } = composeReadable(showsPage, SITE, shows);
  // Each card is one <article>: its venue says which show it is.
  const byVenue = new Map([['Venue Alpha', twinA._id], ['Venue Beta', twinB._id]]);
  let checked = 0;
  for (const card of html.split('<article').slice(1)) {
    const venue = [...byVenue.keys()].find((v) => card.includes(v));
    if (!venue) continue;
    const href = hrefs(card, '/shows/')[0];
    assert.ok(href, `${venue} card links`);
    const resolved = readable.resolveReadableSegment(detailShows(shows), decodeURIComponent(href.slice('/shows/'.length)));
    assert.equal(resolved?.redirect, false, href);
    assert.equal(resolved?.item.id, byVenue.get(venue), `${venue} card resolves to its own show, never its twin`);
    checked += 1;
  }
  assert.equal(checked, 2, 'sanity: both twin cards were found');
});

test('ALLOW: with a page key field that differs, the segment is readable under it AND under slug', async () => {
  const { systemValue } = await import('@hillbombcreations/site-renderer/bindings');
  const authored = pageOf({ ...showsPage, detailPage: { enabled: true, itemKeyField: 'Url Slug' } });
  const { applied } = composeReadable(authored, [homePage, authored, teamPage]);
  const segments = readable.readableSegments(detailShows(showDocs));
  const stamped = applied.itemsByCollection.get('shows1') ?? [];
  assert.equal(stamped.length, showDocs.length, 'sanity');
  for (const item of stamped) {
    assert.equal(systemValue(item.raw, 'Url Slug'), segments.get(item.id));
    assert.equal(systemValue(item.raw, 'slug'), segments.get(item.id), 'a list reading the binding key links the same address');
  }
});

test('SOURCE PIN: product cards are titled and priced at the size quick add bags', () => {
  const bridge = readFileSync(new URL('../api/composition/productBridge.ts', import.meta.url), 'utf8');
  assert.ok(bridge.includes('const defaultVariant = offerVariantKey(product.usingVariant, product.notForSaleVariants);'));
});

/* ── The shows page template (renderer 1.89.1 links it via itemSegment) ── */

const showsTemplate = (variant?: 'compact') => ({
  id: variant ? 'blk_home_shows' : 'blk_shows_tpl',
  order: 0,
  enabled: true,
  type: { kind: 'page-template', dispatchId: 'shows' },
  config: { bindings: [{ collectionId: 'shows1', ...(variant ? { sectionConfig: { variant } } : {}) }] },
});

/** Every /shows/ href on the page resolves, without a redirect, to the show its card names. */
function assertEachCardItsOwnShow(html: string, shows: typeof showDocs) {
  const list = detailShows(shows);
  const links = hrefs(html, '/shows/');
  assert.ok(links.length >= shows.length, `sanity: every show is linked (${links.length})`);
  for (const href of links) {
    const resolved = readable.resolveReadableSegment(list, decodeURIComponent(href.slice('/shows/'.length)));
    assert.equal(resolved?.redirect, false, `${href} is served without a redirect`);
  }
  // Right item: the anchor wrapping a show's title links that show.
  let matched = 0;
  for (const show of shows) {
    const title = show.objectValue.title as string;
    const anchors = [...html.matchAll(/<a\b[^>]*href="(\/shows\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].filter((m) => m[2].includes(title.replace(/'/g, '&#x27;')));
    for (const m of anchors) {
      const resolved = readable.resolveReadableSegment(list, decodeURIComponent(m[1].slice('/shows/'.length)));
      assert.equal(resolved?.item.id, show._id, `the "${title}" card links its own show`);
      matched += 1;
    }
  }
  assert.ok(matched >= shows.length, `sanity: a titled card was matched for every show (${matched})`);
}

test('ALLOW: the shows page template links each show at its readable address, its own item', () => {
  const page = pageOf({ name: 'Shows', slug: 'shows', format: 'shows', blocks: [showsTemplate()], detailPage: { enabled: true } });
  const pages = [homePage, page, teamPage];
  assert.equal(plan(page, pages).get('shows1'), 'shows', 'control: the template lands on the readable route');
  const { html } = composeReadable(page, pages);
  assert.ok(hrefs(html, '/shows/').includes('/shows/hotshots-2fb644'), hrefs(html, '/shows/').join(' '));
  assertEachCardItsOwnShow(html, showDocs);
});

test("ALLOW: the home page's compact shows template links into the shows page at the readable address", () => {
  const home = pageOf({ name: 'Home', slug: 'home', format: 'home', blocks: [showsTemplate('compact')] });
  const page = pageOf({ name: 'Shows', slug: 'shows', format: 'shows', blocks: [showsTemplate()], detailPage: { enabled: true } });
  const pages = [home, page, teamPage];
  const { html } = composeReadable(home, pages);
  assertEachCardItsOwnShow(html, showDocs);
});

test('REFUSE: a page key field on the shows page does not send the template to an address the route ignores', () => {
  const page = pageOf({ name: 'Shows', slug: 'shows', format: 'shows', blocks: [showsTemplate()], detailPage: { enabled: true, itemKeyField: 'Url Slug' } });
  const { html } = composeReadable(page, [homePage, page, teamPage]);
  assertEachCardItsOwnShow(html, showDocs);
});

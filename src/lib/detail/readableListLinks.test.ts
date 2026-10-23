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

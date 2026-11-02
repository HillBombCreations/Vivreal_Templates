import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ContentItem, PageConfig as RendererPageConfig, SiteData as RendererSiteData } from '@hillbombcreations/site-renderer';
import { toContentItem } from '../api/collections/mapItem.ts';
import { composePage } from '../../../node_modules/@hillbombcreations/site-renderer/dist/composition/composePage.js';
import { EVENT_ROW_LAYOUTS as RENDERER_EVENT_ROW_LAYOUTS } from '../../../node_modules/@hillbombcreations/site-renderer/dist/lib/itemAnchor.js';

/**
 * Next release 2026-12, plan 11.3 (T3), owner decisions OD-4 and OD-5.
 *
 * Two kinds of test. The unit cases drive `buildListingEvents` directly (the
 * floor, the cap, the field rule). The page-level cases compose the page with
 * the INSTALLED renderer's real `composePage`, render it to HTML, and assert
 * that every `#item-<id>` an Event links names an id present in that HTML:
 * per event layout, per schedule view (agenda, month, map), and with two
 * blocks on one list. A renderer bump that drops or renames a row id fails
 * here. Each page-level case first asserts it emitted at least one fragment
 * (or, where no fragment is correct, at least one Event), so a pass is never
 * an empty loop.
 *
 * Lazily imported so a tree without the module fails on assertions rather
 * than on the import (red proof).
 */
const mod = (await import('./listingEvents.ts').catch(() => null)) as typeof import('./listingEvents.ts') | null;
const fields = (await import('./eventFields.ts').catch(() => null)) as typeof import('./eventFields.ts') | null;

const PHOENIX = 'America/Phoenix';
const PAGE_URL = 'https://shop.example/markets';
const NOW = Date.now();
const YEAR = new Date(NOW).getFullYear() + 3;
/** A date in March three years out: every fixture row sits in one future month. */
const day = (d: number, time = '17:00:00.000Z') => `${YEAR}-03-${String(d).padStart(2, '0')}T${time}`;

let seq = 0;
const nextId = () => `6a${String(++seq).padStart(22, '0')}`;
const row = (objectValue: Record<string, unknown>, _id = nextId()) => toContentItem({ _id, objectValue }, 'collection') as ContentItem;

const items = new Map<string, ContentItem[]>();
const getItems = (id: string) => items.get(id) ?? [];

function events(page: Record<string, unknown>, extra: Partial<Parameters<NonNullable<typeof mod>['buildListingEvents']>[0]> = {}) {
  assert.ok(mod, 'listingEvents.ts exists');
  return mod.buildListingEvents({ page, getItems, pageUrl: PAGE_URL, timezone: PHOENIX, now: NOW, ...extra });
}

const layoutBlock = (displayAs: string, collectionId: string, sectionConfig?: Record<string, unknown>, id = `blk_${displayAs}_${collectionId}`) => ({
  id,
  order: 0,
  enabled: true,
  type: { kind: 'layout', dispatchId: displayAs },
  config: { bindings: [{ collectionId, displayAs, ...(sectionConfig ? { sectionConfig } : {}) }] },
});
const scheduleBlock = (collectionId: string) => ({
  id: 'blk_schedule',
  order: 0,
  enabled: true,
  type: { kind: 'page-template', dispatchId: 'schedule' },
  config: { bindings: [{ collectionId }] },
});
/** The atomized schedule (`defaultBlocksScheduleAtomized`): a coordinated group whose agenda child carries the binding. */
const scheduleGroup = (collectionId: string) => ({
  id: 'blk_schedule_group',
  order: 0,
  enabled: true,
  type: { kind: 'group', dispatchId: 'group' },
  config: {
    coordinated: 'schedule',
    children: [
      { id: 'c_toolbar', order: 0, enabled: true, type: { kind: 'page-template', dispatchId: 'schedule-toolbar' }, config: {} },
      { id: 'c_agenda', order: 1, enabled: true, type: { kind: 'page-template', dispatchId: 'schedule-agenda' }, config: { bindings: [{ collectionId }] } },
      { id: 'c_calendar', order: 2, enabled: true, type: { kind: 'page-template', dispatchId: 'schedule-calendar' }, config: {} },
      { id: 'c_map', order: 3, enabled: true, type: { kind: 'page-template', dispatchId: 'schedule-map' }, config: {} },
    ],
  },
});

// Fixtures ------------------------------------------------------------------

/** An owner-made list: date, time, venue and a street address (OD-4). */
items.set('markets', [
  row({ title: 'Farmers Market', date: day(7), time: '8:00 am', venue: 'Roosevelt Row', address: '305 E Roosevelt St' }),
  row({ title: 'Night Market', date: day(14), time: '6:00 pm', venue: 'Heritage Square: 115 N 6th St' }),
  row({ title: 'Pop-up, town only', date: day(21), venue: 'Downtown', address: 'Phoenix, AZ' }),
  row({ title: 'Bad date', date: 'sometime in spring', venue: 'Roosevelt Row', address: '305 E Roosevelt St' }),
]);
/** Dated rows with no place field at all: not an event list (OD-4). */
items.set('dated-no-place', [row({ title: 'Opening night', date: day(9) }), row({ title: 'Closing night', date: day(28) })]);
/** Schedule stops as Waves of Grain stores them. */
items.set('stops', [
  row({ title: 'Downtown market', location_name: 'Downtown Phoenix Farmers Market', address: '721 N Central Ave', start: day(8, '15:00:00.000Z'), end: day(8, '19:00:00.000Z') }),
  row({ title: 'Mesa pop-up', location_name: 'Mesa', address: 'Mesa, AZ', start: day(15, '15:00:00.000Z') }),
  row({ title: 'Cancelled stop', location_name: 'Old Town', address: '7121 E 1st Ave', start: day(22, '15:00:00.000Z'), status: 'cancelled' }),
  row({ title: 'All-day fair', location_name: 'State Fair', address: '1826 W McDowell Rd', start: `${YEAR}-03-25` }),
]);
/** Sixty valid rows, for the cap. */
items.set('sixty', Array.from({ length: 60 }, (_, i) => row({ title: `Class ${i + 1}`, date: day((i % 28) + 1), venue: 'Studio', address: '10 W Main St' })));

// The field rule (OD-4) ------------------------------------------------------

test('OD-4: a date read by name or by what it holds; a town is not a street; publish date is never the date', () => {
  assert.ok(fields, 'eventFields.ts exists');
  assert.deepEqual(fields.readEventFields({ date: '2026-11-14', time: '7pm', venue: 'Hall', address: '12 Main St' }), {
    date: '2026-11-14', time: '7pm', location: 'Hall', address: '12 Main St',
  });
  assert.equal(fields.readEventFields({ marketDate: '2026-11-14T15:00:00.000Z' }).date, '2026-11-14T15:00:00.000Z', 'a field named for a date, holding one');
  assert.equal(fields.readEventFields({ when: 'every Saturday' }).date, undefined, 'free text is not a date');
  assert.equal(fields.readEventFields({ notes: '2026-11-14' }).date, undefined, 'a date-like value in a field not named for one');
  assert.equal(fields.readEventFields({ address: 'Phoenix, AZ' }).address, undefined, 'a town is not a street');
  assert.equal(fields.isEventList([{ raw: { date: '2026-11-14', location: 'Hall' } }]), true);
  assert.equal(fields.isEventList([{ raw: { date: '2026-11-14' } }]), false, 'a date and no place');
  assert.equal(fields.isEventList([{ raw: { location: 'Hall', when: 'Fridays' } }]), false, 'a place and no date');
});

// The floor and the cap --------------------------------------------------------

test('ALLOW: a list with date and venue fields on an Agenda page; REFUSE: a town only, and an invalid date', () => {
  const out = events({ blocks: [layoutBlock('agenda', 'markets')] });
  assert.deepEqual(out.map((e) => e.name), ['Farmers Market', 'Night Market']);
  const [first, second] = out as Array<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any -- JSON-LD read in assertions only
  assert.equal(first['@type'], 'Event');
  assert.equal(first.startDate, `${YEAR}-03-07T08:00:00-07:00`, 'the business zone, Phoenix has no daylight time');
  assert.deepEqual(first.location, { '@type': 'Place', name: 'Roosevelt Row', address: { '@type': 'PostalAddress', streetAddress: '305 E Roosevelt St' } });
  assert.deepEqual(second.location.address, { '@type': 'PostalAddress', streetAddress: '115 N 6th St' });
});

test('REFUSE: a list with a date and no place emits nothing, even drawn as an Agenda', () => {
  assert.deepEqual(events({ blocks: [layoutBlock('agenda', 'dated-no-place')] }), []);
});

test('REFUSE: a list drawn in a non-event layout emits nothing (cards have their own detail pages)', () => {
  assert.deepEqual(events({ blocks: [layoutBlock('cards', 'markets')] }), []);
});

test('ALLOW: a schedule stop with a date and street address emits one Event; REFUSE: a town only, a cancelled stop', () => {
  const out = events({ blocks: [scheduleBlock('stops')] }) as Array<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any -- JSON-LD read in assertions only
  assert.deepEqual(out.map((e) => e.name), ['Downtown market', 'All-day fair']);
  assert.equal(out[0].startDate, `${YEAR}-03-08T08:00:00-07:00`, 'the stop instant on the business clock');
  assert.equal(out[0].location.name, 'Downtown Phoenix Farmers Market');
  assert.equal(out[1].startDate, `${YEAR}-03-25`, 'an all-day stop is its date');
  for (const e of out) assert.equal(e.url, PAGE_URL, 'schedule stops render no row id in 1.95.0: no fragment');
});

test('REFUSE: a schedule stop never borrows the business address (no place, no Event)', () => {
  items.set('placeless-stop', [row({ title: 'Somewhere', start: day(10, '15:00:00.000Z') })]);
  assert.deepEqual(events({ blocks: [scheduleBlock('placeless-stop')] }), []);
});

test('REFUSE: a show list is skipped (each show carries its own Event on its detail page); ALLOW: without the skip it would mark up', () => {
  const page = { blocks: [layoutBlock('whats-on', 'markets')] };
  assert.equal(events(page).length, 2, 'control: the same list marks up when it is not a show list');
  assert.deepEqual(events(page, { skipCollections: new Set(['markets']) }), []);
});

test('ALLOW: pageListingEvents skips the collection of a shows page, and gives home its origin with no path', () => {
  assert.ok(mod);
  const site = {
    domainInformation: { live_url: 'https://shop.example' },
    timezone: PHOENIX,
    pageConfigs: [{ name: 'Shows', slug: 'shows', format: 'shows', blocks: [{ id: 'b', order: 0, enabled: true, type: { kind: 'page-template', dispatchId: 'shows' }, config: { bindings: [{ collectionId: 'markets' }] } }] }],
  } as unknown as Parameters<typeof mod.pageListingEvents>[0]; // a minimal site: origin, zone and pages only
  const input = { page: { blocks: [layoutBlock('agenda', 'markets'), layoutBlock('agenda', 'stops-as-rows')] }, data: { getItems } };
  items.set('stops-as-rows', [row({ title: 'Home market', date: day(5), venue: 'Lot', address: '9 W Main St' })]);
  const out = mod.pageListingEvents(site, input, '/');
  assert.ok(out, 'positive control: the non-show list marked up');
  assert.deepEqual(out.map((e) => e.name), ['Home market']);
  assert.match(String(out[0].url), /^https:\/\/shop\.example(#item-[\w-]+)?$/);
  assert.equal(mod.pageListingEvents({ ...site, domainInformation: undefined } as typeof site, input, '/'), null, 'no origin, no Events');
});

test('REFUSE: the 51st row; at most 50 Events on a page (OD-5)', () => {
  const out = events({ blocks: [layoutBlock('whats-on', 'sixty')] });
  assert.equal(out.length, 50);
  assert.equal(out[49].name, 'Class 50');
  assert.ok(!out.some((e) => e.name === 'Class 51'));
});

test('ALLOW: one Event per item, even when two blocks draw the same list', () => {
  const out = events({ blocks: [layoutBlock('agenda', 'markets', undefined, 'blk_a'), layoutBlock('whats-on', 'markets', undefined, 'blk_b')] });
  assert.deepEqual(out.map((e) => e.name), ['Farmers Market', 'Night Market']);
});

test('REFUSE: a block that trims, filters or remaps its list gets no fragment', () => {
  for (const sectionConfig of [{ itemLimit: 1 }, { scope: { field: 'venue', equals: 'x' } }, { fieldMap: { title: 'venue' } }, { upcomingOnly: true }]) {
    const out = events({ blocks: [layoutBlock('agenda', 'markets', sectionConfig)] });
    for (const e of out) assert.equal(e.url, PAGE_URL, JSON.stringify(sectionConfig));
  }
});

test('the local event-layout list is the renderer\'s', () => {
  assert.ok(mod);
  assert.deepEqual([...mod.EVENT_ROW_LAYOUTS].sort(), [...RENDERER_EVENT_ROW_LAYOUTS].sort());
});

// Page level: every fragment names an id the served HTML carries ---------------

const siteData = { pages: {}, pageConfigs: [], primary: '#365b99', timezone: PHOENIX } as unknown as RendererSiteData; // composition reads only these keys here
const pageOf = (p: Record<string, unknown>) => ({ labels: {}, collectionId: null, name: 'Markets', slug: 'markets', ...p }) as unknown as RendererPageConfig; // page fixtures carry only the keys composition reads

function render(page: RendererPageConfig, options: Record<string, unknown> = {}): string {
  const node = composePage({
    page,
    pages: [page],
    data: { siteData, getItems, getIntegrationItems: () => [] },
    options: { mode: 'live', ...options },
    isHome: false,
  } as Parameters<typeof composePage>[0]);
  return renderToStaticMarkup(createElement('div', null, node));
}

const fragmentsOf = (out: Record<string, unknown>[]) =>
  out.map((e) => String(e.url)).filter((u) => u.includes('#')).map((u) => u.slice(u.indexOf('#') + 1));

function assertFragmentsRendered(page: RendererPageConfig, out: Record<string, unknown>[], options?: Record<string, unknown>): string[] {
  const html = render(page, options);
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const fragments = fragmentsOf(out);
  for (const f of fragments) assert.ok(ids.has(f), `#${f} is linked but the page renders no such id`);
  return fragments;
}

for (const displayAs of ['agenda', 'whats-on', 'calendar', 'event-wall']) {
  test(`ALLOW (page level, ${displayAs}): every linked row id is in the rendered page`, () => {
    const page = pageOf({ format: 'standard', blocks: [layoutBlock(displayAs, 'markets')] });
    const out = events(page as unknown as Record<string, unknown>);
    const fragments = assertFragmentsRendered(page, out);
    assert.ok(fragments.length > 0, `positive control: ${displayAs} linked at least one row`);
    for (const f of fragments) assert.match(f, /^item-6a\d{22}$/);
  });
}

test('ALLOW (page level, event wall): only the two cards the phone copy draws are linked', () => {
  const page = pageOf({ format: 'standard', blocks: [layoutBlock('event-wall', 'sixty')] });
  const out = events(page as unknown as Record<string, unknown>);
  assert.equal(fragmentsOf(out).length, 2);
  assertFragmentsRendered(page, out);
});

test('ALLOW (page level, two blocks on one list): links name the first block\'s ids, never the scoped copies', () => {
  const page = pageOf({ format: 'standard', blocks: [layoutBlock('agenda', 'markets', undefined, 'blk_a'), layoutBlock('whats-on', 'markets', undefined, 'blk_b')] });
  const out = events(page as unknown as Record<string, unknown>);
  const fragments = assertFragmentsRendered(page, out);
  assert.equal(fragments.length, 2, 'positive control');
  const html = render(page);
  assert.ok(/\sid="item-\d+-6a/.test(html), 'control: the second block really is scoped in the page');
  for (const f of fragments) assert.doesNotMatch(f, /^item-\d+-/);
});

for (const scheduleView of ['agenda', 'month', 'map'] as const) {
  for (const [shape, block] of [['template', scheduleBlock('stops')], ['atomized', scheduleGroup('stops')]] as const) {
    test(`ALLOW (page level, schedule ${shape}, ${scheduleView} view): Events, and no fragment the page cannot serve`, () => {
      const page = pageOf({ format: 'schedule', blocks: [block], labels: { defaultView: scheduleView } });
      const out = events(page as unknown as Record<string, unknown>);
      assert.equal(out.length, 2, 'positive control: the two stops that pass the floor');
      assertFragmentsRendered(page, out, { scheduleView });
      assert.deepEqual(fragmentsOf(out), []);
    });
  }
}

// Wiring: the three routes that compose a listing page emit the Events --------
// The routes are .tsx server components the plain-Node runner cannot load, so
// the threading is pinned from source (the chromeProps.test.ts precedent).

test('WIRING: home, the schedule and composed formats, and the generic formats emit the page Events', async () => {
  const { readFileSync } = await import('node:fs');
  const read = (relative: string) => {
    const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
    assert.ok(source.length > 500, `${relative} was read`);
    return source;
  };
  const home = read('../../app/page.tsx');
  assert.match(home, /<JsonLd schema=\{pageListingEvents\(siteData, input, "\/"\)\} \/>/);
  const slugPage = read('../../app/[slug]/page.tsx');
  assert.match(slugPage, /<JsonLd schema=\{pageListingEvents\(siteData, input, pagePath\)\} \/>/, 'ComposedFormatBody (schedule and the other composed formats)');
  assert.match(slugPage, /pagePath=\{`\/\$\{slug\}`\}/, 'DynamicPage hands the body its path');
  assert.match(slugPage, /pagePath: `\/\$\{slug\}`,/, 'the generic arm hands renderComposedPage its path');
  const composed = read('../renderComposedPage.tsx');
  assert.match(composed, /\{pagePath && <JsonLd schema=\{pageListingEvents\(siteData, input, pagePath\)\} \/>\}/);
  assert.match(composed, /pagePath=\{pagePath\}/, 'renderComposedPage threads it to the body');
});

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

function events(page: Record<string, unknown>, extra: Partial<Parameters<NonNullable<typeof mod>['buildListingEvents']>[0]> & Record<string, unknown> = {}) {
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
const scheduleGroup = (collectionId: string, agendaEnabled = true) => ({
  id: 'blk_schedule_group',
  order: 0,
  enabled: true,
  type: { kind: 'group', dispatchId: 'group' },
  config: {
    coordinated: 'schedule',
    children: [
      { id: 'c_toolbar', order: 0, enabled: true, type: { kind: 'page-template', dispatchId: 'schedule-toolbar' }, config: {} },
      { id: 'c_agenda', order: 1, enabled: agendaEnabled, type: { kind: 'page-template', dispatchId: 'schedule-agenda' }, config: { bindings: [{ collectionId }] } },
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
    date: '2026-11-14', time: '7pm', location: 'Hall', address: '12 Main St', onlineUrl: undefined, ticketsUrl: undefined,
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
  // Renderer 1.95.1: the default (agenda) view gives every upcoming stop its row id.
  assert.deepEqual(out.map((e) => e.url), out.map((e) => `${PAGE_URL}#item-${String(e.url).split('#item-')[1]}`), 'both upcoming stops link their row');
  assert.ok(out.every((e) => /#item-6a\d{22}$/.test(String(e.url))), JSON.stringify(out.map((e) => e.url)));
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

test('REFUSE (review B1): a row the owner marks Cancelled or private gives no Event, on every event layout', () => {
  items.set('statuses', [
    row({ title: 'Called off', date: day(10), venue: 'Hall', address: '12 Main St', status: 'Cancelled' }),
    row({ title: 'Called off too', date: day(11), venue: 'Hall', address: '12 Main St', status: ' canceled ' }),
    row({ title: 'Members only', date: day(12), venue: 'Hall', address: '12 Main St', status: 'Private' }),
    row({ title: 'Packed house', date: day(13), venue: 'Hall', address: '12 Main St', status: 'Sold out' }),
  ]);
  for (const displayAs of ['agenda', 'whats-on', 'calendar', 'event-wall']) {
    const names = events({ blocks: [layoutBlock(displayAs, 'statuses')] }).map((e) => e.name);
    assert.ok(!names.includes('Called off') && !names.includes('Called off too') && !names.includes('Members only'), `${displayAs}: ${names.join(', ')}`);
  }
});

test('ALLOW (review B1): a Sold out row is still a scheduled Event', () => {
  assert.deepEqual(events({ blocks: [layoutBlock('agenda', 'statuses')] }).map((e) => e.name), ['Packed house']);
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

test('REFUSE (review B6): only rows the block draws are marked up; a block that trims, filters or remaps gives none', () => {
  // Three upcoming rows and one past row, every one above the floor.
  items.set('trim', [
    row({ title: 'First up', date: day(1), venue: 'Hall', address: '12 Main St' }),
    row({ title: 'Second up', date: day(2), venue: 'Hall', address: '12 Main St' }),
    row({ title: 'Third up', date: day(3), venue: 'Hall', address: '12 Main St' }),
    row({ title: 'Long gone', date: `${YEAR - 5}-03-01`, venue: 'Hall', address: '12 Main St' }),
  ]);
  const all = ['First up', 'Second up', 'Third up', 'Long gone'];
  const upcoming = ['First up', 'Second up', 'Third up'];
  const cases: Array<[string, Record<string, unknown> | undefined, string[]]> = [];
  for (const displayAs of ['agenda', 'whats-on', 'calendar', 'event-wall']) {
    cases.push([displayAs, undefined, all], [displayAs, { itemLimit: 1 }, []], [displayAs, { scope: { field: 'venue', equals: 'Hall' } }, []], [displayAs, { fieldMap: { title: 'venue' } }, []]);
  }
  cases.push(['agenda', { upcomingOnly: true }, upcoming], ['whats-on', { showPast: false }, upcoming], ['agenda', { showPast: false }, all], ['whats-on', { upcomingOnly: true }, all]);
  for (const [displayAs, sectionConfig, expected] of cases) {
    const page = pageOf({ format: 'standard', blocks: [layoutBlock(displayAs, 'trim', sectionConfig)] });
    const out = events(page as unknown as Record<string, unknown>);
    assert.deepEqual(out.map((e) => e.name), expected, `${displayAs} ${JSON.stringify(sectionConfig ?? {})}`);
    assertFragmentsRendered(page, out);
  }
});

test('ALLOW (review B6): an Agenda that shows only upcoming dates links the rows it keeps', () => {
  const page = pageOf({ format: 'standard', blocks: [layoutBlock('agenda', 'trim', { upcomingOnly: true })] });
  const out = events(page as unknown as Record<string, unknown>);
  assert.equal(assertFragmentsRendered(page, out).length, 3, 'each kept row links its own row');
});

test('the id rule is the renderer\'s: a fragment exactly when eventRowAnchor gives the row an id', async () => {
  const { eventRowAnchor } = (await import('../../../node_modules/@hillbombcreations/site-renderer/dist/lib/itemAnchor.js')) as { eventRowAnchor: (id: unknown, scope?: string) => { id?: string } };
  const ids = ['abc_DEF-1', 'a.b', 'x'.repeat(64), 'y'.repeat(65), 'has space', 'ok'];
  items.set('id-rule', ids.map((id, i) => row({ title: `Row ${i}`, date: day(i + 1), venue: 'Hall', address: '12 Main St' }, id)));
  const out = events({ blocks: [layoutBlock('whats-on', 'id-rule')] });
  assert.equal(out.length, ids.length, 'positive control: every row is an Event');
  for (const [i, id] of ids.entries()) {
    const expected = eventRowAnchor(id).id;
    assert.equal(String(out[i].url), expected ? `${PAGE_URL}#${expected}` : PAGE_URL, id);
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

/** The Event urls that point at a row's own detail page (not the list page, with or without a fragment). */
const detailLinksOf = (out: Record<string, unknown>[]) =>
  out.map((e) => String(e.url)).filter((u) => u !== PAGE_URL && !u.startsWith(`${PAGE_URL}#`));

function assertFragmentsRendered(page: RendererPageConfig, out: Record<string, unknown>[], options?: Record<string, unknown>): string[] {
  const html = render(page, options);
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const fragments = fragmentsOf(out);
  for (const f of fragments) assert.ok(ids.has(f), `#${f} is linked but the page renders no such id`);
  // A detail link is the address the page itself links that row to.
  const hrefs = new Set([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]));
  for (const url of detailLinksOf(out)) assert.ok(hrefs.has(new URL(url).pathname), `${url} is not an address this page links`);
  return fragments;
}

for (const displayAs of ['agenda', 'whats-on', 'calendar', 'event-wall']) {
  test(`ALLOW (page level, ${displayAs}): every linked row id is in the rendered page`, () => {
    const page = pageOf({ format: 'standard', blocks: [layoutBlock(displayAs, 'markets')] });
    const out = events(page as unknown as Record<string, unknown>);
    const fragments = assertFragmentsRendered(page, out);
    assert.ok(fragments.length + detailLinksOf(out).length > 0, `positive control: ${displayAs} linked at least one row`);
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
  const page = pageOf({ format: 'standard', blocks: [layoutBlock('agenda', 'markets', undefined, 'blk_a'), layoutBlock('calendar', 'markets', undefined, 'blk_b')] });
  const out = events(page as unknown as Record<string, unknown>);
  const fragments = assertFragmentsRendered(page, out);
  assert.equal(fragments.length, 2, 'positive control');
  const html = render(page);
  assert.ok(/\sid="item-\d+-6a/.test(html), 'control: the second block really is scoped in the page');
  for (const f of fragments) assert.doesNotMatch(f, /^item-\d+-/);
});

// Review pass 3, B4: what the renderer draws is read from the blocks, never
// from a binding's own `enabled` flag (the Studio once wrote it, and the
// renderer ignores it when drawing).
const offBinding = (block: ReturnType<typeof layoutBlock> | ReturnType<typeof scheduleBlock>) => ({
  ...block,
  config: { ...block.config, bindings: [{ ...block.config.bindings[0], enabled: false }] },
});

test('REFUSE (B4, layout): a first section whose binding says enabled:false still owns its ids, so the later Agenda is never linked unscoped', () => {
  const shared = getItems('markets')[0];
  items.set('markets-overlap', [shared, row({ title: 'Later only', date: day(20), venue: 'Hall', address: '12 Main St' })]);
  const page = pageOf({ format: 'standard', blocks: [offBinding(layoutBlock('calendar', 'markets', undefined, 'blk_off')), layoutBlock('agenda', 'markets-overlap', undefined, 'blk_later')] });
  const out = events(page as unknown as Record<string, unknown>);
  assert.ok(out.some((e) => e.name === 'Later only'), 'positive control: the later row is an Event');
  assert.ok(!out.some((e) => e.name === 'Night Market'), 'the switched-off binding gives no Events');
  assert.ok(/\sid="item-\d+-6a/.test(render(page)), 'control: the renderer scoped the later Agenda');
  assertFragmentsRendered(page, out);
});

test('REFUSE (B4, schedule template): a schedule whose binding says enabled:false still owns its stops', () => {
  const shared = getItems('stops')[0];
  items.set('stops-overlap-b4', [shared, row({ title: 'Agenda extra', date: day(21), venue: 'Hall', address: '12 Main St' })]);
  const page = pageOf({ format: 'schedule', blocks: [offBinding(scheduleBlock('stops')), layoutBlock('agenda', 'stops-overlap-b4')] });
  const out = events(page as unknown as Record<string, unknown>);
  assert.ok(out.some((e) => e.name === 'Agenda extra'), 'positive control: the later row is an Event');
  assert.ok(!out.some((e) => e.name === 'All-day fair'), 'the switched-off binding gives no Events');
  assert.ok(/\sid="item-\d+-6a/.test(render(page)), 'control: the renderer scoped the later Agenda');
  assertFragmentsRendered(page, out);
});

test('REFUSE (B4, Agenda part with two lists): only the first list is the schedule; the second gives no Event', () => {
  // The second list is stop-shaped, so only the binding choice can keep it out.
  items.set('stops-second', [row({ title: 'Second list stop', location_name: 'Annex', address: '40 E Jefferson St', start: day(12, '15:00:00.000Z') })]);
  const group = scheduleGroup('stops');
  const children = group.config.children.map((c) => (c.id === 'c_agenda' ? { ...c, config: { bindings: [{ collectionId: 'stops' }, { collectionId: 'stops-second' }] } } : c));
  const page = pageOf({ format: 'schedule', blocks: [{ ...group, config: { ...group.config, children } }] });
  const out = events(page as unknown as Record<string, unknown>);
  assert.deepEqual(out.map((e) => e.name), ['Downtown market', 'All-day fair']);
  assertFragmentsRendered(page, out);
});

test('ALLOW (pass 3 note 1): a schedule inside a plain group owns nothing, so a later Agenda keeps its links', () => {
  const shared = getItems('stops')[0];
  items.set('stops-overlap-nested', [shared, row({ title: 'Nested later', date: day(22), venue: 'Hall', address: '12 Main St' })]);
  const plain = { id: 'blk_plain', order: 0, enabled: true, type: { kind: 'group', dispatchId: 'group' }, config: { children: [scheduleGroup('stops')] } };
  const page = pageOf({ format: 'schedule', blocks: [plain, { ...layoutBlock('agenda', 'stops-overlap-nested'), order: 1 }] });
  const out = events(page as unknown as Record<string, unknown>);
  const fragments = assertFragmentsRendered(page, out);
  assert.ok(fragments.some((f) => out.find((e) => e.name === 'Nested later' && String(e.url).endsWith(f))), 'the later Agenda row is linked');
});

test('ALLOW (pass 1 note 3): a row with its own detail page links its Event there, at the address the page links', () => {
  // A collection-list page serves its list's detail pages, so its rows link /<page>/<id>.
  const page = pageOf({ format: 'collection-list', blocks: [layoutBlock('whats-on', 'markets')], detailPage: { enabled: true } });
  const out = events(page as unknown as Record<string, unknown>);
  assert.equal(out.length, 2, 'positive control');
  for (const e of out) assert.match(String(e.url), /^https:\/\/shop\.example\/markets\/6a\d{22}$/);
  assertFragmentsRendered(page, out);
});

test('REFUSE (review B5): Agenda and Event wall draw no detail link, so their rows keep #item-<id>, on the owning page and linked from home', () => {
  const owner = { name: 'All markets', slug: 'all-markets', format: 'collection-list', labels: {}, blocks: [layoutBlock('whats-on', 'markets', undefined, 'blk_owner')] };
  for (const displayAs of ['agenda', 'event-wall']) {
    const own = pageOf({ format: 'collection-list', blocks: [layoutBlock(displayAs, 'markets')], detailPage: { enabled: true } });
    const home = pageOf({ name: 'Home', slug: 'home', format: 'home', blocks: [layoutBlock(displayAs, 'markets')] });
    for (const [where, page, pages] of [['own page', own, [own]], ['home', home, [home, owner]]] as const) {
      const out = events(page as unknown as Record<string, unknown>, { pages: pages as never });
      assert.deepEqual(detailLinksOf(out), [], `${displayAs} on ${where}: no detail address`);
      const fragments = assertFragmentsRendered(page, out);
      assert.ok(fragments.length > 0, `${displayAs} on ${where}: positive control, rows keep their anchor`);
    }
  }
});

test('ALLOW (review B5): a Calendar row links its Event to the detail page the calendar links', () => {
  const page = pageOf({ format: 'collection-list', blocks: [layoutBlock('calendar', 'markets')], detailPage: { enabled: true } });
  const out = events(page as unknown as Record<string, unknown>);
  assert.equal(out.length, 2, 'positive control');
  for (const e of out) assert.match(String(e.url), /^https:\/\/shop\.example\/markets\/6a\d{22}$/);
  assertFragmentsRendered(page, out);
});

test('ALLOW (pass 4 note 2): a group with a coordinated value the renderer does not know is drawn as a plain group', () => {
  for (const coordinated of ['', 'gallery']) {
    const group = { id: 'blk_unknown', order: 0, enabled: true, type: { kind: 'group', dispatchId: 'group' }, config: { coordinated, children: [layoutBlock('agenda', 'markets')] } };
    const page = pageOf({ format: 'standard', blocks: [group] });
    const out = events(page as unknown as Record<string, unknown>);
    assert.deepEqual(out.map((e) => e.name), ['Farmers Market', 'Night Market'], `coordinated '${coordinated}'`);
    assertFragmentsRendered(page, out);
  }
});

test('PARITY (pass 4 note 3): blocks are read in the renderer\'s order, whatever shape `order` is stored in', () => {
  items.set('order-a', [row({ title: 'Order A', date: day(1), venue: 'Hall', address: '12 Main St' })]);
  items.set('order-b', [row({ title: 'Order B', date: day(2), venue: 'Hall', address: '12 Main St' })]);
  items.set('order-c', [row({ title: 'Order C', date: day(3), venue: 'Hall', address: '12 Main St' })]);
  items.set('order-d', [row({ title: 'Order D', date: day(4), venue: 'Hall', address: '12 Main St' })]);
  items.set('order-e', [row({ title: 'Order E', date: day(5), venue: 'Hall', address: '12 Main St' })]);
  const at = (block: ReturnType<typeof layoutBlock>, order: unknown) => ({ ...block, order });
  // `'abc'` reads as NaN in the renderer (an equal pair to sort); `Number(x) || 0`
  // would read it as 0 and move it ahead of `2`, so this case tells the two apart.
  const page = pageOf({
    format: 'standard',
    blocks: [at(layoutBlock('agenda', 'order-a'), '10'), at(layoutBlock('agenda', 'order-b'), 2), at(layoutBlock('agenda', 'order-e'), 'abc'), at(layoutBlock('agenda', 'order-c'), null), at(layoutBlock('agenda', 'order-d'), '1')],
  });
  const names = events(page as unknown as Record<string, unknown>).map((e) => String(e.name));
  const html = render(page);
  const drawnOrder = ['Order A', 'Order B', 'Order C', 'Order D', 'Order E'].sort((x, y) => html.indexOf(x) - html.indexOf(y));
  assert.ok(drawnOrder.every((n) => html.includes(n)), 'positive control: every block drew');
  assert.deepEqual(names, drawnOrder);
});

test('REFUSE (pass 1 note 3): a binding that opts out of detail links keeps the list address', () => {
  const page = pageOf({ format: 'collection-list', blocks: [layoutBlock('whats-on', 'markets', { detailEligible: false })], detailPage: { enabled: true } });
  const out = events(page as unknown as Record<string, unknown>);
  assert.equal(out.length, 2, 'positive control');
  assert.deepEqual(detailLinksOf(out), []);
});

test('ALLOW (pass 1 note 4): an online row is placed at its own join link; REFUSE: with no link it is not marked up', () => {
  items.set('online', [
    row({ title: 'Live stream', date: day(3), venue: 'Online', streamUrl: 'https://stream.example/live' }),
    row({ title: 'Webinar', date: day(4), venue: 'Online' }),
  ]);
  const out = events({ blocks: [layoutBlock('agenda', 'online')] }) as Array<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any -- JSON-LD read in assertions only
  assert.deepEqual(out.map((e) => e.name), ['Live stream']);
  assert.deepEqual(out[0].location, { '@type': 'VirtualLocation', url: 'https://stream.example/live' });
});

test('ALLOW (pass 1 note 5): a stored date-time with no zone is a wall time in the business zone', () => {
  items.set('zoneless', [row({ title: 'Late show', date: `${YEAR}-03-14T23:30`, venue: 'Hall', address: '12 Main St' })]);
  const [event] = events({ blocks: [layoutBlock('agenda', 'zoneless')] });
  assert.equal(event.startDate, `${YEAR}-03-14T23:30:00-07:00`, 'the day and clock written, not moved by the server clock');
});

// Renderer 1.95.1 gives schedule rows `item-<id>`: every upcoming stop in the
// agenda and map views, the first chip of each upcoming stop in the month the
// calendar opens on, never a past stop.
for (const scheduleView of ['agenda', 'month', 'map'] as const) {
  for (const [shape, block] of [['template', scheduleBlock('stops')], ['atomized', scheduleGroup('stops')]] as const) {
    test(`ALLOW (page level, schedule ${shape}, ${scheduleView} view): every linked stop id is in the rendered page`, () => {
      const page = pageOf({ format: 'schedule', blocks: [block], labels: { defaultView: scheduleView } });
      const out = events(page as unknown as Record<string, unknown>);
      assert.equal(out.length, 2, 'positive control: the two stops that pass the floor');
      const fragments = assertFragmentsRendered(page, out);
      assert.equal(fragments.length, 2, 'both upcoming stops are linked to their row');
    });
  }
}

test('ALLOW (page level, schedule month view): only stops in the opening month are linked; a later month gets the page address', () => {
  items.set('stops-two-months', [
    row({ title: 'March market', location_name: 'Plaza', address: '1 N 1st St', start: day(8, '15:00:00.000Z') }),
    row({ title: 'May market', location_name: 'Plaza', address: '1 N 1st St', start: `${YEAR}-05-09T15:00:00.000Z` }),
  ]);
  for (const view of ['month', 'agenda'] as const) {
    const page = pageOf({ format: 'schedule', blocks: [scheduleBlock('stops-two-months')], labels: { defaultView: view } });
    const out = events(page as unknown as Record<string, unknown>);
    assert.equal(out.length, 2, 'positive control');
    const fragments = assertFragmentsRendered(page, out);
    assert.equal(fragments.length, view === 'month' ? 1 : 2, view);
  }
});

test('REFUSE (review B2): a requested ?view= never picks the links; the Event url is the bare page, which serves the default view', () => {
  // A month-default atomized schedule with stops in March and May. Asked for
  // the agenda, a builder that honoured the request would link May's row,
  // which the bare page (March's grid) does not render.
  items.set('stops-march-may', [
    row({ title: 'March market', location_name: 'Plaza', address: '1 N 1st St', start: day(8, '15:00:00.000Z') }),
    row({ title: 'May market', location_name: 'Plaza', address: '1 N 1st St', start: `${YEAR}-05-09T15:00:00.000Z` }),
  ]);
  const page = pageOf({ format: 'schedule', blocks: [scheduleGroup('stops-march-may')], labels: { defaultView: 'month' } });
  for (const scheduleView of ['agenda', 'map']) {
    const out = events(page as unknown as Record<string, unknown>, { scheduleView });
    assert.equal(out.length, 2, 'positive control: both stops are Events');
    const fragments = assertFragmentsRendered(page, out);
    assert.equal(fragments.length, 1, `${scheduleView}: only the opening month's stop is linked`);
  }
});

test('REFUSE (review B3): a schedule whose Agenda part is switched off still owns its stop ids', () => {
  // The renderer builds the group from the agenda child's binding whether or
  // not that child is on, and scopes a later Agenda sharing a stop.
  const shared = getItems('stops')[0];
  items.set('agenda-overlap-off', [shared, row({ title: 'Agenda only', date: day(19), venue: 'Hall', address: '12 Main St' })]);
  const page = pageOf({ format: 'schedule', blocks: [scheduleGroup('stops', false), layoutBlock('agenda', 'agenda-overlap-off')] });
  const out = events(page as unknown as Record<string, unknown>);
  assert.ok(out.some((e) => e.name === 'Agenda only'), 'positive control: the Agenda row is an Event');
  const html = render(page);
  assert.ok(/\sid="item-\d+-6a/.test(html), 'control: the renderer scoped the Agenda');
  assertFragmentsRendered(page, out);
});

test('REFUSE (page level, schedule): a past stop is never linked (the page draws no row id for it)', () => {
  items.set('stops-past', [row({ title: 'Last year', location_name: 'Plaza', address: '1 N 1st St', start: `${YEAR - 5}-03-08T15:00:00.000Z` })]);
  const page = pageOf({ format: 'schedule', blocks: [scheduleBlock('stops-past')] });
  const out = events(page as unknown as Record<string, unknown>);
  assert.equal(out.length, 1, 'positive control: the past stop is still an Event');
  assert.deepEqual(assertFragmentsRendered(page, out), []);
});

test('DRIFT (page level): a schedule owns its stop ids, so a later Agenda sharing one stop is scoped and never linked unscoped', () => {
  // The renderer's scopeEventRowAnchors (1.95.1) counts the schedule as the
  // first owner; Templates' copy must agree, or the Agenda's other row is
  // linked to `#item-<id>` while the page renders `item-<index>-<id>`.
  const shared = getItems('stops')[0];
  items.set('agenda-overlap', [shared, row({ title: 'Agenda only', date: day(18), venue: 'Hall', address: '12 Main St' })]);
  const page = pageOf({ format: 'schedule', blocks: [scheduleBlock('stops'), layoutBlock('agenda', 'agenda-overlap')] });
  const out = events(page as unknown as Record<string, unknown>);
  assert.ok(out.some((e) => e.name === 'Agenda only'), 'positive control: the Agenda row is an Event');
  const html = render(page);
  assert.ok(/\sid="item-\d+-6a/.test(html), 'control: the renderer scoped the Agenda');
  assertFragmentsRendered(page, out);
});

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
  assert.match(slugPage, /<JsonLd schema=\{pageListingEvents\(siteData, input, pagePath\)\} \/>/, 'ComposedFormatBody (schedule and the other composed formats; no ?view=, review B2)');
  assert.match(slugPage, /pagePath=\{`\/\$\{slug\}`\}/, 'DynamicPage hands the body its path');
  assert.match(slugPage, /pagePath: `\/\$\{slug\}`,/, 'the generic arm hands renderComposedPage its path');
  const composed = read('../renderComposedPage.tsx');
  assert.match(composed, /\{pagePath && <JsonLd schema=\{pageListingEvents\(siteData, input, pagePath\)\} \/>\}/);
  assert.match(composed, /pagePath=\{pagePath\}/, 'renderComposedPage threads it to the body');
});

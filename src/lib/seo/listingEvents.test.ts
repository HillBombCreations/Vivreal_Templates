import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ContentItem, PageConfig as RendererPageConfig, SiteData as RendererSiteData } from '@hillbombcreations/site-renderer';
import { toContentItem } from '../api/collections/mapItem.ts';
import * as composition from '../../../node_modules/@hillbombcreations/site-renderer/dist/composition/index.js';
import * as eventSchema from '../../components/JsonLd/eventSchema.ts';

/**
 * F33 (open-backlog release, plan 5.T T1): listing pages mark up the dated
 * rows they draw as Events, built ONLY from the renderer's `eventRows`
 * (1.97.0) through the show rules in `eventSchema.ts`. This replaces the
 * 2026-11-02 "no listing Events" pin (the old `noListingEvents.test.ts`):
 * the owner shipped without them until one renderer helper existed, and it
 * now does.
 *
 * Two halves, because the routes are .tsx server components the plain-Node
 * runner cannot load:
 *   - RENDER: the renderer's real `composePage` body, the rows its real
 *     `eventRows` returns for the same input, and the Events built from them.
 *     Every Event names a row the body draws (name, date, anchor), and a row
 *     the body does not draw has none.
 *   - SOURCE: each of the three composed render sites hands `eventRows` the
 *     exact input it hands `composePage`, and nothing else builds a listing
 *     Event.
 *
 * Namespace imports, so at a base without the helpers each test fails on its
 * own assertion rather than the file failing to load.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../..');
const ORIGIN = 'https://markets.example.com';
const PHOENIX = 'America/Phoenix';

type Fn = (...args: unknown[]) => unknown;
type Row = { blockId: string; name: string; start: { instant?: string; date?: string; timeZone?: string }; place: string | null; anchor: string; detailUrl: string | null };
type Event = Record<string, unknown> & { name: string; startDate: string; url: string; location: Record<string, unknown> };

function helpers(): { eventRows: Fn; buildListingEventsJsonLd: Fn } {
  // Read off the namespaces; each is checked to be a function before use.
  const build = (eventSchema as unknown as Record<string, unknown>).buildListingEventsJsonLd;
  const rowsOf = (composition as unknown as Record<string, unknown>).eventRows;
  assert.equal(typeof build, 'function', 'eventSchema.ts exports buildListingEventsJsonLd');
  assert.equal(typeof rowsOf, 'function', 'the renderer exports eventRows');
  return { eventRows: rowsOf as Fn, buildListingEventsJsonLd: build as Fn };
}

const YEAR = new Date().getFullYear() + 3;
let seq = 0;
const item = (objectValue: Record<string, unknown>) =>
  toContentItem({ _id: `6a${String(++seq).padStart(22, '0')}`, objectValue }, 'collection') as ContentItem;

const items = new Map<string, ContentItem[]>([
  ['markets', [
    item({ title: 'Farmers Market', date: `${YEAR}-03-07T15:00:00.000Z`, time: '8:00 am', location: 'Roosevelt Row: 305 E Roosevelt St', venue: 'Roosevelt Row' }),
    item({ title: 'Night Market', date: `${YEAR}-03-14T01:00:00.000Z`, time: '6:00 pm', location: 'Heritage Square', venue: 'Heritage Square: 115 N 6th St' }),
    item({ title: 'Old Market', date: '2020-03-14T01:00:00.000Z', time: '6:00 pm', location: 'Past Hall: 1 Main St', venue: 'Past Hall: 1 Main St' }),
  ]],
  // The Comedy Collective's "Hotshots", as stored: the date at 07:00Z, the time typed separately.
  ['shows', [
    item({ title: 'Hotshots', date: '2025-11-15T07:00:00.000Z', time: '9:00 pm', venue: '1331 N. Milwaukee Ave., Chicago IL' }),
  ]],
  ['stops', [
    item({ title: 'Downtown market', location_name: 'Downtown Phoenix Farmers Market', address: '721 N Central Ave', start: `${YEAR}-03-08T15:00:00.000Z` }),
  ]],
]);
const siteData = { pages: {}, pageConfigs: [], primary: '#365b99', timezone: PHOENIX } as unknown as RendererSiteData; // composition reads only these keys here

const layoutBlock = (displayAs: string, sectionConfig?: Record<string, unknown>, enabled = true) => ({
  id: `blk_${displayAs}`, order: 0, enabled,
  type: { kind: 'layout', dispatchId: displayAs },
  config: { bindings: [{ collectionId: 'markets', displayAs, ...(sectionConfig ? { sectionConfig } : {}) }] },
});
const whatsOnShows = { id: 'blk_shows', order: 0, enabled: true, type: { kind: 'layout', dispatchId: 'whats-on' }, config: { bindings: [{ collectionId: 'shows', displayAs: 'whats-on', sectionConfig: { timezone: 'America/Chicago', showPast: true } }] } };
const scheduleBlock = { id: 'blk_schedule', order: 0, enabled: true, type: { kind: 'page-template', dispatchId: 'schedule' }, config: { bindings: [{ collectionId: 'stops' }] } };

function inputFor(page: Record<string, unknown>) {
  const config = { labels: {}, collectionId: null, name: 'Markets', slug: 'markets', ...page } as unknown as RendererPageConfig; // page fixtures carry only the keys composition reads
  return {
    page: config,
    pages: [config],
    data: { siteData, getItems: (id: string) => items.get(id) ?? [], getIntegrationItems: () => [] },
    options: { mode: 'live' as const },
    isHome: false,
  };
}

/** The body as served, the rows, and the Events, all from one input. */
function serve(page: Record<string, unknown>, origin: string | null = ORIGIN) {
  const { eventRows, buildListingEventsJsonLd } = helpers();
  const input = inputFor(page);
  const html = renderToStaticMarkup(createElement('div', null, composition.composePage(input as Parameters<typeof composition.composePage>[0])));
  const rows = eventRows(input.page, input.data, { ...input.options, pages: input.pages, isHome: input.isHome }) as Row[];
  const events = buildListingEventsJsonLd(rows, { origin, pagePath: '/markets', timezone: PHOENIX, organizationId: `${ORIGIN}/#organization`, page: input.page }) as Event[];
  return { html, rows, events };
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** The drawn element of one row: from its id to the next row's id. */
function rowHtml(html: string, anchor: string): string {
  const at = html.indexOf(`id="${anchor}"`);
  assert.ok(at >= 0, `the body draws #${anchor}`);
  const next = html.indexOf('id="item-', at + 4);
  return html.slice(at, next === -1 ? at + 4000 : next);
}
const text = (h: string) => h.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

/**
 * Name, date, TIME and anchor of each Event are drawn (review B1: the day alone
 * let a wrong clock through): a `dateTime` of the same instant, or the day as
 * "MAR 7" text and, when the Event names a time, that time as "8:00 AM" text.
 */
function assertDrawn(html: string, event: Event) {
  const anchor = event.url.split('#')[1] ?? `item-${event.url.split('/').pop()}`;
  const drawn = rowHtml(html, anchor);
  const words = text(drawn);
  assert.ok(words.includes(event.name), `${anchor} draws the name "${event.name}"`);
  const instant = Date.parse(event.startDate);
  const times = [...drawn.matchAll(/dateTime="([^"]+)"/gi)].map((m) => Date.parse(m[1]));
  if (times.includes(instant)) return;
  const [, month, day] = event.startDate.slice(0, 10).split('-').map(Number);
  const dayText = new RegExp(`\\b${MONTHS[month - 1]} ${day}\\b`, 'i');
  assert.ok(dayText.test(words), `${anchor} draws the day of ${event.startDate}`);
  const wall = /T(\d{2}):(\d{2})/.exec(event.startDate);
  if (!wall) return;
  const hour = Number(wall[1]);
  const clock = `${hour % 12 || 12}:${wall[2]} ${hour < 12 ? 'AM' : 'PM'}`;
  assert.ok(new RegExp(`\\b${clock}\\b`, 'i').test(words), `${anchor} draws the time of ${event.startDate} (${clock}), got: ${words.slice(0, 200)}`);
}

// ---------------------------------------------------------------------------
// RENDER
// ---------------------------------------------------------------------------

test('ALLOW (agenda): a drawn row with a street gets an Event with its name, date in the shop zone and anchor', () => {
  const { html, events } = serve({ format: 'standard', blocks: [layoutBlock('agenda')] });
  const farmers = events.find((e) => e.name === 'Farmers Market');
  assert.ok(farmers, `an Event for the drawn Farmers Market row, got ${JSON.stringify(events.map((e) => e.name))}`);
  assert.equal(farmers.startDate, `${YEAR}-03-07T08:00:00-07:00`);
  assert.match(farmers.url, new RegExp(`^${ORIGIN}/markets#item-6a\\d{22}$`));
  assert.deepEqual(farmers.location, { '@type': 'Place', name: 'Roosevelt Row', address: { '@type': 'PostalAddress', streetAddress: '305 E Roosevelt St' } });
  assert.equal(farmers.organizer && (farmers.organizer as { '@id': string })['@id'], `${ORIGIN}/#organization`);
  assertDrawn(html, farmers);
});

for (const [name, page] of [
  ['agenda', { format: 'standard', blocks: [layoutBlock('agenda')] }],
  ['schedule', { format: 'schedule', blocks: [scheduleBlock] }],
  ['calendar', { format: 'standard', blocks: [layoutBlock('calendar')] }],
  ['event wall', { format: 'standard', blocks: [layoutBlock('event-wall')] }],
] as const) {
  test(`ALLOW (${name}): every Event's name, date and anchor appear in the served body`, () => {
    const { html, rows, events } = serve(page);
    assert.ok(rows.length > 0, 'positive control: the layout drew rows');
    for (const event of events) assertDrawn(html, event);
    // One Event per row at most, each for a row eventRows returned.
    const anchors = new Set(rows.map((r) => r.anchor));
    for (const event of events) {
      const fragment = event.url.includes('#') ? event.url.split('#')[1] : rows.find((r) => r.detailUrl && event.url === `${ORIGIN}${r.detailUrl}`)?.anchor;
      assert.ok(fragment && anchors.has(fragment), `${event.url} names a drawn row`);
    }
  });
}

test("REFUSE (review B1): What's On rows get no Event while the renderer gives them a clock the card does not draw", () => {
  const shows = serve({ format: 'standard', blocks: [whatsOnShows] });
  assert.match(text(shows.html), /Hotshots/, 'control: the card is drawn');
  assert.match(text(shows.html), /9:00 pm/i, 'control: the card draws the typed time');
  assert.ok(shows.rows.length > 0, 'control: eventRows returns the row');
  assert.deepEqual(shows.events, [], 'no Event, never one that says 01:00 for a 9:00 pm show');
  const markets = serve({ format: 'standard', blocks: [layoutBlock('whats-on')] });
  assert.ok(markets.rows.length > 0, 'control: rows with streets and typed times');
  assert.deepEqual(markets.events, [], "no What's On Event at all");
  // Nested inside a group, and alongside an agenda on the same page: only the What's On block is held.
  const group = { id: 'grp', order: 0, enabled: true, type: { kind: 'group' }, config: { children: [whatsOnShows] } };
  const held = (eventSchema as unknown as Record<string, unknown>).heldListingBlockIds; // a named export, checked next
  assert.equal(typeof held, 'function', 'eventSchema.ts exports heldListingBlockIds');
  assert.deepEqual([...(held as (page: unknown) => Set<string>)({ blocks: [group, layoutBlock('agenda')] })], ['blk_shows']); // checked above
  const mixed = serve({ format: 'standard', blocks: [whatsOnShows, { ...layoutBlock('agenda'), order: 1 }] });
  assert.ok(mixed.events.some((e) => e.name === 'Farmers Market'), 'the agenda beside it keeps its Events');
  assert.ok(!mixed.events.some((e) => e.name === 'Hotshots'));
});

test("TRIPWIRE (review B1): renderer eventRows (whatsOnRows, showDateStart) still drops the What's On typed time", () => {
  // When this goes red the renderer gives What's On rows the time the card draws:
  // delete the hold in eventSchema.ts `heldListingBlockIds` and let these rows through.
  const { rows } = serve({ format: 'standard', blocks: [whatsOnShows] });
  const hotshots = rows.find((r) => r.name === 'Hotshots');
  assert.ok(hotshots, 'control: the row exists');
  assert.deepEqual(hotshots.start, { instant: '2025-11-15T07:00:00.000Z', timeZone: 'America/Chicago' }, 'the stored instant, whose clock (01:00) is not the card\'s 9:00 pm');
  assert.doesNotMatch(JSON.stringify(hotshots), /9:00|21:00/, 'the typed time is not in the row');
});

test('ALLOW (schedule): the row\'s own street and its drawn time are used', () => {
  const schedule = serve({ format: 'schedule', blocks: [scheduleBlock] }).events;
  assert.equal(schedule.length, 1);
  assert.equal(schedule[0].name, 'Downtown Phoenix Farmers Market');
  assert.equal(schedule[0].startDate, `${YEAR}-03-08T08:00:00-07:00`);
  assert.deepEqual((schedule[0].location as { address: unknown }).address, { '@type': 'PostalAddress', streetAddress: '721 N Central Ave' });
});

test('REFUSE: a row the body does not draw has no Event (past rows hidden, a block switched off)', () => {
  const upcoming = serve({ format: 'standard', blocks: [layoutBlock('agenda', { upcomingOnly: true })] });
  assert.doesNotMatch(text(upcoming.html), /Old Market/, 'control: the hidden past row is not drawn');
  assert.ok(upcoming.events.some((e) => e.name === 'Farmers Market'), 'control: a drawn row still has its Event');
  assert.ok(!upcoming.events.some((e) => e.name === 'Old Market'), 'no Event for the hidden past row');
  const all = serve({ format: 'standard', blocks: [layoutBlock('agenda')] });
  assert.ok(all.events.some((e) => e.name === 'Old Market'), 'control: drawn, the same row has its Event');
  const off = serve({ format: 'standard', blocks: [layoutBlock('agenda', undefined, false)] });
  assert.deepEqual(off.rows, []);
  assert.deepEqual(off.events, [], 'a block that is off draws nothing and marks nothing');
});

test('REFUSE: a drawn row with no street in its own place has no Event, and the business address is never borrowed', () => {
  const { html, events } = serve({ format: 'standard', blocks: [layoutBlock('agenda')] });
  assert.match(text(html), /Night Market/, 'control: the row is drawn');
  assert.ok(!events.some((e) => e.name === 'Night Market'), '"Heritage Square" names no street');
  const calendar = serve({ format: 'standard', blocks: [layoutBlock('calendar')] });
  assert.ok(calendar.rows.length > 0, 'control: the calendar drew rows');
  assert.deepEqual(calendar.events, [], 'a calendar row draws no place, so it is never an Event');
  const wall = serve({ format: 'standard', blocks: [layoutBlock('event-wall')] });
  assert.ok(wall.rows.length > 0, 'control: the wall drew rows');
  assert.deepEqual(wall.events, [], 'an event wall badge is display text, never a date');
});

test('REFUSE: a day stored as midnight on the shop clock is a date, never a midnight start', () => {
  const { buildListingEventsJsonLd } = helpers();
  const row = (instant: string): Row => ({ blockId: 'blk_agenda', name: 'Friday Night Standup', start: { instant, timeZone: 'America/Chicago' }, place: 'Uptown Taproom: 1265 W Wilson Ave', anchor: 'item-a1', detailUrl: '/shows/friday' });
  const [midnight] = buildListingEventsJsonLd([row('2026-07-24T05:00:00.000Z')], { origin: ORIGIN, pagePath: '/shows', page: { blocks: [] } }) as Event[];
  assert.equal(midnight.startDate, '2026-07-24', 'the day the card draws');
  const [evening] = buildListingEventsJsonLd([row('2026-07-25T00:00:00.000Z')], { origin: ORIGIN, pagePath: '/shows', page: { blocks: [] } }) as Event[];
  assert.equal(evening.startDate, '2026-07-24T19:00:00-05:00', 'control: a real time is kept, in the shop zone');
  assert.equal(midnight.url, `${ORIGIN}/shows/friday`);
});

test('REFUSE: no durable origin, no Events; ALLOW: at most 50 on a page', () => {
  assert.deepEqual(serve({ format: 'standard', blocks: [layoutBlock('agenda')] }, null).events, []);
  const { buildListingEventsJsonLd } = helpers();
  const many: Row[] = Array.from({ length: 60 }, (_, i) => ({
    blockId: 'blk_schedule', name: `Stop ${i}`, start: { instant: `${YEAR}-04-01T15:00:00.000Z` }, place: `${100 + i} N Central Ave`, anchor: `item-r${i}`, detailUrl: null,
  }));
  const events = buildListingEventsJsonLd(many, { origin: ORIGIN, pagePath: '/', timezone: PHOENIX, page: { blocks: [] } }) as Event[];
  assert.equal(events.length, 50);
  assert.equal(events[0].url, `${ORIGIN}/#item-r0`, 'the home page anchors off the bare origin');
});

// ---------------------------------------------------------------------------
// SOURCE
// ---------------------------------------------------------------------------

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

test('SOURCE: each composed render site gives eventRows the exact input it gives composePage', () => {
  const sites: Array<[string, RegExp, RegExp]> = [
    [path.join('app', 'page.tsx'), /composePage\(input\)/, /pageListingEventsJsonLd\(siteData, input, "\/"\)/],
    [path.join('app', '[slug]', 'page.tsx'), /composePage\(composeInput\)/, /pageListingEventsJsonLd\(siteData, composeInput, `\/\$\{composedPage\.slug \?\? ""\}`\)/],
    [path.join('lib', 'renderComposedPage.tsx'), /composePage\(composeInput\)/, /pageListingEventsJsonLd\(siteData, composeInput, `\/\$\{composedPage\.slug \?\? ''\}`\)/],
  ];
  for (const [file, composed, marked] of sites) {
    const source = fs.readFileSync(path.join(SRC, file), 'utf8');
    assert.match(source, composed, `${file} composes from one named input`);
    assert.match(source, marked, `${file} marks up that same input`);
    // The LAST child of its fragment: an element placed before a sibling moves that sibling's
    // useId (measured: a capture field's id-derived class changed on two sites' home pages).
    assert.match(source, new RegExp(`${marked.source}\\}\\s*\\/>\\s*<\\/>`), `${file} draws the Events last`);
  }
  const wrapper = fs.readFileSync(path.join(SRC, 'lib', 'seo', 'listingEvents.ts'), 'utf8');
  assert.match(wrapper, /eventRows\(input\.page, input\.data, \{/);
  assert.match(wrapper, /buildListingEventsJsonLd\(rows, \{/);
  assert.doesNotMatch(wrapper, /objectValue|\.raw\b|getItems\(/, 'the wrapper never reads an item itself');
});

test('SOURCE: the show detail arm and the listing builder are the only Event builders', () => {
  const files = sourceFiles(SRC);
  assert.ok(files.length > 200, `positive control: read ${files.length} source files`);
  const builderCalls = files.flatMap((f) => (fs.readFileSync(f, 'utf8').match(/(?<!function )buildShowEventJsonLd\(/g) ?? []).map(() => path.relative(SRC, f)));
  assert.deepEqual(builderCalls.sort(), [path.join('app', '[slug]', '[itemId]', 'page.tsx'), path.join('components', 'JsonLd', 'eventSchema.ts')].sort());
  const listingCallers = files.filter((f) => /buildListingEventsJsonLd\(/.test(fs.readFileSync(f, 'utf8')) && !f.endsWith('eventSchema.ts')).map((f) => path.relative(SRC, f));
  assert.deepEqual(listingCallers, [path.join('lib', 'seo', 'listingEvents.ts')]);
});

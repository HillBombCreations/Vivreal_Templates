/**
 * Event JSON-LD for the dated rows a LISTING page shows (next release 2026-12,
 * plan 11.3, T3; owner decisions OD-4 and OD-5 of 2026-11-01).
 *
 * WHAT IS MARKED UP. Before this, only a show's own detail page carried an
 * Event. Now a page also marks up, as one Event each:
 *   - every stop of a schedule page (`schedule` and the atomized
 *     `schedule-agenda` block), dated by the renderer's own stop reader, at the
 *     stop's next date (a weekly market at its next market day);
 *   - every row of a list drawn as Agenda, Calendar, What's On or Event wall
 *     on any page, when the list counts as events (OD-4, `./eventFields.ts`).
 * Each passes the Event builder's honest floor (`eventSchema.ts`: a valid date
 * in the business's zone and a real street address, or nothing). The
 * business's own address is never borrowed for a row.
 *
 * WHERE EACH EVENT POINTS (OD-5). An item with no page of its own is linked
 * to the page that lists it, plus `#item-<id>` when, and only when, the served
 * HTML of this page carries that id. Renderer 1.95.0 (R3) gives a row that id
 * in the four event layouts, and 1.95.1 in a schedule's rows too. The first
 * section that draws an item owns `item-<id>` (a schedule counts every dated
 * stop it holds, upcoming and past, even with its Agenda part switched off,
 * since the renderer still builds it from that part's list); a later section
 * sharing any item is
 * scoped (`item-<index>-<id>`, renderer `scopeEventRowAnchors`). A scoped
 * section is never linked: the index counts sections this module cannot see
 * (headers, heroes), so its ids are not knowable here. A row whose id the
 * served HTML may not carry gets the page address with no fragment, which
 * lands at the top of the page. The rules below are read from the renderer at
 * 1.95.1 and are deliberately conservative; `listingEvents.test.ts` renders
 * the real renderer and fails if any emitted fragment is missing from the
 * page's HTML, so a renderer change that drops or rescopes an id fails here.
 *   - Agenda: every row the agenda dates, unless the block shows only
 *     upcoming dates (then no fragment: which rows are past is decided at the
 *     visitor's request time).
 *   - What's On: every row, unless past events are hidden.
 *   - Calendar: the computer view is a month grid with no ids; the phone list
 *     below it carries them, for the month the calendar opens on. A fragment
 *     only when that month is certain: the block names it (`initialMonth`), or
 *     every dated row falls in one month. On a computer the link lands at the
 *     top of the page (OD-5 accepts this).
 *   - Event wall: the phone copy carries the ids for its first page of two
 *     cards only, so only those two.
 *   - Schedule pages, by the view the page's own address serves: the
 *     toolbar's or the page's `defaultView`, the board style always the
 *     agenda, a switched-off part falling back as the renderer does. Never a
 *     `?view=` a visitor asked for: the Event's url carries no query, so it
 *     opens the default view (review B2). Agenda and map: every upcoming stop. Month: the
 *     first chip of each upcoming stop in the month the calendar opens on (the
 *     soonest stop's month), only when the schedule has a zone. A past stop:
 *     never. "Upcoming" is read an hour ahead too, so a stop that stops
 *     counting between this read and the render is never linked.
 *   - A row whose `status` is cancelled (either spelling) or private is not
 *     marked up at all, on any arm (review B1).
 *   - A block that trims, filters or remaps its list (`itemLimit`, `scope`,
 *     `fieldMap`) gets no fragment, since which rows it draws is decided
 *     after this reads them.
 *
 * WHICH SECTIONS DRAW (review B4). Read from the blocks the way the renderer
 * reads them, never from a binding's own `enabled` flag, which the renderer
 * ignores when it draws: a block draws when it and every block above it are
 * on; a layout draws its FIRST binding (an integration binding draws no
 * collection rows), the schedule template its first binding, a coordinated
 * schedule group the first binding with a list on its Agenda part (whether
 * that part is on or off). Only TOP-LEVEL sections own and scope ids (the
 * renderer's `scopeEventRowAnchors` walks the page's top-level sections only);
 * a section inside a plain group draws its ids unscoped and owns nothing.
 * Events come only from a drawn section whose binding and block are on.
 *
 * A ROW WITH ITS OWN DETAIL PAGE (not a show). When the renderer links the row
 * to a detail page (`resolveServingDetailRouteSlug`, mirrored in
 * `lib/detail/linkedItems.ts`, unless the binding opts out with
 * `detailEligible: false`), its Event points at that page, at the address the
 * row links (the readable key when the page names one), not at the list.
 *
 * At most `LISTING_EVENT_CAP` (50) Events per page (OD-5), one per item.
 *
 * NOT for an item that has a page of its own with its own Event: a show list
 * (the collection of a `shows` page, whose detail pages carry the show's
 * Event) is skipped, so one show is never two Events at two addresses. OD-5
 * covers events with no detail page.
 *
 * Pure: the caller passes the composePage input's page and item getter, the
 * page's address and "now". Runs under `node --test`.
 */
import type { ContentItem } from '@hillbombcreations/site-renderer';
import type { SiteData } from '@/types/SiteData';
import { readStopTiming, scheduleTimezone, stopAnchor, stopOccurrences, systemValue } from '@hillbombcreations/site-renderer/bindings';
import { buildEventJsonLd } from '../../components/JsonLd/eventSchema.ts';
import { seedFreeText } from './seedFreeText.ts';
import { isEventList, readEventFields, type EventFields } from './eventFields.ts';
import { resolveSiteOrigin } from '../og/siteOrigin.ts';
import { siteOrganizationId } from '../../components/JsonLd/schema.ts';
import { pageDetailCollectionId, type DetailPageLike } from '../detail/detailCollection.ts';
import { servingDetailRouteSlug, type LinkPage } from '../detail/linkedItems.ts';

/** OD-5: never more Events than this on one page. */
export const LISTING_EVENT_CAP = 50;

/**
 * The layouts that give each row an `item-<id>` (renderer 1.95.0,
 * `lib/itemAnchor.ts` `EVENT_ROW_LAYOUTS`; the test pins this copy to it).
 */
export const EVENT_ROW_LAYOUTS: ReadonlySet<string> = new Set(['agenda', 'calendar', 'whats-on', 'event-wall']);

/** The schedule page's stop list: the monolith template and the atomized agenda child. */
const SCHEDULE_DISPATCH: ReadonlySet<string> = new Set(['schedule', 'schedule-agenda']);

/** The renderer's own fragment-safe id rule (`eventRowAnchor`). */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface ListingEventsInput {
  /** The page as composePage receives it (`blocks`, `labels`, and for detail links `slug`, `format`, `detailPage`). */
  page: { blocks?: unknown; labels?: unknown; slug?: string | null; format?: string; detailPage?: unknown };
  /** Every page of the site, as composePage receives them: where a row's detail page lives. */
  pages?: readonly LinkPage[];
  /** The composePage input's item getter, so the Events describe the rows the page draws. */
  getItems: (collectionId: string) => ContentItem[];
  /** The page's own absolute address, no fragment. */
  pageUrl: string;
  /** IANA zone of the business (`siteData.timezone`). */
  timezone?: string;
  /** The site node's `@id`, for `organizer`. */
  organizationId?: string;
  /** Epoch ms of this render: the same instant the layouts read. */
  now: number;
  /** Lists whose items already carry an Event on their own detail page (shows). */
  skipCollections?: ReadonlySet<string>;
}

type ScheduleView = 'agenda' | 'month' | 'map';

type SectionConfig = Record<string, unknown>;

/** When the renderer's agenda and calendar date a row (`lib/eventsCalendar.ts` `parseEventDates`). */
function rendererTimestamp(item: ContentItem): number | null {
  const raw = (item.raw ?? {}) as Record<string, unknown>;
  for (const key of ['startDate', 'start', 'startsAt']) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value < 1e12 && value > 1e9 ? value * 1000 : value;
    if (typeof value === 'string' && value.trim()) {
      const ts = Date.parse(value.trim());
      if (Number.isFinite(ts)) return ts;
    }
  }
  if (typeof item.date === 'string' && /\d{4}/.test(item.date)) {
    const ts = Date.parse(item.date.trim());
    if (Number.isFinite(ts)) return ts;
  }
  return null;
}

/** `year-month` (month 0 to 11), read on the server's clock as the calendar reads it. */
function monthOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/** The calendar's authored opening month (`initialMonth: 'YYYY-MM'`), as the renderer parses it. */
function authoredMonth(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const m = /^(\d{4})-(\d{1,2})$/.exec(value.trim());
  if (!m) return undefined;
  const month = Number(m[2]) - 1;
  return month >= 0 && month <= 11 ? `${Number(m[1])}-${month}` : undefined;
}

/** The ids one event-row section is certain to render, per the rules in the docblock. */
function anchoredIds(displayAs: string, items: ContentItem[], config: SectionConfig): Set<string> {
  const ids = new Set<string>();
  if (displayAs === 'agenda') {
    if (config.upcomingOnly === true) return ids;
    for (const item of items) if (rendererTimestamp(item) !== null) ids.add(item.id);
  } else if (displayAs === 'whats-on') {
    if (config.showPast === false) return ids;
    for (const item of items) ids.add(item.id);
  } else if (displayAs === 'calendar') {
    const dated = items.filter((item) => rendererTimestamp(item) !== null);
    if (dated.length === 0) {
      // No dates at all: the calendar lists every row, each with its id.
      for (const item of items) ids.add(item.id);
      return ids;
    }
    const months = new Set(dated.map((item) => monthOf(rendererTimestamp(item) as number)));
    const opening = authoredMonth(config.initialMonth) ?? (months.size === 1 ? [...months][0] : undefined);
    if (opening === undefined) return ids;
    for (const item of dated) if (monthOf(rendererTimestamp(item) as number) === opening) ids.add(item.id);
  } else if (displayAs === 'event-wall') {
    for (const item of items.filter((i) => (i.title ?? '').trim() !== '').slice(0, 2)) ids.add(item.id);
  }
  return ids;
}

/**
 * A row the page shows but that is not happening as scheduled: its owner set
 * `status` to cancelled (either spelling) or private. Marking it up as a
 * scheduled Event would be untrue (review B1), on every arm.
 */
const NOT_SCHEDULED_STATUS = /^(?:cancell?ed|private)$/i;

function notScheduled(item: ContentItem): boolean {
  const status = (item.raw as Record<string, unknown> | undefined)?.status;
  return typeof status === 'string' && NOT_SCHEDULED_STATUS.test(status.trim());
}

/** How far ahead "upcoming" is read again, so the render a moment later agrees. */
const UPCOMING_MARGIN_MS = 60 * 60 * 1000;

type Block = { id?: unknown; enabled?: unknown; type?: { dispatchId?: unknown }; config?: Record<string, unknown> };

/** The block with this id, anywhere in the page's blocks, with its parent group. */
function findBlock(blocks: unknown, id: string, parent?: Block): { block: Block; parent?: Block } | undefined {
  if (!Array.isArray(blocks)) return undefined;
  for (const block of blocks as Block[]) {
    if (block?.id === id) return { block, parent };
    const found = findBlock(block?.config?.children, id, block);
    if (found) return found;
  }
  return undefined;
}

const asView = (value: unknown): ScheduleView => (value === 'month' || value === 'map' ? value : 'agenda');

/**
 * The view a schedule section serves at the page's own address (no query), as
 * the renderer decides it (1.95.1: the `blocks.ts` schedule arms,
 * `ScheduleProvider`, `ScheduleStorefront`), and the zone it reads stops on.
 * `null` view: no part is switched on.
 */
function scheduleServing(
  binding: { blockId: string; dispatchId: string },
  page: ListingEventsInput['page'],
  siteZone: string | undefined,
): { view: ScheduleView | null; zone: string | undefined } {
  const labels = (page.labels ?? {}) as Record<string, unknown>;
  if (binding.dispatchId === 'schedule') {
    // The page template: page labels only, every part on, no `?view=`.
    const view = labels.agendaStyle === 'board' ? 'agenda' : asView(labels.defaultView);
    return { view, zone: scheduleTimezone(labels.timezone, siteZone) };
  }
  const children = (findBlock(page.blocks, binding.blockId)?.parent?.config?.children ?? []) as Block[];
  const child = (dispatchId: string) => children.find((c) => c?.type?.dispatchId === dispatchId);
  const on = (dispatchId: string) => {
    const c = child(dispatchId);
    return c !== undefined && c.enabled !== false;
  };
  const toolbar = (child('schedule-toolbar')?.config ?? {}) as Record<string, unknown>;
  const agendaCfg = (child('schedule-agenda')?.config ?? {}) as Record<string, unknown>;
  const zone = scheduleTimezone(toolbar.timezone, labels.timezone, siteZone);
  const [agenda, calendar, map] = [on('schedule-agenda'), on('schedule-calendar'), on('schedule-map')];
  if ((agendaCfg.agendaStyle ?? labels.agendaStyle) === 'board' && agenda) return { view: 'agenda', zone };
  const view = asView(toolbar.defaultView ?? labels.defaultView);
  if (view === 'agenda' && agenda) return { view, zone };
  if (view === 'month' && calendar) return { view, zone };
  if ((view === 'map' || (!agenda && !calendar)) && map) return { view: 'map', zone };
  return { view: agenda ? 'agenda' : calendar ? 'month' : map ? 'map' : null, zone };
}

/** The stop's occurrence the page draws as upcoming from `from`, read as the renderer reads it (its `date` included). */
function upcomingAt(item: ContentItem, zone: string | undefined, from: number) {
  return stopOccurrences(readStopTiming({ raw: item.raw, date: item.date }), { timezone: zone, from, max: 1 })[0];
}

/** The stop ids a schedule section draws with a row id in the view it serves. */
function scheduleAnchoredIds(items: ContentItem[], view: ScheduleView | null, zone: string | undefined, now: number): Set<string> {
  const ids = new Set<string>();
  if (view === null) return ids;
  const steady = items.filter((item) => upcomingAt(item, zone, now) && upcomingAt(item, zone, now + UPCOMING_MARGIN_MS));
  if (view === 'agenda' || view === 'map') {
    for (const item of steady) ids.add(item.id);
    return ids;
  }
  // Month: the grid opens on the soonest upcoming stop's month, read now and
  // an hour on; when the two disagree the opening month is not certain.
  if (!zone) return ids;
  const openingMonth = (from: number) => {
    const soonest = items
      .map((item) => upcomingAt(item, zone, from))
      .filter((occ) => occ !== undefined)
      .sort((a, b) => a.startMs - b.startMs)[0];
    return soonest?.date.slice(0, 7);
  };
  const opening = openingMonth(now);
  if (opening === undefined || opening !== openingMonth(now + UPCOMING_MARGIN_MS)) return ids;
  for (const item of steady) if (upcomingAt(item, zone, now)?.date.slice(0, 7) === opening) ids.add(item.id);
  return ids;
}

/** `HH:MM` of an instant on the schedule's clock, for the builder's time parser. */
function clockTime(startMs: number, zone: string): string | undefined {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(startMs));
  } catch {
    // An unknown zone: the builder then gives the date alone, as it does for shows.
    return undefined;
  }
}

/**
 * The fields of a schedule stop at its next date (or its date as written, once
 * past).
 */
function stopFields(item: ContentItem, zone: string | undefined, now: number): EventFields {
  const raw = (item.raw ?? {}) as Record<string, unknown>;
  // `raw` only: the item's `date` falls back to its publish date, which is not when a stop happens.
  const timing = readStopTiming({ raw });
  const occurrence = stopOccurrences(timing, { timezone: zone, from: now, max: 1 })[0] ?? stopAnchor(timing, { timezone: zone });
  const place = readEventFields(raw);
  const name = [raw.location_name, raw.locationName].find((v) => typeof v === 'string' && v.trim() !== '') as string | undefined;
  return {
    // An all-day stop is its calendar day; a timed one is its day and its
    // clock time on the schedule's zone, so the builder writes the real offset.
    date: occurrence ? (occurrence.allDay ? occurrence.date : occurrence.start) : undefined,
    time: occurrence && !occurrence.allDay && zone ? clockTime(occurrence.startMs, zone) : undefined,
    location: name?.trim() ?? place.location,
    address: place.address,
    onlineUrl: place.onlineUrl,
  };
}

/** One collection section the renderer draws, read from the blocks as it reads them. */
interface DrawnSection {
  blockId: string;
  dispatchId: string;
  kind: string;
  displayAs?: string;
  collectionId: string;
  sectionConfig: SectionConfig;
  /** A top-level section: it owns its ids and can be scoped. */
  topLevel: boolean;
  /** The block, every block above it and the binding are on: it gets Events. */
  eventsOn: boolean;
}

type DrawnBinding = { collectionId?: unknown; integrationProvider?: unknown; displayAs?: unknown; enabled?: unknown; sectionConfig?: unknown };
type DrawnBlock = Block & { order?: unknown; type?: { kind?: unknown; dispatchId?: unknown } };

const byOrder = (blocks: unknown): DrawnBlock[] =>
  (Array.isArray(blocks) ? (blocks as DrawnBlock[]) : [])
    .filter((b) => !!b && typeof b === 'object')
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

function section(block: DrawnBlock, binding: DrawnBinding | undefined, topLevel: boolean, blockOn: boolean): DrawnSection | undefined {
  if (!binding || typeof binding.collectionId !== 'string' || binding.collectionId === '') return undefined;
  return {
    blockId: String(block.id ?? ''),
    dispatchId: String(block.type?.dispatchId ?? ''),
    kind: String(block.type?.kind ?? ''),
    ...(typeof binding.displayAs === 'string' ? { displayAs: binding.displayAs } : {}),
    collectionId: binding.collectionId,
    sectionConfig: (binding.sectionConfig ?? {}) as SectionConfig,
    topLevel,
    eventsOn: blockOn && binding.enabled !== false,
  };
}

/**
 * The collection sections the renderer draws, in drawing order (`mapBlocks`,
 * `blockToComposedSection`, `mapGroup`, `mapLayout`, the schedule arms of
 * `composition/blocks.js` at 1.95.1). Only the event rows and schedules this
 * module marks up are returned.
 */
function drawnSections(blocks: unknown, topLevel = true, out: DrawnSection[] = []): DrawnSection[] {
  for (const block of byOrder(blocks)) {
    if (block.enabled === false) continue;
    const kind = block.type?.kind;
    const dispatchId = block.type?.dispatchId;
    const config = (block.config ?? {}) as Record<string, unknown>;
    const bindings = (Array.isArray(config.bindings) ? config.bindings : []) as DrawnBinding[];
    if (kind === 'group' && config.coordinated === 'schedule') {
      // The schedule is built from the Agenda part's first list, on or off.
      const agenda = (Array.isArray(config.children) ? (config.children as DrawnBlock[]) : []).find((c) => c?.type?.dispatchId === 'schedule-agenda');
      const agendaBindings = (Array.isArray(agenda?.config?.bindings) ? agenda?.config?.bindings : []) as DrawnBinding[];
      const drawn = agenda && section(agenda, agendaBindings.find((b) => !!b?.collectionId), topLevel, agenda.enabled !== false);
      if (drawn) out.push(drawn);
      continue;
    }
    if (kind === 'group' && typeof config.coordinated === 'string') continue;
    if (kind === 'group') {
      drawnSections(config.children, false, out);
      continue;
    }
    const first = bindings[0];
    if (kind === 'layout' && first && !first.integrationProvider && typeof first.displayAs === 'string' && EVENT_ROW_LAYOUTS.has(first.displayAs)) {
      const drawn = section(block, first, topLevel, true);
      if (drawn) out.push(drawn);
    } else if (kind === 'page-template' && dispatchId === 'schedule') {
      const drawn = section(block, first, topLevel, true);
      if (drawn) out.push(drawn);
    }
  }
  return out;
}

/** The address the renderer links a layout row to (`mapLayout`), or `undefined` when it links none. */
function detailAddress(input: ListingEventsInput, drawn: DrawnSection, item: ContentItem): string | undefined {
  if (drawn.sectionConfig.detailEligible === false) return undefined;
  const page = input.page as LinkPage;
  const owner = servingDetailRouteSlug(page, input.pages ?? [], drawn.collectionId);
  if (!owner) return undefined;
  // `resolveItemKeyField`: the readable key the CURRENT page names, for its own collection.
  const dp = (input.page.detailPage ?? {}) as { itemKeyField?: unknown; itemCollectionId?: unknown };
  const keyField = typeof dp.itemKeyField === 'string' && (!dp.itemCollectionId || dp.itemCollectionId === drawn.collectionId) ? dp.itemKeyField : undefined;
  const keyed = keyField ? systemValue(item.raw, keyField) : undefined;
  const segment = typeof keyed === 'string' && keyed.trim() ? keyed.trim() : item.id;
  return `${new URL(input.pageUrl).origin}/${owner}/${encodeURIComponent(segment)}`;
}

/** Every Event this page marks up, at most `LISTING_EVENT_CAP`, in drawing order. */
export function buildListingEvents(input: ListingEventsInput): Record<string, unknown>[] {
  const events: Record<string, unknown>[] = [];
  const marked = new Set<string>();
  // The ids earlier top-level event sections drew (renderer `scopeEventRowAnchors`).
  const earlierRowIds = new Set<string>();

  for (const drawn of drawnSections(input.page.blocks)) {
    const isSchedule = SCHEDULE_DISPATCH.has(drawn.dispatchId);
    const items = input.getItems(drawn.collectionId).filter((item) => typeof item.id === 'string' && item.id !== '');
    const config = drawn.sectionConfig;
    // What the renderer counts as this section's rows: a schedule's dated stops
    // (upcoming and past, dated as it dates them), a layout's items.
    const rows = isSchedule ? items.filter((item) => stopAnchor(readStopTiming({ raw: item.raw, date: item.date })) !== null) : items;
    const scoped = drawn.topLevel && rows.some((item) => earlierRowIds.has(item.id));
    if (drawn.topLevel && !scoped) for (const item of rows) earlierRowIds.add(item.id);
    // Ownership is counted first: a section with no Events still owns its rows' ids.
    if (!drawn.eventsOn || input.skipCollections?.has(drawn.collectionId)) continue;

    let anchored = new Set<string>();
    let zone = input.timezone;
    if (isSchedule) {
      const serving = scheduleServing(drawn, input.page, input.timezone);
      zone = serving.zone;
      if (!scoped) anchored = scheduleAnchoredIds(rows, serving.view, zone, input.now);
    } else {
      const reshaped = config.itemLimit !== undefined || config.scope !== undefined || config.fieldMap !== undefined;
      if (!scoped && !reshaped) anchored = anchoredIds(drawn.displayAs as string, items, config);
      // OD-4: a list drawn as events still has to carry a date and a place.
      if (!isEventList(items)) continue;
    }

    for (const item of items) {
      if (events.length >= LISTING_EVENT_CAP) return events;
      if (marked.has(item.id) || !(item.title ?? '').trim() || notScheduled(item)) continue;
      const fields = isSchedule ? stopFields(item, zone, input.now) : readEventFields(item.raw as Record<string, unknown>);
      const fragment = anchored.has(item.id) && SAFE_ID.test(item.id) ? `#item-${item.id}` : '';
      const url = (!isSchedule && detailAddress(input, drawn, item)) || `${input.pageUrl}${fragment}`;
      const result = buildEventJsonLd({
        title: item.title.trim(),
        description: seedFreeText(item.description, 500),
        url,
        date: fields.date,
        time: fields.time,
        location: fields.location,
        address: fields.address,
        onlineUrl: fields.onlineUrl,
        ticketsUrl: fields.ticketsUrl,
        timezone: zone,
        organizationId: input.organizationId,
      });
      if (!result.schema) continue;
      marked.add(item.id);
      events.push(result.schema);
    }
  }
  return events;
}

/**
 * The page's Events for `<JsonLd>`, or `null` when there are none. `path` is
 * the page's own path (`/markets`, `/` for home). No origin means no absolute
 * address to give an Event, so no Events.
 */
export function pageListingEvents(
  siteData: SiteData,
  input: { page: ListingEventsInput['page']; data: { getItems: ListingEventsInput['getItems'] } },
  path: string,
  now: number = Date.now(),
): Record<string, unknown>[] | null {
  const origin = resolveSiteOrigin(siteData, { surface: 'durable' });
  if (!origin) return null;
  // The show lists, resolved exactly as the show detail route resolves them
  // (`getPageCollectionId(siteData, page.name, SHOWS_ID)`).
  const showLists = new Set(
    (siteData.pageConfigs ?? [])
      .filter((page) => page.format === 'shows')
      .map((page) => pageDetailCollectionId(page as DetailPageLike) || process.env.SHOWS_ID || '')
      .filter((id) => id !== ''),
  );
  const events = buildListingEvents({
    page: input.page,
    // Cast: the site's page configs are the structural shape `LinkPage` reads.
    pages: (siteData.pageConfigs ?? []) as unknown as LinkPage[],
    getItems: input.data.getItems,
    pageUrl: path === '/' ? origin : `${origin}${path}`,
    timezone: siteData.timezone,
    organizationId: siteOrganizationId(siteData),
    now,
    skipCollections: showLists,
  });
  return events.length > 0 ? events : null;
}

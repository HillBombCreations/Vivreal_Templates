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
 * in the four event layouts; the first section that draws an item owns
 * `item-<id>`, and a later section sharing any item is scoped
 * (`item-<index>-<id>`), so it is never linked. A row whose id the served HTML
 * may not carry gets the page address with no fragment, which lands at the
 * top of the page. The rules below are read from the renderer's layouts at
 * 1.95.0 and are deliberately conservative; `listingEvents.test.ts` renders
 * the real renderer and fails if any emitted fragment is missing from the
 * page's HTML, so a renderer change that drops an id fails the build here.
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
 *   - Schedule pages: renderer 1.95.0 gives schedule stops no ids in any view
 *     (agenda, month, map), so no fragment.
 *   - A block that trims, filters or remaps its list (`itemLimit`, `scope`,
 *     `fieldMap`) gets no fragment, since which rows it draws is decided
 *     after this reads them.
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
import { pageBindings, readStopTiming, scheduleTimezone, stopAnchor, stopOccurrences } from '@hillbombcreations/site-renderer/bindings';
import { buildEventJsonLd } from '../../components/JsonLd/eventSchema.ts';
import { seedFreeText } from './seedFreeText.ts';
import { isEventList, readEventFields, type EventFields } from './eventFields.ts';
import { resolveSiteOrigin } from '../og/siteOrigin.ts';
import { siteOrganizationId } from '../../components/JsonLd/schema.ts';
import { pageDetailCollectionId, type DetailPageLike } from '../detail/detailCollection.ts';

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
  /** The page as composePage receives it (only `blocks` and `labels` are read). */
  page: { blocks?: unknown; labels?: unknown };
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

/** A stop the page shows but that is not happening as scheduled (`shapeSchedule` statuses). */
const NOT_SCHEDULED_STOP: ReadonlySet<string> = new Set(['cancelled', 'private']);

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
 * past). `undefined` for a cancelled or private stop: marking it up as a
 * scheduled event would be untrue.
 */
function stopFields(item: ContentItem, zone: string | undefined, now: number): EventFields | undefined {
  const raw = (item.raw ?? {}) as Record<string, unknown>;
  if (typeof raw.status === 'string' && NOT_SCHEDULED_STOP.has(raw.status.trim())) return undefined;
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
  };
}

/** Every Event this page marks up, at most `LISTING_EVENT_CAP`, in drawing order. */
export function buildListingEvents(input: ListingEventsInput): Record<string, unknown>[] {
  const { collections } = pageBindings(input.page as Parameters<typeof pageBindings>[0]);
  const events: Record<string, unknown>[] = [];
  const marked = new Set<string>();
  // The ids earlier event-row sections drew (renderer `scopeEventRowAnchors`).
  const earlierRowIds = new Set<string>();
  const labels = (input.page.labels ?? {}) as Record<string, unknown>;

  for (const binding of collections) {
    if (!binding.enabled || !binding.collectionId) continue;
    if (input.skipCollections?.has(binding.collectionId)) continue;
    const isSchedule = SCHEDULE_DISPATCH.has(binding.dispatchId);
    const isEventRows = binding.kind === 'layout' && typeof binding.displayAs === 'string' && EVENT_ROW_LAYOUTS.has(binding.displayAs);
    if (!isSchedule && !isEventRows) continue;

    const items = input.getItems(binding.collectionId).filter((item) => typeof item.id === 'string' && item.id !== '');
    const config = (binding.sectionConfig ?? {}) as SectionConfig;
    let anchored = new Set<string>();
    if (isEventRows) {
      const scoped = items.some((item) => earlierRowIds.has(item.id));
      const reshaped = config.itemLimit !== undefined || config.scope !== undefined || config.fieldMap !== undefined;
      if (!scoped) {
        if (!reshaped) anchored = anchoredIds(binding.displayAs as string, items, config);
        for (const item of items) earlierRowIds.add(item.id);
      }
      // OD-4: a list drawn as events still has to carry a date and a place.
      if (!isEventList(items)) continue;
    }
    // The schedule's own zone first, as the page reads it, then the business's.
    const zone = isSchedule ? scheduleTimezone(config.timezone, labels.timezone, input.timezone) : input.timezone;

    for (const item of items) {
      if (events.length >= LISTING_EVENT_CAP) return events;
      if (marked.has(item.id) || !(item.title ?? '').trim()) continue;
      const fields = isSchedule ? stopFields(item, zone, input.now) : readEventFields(item.raw as Record<string, unknown>);
      if (!fields) continue;
      const fragment = anchored.has(item.id) && SAFE_ID.test(item.id) ? `#item-${item.id}` : '';
      const result = buildEventJsonLd({
        title: item.title.trim(),
        description: seedFreeText(item.description, 500),
        url: `${input.pageUrl}${fragment}`,
        date: fields.date,
        time: fields.time,
        location: fields.location,
        address: fields.address,
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
    getItems: input.data.getItems,
    pageUrl: path === '/' ? origin : `${origin}${path}`,
    timezone: siteData.timezone,
    organizationId: siteOrganizationId(siteData),
    now,
    skipCollections: showLists,
  });
  return events.length > 0 ? events : null;
}

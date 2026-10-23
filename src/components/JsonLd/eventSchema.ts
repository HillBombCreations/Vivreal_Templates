/**
 * Event JSON-LD for a show detail page (discovery batch 3.1, 2026-10-22).
 *
 * WHAT WAS WRONG. `startDate` was `${show.date}T${show.time}`, string
 * concatenation of an ISO timestamp and a clock time as typed, which produced
 * `2026-07-24T05:00:00.000ZT7:00 pm`: not a date at all. `location` was a
 * `Place` with a name and no address, and Google lists `location.address` as
 * required. Both are errors in exactly the Search Console report owners are
 * now invited to open.
 *
 * THE RULES.
 *   - `startDate` is the show's CALENDAR date in the business's own time zone,
 *     with the clock time parsed (`7:00 pm`, `7pm`, `7:30PM`, `19:00`) and that
 *     date's real offset from `Intl`: `2026-07-24T19:00:00-05:00`. An
 *     unparseable or missing time, or no usable time zone, gives the date alone
 *     (`2026-07-24`, still valid ISO 8601). No date at all gives no Event.
 *   - `location`, first match wins: the show's own address field; `location`
 *     text written `Venue: street` where the street starts with a number, or
 *     `Venue 123 N Street` with no colon (D17, see `splitSpacedVenue`); no
 *     location text at all on a business with a street address (its own
 *     events) gives the business address; location text saying online or
 *     virtual gives a `VirtualLocation`. No city is ever borrowed from the
 *     business for a named venue: a touring act's venue is not its home town.
 *   - Nothing resolvable gives NO Event node. A missing rich result costs less
 *     than a red error. The caller logs `jsonld.event.skipped`.
 *
 * Pure (no `next/*`, no Sentry), so it runs under `node --test`.
 */
import type { SiteData } from '@/types/SiteData';
import { unsignMediaUrl } from './unsignMediaUrl.ts';

export interface ShowEventInput {
  title: string;
  description?: string;
  imageUrl?: string;
  /** The detail page's own URL. */
  url?: string;
  /** As stored: an ISO timestamp (`2026-07-24T05:00:00.000Z`) or a bare `YYYY-MM-DD`. */
  date?: string;
  /** As typed by the owner: `7:00 pm`, `7pm`, `19:00`, or free text. */
  time?: string;
  /** Free text: a venue name, `Venue: 1265 W Wilson Ave`, or `Online`. */
  location?: string;
  /** The show's own street address, when its content type has the field. */
  address?: string;
  ticketsUrl?: string;
  /** IANA zone of the business (`siteDetails.values.timezone`). */
  timezone?: string;
  /** The site node's `@id`, for `organizer`. */
  organizationId?: string;
  /** The business, for rule 3 (its own events at its own address). */
  business?: { name?: string; address?: NonNullable<SiteData['businessInfo']>['address'] };
}

export type EventSkipReason = 'no_date' | 'no_address';

export type ShowEventResult =
  | { schema: Record<string, unknown>; skipped?: undefined }
  | { schema: null; skipped: EventSkipReason };

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` of `date` in `timezone`, or in UTC when the zone is unusable. */
export function calendarDate(date: string | undefined, timezone: string | undefined): string | undefined {
  const trimmed = date?.trim();
  if (!trimmed) return undefined;
  if (ISO_DATE_ONLY.test(trimmed)) return trimmed;
  const time = Date.parse(trimmed);
  if (!Number.isFinite(time)) return undefined;
  if (timezone) {
    try {
      // en-CA formats as YYYY-MM-DD.
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(time));
    } catch {
      // An unknown IANA name is an authoring mistake; fall back to UTC rather
      // than lose the show.
    }
  }
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * Minute of day for a clock time as owners type it, or `undefined`.
 * Accepts `7:00 pm`, `7pm`, `7:30PM`, `7 p.m.`, `19:00`, `9:05`.
 */
export function parseShowTime(time: string | undefined): number | undefined {
  const value = time?.trim().toLowerCase();
  if (!value) return undefined;
  const twelve = /^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m?\.?$/.exec(value);
  if (twelve) {
    const hour = Number(twelve[1]);
    const minute = Number(twelve[2] ?? '0');
    if (hour < 1 || hour > 12 || minute > 59) return undefined;
    const base = hour % 12;
    return (twelve[3] === 'p' ? base + 12 : base) * 60 + minute;
  }
  const twentyFour = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    if (hour > 23 || minute > 59) return undefined;
    return hour * 60 + minute;
  }
  return undefined;
}

/** Offset of `timezone` from UTC at the instant `utcMs`, in minutes. Throws on an unknown zone. */
function zoneOffsetMinutes(timezone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - utcMs) / 60000);
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

/**
 * The Event `startDate`: local wall time with that date's real offset, or the
 * date alone. Never concatenated from the stored strings.
 */
export function showStartDate(
  date: string | undefined,
  time: string | undefined,
  timezone: string | undefined,
): string | undefined {
  const day = calendarDate(date, timezone);
  if (!day) return undefined;
  const minuteOfDay = parseShowTime(time);
  if (minuteOfDay === undefined || !timezone) return day;
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const wall = Date.UTC(year, month - 1, dayOfMonth, hour, minute);
  let offset: number;
  try {
    // Two passes: the first guess can sit on the wrong side of a DST change.
    offset = zoneOffsetMinutes(timezone, wall - zoneOffsetMinutes(timezone, wall) * 60000);
  } catch {
    return day;
  }
  return `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${formatOffset(offset)}`;
}

/** An http(s) link, or nothing. */
function webLink(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    // Not a URL: there is no link to publish, which is the same answer.
    return undefined;
  }
}

const ONLINE = /\b(online|virtual)\b/i;
const STARTS_WITH_NUMBER = /^\d/;

type EventLocation = { location: Record<string, unknown>; online: boolean };

function streetPlace(name: string, street: string): Record<string, unknown> {
  return {
    '@type': 'Place',
    name,
    address: { '@type': 'PostalAddress', streetAddress: street },
  };
}

/** `Venue: street`, the design's form: the right side starts with a number. */
function splitColonVenue(location: string): { venue: string; street: string } | undefined {
  const colon = location.indexOf(':');
  if (colon === -1) return undefined;
  const venue = location.slice(0, colon).trim();
  const street = location.slice(colon + 1).trim();
  if (!STARTS_WITH_NUMBER.test(street)) return undefined;
  return { venue: venue || street, street };
}

const HOUSE_NUMBER = /^\d{1,6}$/;
const DIRECTIONS: ReadonlySet<string> = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw', 'north', 'south', 'east', 'west']);
const STREET_WORDS: ReadonlySet<string> = new Set([
  'st', 'street', 'ave', 'avenue', 'rd', 'road', 'blvd', 'boulevard', 'dr', 'drive', 'ln', 'lane', 'way',
  'pl', 'place', 'ct', 'court', 'pkwy', 'parkway', 'hwy', 'highway', 'ter', 'terrace', 'cir', 'circle',
  'sq', 'square', 'broadway', 'trl', 'trail', 'plz', 'plaza',
]);

const ZIP = /^\d{5}(-\d{4})?$/;
const STATE = /^[A-Z]{2}$/;

/**
 * Do the words after a house number read as a street? STRICT on purpose (owner
 * decision D17, 2026-10-23, tightened by review): D17 must never invent an
 * address, so a number inside a venue name ("Pier 39 West Lot", "Suite 200
 * Park Plaza Hotel") never splits it. Accepted only when:
 *   - at least TWO words follow the number ("Club 21" never splits), the
 *     first of them not a number ("Hall 5 300 N State St" splits at 300); and
 *   - EITHER a street word ENDS the street part: it is the last word, or it
 *     carries a comma, or the next word is a two letter state or a ZIP
 *     ("1447 N Wells St", "1331 N. Milwaukee Ave., Chicago IL", "12 Main St");
 *   - OR the first word is a compass direction AND a ZIP, or a `, XX` state,
 *     follows ("3164 North Broadway Chicago, IL 60657").
 * A compass word alone ("Stage 3 North Hall") and a street word in the middle
 * of a name ("The 5 Points Lane Bar") are not enough.
 * Trailing dots and commas are ignored when reading a word ("N.", "Ave.,").
 */
function readsAsStreet(after: string[]): boolean {
  if (after.length < 2) return false;
  // "Hall 5 300 N State St": a number straight after a number means the first
  // one belongs to the venue name; the street starts at the second.
  if (/^\d/.test(after[0])) return false;
  const bare = (word: string) => word.replace(/[.,]+$/, '');
  const words = after.map((word) => bare(word).toLowerCase());
  const endsStreetPart = (index: number) => {
    const next = after[index + 1];
    return next === undefined || after[index].endsWith(',') || STATE.test(bare(next)) || ZIP.test(bare(next));
  };
  if (words.slice(0, 4).some((word, index) => STREET_WORDS.has(word) && endsStreetPart(index))) return true;
  if (!DIRECTIONS.has(words[0])) return false;
  const rest = after.slice(1);
  return rest.some((word) => ZIP.test(bare(word))) || rest.some((word, index) => index > 0 && rest[index - 1].endsWith(',') && STATE.test(bare(word)));
}

/**
 * `Venue Name 123 Street ...` with no colon (D17), measured on The Comedy
 * Collective's real strings: "Burton Place 1447 N Wells St", "BottlesUp! 3164
 * North Broadway Chicago, IL 60657", "K&K Wrigleyville  3443 N Sheffield
 * Chicago, IL 60657". The split is at the FIRST run of digits that starts a
 * street (`readsAsStreet`); everything before it is the venue. A text that IS
 * a street address ("1331 N. Milwaukee Ave., Chicago IL") is its own name.
 */
function splitSpacedVenue(location: string): { venue: string; street: string } | undefined {
  const words = location.split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i += 1) {
    if (!HOUSE_NUMBER.test(words[i]) || !readsAsStreet(words.slice(i + 1))) continue;
    const street = words.slice(i).join(' ');
    const venue = words.slice(0, i).join(' ').replace(/[\s,;-]+$/, '');
    return { venue: venue || street, street };
  }
  return undefined;
}

/** A venue and its street from the location text, colon form first, or `undefined`. */
function splitVenue(location: string): { venue: string; street: string } | undefined {
  return splitColonVenue(location) ?? splitSpacedVenue(location);
}

function resolveLocation(input: ShowEventInput): EventLocation | undefined {
  const location = input.location?.trim() ?? '';
  const ownAddress = input.address?.trim();

  // 1. The show's own address field.
  if (ownAddress) {
    const name = (location && splitVenue(location)?.venue) || location || ownAddress;
    return { location: streetPlace(name, ownAddress), online: false };
  }

  // 2. `Venue: street`, or `Venue 123 N Street` (D17), in the location text.
  if (location) {
    const split = splitVenue(location);
    if (split) return { location: streetPlace(split.venue, split.street), online: false };
  }

  // 3. No location text at all, and the business has a street address: its
  //    own event, at its own place.
  const businessAddress = input.business?.address;
  if (!location && businessAddress?.street1) {
    return {
      location: {
        '@type': 'Place',
        ...(input.business?.name ? { name: input.business.name } : {}),
        address: {
          '@type': 'PostalAddress',
          streetAddress: [businessAddress.street1, businessAddress.street2].filter(Boolean).join(' '),
          ...(businessAddress.city ? { addressLocality: businessAddress.city } : {}),
          ...(businessAddress.state ? { addressRegion: businessAddress.state } : {}),
          ...(businessAddress.zip ? { postalCode: businessAddress.zip } : {}),
        },
      },
      online: false,
    };
  }

  // 4. Online or virtual: the place is the link people join or buy at.
  if (location && ONLINE.test(location)) {
    const url = webLink(input.ticketsUrl) ?? webLink(input.url);
    if (url) return { location: { '@type': 'VirtualLocation', url }, online: true };
  }

  return undefined;
}

export function buildShowEventJsonLd(input: ShowEventInput): ShowEventResult {
  const startDate = showStartDate(input.date, input.time, input.timezone);
  if (!startDate) return { schema: null, skipped: 'no_date' };
  const resolved = resolveLocation(input);
  if (!resolved) return { schema: null, skipped: 'no_address' };

  const image = unsignMediaUrl(input.imageUrl);
  const tickets = webLink(input.ticketsUrl);
  return {
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: input.title,
      ...(input.description ? { description: input.description } : {}),
      ...(image ? { image } : {}),
      ...(input.url ? { url: input.url } : {}),
      startDate,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: resolved.online
        ? 'https://schema.org/OnlineEventAttendanceMode'
        : 'https://schema.org/OfflineEventAttendanceMode',
      location: resolved.location,
      ...(input.organizationId ? { organizer: { '@id': input.organizationId } } : {}),
      ...(tickets ? { offers: { '@type': 'Offer', url: tickets } } : {}),
    },
  };
}

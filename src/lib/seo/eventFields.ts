/**
 * Which owner-made lists count as events, and where each row's date, time and
 * place are read from (next release 2026-12, plan 11.3, owner decision OD-4,
 * 2026-11-01: "a list counts as events when it has a date field and a place
 * field").
 *
 * THE RULE, for owners and for the help note:
 *   - A list counts as events when its rows carry a DATE field and a PLACE
 *     field. Both are recognised by name, and the date also by what it holds.
 *   - DATE: a field named `startDate`, `start`, `startsAt`, `start_date`,
 *     `date`, `eventDate`, `datetime` or `dateTime`, or any field whose name
 *     contains `date` or `start`, holding a calendar date the way Lists
 *     stores one: `2026-11-14`, or a full timestamp that begins with one
 *     (`2026-11-14T17:00:00.000Z`). Nothing else is a date: free text
 *     ("every Saturday"), a year-less string, a number. The row's publish
 *     date is never its event date.
 *   - TIME: a field named `time`, `startTime`, `start_time` or `starts`, as
 *     owners type it (`7:00 pm`, `19:00`); read by the same parser the show
 *     pages use. Absent or unreadable: the event is that whole day.
 *   - PLACE: a field named `location`, `venue`, `place`, `where`,
 *     `locationName`, `location_name`, `venueName` or `placeName` (the place's
 *     name, or `Venue: 123 Street`), and an ADDRESS field named `address`,
 *     `streetAddress`, `street`, `venueAddress` or `locationAddress`. An
 *     address counts only when it starts with a house number: "Phoenix, AZ"
 *     is a town, not a street, and is dropped rather than published.
 *
 * The site never receives a list's schema (field types and labels), only its
 * rows, so "type date" is read from the stored value's shape. That is the
 * same shape a date field writes, and it keeps a text field that happens to
 * hold a date-like word out.
 *
 * The honest floor is the Event builder's, not this module's
 * (`components/JsonLd/eventSchema.ts`): a valid date in the business's zone
 * and a real street address, or no Event at all.
 *
 * Pure (no `next/*`, no I/O), so it runs under `node --test`.
 */

/** The fields of one row an Event is built from. */
export interface EventFields {
  date?: string;
  time?: string;
  location?: string;
  address?: string;
}

const DATE_NAMES = ['startDate', 'start', 'startsAt', 'start_date', 'date', 'eventDate', 'datetime', 'dateTime'] as const;
const TIME_NAMES = ['time', 'startTime', 'start_time', 'starts'] as const;
const PLACE_NAMES = ['location', 'venue', 'place', 'where', 'locationName', 'location_name', 'venueName', 'placeName'] as const;
const ADDRESS_NAMES = ['address', 'streetAddress', 'street', 'venueAddress', 'locationAddress'] as const;

/** A calendar date as a date field stores it: `YYYY-MM-DD`, optionally a full timestamp after it. */
const STORED_DATE = /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const HOUSE_NUMBER_FIRST = /^\d/;

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** A stored value that is a date, by shape and by parsing. */
export function isStoredDate(value: unknown): value is string {
  const v = text(value);
  return v !== undefined && STORED_DATE.test(v) && Number.isFinite(Date.parse(v));
}

function firstText(raw: Record<string, unknown>, names: readonly string[]): string | undefined {
  for (const name of names) {
    const v = text(raw[name]);
    if (v !== undefined) return v;
  }
  return undefined;
}

/** The row's date: a named date field first, then any field whose name reads as a date or a start. */
function readDate(raw: Record<string, unknown>): string | undefined {
  for (const name of DATE_NAMES) {
    if (isStoredDate(raw[name])) return text(raw[name]);
  }
  for (const [name, value] of Object.entries(raw)) {
    const lower = name.toLowerCase();
    if ((lower.includes('date') || lower.includes('start')) && isStoredDate(value)) return text(value);
  }
  return undefined;
}

/** The date, time and place of one row, each `undefined` when the row does not carry it. */
export function readEventFields(raw: Record<string, unknown> | null | undefined): EventFields {
  if (!raw || typeof raw !== 'object') return {};
  const address = firstText(raw, ADDRESS_NAMES);
  return {
    date: readDate(raw),
    time: firstText(raw, TIME_NAMES),
    location: firstText(raw, PLACE_NAMES),
    address: address !== undefined && HOUSE_NUMBER_FIRST.test(address) ? address : undefined,
  };
}

/** True when the row has a date field and a place field (OD-4), whatever the place says. */
function rowHasDateAndPlace(raw: Record<string, unknown> | null | undefined): boolean {
  if (!raw || typeof raw !== 'object') return false;
  if (readDate(raw) === undefined) return false;
  return firstText(raw, PLACE_NAMES) !== undefined || firstText(raw, ADDRESS_NAMES) !== undefined;
}

/** OD-4: a list counts as events when its rows carry a date field and a place field. */
export function isEventList(rows: ReadonlyArray<{ raw?: Record<string, unknown> }>): boolean {
  return rows.some((row) => rowHasDateAndPlace(row.raw));
}

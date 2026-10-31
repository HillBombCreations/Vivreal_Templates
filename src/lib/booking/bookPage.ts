/**
 * What `/book` serves (owner ideas 2026-10-29, plan 3.4, 3.11, D29, D62; T2
 * and T14). Pure, so `node --test` decides it the way the page does.
 *
 *  - Booking ON (`siteData.booking.mode` is exactly `request` or `online`,
 *    the renderer's `bookingModeOf`): the booking form. VR_Client_API serves
 *    `booking` only while the lever (`/vivreal/prod/booking/mode`, default
 *    off) allows the group AND the owner switched requests on, so with the
 *    lever off every site reads as booking off here.
 *  - Booking OFF and the owner HAS a page at `book`: that page, rendered by
 *    the `[slug]` route exactly as `/book` rendered it before this fixed route
 *    existed (T14, D62). Next matches `/book` before `[slug]`, so without
 *    this an owner's own "Book" page would vanish the day this ships.
 *  - Booking OFF and no such page: 404, the answer `/book` gave before.
 *
 * Online mode falls back to the request form when no service can be offered
 * with a name, the same "collecting is never switched off" rule as D26. Since
 * next release 2026-11 (N3) the public subset names a service whose item is
 * public; any other is named from the site's own pages (`serviceNames.ts`).
 */
import type { BookingChoice, BookingDay } from '@hillbombcreations/site-renderer';
import { resolvePageForSlug } from '../pages/builtInPages.ts';

/** The owner page `/book` falls back to while booking is off. */
export const BOOK_SLUG = 'book';

export interface BookPageSite {
  pageConfigs?: ReadonlyArray<{ slug?: string; format?: string; enabled?: boolean }>;
  booking?: { mode?: unknown; staff?: unknown; services?: unknown; timeZone?: unknown; closedWeekdays?: unknown } | null;
}

export type BookPageDecision =
  | { kind: 'owner-page' }
  | { kind: 'not-found' }
  | { kind: 'form'; mode: 'request' | 'online' };

/**
 * The renderer's `bookingModeOf` rule, restated because the renderer's root
 * entry cannot load under `node --test` (it imports `next/link`). Anything but
 * the two exact words is off. `bookPage.test.ts` pins this against the
 * renderer's own function, so the two cannot drift.
 */
export function bookingMode(site: BookPageSite): 'off' | 'request' | 'online' {
  const mode = site.booking?.mode;
  return mode === 'request' || mode === 'online' ? mode : 'off';
}

export function decideBookPage(site: BookPageSite): BookPageDecision {
  const mode = bookingMode(site);
  if (mode === 'request' || mode === 'online') return { kind: 'form', mode };
  // `resolvePageForSlug` also synthesizes the checkout result pages; `book`
  // is never one of those, so this is "the owner stored a `book` page".
  const stored = resolvePageForSlug(
    (site.pageConfigs ?? []) as Parameters<typeof resolvePageForSlug>[0],
    BOOK_SLUG,
  );
  return stored ? { kind: 'owner-page' } : { kind: 'not-found' };
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** The people a customer can choose, from the public subset. Malformed rows are dropped. */
export function staffChoices(booking: BookPageSite['booking']): BookingChoice[] {
  const staff = Array.isArray(booking?.staff) ? booking.staff : [];
  return staff.flatMap((row): BookingChoice[] => {
    if (typeof row !== 'object' || row === null) return [];
    const { id, name } = row as { id?: unknown; name?: unknown };
    return typeof id === 'string' && ID.test(id) && typeof name === 'string' && name.trim() ? [{ id, name: name.trim() }] : [];
  });
}

/** The service item ids the public subset offers for online booking. */
export function serviceIds(booking: BookPageSite['booking']): string[] {
  const services = Array.isArray(booking?.services) ? booking.services : [];
  return services.flatMap((row): string[] => {
    if (typeof row !== 'object' || row === null) return [];
    const { itemId } = row as { itemId?: unknown };
    return typeof itemId === 'string' && ID.test(itemId) ? [itemId] : [];
  });
}

/**
 * The names VR_Client_API already sent with the subset (N3), by item id. Only
 * a non-blank string counts; the rest are named from the pages, as before.
 */
export function subsetServiceNames(booking: BookPageSite['booking']): Map<string, string> {
  const names = new Map<string, string>();
  const services = Array.isArray(booking?.services) ? booking.services : [];
  for (const row of services) {
    if (typeof row !== 'object' || row === null) continue;
    const { itemId, name } = row as { itemId?: unknown; name?: unknown };
    if (typeof itemId === 'string' && ID.test(itemId) && typeof name === 'string' && name.trim()) names.set(itemId, name.trim());
  }
  return names;
}

/** The services with a name, in the subset's order. An id with no name is not offered. */
export function serviceChoices(ids: readonly string[], names: ReadonlyMap<string, string>): BookingChoice[] {
  return ids.flatMap((id) => {
    const name = names.get(id)?.trim();
    return name ? [{ id, name }] : [];
  });
}

/** The form to draw: online needs at least one named service, else requests (D26). */
export function effectiveMode(mode: 'request' | 'online', services: readonly BookingChoice[]): 'request' | 'online' {
  return mode === 'online' && services.length > 0 ? 'online' : 'request';
}

function zoneOrUtc(timeZone: string | undefined): string {
  if (!timeZone) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * The next `count` days on the SHOP's clock (never the visitor's), as the
 * forms take them: `YYYY-MM-DD` plus "Sat Nov 8". Stepping by 24 hours from
 * noon UTC of the shop's today never skips or repeats a date across a
 * daylight saving change.
 *
 * `closedWeekdays` (N3) marks those days `closed`, which the renderer's
 * pickers dim and never offer. Numbered 0 = Sunday to 6 = Saturday, read off
 * the shop date's own noon with `getUTCDay`, the numbering VR_Client_API's
 * `closedWeekdays` (`slotMath.js`) sends. Absent or empty greys nothing, and
 * an open day carries no `closed` key, so today's days are byte-identical.
 */
export function bookingDays(
  now: Date,
  timeZone: string | undefined,
  closedWeekdays?: readonly number[],
  count = 30,
): BookingDay[] {
  const zone = zoneOrUtc(timeZone);
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = ymd.format(now);
  const [y, m, d] = today.split('-').map(Number);
  const label = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
  const closed = new Set(Array.isArray(closedWeekdays) ? closedWeekdays : []);
  const days: BookingDay[] = [];
  for (let i = 0; i < count; i += 1) {
    const noon = new Date(Date.UTC(y, m - 1, d + i, 12));
    const date = noon.toISOString().slice(0, 10);
    const day: BookingDay = { date, label: label.format(noon).replace(',', '') };
    if (closed.has(noon.getUTCDay())) day.closed = true;
    days.push(day);
  }
  return days;
}

/** The `?service=` preselection, only when it names an offered service. */
export function initialServiceId(raw: unknown, services: readonly BookingChoice[]): string | undefined {
  return typeof raw === 'string' && services.some((s) => s.id === raw) ? raw : undefined;
}

/**
 * The public booking subset (owner ideas 2026-10-29, F4), read from the TOP
 * LEVEL of VR_Client_API's `getSiteDetails` answer, where Client PR 10 (CL3)
 * puts it: `{ mode: 'request'|'online', staff: [{ id, name }], services:
 * [{ itemId, minutes, name? }], timeZone?, closedWeekdays? }`, present only
 * while the lever allows the group AND the owner switched booking on. Never
 * hours, notes or tokens.
 *
 * Next release 2026-11 (N3, Client CL1) adds three fields, each read here
 * field by field like the rest:
 *  - `services[].name`: the service item's name, sent only when that item is
 *    public; a blank or missing name stays absent.
 *  - `timeZone`: the shop's zone as the booking engine reads it.
 *  - `closedWeekdays`: the weekdays the shop opens nothing, numbered 0 =
 *    Sunday to 6 = Saturday (JS `getUTCDay`, the numbering VR_Client_API's
 *    `closedWeekdays` in `slotMath.js` uses), with no time of day. Absent when
 *    the shop has no hours. A value that is not a whole number 0 to 6 is
 *    dropped, so a malformed entry can never grey a bookable day.
 *
 * `getSiteData` copies top-level fields by name, so without this reader the
 * field is dropped and every site reads as booking off whatever Client says.
 *
 * Absent stays absent (spread `{}`), so every site that never turned booking
 * on carries exactly the site data it carried before. Any mode but the two
 * exact words is off, the renderer's `bookingModeOf` rule. Pure.
 */
export interface SiteBookingSubset {
  mode: 'request' | 'online';
  staff: Array<{ id: string; name: string }>;
  services: Array<{ itemId: string; minutes: number; name?: string }>;
  timeZone?: string;
  closedWeekdays?: number[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function readBooking(raw: { booking?: unknown }): { booking?: SiteBookingSubset } {
  const b = raw?.booking;
  if (!isRecord(b) || (b.mode !== 'request' && b.mode !== 'online')) return {};
  const staff = (Array.isArray(b.staff) ? b.staff : []).flatMap((p) =>
    isRecord(p) && typeof p.id === 'string' && typeof p.name === 'string' ? [{ id: p.id, name: p.name }] : [],
  );
  const services = (Array.isArray(b.services) ? b.services : []).flatMap((s) => {
    if (!isRecord(s) || typeof s.itemId !== 'string' || typeof s.minutes !== 'number' || !Number.isFinite(s.minutes)) return [];
    const name = typeof s.name === 'string' ? s.name.trim() : '';
    return [name ? { itemId: s.itemId, minutes: s.minutes, name } : { itemId: s.itemId, minutes: s.minutes }];
  });
  const timeZone = typeof b.timeZone === 'string' && b.timeZone.trim() ? b.timeZone.trim() : undefined;
  const closedWeekdays = Array.isArray(b.closedWeekdays)
    ? [...new Set(b.closedWeekdays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort((x, y) => x - y)
    : undefined;
  return {
    booking: {
      mode: b.mode,
      staff,
      services,
      ...(timeZone ? { timeZone } : {}),
      ...(closedWeekdays ? { closedWeekdays } : {}),
    },
  };
}

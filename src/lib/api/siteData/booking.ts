/**
 * The public booking subset (owner ideas 2026-10-29, F4), read from the TOP
 * LEVEL of VR_Client_API's `getSiteDetails` answer, where Client PR 10 (CL3)
 * puts it: `{ mode: 'request'|'online', staff: [{ id, name }], services:
 * [{ itemId, minutes }] }`, present only while the lever allows the group AND
 * the owner switched booking on. Never hours, notes or tokens.
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
  services: Array<{ itemId: string; minutes: number }>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function readBooking(raw: { booking?: unknown }): { booking?: SiteBookingSubset } {
  const b = raw?.booking;
  if (!isRecord(b) || (b.mode !== 'request' && b.mode !== 'online')) return {};
  const staff = (Array.isArray(b.staff) ? b.staff : []).flatMap((p) =>
    isRecord(p) && typeof p.id === 'string' && typeof p.name === 'string' ? [{ id: p.id, name: p.name }] : [],
  );
  const services = (Array.isArray(b.services) ? b.services : []).flatMap((s) =>
    isRecord(s) && typeof s.itemId === 'string' && typeof s.minutes === 'number' && Number.isFinite(s.minutes)
      ? [{ itemId: s.itemId, minutes: s.minutes }]
      : [],
  );
  return { booking: { mode: b.mode, staff, services } };
}

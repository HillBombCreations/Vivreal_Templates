/**
 * Browser-side reading of the booking routes' answers (owner ideas T2, T4).
 * Pure, so `node --test` reads them the way the forms do.
 */
import type { BookingSlot } from '@hillbombcreations/site-renderer';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The open times of ONE day, from a slots answer covering up to seven days
 * (`{ timeZone, slots: [{ start, end }] }`). A time belongs to the day it
 * falls on in the SHOP's zone, never the visitor's, so a visitor in another
 * zone is offered exactly the times the shop opens.
 */
export function slotsForDay(body: unknown, day: string): BookingSlot[] {
  if (!isRecord(body) || !Array.isArray(body.slots)) return [];
  const zone = typeof body.timeZone === 'string' ? body.timeZone : 'UTC';
  let ymd: Intl.DateTimeFormat;
  try {
    ymd = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
  }
  return body.slots.flatMap((slot): BookingSlot[] => {
    if (!isRecord(slot) || typeof slot.start !== 'string') return [];
    const at = new Date(slot.start);
    if (Number.isNaN(at.getTime())) return [];
    return ymd.format(at) === day ? [{ start: slot.start }] : [];
  });
}

export type ManageLookup =
  | { kind: 'found'; booking: { serviceName: string; staffName?: string; start: string; cancelable: boolean } }
  | { kind: 'invalid' }
  | { kind: 'error' };

/** A lookup answer: the booking, an expired or used link, or a failure to read. */
export function readLookup(status: number, body: unknown): ManageLookup {
  if (status >= 200 && status < 300 && isRecord(body) && isRecord(body.booking)) {
    const b = body.booking;
    if (typeof b.start !== 'string' || Number.isNaN(new Date(b.start).getTime())) return { kind: 'error' };
    return {
      kind: 'found',
      booking: {
        serviceName: typeof b.serviceName === 'string' && b.serviceName ? b.serviceName : 'Your booking',
        ...(typeof b.staffName === 'string' && b.staffName ? { staffName: b.staffName } : {}),
        start: b.start,
        // A canceled booking reads as not cancelable; the manage screen says so.
        cancelable: b.cancelable === true && b.status !== 'cancelled',
      },
    };
  }
  if (isRecord(body) && (body.errorCode === 'BOOKING_LINK_INVALID' || body.errorCode === 'VALIDATION')) return { kind: 'invalid' };
  return { kind: 'error' };
}

/** A cancel answer, in the renderer's three outcomes. */
export function readCancel(status: number, body: unknown): 'canceled' | 'too-late' | 'error' {
  if (status >= 200 && status < 300 && isRecord(body) && body.canceled === true) return 'canceled';
  if (isRecord(body) && body.errorCode === 'ALREADY_CANCELED') return 'canceled';
  if (isRecord(body) && body.errorCode === 'CANCEL_TOO_LATE') return 'too-late';
  return 'error';
}

/** The cancel link's token, as VR_Client_API mints it: `<bookingId>.<43 base64url>`. */
export const MANAGE_TOKEN = /^[0-9a-f]{24}\.[A-Za-z0-9_-]{43}$/;

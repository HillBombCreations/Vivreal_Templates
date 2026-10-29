/**
 * The website's booking routes (owner ideas 2026-10-29, plan 3.4, T3):
 * `/api/booking/{request,slots,create,lookup,cancel}`, each a thin forward to
 * VR_Client_API with this site's key. The logic lives here, free of
 * `next/server`, so `node --test` can call it; the route files are call sites.
 *
 * The contact route's shape (`src/app/api/contact/route.ts`), plus what a
 * public, unauthenticated form needs:
 *
 *  - SIZE CAP. A body over `MAX_BODY_BYTES` is refused (413) before it is
 *    parsed, so a flood of large posts costs nothing upstream.
 *  - ALLOWLIST. Only the fields VR_Client_API's booking validators declare
 *    are forwarded; anything else in the body is dropped, never echoed on.
 *    The tenant comes from the site key on the server, never the body, and
 *    `siteId` (the site the customer is on, for the cancel link) is this
 *    deployment's own `SITE_ID`, never the visitor's.
 *  - HONEYPOT. A filled `website` field (the renderer's booking forms carry
 *    it) is a bot: it is answered exactly as a sent request and NEVER
 *    forwarded, so it costs no rate-limit increment, no Mongo read and no
 *    email. VR_Client_API applies the same rule again behind this one.
 *  - NO-STORE both ways. An open time or a booking is only true now.
 *  - What reaches the browser is the upstream `data` on success, and on a
 *    refusal only its stable `errorCode` (`BOOKING_OFF`, `SLOT_TAKEN`, ...),
 *    the next open times (`items`) and the allowlisted `reason`. Never the
 *    upstream sentence, never anything it might quote back.
 *
 * Contract: VR_Client_API PR 10 (`feat/owner-ideas-client`), validators.js
 * `booking*Validator` and `api/tenant/bookings.js`. Lookup and cancel carry the
 * token in the BODY (a POST), so the secret never sits in a URL this app logs.
 */

export type BookingRoute = 'request' | 'slots' | 'create' | 'lookup' | 'cancel';

/** Comfortably above the largest valid body (a 500 character note plus every field). */
export const MAX_BODY_BYTES = 4096;

const UPSTREAM: Record<BookingRoute, { method: 'GET' | 'POST'; path: string }> = {
  request: { method: 'POST', path: '/tenant/bookingRequest' },
  slots: { method: 'GET', path: '/tenant/bookingSlots' },
  create: { method: 'POST', path: '/tenant/bookingCreate' },
  lookup: { method: 'POST', path: '/tenant/bookingLookup' },
  cancel: { method: 'POST', path: '/tenant/bookingCancel' },
};

/** The fields each route forwards, exactly the upstream validator's keys (minus `siteId`, added here). */
const FIELDS: Record<Exclude<BookingRoute, 'slots'>, readonly string[]> = {
  request: ['serviceItemId', 'what', 'staffId', 'day', 'timeOfDay', 'time', 'name', 'phone', 'email', 'note', 'website'],
  create: ['serviceItemId', 'staffId', 'start', 'name', 'phone', 'email', 'website'],
  lookup: ['token'],
  cancel: ['token'],
};

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The upstream codes a refusal may carry to the browser. */
const PASSTHROUGH_CODES: ReadonlySet<string> = new Set([
  'BOOKING_OFF', 'BOOKING_LIMIT', 'UNKNOWN_SERVICE', 'UNKNOWN_STAFF', 'DAY_OUT_OF_RANGE',
  'ONLINE_BOOKING_OFF', 'SLOT_TAKEN', 'BOOKING_LINK_INVALID', 'CANCEL_TOO_LATE', 'ALREADY_CANCELED',
  'VALIDATION', 'GroupFrozen',
]);

export interface BookingRequestLike {
  method: string;
  url: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export interface BookingEnv {
  apiKey: string | undefined;
  clientApiUrl: string;
  siteId: string | undefined;
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; cache?: 'no-store' }) => Promise<{
  status: number;
  json(): Promise<unknown>;
}>;

export interface BookingAnswer {
  status: number;
  body: Record<string, unknown>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Whether the honeypot is filled. Any non-blank string is a bot. */
export function honeypotFilled(body: Record<string, unknown>): boolean {
  return typeof body.website === 'string' && body.website.trim() !== '';
}

/** What a bot is told: exactly what a person is told on success. */
function honeypotAnswer(route: BookingRoute, body: Record<string, unknown>): BookingAnswer {
  if (route === 'create') {
    return { status: 200, body: { ok: true, serviceName: '', start: typeof body.start === 'string' ? body.start : '', email: '' } };
  }
  return { status: 200, body: { ok: true, emailed: false } };
}

function pick(body: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = body[key];
    // An untouched optional input arrives as ''. Upstream reads '' as absent
    // for email and note only; dropping it here keeps every field consistent.
    if (value === undefined || value === null || value === '') continue;
    if (typeof value !== 'string') continue; // every forwarded field is a string
    out[key] = value;
  }
  return out;
}

/** The slots query, rebuilt from validated values only. Null when malformed. */
function slotsQuery(url: string): string | null {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    return null;
  }
  const serviceItemId = params.get('serviceItemId') ?? '';
  const staffId = params.get('staffId') ?? '';
  const from = params.get('from') ?? '';
  if (!OBJECT_ID.test(serviceItemId) || !DAY.test(from) || (staffId !== '' && !OBJECT_ID.test(staffId))) return null;
  const out = new URLSearchParams({ serviceItemId, from });
  if (staffId) out.set('staffId', staffId);
  return out.toString();
}

/** The browser's view of an upstream answer. */
export function mapUpstream(status: number, json: unknown): BookingAnswer {
  if (status >= 200 && status < 300) {
    const data = isRecord(json) && 'data' in json ? json.data : json;
    return { status: 200, body: isRecord(data) ? data : {} };
  }
  const out: Record<string, unknown> = {};
  if (isRecord(json)) {
    const code = typeof json.errorCode === 'string' ? json.errorCode : typeof json.code === 'string' ? json.code : '';
    if (PASSTHROUGH_CODES.has(code)) out.errorCode = code;
    if (Array.isArray(json.items)) {
      out.items = json.items.filter((i): i is { start: string } => isRecord(i) && typeof i.start === 'string').map((i) => ({ start: i.start }));
    }
    if (json.reason === 'request') out.reason = 'request';
  }
  // A 5xx upstream is a 502 here: this route did not fail, the hop did.
  return { status: status >= 500 ? 502 : status, body: out };
}

const BAD_REQUEST: BookingAnswer = { status: 400, body: { errorCode: 'VALIDATION' } };

/** The whole route: read, refuse or forward, map. Never throws. */
export async function handleBookingRoute(
  route: BookingRoute,
  request: BookingRequestLike,
  env: BookingEnv,
  fetchImpl: FetchLike,
): Promise<BookingAnswer> {
  if (!env.apiKey) return { status: 503, body: {} };
  const upstream = UPSTREAM[route];
  const headers: Record<string, string> = { Authorization: env.apiKey };
  let url = `${env.clientApiUrl}${upstream.path}`;
  let body: string | undefined;

  if (route === 'slots') {
    const query = slotsQuery(request.url);
    if (query === null) return BAD_REQUEST;
    url = `${url}?${query}`;
  } else {
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { status: 413, body: {} };
    let raw: string;
    try {
      raw = await request.text();
    } catch {
      return BAD_REQUEST;
    }
    if (raw.length > MAX_BODY_BYTES) return { status: 413, body: {} };
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return BAD_REQUEST;
    }
    if (!isRecord(parsed)) return BAD_REQUEST;
    if ((route === 'request' || route === 'create') && honeypotFilled(parsed)) return honeypotAnswer(route, parsed);
    const forwarded = pick(parsed, FIELDS[route]);
    if (route === 'create') {
      if (!env.siteId || !OBJECT_ID.test(env.siteId)) return { status: 503, body: {} };
      forwarded.siteId = env.siteId;
    }
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(forwarded);
  }

  try {
    const res = await fetchImpl(url, { method: upstream.method, headers, ...(body !== undefined ? { body } : {}), cache: 'no-store' });
    const json = await res.json().catch(() => null);
    return mapUpstream(res.status, json);
  } catch {
    return { status: 502, body: {} };
  }
}

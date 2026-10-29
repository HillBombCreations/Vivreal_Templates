/**
 * What the first-party beacon sends beyond a page view (owner ideas
 * 2026-10-29, plan 3.3 and 3.5, D15, D16, D32).
 *
 * Three things, all cookieless and with nothing stored on the visitor's device:
 *
 *  1. `a: 1` on a page view whose landing address carried a Google ad click id
 *     (`gclid`, `gbraid`, `wbraid`). The id itself is NEVER sent: only the yes.
 *     Google Ads auto-tagging adds `gclid` by default, so an owner does nothing
 *     to get ad visits counted.
 *  2. `u: { s, m, c }`, the campaign tags (`utm_source`, `utm_medium`,
 *     `utm_campaign`), lowercased and trimmed. A tag that is not 1 to 40 of
 *     `[a-z0-9._-]` is dropped rather than cut, so a half campaign name never
 *     reaches the owner's list (VR_Analytics_API drops it on the same rule).
 *  3. `sendSiteEvent`: a link tap (`k: 'lt'`, the link page, D32) or a result
 *     (`k: 'gl'`: a message, a booking request, a purchase), which the ingest
 *     matches to an ad visit by the daily visitor hash (D16). Neither is ever
 *     counted as a page view.
 *
 * The page view's path never carries the query: `pagePath` cuts it, so a
 * `gclid` or a shopper's `session_id` can never ride the `p` field.
 *
 * The send is gated exactly as the page view is: `configureSiteEvents` is
 * called by <SiteBeacon> only after `shouldSendBeacon` allowed it, so a
 * preview, a local build or Vivreal staff send nothing. Every failure is
 * swallowed: analytics must never break the site.
 *
 * Pure apart from the injected transport, so it runs under `node --test`.
 */

/** The landing parameters that mean "this visit came from a Google ad" (D15). */
export const AD_CLICK_ID_PARAMS: readonly string[] = Object.freeze(['gclid', 'gbraid', 'wbraid']);

/** One campaign tag, after lowercasing and trimming (VR_Analytics_API's rule). */
const TAG = /^[a-z0-9._-]{1,40}$/;
/** A link page link id, as the Studio mints it. */
const LINK_ID = /^[a-z0-9]{6,24}$/;

export type SiteGoal = 'message' | 'booking' | 'purchase';
const GOALS: ReadonlySet<string> = new Set<SiteGoal>(['message', 'booking', 'purchase']);

export interface CampaignTags {
  s?: string;
  m?: string;
  c?: string;
}

export interface LandingSignals {
  a?: 1;
  u?: CampaignTags;
}

function readParams(search: string): URLSearchParams | null {
  try {
    return new URLSearchParams(search);
  } catch {
    return null;
  }
}

function cleanTag(value: string | null): string | undefined {
  if (value === null) return undefined;
  const tag = value.trim().toLowerCase();
  return TAG.test(tag) ? tag : undefined;
}

/**
 * The ad signal and campaign tags of a landing address's query string
 * (`window.location.search`). Returns only what is present and valid, so a
 * plain visit adds no key at all and its payload is byte-identical to today's.
 */
export function readLandingSignals(search: string): LandingSignals {
  const params = readParams(search);
  if (!params) return {};
  const signals: LandingSignals = {};
  if (AD_CLICK_ID_PARAMS.some((name) => (params.get(name) ?? '').trim() !== '')) signals.a = 1;
  const u: CampaignTags = {};
  const s = cleanTag(params.get('utm_source'));
  const m = cleanTag(params.get('utm_medium'));
  const c = cleanTag(params.get('utm_campaign'));
  if (s) u.s = s;
  if (m) u.m = m;
  if (c) u.c = c;
  if (u.s || u.m || u.c) signals.u = u;
  return signals;
}

/** A path with any query or fragment cut off. The beacon's `p` is only ever this. */
export function pagePath(path: string): string {
  const cut = path.search(/[?#]/);
  return cut === -1 ? path : path.slice(0, cut);
}

export interface PageViewInput {
  siteId: string;
  hostname: string;
  path: string;
  referrer: string;
  width: number;
  /** `window.location.search` of the page being counted. */
  search: string;
}

/** The page-view payload: today's five fields, plus `a` and `u` only when the landing carried them. */
export function buildPageViewPayload(input: PageViewInput): Record<string, unknown> {
  return {
    s: input.siteId,
    h: input.hostname,
    p: pagePath(input.path),
    r: input.referrer,
    w: input.width,
    ...readLandingSignals(input.search),
  };
}

export type SiteEvent = { k: 'lt'; l: string } | { k: 'gl'; g: SiteGoal };

/** Whether an event is well formed. Anything else is not sent at all. */
export function isValidSiteEvent(event: unknown): event is SiteEvent {
  if (typeof event !== 'object' || event === null) return false;
  const { k, l, g } = event as { k?: unknown; l?: unknown; g?: unknown };
  if (k === 'lt') return typeof l === 'string' && LINK_ID.test(l);
  if (k === 'gl') return typeof g === 'string' && GOALS.has(g);
  return false;
}

/** Sends a payload. Never throws to the caller of `sendSiteEvent`. */
export type BeaconTransport = (endpoint: string, payload: string) => void;

interface SiteEventsConfig {
  siteId: string;
  endpoint: string;
  transport: BeaconTransport;
}

let config: SiteEventsConfig | null = null;

/**
 * Called by <SiteBeacon> once `shouldSendBeacon` allowed this page view, so
 * events follow the page view's own gate. Until it is called, `sendSiteEvent`
 * sends nothing.
 */
export function configureSiteEvents(next: SiteEventsConfig | null): void {
  config = next;
}

export interface EventLocation {
  hostname: string;
  path: string;
}

/**
 * Send a link tap or a result. Returns whether a payload was handed to the
 * transport (for tests); callers ignore it.
 */
export function sendSiteEvent(event: SiteEvent, where: EventLocation): boolean {
  if (!config || !isValidSiteEvent(event)) return false;
  const payload: Record<string, unknown> = {
    s: config.siteId,
    h: where.hostname,
    p: pagePath(where.path),
    k: event.k,
    ...(event.k === 'lt' ? { l: event.l } : { g: event.g }),
  };
  try {
    config.transport(config.endpoint, JSON.stringify(payload));
    return true;
  } catch {
    return false; // analytics must never break the site
  }
}

/**
 * The browser transport: `sendBeacon` (text/plain, no preflight, survives
 * unload), else a keepalive fetch. Every failure is swallowed.
 */
export function browserBeaconTransport(endpoint: string, payload: string): void {
  try {
    const blob = new Blob([payload], { type: 'text/plain' });
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(endpoint, blob)) {
      return;
    }
  } catch {
    /* fall through to fetch */
  }
  try {
    void fetch(endpoint, {
      method: 'POST',
      body: payload,
      keepalive: true,
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
    }).catch(() => undefined);
  } catch {
    /* swallow: analytics must never break the site */
  }
}

/** `sendSiteEvent` at the current page, for client components. */
export function sendSiteEventHere(event: SiteEvent): void {
  if (typeof window === 'undefined') return;
  sendSiteEvent(event, { hostname: window.location.hostname, path: window.location.pathname });
}

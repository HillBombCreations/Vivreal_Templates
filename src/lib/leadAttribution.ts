/**
 * Server-side lead attribution (G12 / change item C4).
 *
 * Reads the `vr_attr` cookie off the REQUEST and folds the first touch into the
 * outbound lead. Two files carry the whole feature — `/api/subscribe` and
 * `/api/contact` — because every email-capture surface on a renderer site
 * already funnels through them: the hero inline capture, the footer newsletter
 * and the exit-intent popup all reach `/api/subscribe`; `/contact` and
 * `/migrate` reach `/api/contact`.
 *
 * WHY SERVER-SIDE. Both routes are same-origin POSTs, so the apex cookie is on
 * the request automatically. Doing the merge here means no renderer change and
 * no client-spoofable payload field (the renderer has no `hidden` field type),
 * and it covers capture surfaces that do not exist yet.
 *
 * INFRA DEPENDENCY, stated because its failure is SILENT. "The cookie is on the
 * request automatically" is only true while CloudFront forwards it. The
 * `/api/*` behavior on E39DUKXYGXCX8Q carries the AllViewer origin-request
 * policy, which forwards all cookies. If `/api/*` ever moved to a behavior
 * without cookie forwarding, this would no-op with no error and no alarm —
 * leads delivered with empty attribution. That is why change item C11 pins both
 * policy ids as a hard constraint of the origin swap, and why GATE 3 item 18
 * must run through CloudFront and never against the Amplify origin directly.
 *
 * FAIL-SAFE DOCTRINE. Attribution must never cost a lead. Every entry point
 * here returns the caller's payload UNCHANGED on any parse failure, missing
 * cookie, or malformed value — same doctrine as attribution.ts's own
 * swallow-everything catch. A lead with no attribution is a small loss; a lead
 * that 400s because of an attribution bug is a large one.
 */

import type { Attribution, AttributionTouch } from './attribution.ts';

export const ATTRIBUTION_COOKIE_NAME = 'vr_attr';

/**
 * The keys folded into a lead, in emission order. Deliberately the plain UTM
 * names rather than a `vr_`-namespaced set: WS-5 item 4's proof reads
 * `utm_campaign` off the created subscriber document, and the branded contact
 * email renders these as human labels ("Utm Campaign", "Landing Path").
 */
const LEAD_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'source',
  'landing_path',
] as const;

/** Matches the per-value ceiling `sanitizeFields()` already applies. */
const VALUE_MAX = 200;

/**
 * Parse one cookie out of a raw `Cookie:` request header.
 *
 * Hand-rolled rather than using `NextRequest.cookies` so both routes — one
 * Node, one edge — share a single implementation that is unit-testable without
 * importing `next/server`.
 */
export function readCookieFromHeader(
  cookieHeader: string | null | undefined,
  name: string,
): string | null {
  if (typeof cookieHeader !== 'string' || cookieHeader === '') return null;
  for (const part of cookieHeader.split(';')) {
    const raw = part.trim();
    const eq = raw.indexOf('=');
    if (eq === -1) continue;
    if (raw.slice(0, eq) !== name) continue;
    return raw.slice(eq + 1);
  }
  return null;
}

/**
 * Parse the v2 `vr_attr` payload. Mirrors the client reader in attribution.ts:
 * only a well-formed object at the CURRENT version with a `first` touch counts.
 * Anything else — absent, malformed, a v1 leftover — is null.
 */
export function parseAttributionCookie(
  cookieHeader: string | null | undefined,
): Attribution | null {
  const raw = readCookieFromHeader(cookieHeader, ATTRIBUTION_COOKIE_NAME);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed as Attribution).v === 2 &&
      (parsed as Attribution).first &&
      typeof (parsed as Attribution).first === 'object'
    ) {
      return parsed as Attribution;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Flatten the FIRST touch into string lead fields.
 *
 * First touch, not last: it is the campaign that actually earned the visit, it
 * is frozen for the cookie's 90-day life, and it is what the admin rollup's
 * `totals.byCampaign[]` reports. Last touch is available on the same cookie if
 * a later change wants it — deliberately not shipped now (no scope creep).
 */
export function attributionLeadFields(
  attribution: Attribution | null,
): Record<string, string> {
  if (!attribution?.first) return {};
  const first = attribution.first as AttributionTouch & Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of LEAD_KEYS) {
    const value = first[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed === '') continue;
    out[key] = trimmed.length > VALUE_MAX ? trimmed.slice(0, VALUE_MAX) : trimmed;
  }
  return out;
}

/**
 * Merge attribution into a lead's field bag.
 *
 * NEVER CLOBBERS. A submitted field wins over an attribution key of the same
 * name — a customer's contact form can legitimately carry a field keyed
 * `source` ("How did you hear about us?"), and silently overwriting the
 * visitor's own answer with a derived value would be data loss in the one
 * payload we are here to enrich.
 *
 * Returns the ORIGINAL reference when there is nothing to add, so a request
 * with no `vr_attr` cookie produces a byte-identical payload to today's.
 */
export function mergeAttributionFields<T extends Record<string, string> | undefined>(
  fields: T,
  cookieHeader: string | null | undefined,
): T | Record<string, string> {
  try {
    const attribution = attributionLeadFields(parseAttributionCookie(cookieHeader));
    const keys = Object.keys(attribution);
    if (keys.length === 0) return fields;

    const merged: Record<string, string> = { ...(fields ?? {}) };
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(merged, key)) continue;
      merged[key] = attribution[key];
    }
    return merged;
  } catch {
    // Attribution must never cost a lead.
    return fields;
  }
}

/**
 * Contact-route variant. Same never-clobber merge, but tolerant of the looser
 * `Record<string, unknown>` shape `customFields` carries (the renderer parks
 * booleans and arrays there too).
 *
 * Verified against the receiving validator before shipping:
 * `VR_Client_API/src/scripts/validators.js` declares
 * `customFields: Joi.object().unknown(true).max(40)`, so extra string keys are
 * accepted and the 40-key cap has ample headroom over any real contact form
 * plus these seven. A strict sub-key validator there would have rejected the
 * whole submission — which is why this was checked rather than assumed.
 */
export function mergeAttributionCustomFields(
  customFields: Record<string, unknown> | undefined,
  cookieHeader: string | null | undefined,
): Record<string, unknown> | undefined {
  try {
    const attribution = attributionLeadFields(parseAttributionCookie(cookieHeader));
    const keys = Object.keys(attribution);
    if (keys.length === 0) return customFields;

    const merged: Record<string, unknown> = { ...(customFields ?? {}) };
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(merged, key)) continue;
      merged[key] = attribution[key];
    }
    return merged;
  } catch {
    return customFields;
  }
}

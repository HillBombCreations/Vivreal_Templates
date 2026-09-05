/**
 * Request preparation for `POST /api/delivery-quote`, the thin proxy in front
 * of VR_Client_API's delivery-quote endpoint.
 *
 * Pure and dependency-free so it runs under plain `node --test`: the route
 * itself imports `next/server` and cannot be loaded there, and this is the half
 * with the behaviour worth pinning.
 *
 * The single most important property here is that the body is FORWARDED, not
 * REBUILT. A proxy that reconstructs a request from the fields it happens to
 * know about silently drops every field added after it was written, and the
 * symptom is a correctly built endpoint returning a wrong answer that looks
 * like the endpoint's bug. `deliveryDays` is the live example: it is authored
 * in the renderer's block config, the date arithmetic that reads it lives in
 * VR_Client_API, and this layer's whole job is to not lose it in between.
 */

/**
 * Exactly five digits, and this is deliberately the same rule VR_Client_API
 * applies, so the two layers cannot disagree about what a ZIP is.
 */
export const ZIP_PATTERN = /^\d{5}$/;

/**
 * A quote request is a ZIP, a small zone list, and a few scalars. This cap is
 * generous for that and stops an unauthenticated caller from making us relay an
 * arbitrary payload to a Lambda on the public read path.
 *
 * Named in CHARACTERS rather than bytes because that is what is actually
 * measured; a multi-byte body hits the cap sooner than its byte length
 * suggests, which errs in the safe direction.
 */
export const MAX_BODY_CHARS = 16 * 1024;

export type PreparedQuoteRequest =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; error: string };

/**
 * Validate the parts this layer owns and hand back the body to forward.
 *
 * Only `zip` is checked, because only `zip` is checked cheaply and rejected
 * before any upstream work happens. Everything else is the upstream's to
 * validate, and everything else is passed through UNTOUCHED, including keys
 * this file has never heard of.
 */
export function prepareDeliveryQuoteRequest(bodyText: string): PreparedQuoteRequest {
  if (bodyText.length > MAX_BODY_CHARS) {
    return { ok: false, status: 413, error: 'Request too large' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return { ok: false, status: 400, error: 'Invalid request body' };
  }

  // `typeof null === 'object'`, and an array would spread into numeric keys.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, status: 400, error: 'Invalid request body' };
  }

  const body = parsed as Record<string, unknown>;
  const zip = typeof body.zip === 'string' ? body.zip.trim() : '';
  if (!ZIP_PATTERN.test(zip)) {
    return { ok: false, status: 400, error: 'Enter a 5 digit ZIP code' };
  }

  // Spread, so every other key survives by construction rather than by this
  // file remembering to list it. `zip` is the only value normalised.
  return { ok: true, body: { ...body, zip } };
}

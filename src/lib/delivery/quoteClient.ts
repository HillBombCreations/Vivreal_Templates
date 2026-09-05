/**
 * The browser half of the delivery coverage check: the function injected into
 * the renderer as `onDeliveryQuote`, sitting in front of the same-origin proxy
 * at `/api/delivery-quote`.
 *
 * WHY THIS EXISTS AS ITS OWN MODULE. The renderer has no network by design, so
 * `DeliveryCheck` reads an adapter off the renderer context and DISABLES ITSELF
 * when it is absent. Without this function reaching that context, every live
 * site renders a heading, a greyed-out ZIP box and a dead button, and both the
 * proxy and the VR_Client_API endpoint behind it are unreachable from the
 * product. It is a plain exported function rather than an inline arrow in
 * `Providers` so the thing the provider passes is the same object a test can
 * call.
 *
 * THE FAILURE CONTRACT, which is the whole point of the file.
 *
 * `subscribeUser` returns `false` on every failure and never throws. This
 * returns `null` on every failure and never throws, which is the same shape:
 * one sentinel meaning "no answer", chosen so a caller cannot mistake a failure
 * for a result. `DeliveryCheck` turns `null` into "We could not check right
 * now", which is true.
 *
 * There is no optimistic path, deliberately, and the reason is sharper than
 * taste. `EmailCaptureInline` fakes success with no handler injected so a
 * Studio preview reads as complete; for a newsletter box that is cosmetic.
 * Here the equivalent would be telling a real customer "Yes, we deliver to
 * 37659" when nothing is wired.
 *
 * WHY THE STATUS IS CHECKED AGAINST A LIST. `buildDeliveryAnswer` in the
 * renderer ends with an unguarded fall-through to `out-of-area`, so ANY object
 * without a status it recognises renders as "We do not deliver to 37659 yet."
 * A truncated body, an envelope shape change or a `data: {}` would therefore
 * turn a plumbing fault into the business refusing an order it wanted, silently
 * and only for that visitor. Refusing to pass on a payload we cannot read costs
 * a "could not check right now"; passing it on costs the order. If the endpoint
 * ever adds a fifth status this list is the thing to update, and until it is
 * updated the block degrades rather than lies.
 *
 * WHY THE REQUEST IS FORWARDED, NOT REBUILT. The same rule the proxy follows.
 * The renderer composes the request in `buildQuoteRequest` and the date
 * arithmetic that reads `config.deliveryDays` lives in VR_Client_API; this
 * layer's entire job in between is to not lose a field. Rebuilding it here from
 * the keys this file happens to know about would silently drop every field
 * added after it was written.
 */

/** The same-origin proxy. Relative on purpose: an absolute URL built on a site's own host is how a request ends up somewhere else. */
export const DELIVERY_QUOTE_PATH = '/api/delivery-quote';

/**
 * The four answers the endpoint can give, mirroring `DeliveryQuoteStatus` in
 * the renderer's `types/Delivery.ts`. Anything else is not an answer.
 */
export const DELIVERY_QUOTE_STATUSES: ReadonlySet<string> = new Set([
    'in-area',
    'out-of-area',
    'zip-not-recognized',
    'origin-not-configured',
]);

/**
 * What the renderer hands us. Structurally minimal ON PURPOSE: this layer
 * relays the request rather than modelling it, so a field the renderer adds
 * needs no change here. `zip` is named because it is the only one this side
 * ever reads.
 */
export interface DeliveryQuoteRequest {
    zip: string;
    [key: string]: unknown;
}

/** What the endpoint answers. Same reasoning: only `status` is read here. */
export interface DeliveryQuoteAnswer {
    status: string;
    [key: string]: unknown;
}

/**
 * Ask whether the business delivers to a ZIP.
 *
 * Resolves the quote, or `null` when no answer could be obtained for any
 * reason at all: the route is not configured (503), the ZIP was rejected (400),
 * the upstream was unreachable (502), the body was not JSON, the envelope said
 * failure, or the payload carried no status we recognise. The caller renders
 * "could not check", never a coverage answer.
 */
export async function requestDeliveryQuote(
    input: DeliveryQuoteRequest,
): Promise<DeliveryQuoteAnswer | null> {
    try {
        const res = await fetch(DELIVERY_QUOTE_PATH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Forwarded whole. See the header comment.
            body: JSON.stringify(input),
        });
        // Every non-2xx is a non-answer, including 400 and 429. The block's
        // error state already says the honest thing about all of them.
        if (!res.ok) return null;

        const json: unknown = await res.json();
        if (!json || typeof json !== 'object') return null;

        // VR_Client_API's tenant envelope: { success, data, error }.
        const envelope = json as { success?: unknown; data?: unknown };
        if (envelope.success !== true) return null;

        const data = envelope.data;
        // `typeof null === 'object'`, and an array has no `status`.
        if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

        const status = (data as { status?: unknown }).status;
        if (typeof status !== 'string' || !DELIVERY_QUOTE_STATUSES.has(status)) return null;

        return data as DeliveryQuoteAnswer;
    } catch (err) {
        // Swallowed to a null, matching `subscribeUser`. A coverage lookup must
        // not take the page down, and the visitor is not the person who can fix
        // it. Logged with no request detail: the input carries the visitor's
        // ZIP and the error does not need it.
        console.error('[requestDeliveryQuote] Error:', err);
        return null;
    }
}

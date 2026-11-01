/**
 * Credentials and the visitor's IP never leave in a Sentry event (next release
 * 2026-11, plan 3.PII, T8; owner Q14).
 *
 * `sendDefaultPii: false` (set explicitly in all three Templates inits) only
 * stops the SDK adding the IP itself: measured on the fleet's SDKs, the
 * `Cookie` header, `request.cookies` and every other request header still ride
 * on an event, and Templates' cookies include the portal preview token
 * (`vr-preview-token`, `src/lib/api/previewToken.ts`). So the three hooks
 * (`beforeSend`, `beforeSendTransaction`, `beforeBreadcrumb`) delete:
 *
 *  - `request.cookies`, and every header on the FLEET-WIDE list below from
 *    `request.headers` (case-insensitive);
 *  - `user.ip_address`, as a backstop;
 *  - in `contexts.trace.data` and every `spans[].data`, in the SDK's own key
 *    shape (`http.request.header.<name>`, lower-cased, hyphens written as
 *    underscores, one key per cookie): every listed header in either spelling,
 *    every key under a cookie or set-cookie prefix whatever the cookie is
 *    called, and the client address keys. Templates runs with tracing off
 *    (`tracesSampleRate: 0`), so no transaction or span is sent today; the
 *    transaction hook and the span walk are here so turning tracing on can
 *    never ship these keys;
 *  - the same header and attribute keys from a breadcrumb's `data`.
 *
 * One list for the whole fleet, never this repo's own names (plan 3.PII,
 * Revision 26, 33 names): the 4 always-names, the 21 found by the unfiltered
 * grep of every repo's `src` plus the release check's canary
 * `x-vr-sentry-canary`, the 3 from the server-side rule, and the 5 headers
 * that carry the visitor's IP. Templates' own unfiltered re-grep at build
 * (2026-10-31) found no name outside it. The release check's kept control
 * header, `x-vr-check-control`, must NEVER join it. The same array as
 * VR_Client_API PR #133 `src/scripts/sentry.js` `FLEET_SECRET_HEADERS`.
 *
 * Only Sentry's copy of the event is touched; nothing here changes a request.
 * Pure, so `node --test` drives it with the installed SDK's own output.
 */

export const FLEET_SECRET_HEADERS: readonly string[] = Object.freeze([
  'cookie', 'set-cookie', 'authorization', 'proxy-authorization',
  'x-active-ctx', 'x-user-ctx', 'x-api-key', 'x-support-attestation',
  'x-csrf-token', 'x-aws-waf-token', 'x-amz-security-token', 'x-amz-signature',
  'x-shopify-access-token', 'x-dead-token-value', 'x-github-stateless-s2s-token',
  'x-vivreal-preview', 'x-vivreal-preview-token', 'x-vivreal-signature', 'x-vivreal-internal',
  'stripe-signature', 'x-stripe-signature', 'x-hub-signature-256',
  'x-shopify-hmac-sha256', 'x-square-hmacsha256-signature', 'x-vr-sentry-canary',
  'x-preview-token', 'x-vr-metering-token', 'x-revalidate-signature',
  'x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'true-client-ip', 'x-client-ip',
]);

const SECRET_HEADERS: ReadonlySet<string> = new Set(FLEET_SECRET_HEADERS);

// `http.request.header.<name>`: the name is the segment after `header.`, read
// in either spelling. A key under a cookie prefix goes whatever follows it.
const HEADER_ATTRIBUTE = /^http\.(?:request|response)\.header\.([^.]+)/;
const COOKIE_ATTRIBUTE_PREFIXES: readonly string[] = Object.freeze([
  'http.request.header.cookie',
  'http.response.header.set_cookie',
  'http.response.header.set-cookie',
]);
/** Where the SDK records the client address on a span. */
const CLIENT_ADDRESS_KEYS: ReadonlySet<string> = new Set(['http.client_ip', 'client.address', 'net.peer.ip']);

type Bag = Record<string, unknown>;

const isBag = (value: unknown): value is Bag => typeof value === 'object' && value !== null;

function isSecretHeaderAttribute(key: string): boolean {
  const lower = key.toLowerCase();
  if (CLIENT_ADDRESS_KEYS.has(lower)) return true;
  if (COOKIE_ATTRIBUTE_PREFIXES.some((prefix) => lower.startsWith(prefix))) return true;
  const match = HEADER_ATTRIBUTE.exec(lower);
  return match !== null && SECRET_HEADERS.has(match[1].replace(/_/g, '-'));
}

function deleteSecretHeaders(headers: unknown): void {
  if (!isBag(headers)) return;
  for (const name of Object.keys(headers)) {
    if (SECRET_HEADERS.has(name.toLowerCase())) delete headers[name];
  }
}

function deleteSecretHeaderAttributes(data: unknown): void {
  if (!isBag(data)) return;
  for (const key of Object.keys(data)) {
    if (isSecretHeaderAttribute(key)) delete data[key];
  }
}

/**
 * `beforeSend` and `beforeSendTransaction`: the event, with every credential
 * and the IP removed in place. Never drops the event and never throws on a
 * shape it does not expect.
 */
export function scrubCredentials<E>(event: E): E {
  if (!isBag(event)) return event;
  const request = event.request;
  if (isBag(request)) {
    delete request.cookies;
    deleteSecretHeaders(request.headers);
  }
  if (isBag(event.user)) delete event.user.ip_address;
  const contexts = event.contexts;
  if (isBag(contexts) && isBag(contexts.trace)) deleteSecretHeaderAttributes(contexts.trace.data);
  if (Array.isArray(event.spans)) {
    for (const span of event.spans) if (isBag(span)) deleteSecretHeaderAttributes(span.data);
  }
  return event;
}

/** `beforeBreadcrumb`: the same header and attribute keys out of `data`. */
export function scrubBreadcrumbCredentials<B>(breadcrumb: B): B {
  if (!isBag(breadcrumb) || !isBag(breadcrumb.data)) return breadcrumb;
  deleteSecretHeaders(breadcrumb.data);
  deleteSecretHeaderAttributes(breadcrumb.data);
  return breadcrumb;
}

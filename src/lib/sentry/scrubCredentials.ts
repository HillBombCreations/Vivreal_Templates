/**
 * Credentials, the visitor's IP, the request body and URL queries never leave
 * in a Sentry event (next release 2026-11, plan 3.PII, T8; owner Q14; the body
 * and the query since the open-backlog release).
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
 *  - the same header and attribute keys from a breadcrumb's `data`;
 *  - `request.data`, the request BODY, whatever its shape (open-backlog
 *    release 2026-11, Sentry body leak). The Node SDK reads every JSON and
 *    form body a request carries (it wraps `req.on("data")`, which Next 16
 *    reads bodies with) and attaches it to every event of that request,
 *    whatever `sendDefaultPii` says. On this site that was a form-encoded
 *    POST to a Node-rendered page (Next reads it as a possible server
 *    action), on every capture the render makes; contact, booking and
 *    checkout run on the edge runtime, which records no body. The Node init
 *    also stops the SDK reading the body at all
 *    (`maxIncomingRequestBodySize: "none"`, `src/instrumentation.ts`); this
 *    delete is the hook's half, and the only one the edge and browser
 *    inits have;
 *  - every URL QUERY (open-backlog release 2026-11, review P1): a renderer
 *    form submitted before the page's script loads sends a GET, so its
 *    name, email, phone and message ride the page URL. `request.query_string`
 *    goes, and `request.url`, a `Referer` header, the transaction name, a
 *    breadcrumb's `url`, `from` and `to`, and a span's URL keys are cut at
 *    `?` or `#`; the path stays, so an error still says which page. The
 *    renderer's own fix (no form ever GETs) is backlog F179.
 *
 * One list for the whole fleet, never this repo's own names (plan 3.PII,
 * Revision 26, 33 names): the 4 always-names, the 21 found by the unfiltered
 * grep of every repo's `src` plus the release check's canary
 * `x-vr-sentry-canary`, the 3 from the server-side rule, and the 5 headers
 * that carry the visitor's IP. Templates' own unfiltered re-grep at build
 * (2026-10-31) found no name outside it. The release check's kept control
 * header, `x-vr-check-control`, must NEVER join it. Next release 2026-12
 * (plan RP-4, review-a-pr28 note 5) adds a 34th, `cloudfront-viewer-address`
 * (the viewer's `ip:port`): the SDK's HTTP server instrumentation records it
 * like any other request header, and the SDK's own IP list does not hold it.
 * The same array as VR_Client_API `src/scripts/sentry.js`
 * `FLEET_SECRET_HEADERS` on its 2026-12 release branch.
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
  'cloudfront-viewer-address',
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
/**
 * Where the SDK records the client address on a span. Next release 2026-12
 * (plan D8, RP-4): the fleet's one five-key set. The installed SDK does not
 * write the two stable-convention names (`network.peer.address`,
 * `net.sock.peer.addr`) today, but a move to them would otherwise ship the
 * address silently.
 */
const CLIENT_ADDRESS_KEYS: ReadonlySet<string> = new Set([
  'network.peer.address', 'client.address', 'net.peer.ip', 'http.client_ip', 'net.sock.peer.addr',
]);

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

/** The URL up to its query or fragment: the path stays, what a GET form put after it does not. */
function withoutQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/** A request header that carries the previous page's whole URL. */
const REFERER_HEADERS: ReadonlySet<string> = new Set(['referer', 'referrer']);
/**
 * Breadcrumb and span keys that hold a whole URL (cut at its query), and keys
 * that hold only a query or a fragment (deleted). The SDK's outgoing request
 * breadcrumbs split a URL into `url`, `http.query` and `http.fragment`;
 * navigation breadcrumbs carry `from` and `to`.
 */
const URL_KEYS: ReadonlySet<string> = new Set([
  'url', 'from', 'to', 'url.full', 'http.url', 'http.target',
  'http.request.header.referer', 'http.request.header.referrer',
]);
const QUERY_KEYS: ReadonlySet<string> = new Set(['http.query', 'http.fragment', 'url.query', 'url.fragment']);

function cutRefererQueries(headers: unknown): void {
  if (!isBag(headers)) return;
  for (const name of Object.keys(headers)) {
    const value = headers[name];
    if (REFERER_HEADERS.has(name.toLowerCase()) && typeof value === 'string') headers[name] = withoutQuery(value);
  }
}

function cutUrlQueries(data: unknown): void {
  if (!isBag(data)) return;
  for (const key of Object.keys(data)) {
    const lower = key.toLowerCase();
    const value = data[key];
    if (QUERY_KEYS.has(lower)) delete data[key];
    else if (URL_KEYS.has(lower) && typeof value === 'string') data[key] = withoutQuery(value);
  }
}

/** A span's or the trace context's attributes: credentials and URL queries out. */
function scrubAttributes(data: unknown): void {
  deleteSecretHeaderAttributes(data);
  cutUrlQueries(data);
}

/**
 * `beforeSend` and `beforeSendTransaction`: the event, with every credential,
 * the IP, the request body and every URL query removed in place. Never drops
 * the event and never throws on a shape it does not expect.
 */
export function scrubCredentials<E>(event: E): E {
  if (!isBag(event)) return event;
  const request = event.request;
  if (isBag(request)) {
    delete request.data;
    delete request.cookies;
    delete request.query_string;
    if (typeof request.url === 'string') request.url = withoutQuery(request.url);
    deleteSecretHeaders(request.headers);
    cutRefererQueries(request.headers);
  }
  // Written through the plain record view: a generic `E` has no `transaction` to assign.
  const fields: Bag = event;
  if (typeof fields.transaction === 'string') fields.transaction = withoutQuery(fields.transaction);
  if (isBag(event.user)) delete event.user.ip_address;
  const contexts = event.contexts;
  if (isBag(contexts) && isBag(contexts.trace)) scrubAttributes(contexts.trace.data);
  if (Array.isArray(event.spans)) {
    for (const span of event.spans) if (isBag(span)) scrubAttributes(span.data);
  }
  // Breadcrumbs already passed `beforeBreadcrumb` when they were added; this
  // covers any an event brings with it.
  if (Array.isArray(event.breadcrumbs)) {
    for (const crumb of event.breadcrumbs) scrubBreadcrumbCredentials(crumb);
  }
  return event;
}

/** `beforeBreadcrumb`: the same header and attribute keys, and every URL query, out of `data`. */
export function scrubBreadcrumbCredentials<B>(breadcrumb: B): B {
  if (!isBag(breadcrumb) || !isBag(breadcrumb.data)) return breadcrumb;
  deleteSecretHeaders(breadcrumb.data);
  deleteSecretHeaderAttributes(breadcrumb.data);
  cutUrlQueries(breadcrumb.data);
  return breadcrumb;
}

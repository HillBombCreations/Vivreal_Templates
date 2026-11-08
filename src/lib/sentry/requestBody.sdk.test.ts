import { test } from "node:test";
import assert from "node:assert/strict";
import { register as registerLoader } from "node:module";

// Scoped to THIS file's process (`node --test` runs each file in its own
// child). The subscribe route's loader with `@sentry/nextjs` left REAL; see
// `../api/testSupport/realSentryLoader.mjs` and `../api/testSupport/realSentry.mjs`.
registerLoader(new URL("../api/testSupport/realSentryLoader.mjs", import.meta.url).href);

/**
 * Open-backlog release 2026-11, Sentry body leak (vivreal-hq
 * docs/projects/release-plan-open-backlog/research-sentry-body-leak.md, the
 * Templates row). The Node SDK wraps `req.on("data")`, which Next 16 reads
 * every request body with, and attaches the body to every event that request
 * raises, whatever `sendDefaultPii` says. Until this release no hook removed
 * it. On this site that was a form-encoded POST to a Node-rendered page (Next
 * reads it as a possible server action), on every capture the render makes;
 * contact, booking and checkout run on the edge runtime, which records no
 * body (review-t-pr227.md pass 3, measured on a real Next server).
 *
 * This drives the installed SDK end to end, the same way
 * `../api/scrubbedCapture.sdk.test.ts` does: the repo's own `register()` from
 * `src/instrumentation.ts` (Node runtime), a real node http server whose
 * handler reads the body with `req.on("data")` from inside the request (as
 * Next does), and an in-memory transport in place of the network. It is not
 * Next itself, so each leg names the production surface it stands for. The
 * captures made inside a request that carries a visitor's details:
 *  - a form posted to a page, captured the way a page render's failed read
 *    is (`client.ts` `buildFetchFailureCapture`): the surface that leaked;
 *  - the REAL contact route (`src/app/api/contact/route.ts`), whose upstream
 *    refuses, so it sends its own two captures (recipient lookup failed, and
 *    submission rejected, `route.ts:97`). Edge in production; here it runs
 *    under the Node SDK, as a route on Node would;
 *  - the SDK's route handler wrapper (`wrapRouteHandlerWithSentry`)
 *    capturing a booking route that throws, JSON and form bodies. A webpack
 *    build puts that wrapper around every app route; Templates builds with
 *    turbopack (`scripts/build-with-snapshot.mjs`), which puts none, so here
 *    it stands for any capture made while a body-carrying request runs;
 *  - a page request whose URL QUERY carries the details (review P1: a
 *    renderer form submitted before the page's script loads sends a GET),
 *    with the same URL in its `Referer`.
 *
 * Two layers are checked separately. A scope event processor records each
 * event as the SDK built it, AFTER the SDK's own processors attach the
 * request and BEFORE `beforeSend` runs: no `data` there means the SDK never
 * read the body (`maxIncomingRequestBodySize: "none"`). The envelope is what
 * would have left the process: no visitor detail anywhere in it. Red at
 * `43f90217` on the envelope assertion: the body rode in `request.data`. The
 * query leg is red at `a662b444`: the details rode in `request.url` and
 * `request.query_string`.
 *
 * Positive controls: the contact route forwarded the visitor's details
 * upstream and the handlers parsed every body and query, so the request
 * really carried every marker; and every event still carries its request
 * (method, path, headers), so an absent detail is not an absent request.
 * Events are matched on the URL's PATH, so a query left on the URL fails the
 * marker check rather than hiding the event.
 */

/** One visitor's details. Every value carries a marker no other value shares. */
const CONTACT = {
  name: "Ada kx1name",
  customerEmail: "kx1email@visitor.example",
  message: "kx1message, a table for six on Friday",
  siteName: "Body Test Site",
  customFields: { phone: "+14155550101" },
};
const CONTACT_MARKERS = ["kx1name", "kx1email", "4155550101", "kx1message"];
const BOOKING_JSON = { name: "Bea kx2name", email: "kx2email@visitor.example", phone: "+14155550102", notes: "kx2notes, window seat" };
const BOOKING_JSON_MARKERS = ["kx2name", "kx2email", "4155550102", "kx2notes"];
const BOOKING_FORM = { name: "Cy kx3name", email: "kx3email@visitor.example", phone: "+14155550103", notes: "kx3notes, high chair" };
const BOOKING_FORM_MARKERS = ["kx3name", "kx3email", "4155550103", "kx3notes"];
/** Posted as a form to a page, the surface that leaked at 43f90217. */
const PAGE_FORM = { name: "Di kx4name", email: "kx4email@visitor.example", phone: "+14155550104", message: "kx4message, call me back" };
const PAGE_FORM_MARKERS = ["kx4name", "kx4email", "4155550104", "kx4message"];
/** Sent as a page URL's query (review P1), and in the same request's `Referer`. */
const PAGE_QUERY = { name: "Eli kx5name", email: "kx5email@visitor.example", phone: "+14155550105", message: "kx5message, see you then" };
const PAGE_QUERY_MARKERS = ["kx5name", "kx5email", "4155550105", "kx5message"];
const EVERY_MARKER = [
  ...CONTACT_MARKERS,
  ...BOOKING_JSON_MARKERS,
  ...BOOKING_FORM_MARKERS,
  ...PAGE_FORM_MARKERS,
  ...PAGE_QUERY_MARKERS,
];

const SITE_ID = "request-body-test-site";
/** Never dialled: every fetch to it is answered by the stub below. */
const CLIENT_API = "https://client-api.test";
const BOOKING_FAILURE = "booking upstream unreachable";
/** The read a page render makes first, and the path its failure is tagged with. */
const PAGE_READ_PATH = `/tenant/siteDetails?siteId=${SITE_ID}`;

/** The parts of a sent event these assertions read. */
interface SentEvent {
  message?: string;
  transaction?: string;
  tags?: Record<string, string>;
  exception?: { values?: Array<{ value?: string; mechanism?: { type?: string } }> };
  request?: { method?: string; url?: string; query_string?: unknown; headers?: Record<string, string>; data?: unknown };
}

interface ScopeLike {
  addEventProcessor(processor: (event: SentEvent) => SentEvent): void;
}

/** Shape `../api/testSupport/realSentry.mjs` exposes beside the real SDK functions. */
interface RealSentryModule {
  SDK_VERSION: string;
  close(timeout?: number): Promise<boolean>;
  flush(timeout?: number): Promise<boolean>;
  captureMessage(message: string, context?: Record<string, unknown>): string;
  captureException(error: unknown, context?: object): string;
  withScope<T>(callback: (scope: ScopeLike) => T): T;
  wrapRouteHandlerWithSentry(
    handler: (request: Request) => Promise<unknown>,
    context: { method: string; parameterizedRoute: string },
  ): (request: Request) => Promise<unknown>;
  __realSentryControl: { readonly envelopes: readonly string[] };
}

type RouteModule = { POST(req: Request): Promise<{ status: number; body: unknown }> };

/** Each envelope's event item, with the raw envelope text it came in. */
function sentEvents(envelopes: readonly string[]): Array<{ raw: string; event: SentEvent }> {
  return envelopes.flatMap((raw) => {
    const lines = raw.split("\n");
    const itemHeader = JSON.parse(lines[1] ?? "{}") as { type?: string };
    if (itemHeader.type !== "event") return [];
    return [{ raw, event: JSON.parse(lines[2]) as SentEvent }];
  });
}

const envKeys = [
  "NEXT_RUNTIME",
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_ENVIRONMENT",
  "NEXT_PUBLIC_CLIENT_API",
  "SITE_ID",
  "API_KEY",
] as const;
const realEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

test("a visitor's request body and URL query never reach Sentry; the error they came with still does", async (t) => {
  process.env.NEXT_RUNTIME = "nodejs";
  // `realSentry.mjs` swaps the transport for an in-memory one, and the
  // .invalid host (RFC 2606) cannot resolve if that swap is ever removed.
  process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@sentry.invalid/0";
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT = "production";
  process.env.NEXT_PUBLIC_CLIENT_API = CLIENT_API;
  process.env.SITE_ID = SITE_ID;
  delete process.env.API_KEY;

  const { register } = await import("../../instrumentation.ts");
  await register();
  const Sentry = (await import("@sentry/nextjs")) as unknown as RealSentryModule;
  const { POST: contactPOST } = (await import("../../app/api/contact/route.ts")) as unknown as RouteModule;
  const { ApiError } = await import("../api/clientFetchCore.ts");
  const { buildFetchFailureCapture } = await import("../api/errorCapture.ts");
  const http = await import("node:http");

  const realFetch = globalThis.fetch;
  /** What the contact route sent VR_Client_API (the positive control). */
  const forwardedUpstream: string[] = [];
  /** What the booking handler parsed from each request (the positive control). */
  const parsedByHandler: string[] = [];
  /** What the page handler read from each request: its body and its query (the positive control). */
  const readByPage: string[] = [];
  /** Each event as the SDK built it, before `beforeSend`. */
  const beforeHooks: Array<{ url: string; request: SentEvent["request"] | null }> = [];

  // The far upstream: the site lookup fails and the submission is refused,
  // so the contact route makes both of its captures. Anything else is a
  // request this test did not expect, refused rather than sent.
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.startsWith(`${CLIENT_API}/tenant/siteDetails`)) return new Response("{}", { status: 500 });
    if (url.startsWith(`${CLIENT_API}/tenant/sendContactEmail`)) {
      forwardedUpstream.push(String(init?.body));
      return new Response(JSON.stringify({ success: false, error: "refused" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  /**
   * The body is awaited from INSIDE the request handler, the way Next's own
   * handler reads it: the SDK opens the request's isolation scope around
   * `emit("request")`, and async context follows an `await`, not an emitter.
   */
  async function handle(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
    const body = await new Promise<string>((resolve, reject) => {
      let text = "";
      req.on("data", (chunk) => {
        text += chunk;
      });
      req.on("end", () => resolve(text));
      req.on("error", reject);
    });
    const [path, query = ""] = (req.url ?? "").split("?");
    const isForm = String(req.headers["content-type"] ?? "").startsWith("application/x-www-form-urlencoded");
    const parsed: unknown = body === "" ? null : isForm ? Object.fromEntries(new URLSearchParams(body)) : JSON.parse(body);
    // Duck-typed: `.json()`, `.text()` and `.headers.get()` are all a route reads.
    const routeRequest = { json: async () => parsed, text: async () => body, headers: { get: () => null } } as unknown as Request;

    const status = await Sentry.withScope(async (scope) => {
      scope.addEventProcessor((event) => {
        beforeHooks.push({ url: String(event.request?.url ?? ""), request: structuredClone(event.request ?? null) });
        return event;
      });
      if (path === "/" || path === "/contact") {
        // A page render whose first read fails, captured as `client.ts`
        // captures it (`clientFetchCached`, `buildFetchFailureCapture`).
        readByPage.push(`${body} ${decodeURIComponent(query)}`);
        Sentry.captureException(
          new ApiError("VR_Client_API 500", 500),
          buildFetchFailureCapture({ source: "clientFetchCached", path: PAGE_READ_PATH, siteId: SITE_ID }),
        );
        return 500;
      }
      if (path === "/api/contact") return (await contactPOST(routeRequest)).status;
      if (path.startsWith("/api/booking/")) {
        parsedByHandler.push(JSON.stringify(parsed));
        const route = Sentry.wrapRouteHandlerWithSentry(
          async () => {
            throw new Error(BOOKING_FAILURE);
          },
          { method: "POST", parameterizedRoute: path },
        );
        try {
          await route(routeRequest);
          return 200;
        } catch {
          return 500;
        }
      }
      Sentry.captureMessage("request body isolation probe", { level: "error" });
      return 200;
    });
    await Sentry.flush(2000);
    res.statusCode = status;
    res.end();
  }
  const server = http.createServer((req, res) => {
    handle(req, res).catch((err: unknown) => {
      res.statusCode = 599;
      res.end(String(err));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === "object", "the server is listening");
  const origin = `http://127.0.0.1:${address.port}`;

  async function send(
    path: string,
    body: string | null,
    contentType = "application/json",
    extraHeaders: Record<string, string> = {},
  ): Promise<number> {
    const res = await realFetch(`${origin}${path}`, {
      method: body === null ? "GET" : "POST",
      headers: { ...(body === null ? {} : { "content-type": contentType }), ...extraHeaders },
      ...(body === null ? {} : { body }),
    });
    return res.status;
  }
  /** Matched on the URL's path, so a query left on the URL fails a marker check instead of hiding the event. */
  const pathOf = (url: unknown) => String(url ?? "").split(/[?#]/)[0];
  const eventsFor = (path: string) =>
    sentEvents(Sentry.__realSentryControl.envelopes).filter(({ event }) => pathOf(event.request?.url) === `${origin}${path}`);
  const builtFor = (path: string) => beforeHooks.filter((b) => pathOf(b.url) === `${origin}${path}`);

  t.after(async () => {
    globalThis.fetch = realFetch;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await Sentry.close(2000);
    for (const key of envKeys) {
      if (realEnv[key] === undefined) delete process.env[key];
      else process.env[key] = realEnv[key];
    }
  });

  await t.test("REFUSE: a contact form's name, email, phone and message are nowhere in what the SDK sends", async () => {
    assert.equal(await send("/api/contact", JSON.stringify(CONTACT)), 400, "the visitor is told the submission was refused");
    assert.equal(forwardedUpstream.length, 1, "control: the route forwarded the submission upstream");
    for (const marker of CONTACT_MARKERS) {
      assert.ok(forwardedUpstream[0].includes(marker), `control: ${marker} was in the request the route read`);
    }

    const sent = eventsFor("/api/contact");
    assert.equal(sent.length, 2, "the route sent both of its captures");
    for (const { raw, event } of sent) {
      for (const marker of CONTACT_MARKERS) {
        assert.ok(!raw.includes(marker), `${marker} is in the envelope for "${event.message}"`);
      }
      assert.equal("data" in (event.request ?? {}), false, `request.data was sent with "${event.message}"`);
    }
    const built = builtFor("/api/contact");
    assert.equal(built.length, 2, "control: the scope processor saw both events");
    for (const { request } of built) {
      assert.equal(request?.data, undefined, "the SDK read the body (maxIncomingRequestBodySize is not none)");
    }
  });

  await t.test("ALLOW: the refused contact form is still captured, with its route and status", async () => {
    const sent = eventsFor("/api/contact").map(({ event }) => event);
    const rejected = sent.find((event) => event.message === "contact-form submission rejected, not stored or emailed");
    assert.ok(rejected, "the rejection reached Sentry");
    assert.equal(rejected.tags?.stage, "upstream-rejected");
    assert.equal(rejected.tags?.status, "400");
    assert.equal(rejected.tags?.formType, "contact");
    assert.equal(rejected.tags?.siteId, SITE_ID);
    assert.equal(rejected.request?.method, "POST");
    assert.equal(rejected.request?.headers?.["content-type"], "application/json", "control: the SDK attached the request itself");
    const lookup = sent.find((event) => event.message === "contact-form recipient lookup failed, submission stored but not emailed");
    assert.ok(lookup, "the recipient lookup failure reached Sentry");
    assert.equal(lookup.tags?.reason, "http-error");
  });

  await t.test("REFUSE: a booking's details, sent as JSON or as a form, are nowhere in the SDK's own capture", async () => {
    assert.equal(await send("/api/booking/create", JSON.stringify(BOOKING_JSON)), 500);
    assert.equal(
      await send("/api/booking/request", new URLSearchParams(BOOKING_FORM).toString(), "application/x-www-form-urlencoded"),
      500,
    );
    for (const [index, markers] of [BOOKING_JSON_MARKERS, BOOKING_FORM_MARKERS].entries()) {
      for (const marker of markers) {
        assert.ok(parsedByHandler[index]?.includes(marker), `control: ${marker} was in the request the handler read`);
      }
    }

    for (const [path, markers] of [
      ["/api/booking/create", BOOKING_JSON_MARKERS],
      ["/api/booking/request", BOOKING_FORM_MARKERS],
    ] as const) {
      const sent = eventsFor(path);
      assert.equal(sent.length, 1, `${path}: the SDK captured the failing route`);
      const { raw, event } = sent[0];
      for (const marker of markers) assert.ok(!raw.includes(marker), `${path}: ${marker} is in the envelope`);
      assert.equal("data" in (event.request ?? {}), false, `${path}: request.data was sent`);
      const built = builtFor(path);
      assert.equal(built.length, 1, `control: the scope processor saw the ${path} event`);
      assert.equal(built[0].request?.data, undefined, `${path}: the SDK read the body`);
    }
  });

  await t.test("ALLOW: the failing booking route is still captured, with its route", () => {
    for (const path of ["/api/booking/create", "/api/booking/request"]) {
      const [{ event }] = eventsFor(path);
      assert.equal(event.exception?.values?.[0]?.value, BOOKING_FAILURE);
      assert.equal(event.exception?.values?.[0]?.mechanism?.type, "auto.function.nextjs.route_handler");
      assert.equal(event.transaction, `POST ${path}`);
      assert.equal(event.request?.method, "POST");
    }
  });

  await t.test("REFUSE: a form posted to a page, the surface that leaked, sends none of its fields", async () => {
    // The leak the review measured on a real Next server at 43f90217: a
    // form-encoded POST to a Node-rendered page, carried on every capture the
    // render made. Passes at a662b444 (the body fix); this is its own leg.
    assert.equal(await send("/", new URLSearchParams(PAGE_FORM).toString(), "application/x-www-form-urlencoded"), 500);
    for (const marker of PAGE_FORM_MARKERS) {
      assert.ok(readByPage[0]?.includes(marker), `control: ${marker} was in the request the page read`);
    }
    const sent = eventsFor("/");
    assert.equal(sent.length, 1, "the page render's capture was sent");
    const { raw, event } = sent[0];
    for (const marker of PAGE_FORM_MARKERS) assert.ok(!raw.includes(marker), `/: ${marker} is in the envelope`);
    assert.equal("data" in (event.request ?? {}), false, "/: request.data was sent");
  });

  await t.test("REFUSE: a page URL whose query carries a visitor's details sends none of them, in the URL, the query or the Referer", async () => {
    // Review P1: a renderer form submitted before the page's script loads
    // sends a GET, so its fields ride the page URL, and the next request's
    // Referer. Red at a662b444: the markers rode in request.url and
    // request.query_string.
    const query = new URLSearchParams(PAGE_QUERY).toString();
    assert.equal(await send(`/contact?${query}`, null, undefined, { referer: `${origin}/contact?${query}` }), 500);
    for (const marker of PAGE_QUERY_MARKERS) {
      assert.ok(readByPage[1]?.includes(marker), `control: ${marker} was in the URL the page read`);
    }
    const sent = eventsFor("/contact");
    assert.equal(sent.length, 1, "the page render's capture was sent");
    const { raw, event } = sent[0];
    for (const marker of PAGE_QUERY_MARKERS) assert.ok(!raw.includes(marker), `/contact: ${marker} is in the envelope`);
    assert.equal("query_string" in (event.request ?? {}), false, "/contact: request.query_string was sent");
  });

  await t.test("ALLOW: a page render's failure is still captured, with its path, method, Referer path and status", () => {
    for (const [path, method] of [
      ["/", "POST"],
      ["/contact", "GET"],
    ] as const) {
      const [{ event }] = eventsFor(path);
      assert.equal(event.request?.url, `${origin}${path}`, `${path}: the path stays`);
      assert.equal(event.request?.method, method);
      assert.equal(event.exception?.values?.[0]?.value, "VR_Client_API 500", `${path}: the upstream status stays`);
      assert.equal(event.tags?.source, "clientFetchCached");
      assert.equal(event.tags?.path, "/tenant/siteDetails");
    }
    const [{ event }] = eventsFor("/contact");
    assert.equal(event.request?.headers?.referer, `${origin}/contact`, "control: the SDK recorded the Referer, cut to its path");
  });

  await t.test("PIN: a later request on the same server carries none of the earlier visitors' details", async () => {
    // Passes at 43f90217 too: the SDK already opened one isolation scope per
    // request. This pins it, so a change that shares a scope across requests
    // (the Main, Secure, CMS and Client API defect) fails here.
    assert.equal(await send("/api/shows", null), 200);
    const sent = eventsFor("/api/shows");
    assert.equal(sent.length, 1, "the probe was captured");
    const { raw, event } = sent[0];
    assert.equal(event.request?.method, "GET", "the probe carries its own request, not an earlier one");
    for (const marker of EVERY_MARKER) assert.ok(!raw.includes(marker), `${marker} from an earlier request is in the probe`);
  });
});

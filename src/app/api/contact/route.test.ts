import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";
import type { NextRequest } from "next/server";
import { stripComments } from "../../../lib/source/stripComments.ts";

// Scoped to THIS file's process only (`node --test` runs each test file in
// its own child process by default — see `testSupport/routeLoader.mjs`'s
// header for how that was confirmed). Registered before the first dynamic
// `import("./route.ts")` below, which is what lets it intercept that import.
register(new URL("./testSupport/routeLoader.mjs", import.meta.url).href);

/**
 * route.ts imports `next/server`, which the plain-Node test runner cannot
 * load, so this pins the structural decisions in the module itself, exactly
 * as `checkout/confirm/route.test.ts` and `delivery-quote/route.test.ts` do.
 * The behaviour worth pinning — what `resolveContactRecipient` actually
 * resolves to under an ALLOW/REFUSE/no-email body — lives in
 * `src/lib/contactRecipient.test.ts`, which CAN be loaded and called.
 *
 * Every ABSENCE assertion below runs against comment-stripped source. A grep
 * for a removed pattern otherwise matches the comment explaining the
 * removal, and the check silently becomes one that can never fail.
 */
const source = fs.readFileSync(new URL("./route.ts", import.meta.url), "utf8");
const code = stripComments(source);

/**
 * The exact lines this file replaced (verbatim, from before this fix). Kept
 * as the CONTROL for the absence assertions below: every pattern they refuse
 * is one this version really contained, so a typo in a regex cannot read as
 * a clean pass.
 */
const DRAFT_CONDITIONAL_LOOKUP =
  "const site = body.contactEmail?.trim() ? null : await resolveSiteContact();";
const DRAFT_RECIPIENT_LINE =
  'const to = (body.contactEmail?.trim() || site?.email || "").trim();';
const DRAFT_DROP_ON_NO_EMAIL = 'error: "No contact email configured"';

test("comment stripping did not eat the code (control)", () => {
  assert.ok(code.includes("export async function POST"), "stripper removed real code");
  assert.notEqual(code, source, "there were comments to strip");
  assert.equal(code.length, source.length, "offsets must be preserved");
  assert.ok(code.includes('"https://client.vivreal.io"'), "the stripper ate a URL string literal");
  assert.ok(!code.includes("mail relay") && !code.includes("security hotfix"), "a comment survived stripping");
});

// ---------------------------------------------------------------------------
// F1 — the open relay. Nothing a caller sends may choose the recipient.
// ---------------------------------------------------------------------------

test("the site contact lookup is unconditional, never gated on the body", () => {
  // The defect: resolveSiteContact() was only called when the body did NOT
  // supply its own contactEmail, so a caller supplying ANY value skipped the
  // server-side lookup entirely.
  assert.doesNotMatch(code, /body\.contactEmail/, "the body's contactEmail must never be read");
  // 2026-10-04: resolveSiteContact() now takes an `onFailure` alerting hook
  // (idle-dead-socket fix), so the call spans several lines, but it is still
  // the unconditional `const site = await resolveSiteContact(` start this
  // control is really about — never `body.contactEmail ? null : ...`.
  assert.match(code, /const site = await resolveSiteContact\(\{/);
});

test("control: the replaced code really did gate the lookup on body.contactEmail", () => {
  assert.match(DRAFT_CONDITIONAL_LOOKUP, /body\.contactEmail/);
  assert.match(DRAFT_RECIPIENT_LINE, /body\.contactEmail/);
});

test("the recipient comes from resolveContactRecipient(), imported from the shared module", () => {
  assert.match(
    code,
    /import \{ resolveContactRecipient, resolveSiteContact \} from "@\/lib\/contactRecipient";/,
  );
  assert.match(code, /const \{ to, siteName, branding \} = resolveContactRecipient\(body, site\);/);
});

test("the recipient is resolved in exactly one place, never re-derived with a body fallback", () => {
  // A second `||`-chained fallback elsewhere in the file is how the defect
  // would come back under a different variable name.
  const calls = [...code.matchAll(/resolveContactRecipient\(/g)];
  assert.equal(calls.length, 1, "resolveContactRecipient must be called exactly once");
  assert.doesNotMatch(code, /\bto\s*=\s*\(?\s*body\./, "no second body-derived recipient binding");
});

test("the forwarded request never contains the body's own siteId/apiKey-adjacent fields unchecked", () => {
  // Not a new claim, just confirming the F1 fix did not loosen this: siteId
  // keeps coming from the build env, never the body.
  assert.match(code, /siteId: process\.env\.SITE_ID \|\| undefined/);
});

// ---------------------------------------------------------------------------
// F2 — a submission is never silently dropped for lack of a recipient.
// ---------------------------------------------------------------------------

test("there is no early return when the site has no contact email configured", () => {
  assert.doesNotMatch(code, /No contact email configured/, "the drop-and-500 path must be gone");
});

test("control: the replaced code really did drop the submission with a 500", () => {
  assert.match(DRAFT_DROP_ON_NO_EMAIL, /No contact email configured/);
});

test("an empty recipient omits contactEmail from the upstream fetch body rather than sending it empty", () => {
  assert.match(code, /\.\.\.\(to \? \{ contactEmail: to \} : \{\}\)/);
  // The upstream `fetch(...)` call (not the unrelated `enriched` object used
  // only to render the HTML) must carry the conditional form, not a bare
  // `contactEmail: to,` that would send an empty string on a no-email site.
  const fetchCallStart = code.indexOf("await fetch(`${clientApiUrl}/tenant/sendContactEmail`");
  assert.ok(fetchCallStart > -1, "control: the upstream fetch call must exist");
  const fetchCallBody = code.slice(fetchCallStart, code.indexOf(");", fetchCallStart));
  assert.doesNotMatch(fetchCallBody, /contactEmail: to,/, "must be conditional, not unconditional");
});

// ---------------------------------------------------------------------------
// Reply-To — the visitor's own address rides as reply-to content, never as
// a recipient. (VR_Client_API's service layer sets the actual SMTP
// Reply-To header from this same field; this route's job is only to keep
// forwarding it unchanged, under its own name, never as `contactEmail`.)
// ---------------------------------------------------------------------------

test("customerEmail (the visitor's address) is forwarded verbatim and never promoted to a recipient", () => {
  assert.match(code, /customerEmail,/, "the visitor's address must still be forwarded");
  assert.doesNotMatch(code, /contactEmail:\s*customerEmail/, "the visitor's address must never become the recipient");
});

// ---------------------------------------------------------------------------
// review-templates-183.md concern 4 / review-templates-184.md item 2 — the
// contact alert must actually be FLUSHED before this edge route's response,
// not merely enqueued, since nothing else flushes Sentry here and Amplify
// can freeze the container the instant the response is sent.
//
// The source-text version of these checks (removed here) pinned SPELLING —
// "a `const flushPromise = ...` assignment precedes `fetch(`, and an
// `await flushPromise;` appears after it" — not the actual ordering at
// runtime. review-templates-184.md's mutation table found two mutations that
// kept every one of those substrings in place while changing what actually
// happens: serialising the flush before the POST (still matches "assignment
// precedes fetch", since the un-awaited assignment is untouched), and moving
// the success-path await below an unreachable `return` (still matches
// "an `await flushPromise;` exists somewhere after `fetch(`"). Both passed.
// The tests below call the real route with real timing instead, via
// `routeLoader.mjs` (see its header for why `route.ts` is loadable here at
// all — it is normally blocked by its `next/server` import).
// ---------------------------------------------------------------------------

/** `route.ts` only ever calls `.json()` and `.headers.get(...)` on its
 * `request` parameter; every other `NextRequest` member is unused here. The
 * cast (not a full implementation) mirrors `routeLoader.mjs`'s "next/server"
 * stub — this object exists to satisfy the REAL compiled type `POST` is
 * declared against, not to implement the interface. */
function fakeRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    headers: { get: () => null },
  } as unknown as NextRequest;
}

/** Control surface `testSupport/sentryStub.mjs` exports alongside its fake
 * `captureMessage`/`flush`. `@sentry/nextjs`'s own types have no such export
 * — the loader substitutes the whole module at runtime (see its header), so
 * this interface, not the real SDK's types, describes what import actually
 * returns under test. */
interface SentryStubModule {
  __sentryStubControl: {
    readonly flushCalls: ReadonlyArray<{ timeout: number; at: number }>;
    readonly captureCalls: ReadonlyArray<{ message: string; context: unknown; at: number }>;
    resolveFlush(value?: boolean): void;
    reset(): void;
  };
}

const realFetch = globalThis.fetch;
const realSiteId = process.env.SITE_ID;

/** A `Response` the test settles on its own schedule, so it can assert what
 * has (and has not) happened while the upstream POST is still in flight. */
function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((res) => {
    resolve = res;
  });
  return {
    promise,
    settle: (status: number, data: unknown) =>
      resolve(new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })),
  };
}

/** Flush a bounded number of microtask turns — enough for the async chain
 * between a mocked `fetch` resolving and the next `await` in `route.ts`
 * actually running, without a real timer. */
async function flush(turns = 15) {
  for (let i = 0; i < turns; i += 1) await Promise.resolve();
}

test("flush behaviour (review-templates-184.md item 2)", async (t) => {
  process.env.SITE_ID = "behaviour-test-site";
  const { POST } = await import("./route.ts");
  // The real `@sentry/nextjs` types have no `__sentryStubControl` — see
  // `SentryStubModule`'s own comment for why this cast, not the SDK's own
  // types, is correct here.
  const { __sentryStubControl } = (await import("@sentry/nextjs")) as unknown as SentryStubModule;

  t.afterEach(() => {
    globalThis.fetch = realFetch;
    __sentryStubControl.reset();
  });
  t.after(() => {
    if (realSiteId === undefined) delete process.env.SITE_ID;
    else process.env.SITE_ID = realSiteId;
  });

  await t.test("the flush runs CONCURRENTLY with the upstream POST, and the success path waits for it", async () => {
    __sentryStubControl.reset();
    const upstream = deferredResponse();
    let upstreamCalls = 0;
    globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.includes("/tenant/siteDetails")) {
        // Non-ok, not a thrown TypeError, so fetchWithReconnect does not
        // retry (only a connection-level failure is retried) — this is the
        // FAST path to recipientLookupFailed = true.
        return new Response("{}", { status: 500 });
      }
      if (url.includes("/tenant/sendContactEmail")) {
        upstreamCalls += 1;
        return upstream.promise;
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const responsePromise = POST(
      fakeRequest({ name: "Ada", customerEmail: "ada@example.com", message: "hi", siteName: "Test Site" }),
    );
    let settled = false;
    responsePromise.then(() => {
      settled = true;
    });

    await flush();
    assert.equal(upstreamCalls, 1, "the upstream POST must have started");
    assert.equal(__sentryStubControl.flushCalls.length, 1, "the flush must have started ALONGSIDE it, not after it");
    assert.equal(settled, false, "the response must not settle while the upstream POST is still pending");

    upstream.settle(200, { success: true });
    await flush();
    assert.equal(
      settled,
      false,
      "the response must not settle on a resolved upstream POST alone — the flush is still pending",
    );

    __sentryStubControl.resolveFlush(true);
    const res = await responsePromise;
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true });
  });

  await t.test("a non-2xx upstream reply still waits for the flush before responding", async () => {
    __sentryStubControl.reset();
    const upstream = deferredResponse();
    globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.includes("/tenant/siteDetails")) return new Response("{}", { status: 500 });
      if (url.includes("/tenant/sendContactEmail")) return upstream.promise;
      throw new Error(`unexpected fetch: ${url}`);
    };

    const responsePromise = POST(
      fakeRequest({ name: "Ada", customerEmail: "ada@example.com", message: "hi", siteName: "Test Site" }),
    );
    let settled = false;
    responsePromise.then(() => {
      settled = true;
    });

    await flush();
    upstream.settle(502, { error: "upstream exploded" });
    await flush();
    assert.equal(settled, false, "a non-2xx reply must still wait for the flush");

    __sentryStubControl.resolveFlush(true);
    const res = await responsePromise;
    assert.equal(res.status, 502);
    assert.deepEqual(res.body, { error: "upstream exploded" });
  });

  await t.test("a rejected upstream fetch (the catch block) still waits for the flush", async () => {
    __sentryStubControl.reset();
    globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.includes("/tenant/siteDetails")) return new Response("{}", { status: 500 });
      if (url.includes("/tenant/sendContactEmail")) throw new TypeError("fetch failed");
      throw new Error(`unexpected fetch: ${url}`);
    };

    const responsePromise = POST(
      fakeRequest({ name: "Ada", customerEmail: "ada@example.com", message: "hi", siteName: "Test Site" }),
    );
    let settled = false;
    responsePromise.then(() => {
      settled = true;
    });

    await flush();
    assert.equal(settled, false, "the catch block must still wait for the flush");

    __sentryStubControl.resolveFlush(true);
    const res = await responsePromise;
    assert.equal(res.status, 502);
  });

  await t.test(
    "review-templates-184.md item 1: a throw BEFORE the upstream fetch (hostile siteName) still waits for the flush",
    async () => {
      __sentryStubControl.reset();
      globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
        const url = String(input);
        if (url.includes("/tenant/siteDetails")) return new Response("{}", { status: 500 });
        throw new Error(`unexpected fetch: ${url}`);
      };

      // `resolveContactRecipient` runs `body.siteName?.trim()` — a non-string
      // `siteName` throws a TypeError here, BEFORE the upstream fetch is ever
      // called. This is the exact regression item 1 fixed: the flush must
      // still be awaited on this path, not just on a `return`.
      const responsePromise = POST(
        fakeRequest({ name: "Ada", customerEmail: "ada@example.com", message: "hi", siteName: 5 }),
      );
      let settled = false;
      responsePromise.then(() => {
        settled = true;
      });

      await flush();
      assert.equal(__sentryStubControl.flushCalls.length, 1, "the flush must have started despite the later throw");
      assert.equal(settled, false, "the response must not settle while the flush from the failed lookup is pending");

      __sentryStubControl.resolveFlush(true);
      const res = await responsePromise;
      assert.equal(res.status, 502, "a throw before the fetch must still answer 502, not hang or crash");
    },
  );
});

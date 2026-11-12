import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

// Scoped to THIS file's process. The subscribe route's loader resolves every
// import this route needs (see `../subscribe/testSupport/routeLoader.mjs`):
// the REAL route and the REAL `createReview` + `doClientFetch`, with only the
// far upstream `fetch` mocked below.
register(new URL("../subscribe/testSupport/routeLoader.mjs", import.meta.url).href);

/**
 * F103 (plan 5.T T9): VR_Client_API answers a review it is taking too many of
 * with a 429 (`createDefinedCollectionObject.js`, REVIEW_RATE_LIMIT). The route
 * used to turn that into its generic 500, so the visitor read "something went
 * wrong" for a review they only had to send again later. It now answers 429
 * with words the review form shows: the renderer's `ConfigurableForm` shows a
 * server `error` string first (`resolveErrorMessage`). Every other failure
 * keeps the 500 and its Sentry report.
 */

const RATE_LIMITED = "Lots of reviews are coming in right now. Try again shortly.";
const BODY = { email: "visitor@example.com", name: "Visitor", review: "Lovely", rating: 5, collectionId: "65f0c0ffee0000000000dcba" };

/** Shape the loader's `next/server` stub returns, and the Sentry stub's control. */
type StubResponse = { status: number; body: { success?: boolean; error?: string; message?: string } };
interface SentryStubModule {
  __sentryStubControl: { readonly captureCalls: ReadonlyArray<unknown>; resolveFlush(value?: boolean): void; reset(): void };
}

const realFetch = globalThis.fetch;
function upstreamAnswers(status: number) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (!String(input).endsWith("/tenant/definedCollectionObject")) throw new Error(`unexpected fetch: ${String(input)}`);
    return new Response(JSON.stringify({ success: false, error: "Too many review submissions. Please try again later." }), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}
const request = (body: unknown) => ({ json: async () => body }) as unknown as Request; // POST reads only .json()

test("REFUSE (F103): a rate-limited review answers 429 with the words the form shows", async () => {
  const { POST } = await import("./route.tsx");
  const { __sentryStubControl: sentry } = (await import("@sentry/nextjs")) as unknown as SentryStubModule; // the loader's stub
  sentry.reset();
  upstreamAnswers(429);
  try {
    // Settled either way, so a route that still reports this as a lost review fails on the status, never hangs.
    const pending = POST(request(BODY));
    await new Promise<void>((resolve) => setImmediate(resolve));
    sentry.resolveFlush(true);
    const res = (await pending) as unknown as StubResponse; // the loader's NextResponse stub
    assert.equal(res.status, 429, "a 429 upstream is a 429 here, never the generic 500");
    assert.equal(res.body.error, RATE_LIMITED);
    assert.equal(sentry.captureCalls.length, 0, "a by-design refusal is not reported as a lost review");
  } finally {
    globalThis.fetch = realFetch;
  }
  const form = fs.readFileSync(new URL("../../../../node_modules/@hillbombcreations/site-renderer/dist/components/ConfigurableForm.js", import.meta.url), "utf8");
  // Renderer 1.98.3 (W2-2) made the built-in fallback per form (a review form has its own), so the third
  // argument is the local `builtInErrorMessage`; the route's `error` is still the first, and it still wins.
  assert.match(form, /resolveErrorMessage\(body\?\.error, authoredErrorMessage, builtInErrorMessage\)/, "the form shows the route's `error` first");
});

test("ALLOW (F103): any other failure stays a 500, reported as before", async () => {
  const { POST } = await import("./route.tsx");
  const { __sentryStubControl: sentry } = (await import("@sentry/nextjs")) as unknown as SentryStubModule; // the loader's stub
  for (const status of [400, 500, 503]) {
    sentry.reset();
    upstreamAnswers(status);
    try {
      const pending = POST(request(BODY));
      await new Promise<void>((resolve) => setImmediate(resolve));
      sentry.resolveFlush(true);
      const res = (await pending) as unknown as StubResponse; // the loader's NextResponse stub
      assert.equal(res.status, 500, `upstream ${status} keeps the 500`);
      assert.notEqual(res.body.error, RATE_LIMITED);
      assert.equal(sentry.captureCalls.length, 1, `upstream ${status} is reported`);
    } finally {
      globalThis.fetch = realFetch;
    }
  }
});

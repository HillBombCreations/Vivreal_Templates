import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

// Scoped to THIS file's process. The contact route's loader stubs only
// `next/server` (and Sentry, which this route does not import) and resolves
// `@/x` to `src/x.ts`, so the REAL route, the REAL edge site map and the REAL
// origin resolver run; only the far upstream, VR_Client_API, is faked.
register(new URL("../contact/testSupport/routeLoader.mjs", import.meta.url).href);

/**
 * F165-G1-05 (release A T-7, the Templates half; Client's half is CL-S2):
 * the address a buyer returns to after paying is this site's own, never one
 * the request names. VR_Client_API builds Stripe's `success_url` and
 * `cancel_url` and Square's `redirect_url` on the `originUrl` this route
 * forwards, so a body's value used to send a buyer, session id appended,
 * wherever the caller chose. Each test asserts the body the route FORWARDED.
 */

const CLIENT_API = "https://client-api.test";
const SITE_ID = "6a0000000000000000000a01";
const STRIPE_URL = "https://checkout.stripe.com/c/pay/cs_test_origin";
const PRODUCTS = [{ price: "price_1", quantity: 2 }];

// The edge map reads the Client API base at module load, so the env is set before any import below.
process.env.NEXT_PUBLIC_CLIENT_API = CLIENT_API;
process.env.API_KEY = "test-site-key";
process.env.SITE_ID = SITE_ID;
delete process.env.NEXT_PUBLIC_SITE_URL;

type SiteFields = { domainName?: string; live_url?: string; canonicalUrl?: string };
type Reply = { status: number; body: Record<string, unknown> };
type RouteModule = { POST(request: unknown): Promise<Reply> };
type EdgeMapModule = { __resetEdgeSiteMapCacheForTests(): void };

/**
 * One checkout through the real route. `site` is what VR_Client_API's
 * siteDetails answers (`null`: it fails with a 503); every createCheckoutSession
 * body the route sends is returned, parsed, with the number of siteDetails
 * reads. `fresh: false` keeps the edge map's state from the call before (a
 * retry on the same instance); `siteId: false` runs with no SITE_ID.
 */
async function checkout(
  body: Record<string, unknown>,
  site: SiteFields | null,
  { fresh = true, siteId = true }: { fresh?: boolean; siteId?: boolean } = {},
): Promise<{ reply: Reply; forwarded: Array<Record<string, unknown>>; siteReads: number }> {
  const edgeMap = (await import("@/lib/edgeSiteMap")) as unknown as EdgeMapModule; // the same module instance the route reads
  if (fresh) edgeMap.__resetEdgeSiteMapCacheForTests();
  const { POST } = (await import("./route.ts")) as unknown as RouteModule; // the real handler; its NextResponse is the loader's plain stand-in
  const forwarded: Array<Record<string, unknown>> = [];
  let siteReads = 0;
  const realFetch = globalThis.fetch;
  if (!siteId) delete process.env.SITE_ID;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.startsWith(`${CLIENT_API}/tenant/siteDetails`)) {
      siteReads += 1;
      if (!site) return new Response(JSON.stringify({ success: false, data: null, error: "down" }), { status: 503 });
      const values = { lifecycleState: "live", ...(site.canonicalUrl ? { canonicalUrl: site.canonicalUrl } : {}) };
      return Response.json({
        success: true,
        data: { pages: [], siteDetails: { values }, domainName: site.domainName, domainInformation: site.live_url ? { live_url: site.live_url } : undefined },
        error: null,
      });
    }
    if (url === `${CLIENT_API}/tenant/createCheckoutSession`) {
      forwarded.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return Response.json({ success: true, data: { url: STRIPE_URL } });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const reply = await POST({ json: async () => body });
    return { reply, forwarded, siteReads };
  } finally {
    globalThis.fetch = realFetch;
    process.env.SITE_ID = SITE_ID;
  }
}

const OWN_SITE: SiteFields = { domainName: "shop.example.com", live_url: "https://shop.example.com" };

test("REFUSE (T-7): a body naming another address forwards the site's own origin", async () => {
  const { reply, forwarded } = await checkout({ products: PRODUCTS, requiresShipping: false, originUrl: "https://elsewhere.example" }, OWN_SITE);
  assert.equal(reply.status, 200);
  assert.equal(forwarded.length, 1, "one checkout was started");
  assert.equal(forwarded[0].originUrl, "https://shop.example.com");
  assert.ok(!JSON.stringify(forwarded).includes("elsewhere.example"), "the body's address is forwarded nowhere");
});

test("REFUSE (T-7): a body with no originUrl no longer answers \"Missing originUrl\"; it forwards the site's own origin", async () => {
  const { reply, forwarded } = await checkout({ products: PRODUCTS, requiresShipping: true }, OWN_SITE);
  assert.notEqual(reply.body.error, "Missing originUrl");
  assert.equal(reply.status, 200);
  assert.deepEqual(reply.body, { url: STRIPE_URL });
  assert.equal(forwarded[0].originUrl, "https://shop.example.com");
});

test("REFUSE (T-7): a site read that finds only an Amplify build host, or no site read and no site id, starts no checkout", async () => {
  // Review B1 moved the no-read case: it now starts a checkout by site id
  // (the two B1 tests below). With no site id there is nothing for
  // VR_Client_API to find the site by, so that case stays refused.
  for (const [site, options] of [
    [{ live_url: "https://main.d1abcdefghijk.amplifyapp.com" }, {}],
    [null, { siteId: false }],
  ] as const) {
    const { reply, forwarded } = await checkout({ products: PRODUCTS, requiresShipping: false, originUrl: "https://main.d1abcdefghijk.amplifyapp.com" }, site, options);
    assert.equal(reply.status, 502, `site ${JSON.stringify(site)}`);
    assert.equal(reply.body.error, "We could not start checkout just now. Please try again in a moment.");
    assert.deepEqual(forwarded, [], "nothing was sent to the payment provider's side");
  }
});

test("REFUSE (B1): a failed site read forwards no originUrl at all, only the site id; nothing from the body's address", async () => {
  const { reply, forwarded, siteReads } = await checkout({ products: PRODUCTS, requiresShipping: false, originUrl: "https://elsewhere.example" }, null);
  assert.equal(siteReads > 0, true, "control: the route did try to read the site");
  assert.equal(reply.status, 200, "the checkout started");
  assert.deepEqual(reply.body, { url: STRIPE_URL });
  // The whole forwarded body: no originUrl key, so VR_Client_API builds the return address from the site.
  assert.deepEqual(forwarded, [{ products: PRODUCTS, requiresShipping: false, siteId: SITE_ID }]);
});

test("ALLOW (B1): a retry right after a failed site read starts a checkout, inside the read's 30 s back-off", async () => {
  const first = await checkout({ products: PRODUCTS, requiresShipping: true }, null);
  assert.equal(first.siteReads > 0, true, "control: the first checkout's site read was made, and failed");
  // The same instance seconds later, the site healthy again: the edge map does not read inside its back-off.
  const retry = await checkout({ products: PRODUCTS, requiresShipping: true }, OWN_SITE, { fresh: false });
  assert.equal(retry.siteReads, 0, "control: the retry falls inside the back-off and makes no site read");
  assert.equal(retry.reply.status, 200);
  assert.deepEqual(retry.forwarded, [{ products: PRODUCTS, requiresShipping: true, siteId: SITE_ID }]);
});

test("ALLOW (T-7): a checkout on the site's own origin forwards that origin, and the rest of the body as before", async () => {
  const { reply, forwarded } = await checkout({ products: PRODUCTS, requiresShipping: true, originUrl: "https://shop.example.com", code: " save10 " }, OWN_SITE);
  assert.equal(reply.status, 200);
  assert.deepEqual(forwarded, [{ products: PRODUCTS, requiresShipping: true, originUrl: "https://shop.example.com", code: "SAVE10", siteId: SITE_ID }]);
  // A custom domain the owner set as the canonical is the site's own address too.
  const custom = await checkout({ products: PRODUCTS, requiresShipping: false, originUrl: "https://www.bakery.example" }, { ...OWN_SITE, canonicalUrl: "https://www.bakery.example" });
  assert.equal(custom.forwarded[0].originUrl, "https://www.bakery.example");
});

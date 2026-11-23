import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

// Scoped to THIS file's process, as route.origin.test.ts: the loader stubs only
// `next/server` and resolves `@/x`, so the REAL route runs and only the far
// upstream, VR_Client_API, is faked.
register(new URL("../contact/testSupport/routeLoader.mjs", import.meta.url).href);

/**
 * D-P9-5 (release C, design-dp95-per-size-stock.md S2 and S5), through the real
 * next hop: the body the bag builds for a product with one price and a count
 * per size reaches VR_Client_API with each line's `option`, and Client's 409
 * naming the short size comes back to the bag with that size, which trims only
 * that size's line. The Client side is release-c/client `3555c68`: its
 * validator takes `option: Joi.string().trim().min(1).max(100)` per line and
 * merges one price's lines into `optionQty`; its 409 items read
 * `{ priceId, option?, available }` (`stockShortage.js`).
 */

const CLIENT_API = "https://client-api.test";
const SITE_ID = "6a0000000000000000000a01";
const STRIPE_URL = "https://checkout.stripe.com/c/pay/cs_test_dp95";

process.env.NEXT_PUBLIC_CLIENT_API = CLIENT_API;
process.env.API_KEY = "test-site-key";
process.env.SITE_ID = SITE_ID;
delete process.env.NEXT_PUBLIC_SITE_URL;

type Reply = { status: number; body: Record<string, unknown> };
type RouteModule = { POST(request: unknown): Promise<Reply> };
type EdgeMapModule = { __resetEdgeSiteMapCacheForTests(): void };
type Upstream = { status: number; body: Record<string, unknown> };

/** One checkout through the real route; `upstream` is what createCheckoutSession answers. */
async function checkout(body: Record<string, unknown>, upstream: Upstream): Promise<{ reply: Reply; forwarded: Array<Record<string, unknown>> }> {
  const edgeMap = (await import("@/lib/edgeSiteMap")) as unknown as EdgeMapModule; // the same module instance the route reads
  edgeMap.__resetEdgeSiteMapCacheForTests();
  const { POST } = (await import("./route.ts")) as unknown as RouteModule; // the real handler; its NextResponse is the loader's plain stand-in
  const forwarded: Array<Record<string, unknown>> = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.startsWith(`${CLIENT_API}/tenant/siteDetails`)) {
      return Response.json({
        success: true,
        data: { pages: [], siteDetails: { values: { lifecycleState: "live" } }, domainName: "shop.example.com", domainInformation: { live_url: "https://shop.example.com" } },
        error: null,
      });
    }
    if (url === `${CLIENT_API}/tenant/createCheckoutSession`) {
      forwarded.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return Response.json(upstream.body, { status: upstream.status });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    return { reply: await POST({ json: async () => body }), forwarded };
  } finally {
    globalThis.fetch = realFetch;
  }
}

/** The bag's own body for 2 Small and 3 Medium of QA TEST P7 (one price, a count per size). */
async function bagBody(): Promise<Record<string, unknown>> {
  const { handleCheckout } = await import("../../../lib/utils/cartUtils/index.ts");
  const line = (variant: string, quantity: number, stock: number) => ({
    _id: "p7", quantity, name: `QA TEST P7 (${variant})`, price: "$20.00", priceID: "price_p7", imageUrl: "", variant, stock, optionStock: true as const,
  });
  const realFetch = globalThis.fetch;
  let sent = "";
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    sent = String(init?.body);
    return new Response(JSON.stringify({ error: "x" }), { status: 400 });
  }) as typeof fetch; // a test double that records the body and refuses
  try {
    await handleCheckout({ cart: { p7_Small: line("Small", 2, 2), p7_Medium: line("Medium", 3, 10) }, requiresShipping: false, originUrl: "" }).catch(() => undefined);
  } finally {
    globalThis.fetch = realFetch;
  }
  return JSON.parse(sent) as Record<string, unknown>;
}

test("[D-P9-5 ALLOW] the route forwards each size the bag names to VR_Client_API", async () => {
  const body = await bagBody();
  const { reply, forwarded } = await checkout(body, { status: 200, body: { success: true, data: { url: STRIPE_URL } } });
  assert.equal(reply.status, 200);
  assert.deepEqual(forwarded[0].products, [
    { price: "price_p7", quantity: 2, name: "QA TEST P7 (Small)", option: "Small" },
    { price: "price_p7", quantity: 3, name: "QA TEST P7 (Medium)", option: "Medium" },
  ]);
});

test("[D-P9-5 REFUSE] Client's 409 naming Small short reaches the bag with the size, and only Small is trimmed", async () => {
  const { applyShortStock } = await import("../../../lib/cartStock.ts");
  const body = await bagBody();
  const { reply } = await checkout(body, {
    status: 409,
    body: { success: false, data: null, error: "Not enough stock available", errorCode: "INSUFFICIENT_STOCK", items: [{ priceId: "price_p7", option: "Small", available: 1 }] },
  });
  assert.equal(reply.status, 409);
  assert.equal(reply.body.reason, "out_of_stock");
  assert.deepEqual(reply.body.items, [{ priceId: "price_p7", option: "Small", available: 1 }]);
  const line = (variant: string, quantity: number, stock: number) => ({
    _id: "p7", quantity, name: `QA TEST P7 (${variant})`, price: "$20.00", priceID: "price_p7", imageUrl: "", variant, stock, optionStock: true as const,
  });
  const items = reply.body.items as Array<{ priceId: string; option?: string; available: number }>; // asserted just above
  const { cart } = applyShortStock({ p7_Small: line("Small", 2, 2), p7_Medium: line("Medium", 3, 10) }, items);
  assert.equal(cart["p7_Small"]?.quantity, 1);
  assert.equal(cart["p7_Medium"]?.quantity, 3, "Medium is untouched");
});

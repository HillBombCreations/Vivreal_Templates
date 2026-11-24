import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

// Scoped to THIS file's process: the contact route's loader stubs only
// `next/server` and resolves `@/x` to `src/x.ts`, so the REAL checkout route
// and the REAL `forwardedCheckoutExtras` run; only VR_Client_API is faked.
register(new URL("../contact/testSupport/routeLoader.mjs", import.meta.url).href);

/**
 * Release C, SQP-T4 (design-square-parity.md FP1.5, T-SQQ-4): `/api/checkout`
 * forwards the cart's answers (SV-SQ11) and its newsletter tick (SV-SQ13) to
 * VR_Client_API, shape-checked entry by entry, `joinList` only as the boolean
 * `true`, and only with a site id. The Client's validator refuses unknown
 * top-level keys and a string "true" (`Joi.boolean().strict()`), so anything
 * else forwarded would fail the whole checkout. Each test asserts the body the
 * route FORWARDED.
 */

const CLIENT_API = "https://client-api.test";
const SITE_ID = "6a0000000000000000000a01";
const PRODUCTS = [{ price: "SQVAR_COOKIES", quantity: 1 }];

process.env.NEXT_PUBLIC_CLIENT_API = CLIENT_API;
process.env.API_KEY = "test-site-key";
process.env.SITE_ID = SITE_ID;
delete process.env.NEXT_PUBLIC_SITE_URL;

type Reply = { status: number; body: Record<string, unknown> };
type RouteModule = { POST(request: unknown): Promise<Reply> };
type EdgeMapModule = { __resetEdgeSiteMapCacheForTests(): void };

async function forwardedBody(body: Record<string, unknown>): Promise<Record<string, unknown>> {
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
      return Response.json({ success: true, data: { url: "https://square.link/u/test" } });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const reply = await POST({ json: async () => ({ products: PRODUCTS, requiresShipping: false, ...body }) });
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    assert.equal(forwarded.length, 1, "one checkout was started");
    return forwarded[0];
  } finally {
    globalThis.fetch = realFetch;
  }
}

const TWO = [
  { line: "SQVAR_COOKIES", answer: "Chocolate chip and oatmeal" },
  { line: "SQVAR_CAKE_8", answer: "" },
];

test("ALLOW (T-SQQ-4): two valid answers and joinList: true are forwarded unchanged", async () => {
  const sent = await forwardedBody({ answers: TWO, joinList: true });
  assert.deepEqual(sent.answers, TWO);
  assert.equal(sent.joinList, true);
  assert.equal(sent.siteId, SITE_ID, "with the site id the Client reads the rules off");
});

test("REFUSE (T-SQQ-4): joinList as a string or a number is dropped", async () => {
  for (const joinList of ["true", 1, "yes", {}]) {
    const sent = await forwardedBody({ joinList });
    assert.equal("joinList" in sent, false, `joinList ${JSON.stringify(joinList)} is not forwarded`);
  }
});

test("REFUSE (T-SQQ-4): a fourth answer, an answer of 301, an entry with no line, and answers that are not an array are dropped", async () => {
  const four = [1, 2, 3, 4].map((n) => ({ line: `SQ${n}`, answer: `A${n}` }));
  assert.deepEqual((await forwardedBody({ answers: four })).answers, four.slice(0, 3), "the first three only");
  const mixed = [
    { line: "SQ1", answer: "x".repeat(301) },
    { answer: "no line" },
    { line: "", answer: "empty line" },
    { line: "L".repeat(193), answer: "line too long" },
    { line: "SQ2", answer: 42 },
  ];
  assert.equal("answers" in (await forwardedBody({ answers: mixed })), false, "every bad entry dropped, so no key at all");
  assert.deepEqual((await forwardedBody({ answers: [mixed[0], { line: "SQ3", answer: "ok" }, mixed[1]] })).answers, [{ line: "SQ3", answer: "ok" }], "entry by entry");
  assert.equal("answers" in (await forwardedBody({ answers: { line: "SQ1", answer: "x" } })), false, "not an array");
  assert.equal("answers" in (await forwardedBody({ answers: "SQ1:x" })), false);
});

test("REFUSE (T-SQQ-4): with no site id neither key is forwarded", async () => {
  // The route itself starts no checkout without a site id (route.origin.test.ts),
  // so the forwarder's own rule is read directly as well.
  const { forwardedCheckoutExtras } = await import("@/lib/cart/cartSettings");
  assert.deepEqual(forwardedCheckoutExtras({ answers: TWO, joinList: true }, false), {});
  assert.deepEqual(forwardedCheckoutExtras({ answers: TWO, joinList: true }, true), { answers: TWO, joinList: true }, "control: with one, both");
});

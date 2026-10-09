import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
// Explicit .ts extension: runs under `node --experimental-strip-types --test`.
import { fetchCartQuote, CART_QUOTE_TIMEOUT_MS } from "./index.ts";

/**
 * F4 review follow-up: the Checkout press re-quotes, so a quote that never
 * answers must fall back to list prices within the timeout, never hold the
 * press and never show a sale.
 */

const LINES = [{ price: "price_mug", quantity: 1 }];
const QUOTE = { lines: [{ priceId: "price_mug", unitCents: 499, saleUnitCents: 424, saleName: "Spring sale" }] };

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("the timeout is about 3 s", () => {
  assert.equal(CART_QUOTE_TIMEOUT_MS, 3_000);
});

test("REFUSE: a hanging quote (one that even ignores the abort) resolves to the list-price path within the timeout", async () => {
  let aborted = false;
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    init?.signal?.addEventListener("abort", () => {
      aborted = true;
    });
    return new Promise<Response>(() => undefined);
  }) as typeof fetch;

  const started = Date.now();
  const quote = await fetchCartQuote(LINES, 50);
  const waited = Date.now() - started;

  assert.equal(quote, null, "null is the failed-quote path: the bag shows list prices");
  assert.ok(waited < 1_000, `resolved in ${waited} ms`);
  assert.equal(aborted, true, "the request is aborted, not left running");
});

test("ALLOW: a fast quote is used", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(QUOTE), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  const quote = await fetchCartQuote(LINES, 50);
  assert.ok(quote, "the quote was used");
  assert.deepEqual(quote.get("price_mug"), QUOTE.lines[0]);
});

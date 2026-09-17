import { test } from "node:test";
import assert from "node:assert/strict";
// Explicit .ts extension: runs directly under plain Node.
import { CheckoutLineError, UNBUYABLE_LINE_MESSAGE, handleAddToCart, handleCheckout } from "./index.ts";
import type { Cart } from "@/types/Cart";
import type { Product } from "@/types/Products";

function product(overrides: Partial<Product> = {}): Product {
  return { _id: "syn_1", name: "Petit Cartable", price: "$1,440.00", description: "", imageUrl: "", ...overrides };
}

function add(p: Product): { added: boolean; setCartCalls: number } {
  let setCartCalls = 0;
  const added = handleAddToCart({ product: p, selectedVariant: null, quantity: 1, cart: {}, setCart: () => { setCartCalls += 1; } });
  return { added, setCartCalls };
}

test("Phase 0.2: an item with no checkout price is never added to the bag", () => {
  assert.deepEqual(add(product()), { added: false, setCartCalls: 0 });
  assert.deepEqual(add(product({ default_price: "   " })), { added: false, setCartCalls: 0 });
});

test("a real checkout id is still added, and says so", () => {
  assert.deepEqual(add(product({ default_price: "price_123" })), { added: true, setCartCalls: 1 });
});

async function withFetchSpy(run: (calls: () => number) => Promise<void>) {
  const original = globalThis.fetch;
  let calls = 0;
  // A test double for the global; its signature is irrelevant to the assertion.
  globalThis.fetch = (async () => { calls += 1; return new Response("{}"); }) as typeof fetch;
  try {
    await run(() => calls);
  } finally {
    globalThis.fetch = original;
  }
}

const EMPTY_LINE = { _id: "syn_1", quantity: 1, name: "Petit Cartable", price: "$1,440.00", priceID: "", imageUrl: "", variant: "default" };

test("Phase 0.2: checkout is never called with an empty price, even from a bag saved before this fix", async () => {
  await withFetchSpy(async (calls) => {
    const cart: Cart = {
      syn_1_default: EMPTY_LINE,
      p1_default: { ...EMPTY_LINE, _id: "p1", name: "Sourdough", priceID: "price_123" },
    };
    await assert.rejects(
      handleCheckout({ cart, requiresShipping: true, originUrl: "https://example.com" }),
      (err: unknown) => err instanceof CheckoutLineError && err.message === UNBUYABLE_LINE_MESSAGE,
    );
    assert.equal(calls(), 0);
  });
});

test("the checkout message carries no dash", () => {
  assert.doesNotMatch(UNBUYABLE_LINE_MESSAGE, /[–—]/);
});

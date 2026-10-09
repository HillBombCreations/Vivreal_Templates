import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyShortStock,
  capQuantity,
  clampCartToStock,
  trackedLineStock,
  stockAdjustedMessage,
  STOCK_REFUSAL_FALLBACK_COPY,
} from "./cartStock.ts";
import { CheckoutStockError, SOLD_OUT_ITEM_MESSAGE, UNBUYABLE_ITEM_MESSAGE, addRefusal, handleAddToCart, handleCheckout } from "./utils/cartUtils/index.ts";
import type { Cart } from "../types/Cart";
import type { Product } from "../types/Products";

/**
 * QA-W2-1: the bag caps each line at its tracked stock, with no cap when stock
 * is untracked, and says how many are left when checkout refuses for stock.
 * The walk's Cookie box stores `{ "Small": 4 }`; Large has no count.
 */

const COOKIE_BOX_STOCK = { Small: 4 };

const line = (name: string, quantity: number, stock?: number) => ({
  _id: name,
  name,
  quantity,
  price: "$4.50",
  priceID: "price_" + name,
  imageUrl: "",
  variant: "default",
  ...(stock !== undefined ? { stock } : {}),
});

function addToCart(product: Product, selectedVariant: string | null, quantity: number, start: Cart = {}) {
  let next: Cart = start;
  const added = handleAddToCart({
    product,
    selectedVariant,
    quantity,
    cart: start,
    setCart: (u) => {
      next = typeof u === "function" ? u(next) : u;
    },
  });
  return { added, cart: next };
}

const cookieBox = (stock: Product["stock"]): Product => ({
  _id: "cookie",
  name: "Cookie box",
  price: { Small: "$4.50", Large: "$6.75" },
  description: "",
  imageUrl: "",
  default_price: { Small: "price_small", Large: "price_large" },
  usingVariant: { name: "Size", values: ["Small", "Large"] },
  stock,
} as Product); // a fixture with only the fields add-to-cart reads

const SIZE_IDS = { Small: "price_small", Large: "price_large" };

test("checkout's rule, REFUSE side: tracked lines are capped (a size's own count, or a single-price count)", () => {
  assert.equal(trackedLineStock(COOKIE_BOX_STOCK, SIZE_IDS, "price_small"), 4);
  assert.equal(trackedLineStock(12, "price_one", "price_one"), 12, "single-price product, plain count");
  assert.equal(trackedLineStock({ Small: 0 }, SIZE_IDS, "price_small"), 0);
});

test("checkout's rule, ALLOW side: what checkout treats as untracked gets no cap", () => {
  assert.equal(trackedLineStock(COOKIE_BOX_STOCK, SIZE_IDS, "price_large"), undefined, "Large has no count; never Small's 4");
  // The review's case: a sized product with a PLAIN number. Checkout
  // (resolveProductVariantByPriceId.js) ignores it, so the bag must too.
  assert.equal(trackedLineStock(12, SIZE_IDS, "price_small"), undefined);
  assert.equal(trackedLineStock(COOKIE_BOX_STOCK, SIZE_IDS, "price_unknown"), undefined, "an id the map does not hold");
  assert.equal(trackedLineStock({ Small: 4 }, "price_one", "price_one"), undefined, "single-price product with a map");
  for (const untracked of [undefined, null, "4", { Small: "4" }, Number.NaN]) {
    assert.equal(trackedLineStock(untracked, SIZE_IDS, "price_small"), undefined, String(untracked));
  }
});

test("ALLOW: a sized product with a plain numeric stock is not capped in the bag (checkout does not cap it)", () => {
  const { cart } = addToCart(cookieBox(3), "Small", 6);
  assert.equal(cart["cookie_Small"]?.quantity, 6);
  assert.equal("stock" in (cart["cookie_Small"] ?? {}), false);
});

test("REFUSE: adding a sold-out size says it is sold out, never 'can't be bought online'", () => {
  const soldOut = cookieBox({ Small: 0, Large: 2 });
  const { added, cart } = addToCart(soldOut, "Small", 1);
  assert.equal(added, false);
  assert.deepEqual(cart, {}, "nothing joined the bag");
  assert.deepEqual(addRefusal(soldOut, "Small"), { title: "Sold out", description: SOLD_OUT_ITEM_MESSAGE });
  assert.doesNotMatch(SOLD_OUT_ITEM_MESSAGE, /only \d+ left|bought online/i);
});

test("ALLOW: an item with no checkout price keeps its own message; an in-stock size still adds", () => {
  const unbuyable = { ...cookieBox(undefined), default_price: undefined } as Product; // the same fixture without a price
  assert.deepEqual(addRefusal(unbuyable, "Small"), { title: "Not available online", description: UNBUYABLE_ITEM_MESSAGE });
  const { added, cart } = addToCart(cookieBox({ Small: 0, Large: 2 }), "Large", 1);
  assert.equal(added, true);
  assert.equal(cart["cookie_Large"]?.quantity, 1);
});

test("REFUSE: the bag never goes above a tracked line's stock (Small x6 with 4 left is 4)", () => {
  assert.equal(capQuantity(6, 4), 4);
  const { cart } = addToCart(cookieBox(COOKIE_BOX_STOCK), "Small", 6);
  assert.equal(cart["cookie_Small"]?.quantity, 4);
  assert.equal(cart["cookie_Small"]?.stock, 4, "the cap travels with the line");
  const again = addToCart(cookieBox(COOKIE_BOX_STOCK), "Small", 3, cart);
  assert.equal(again.cart["cookie_Small"]?.quantity, 4, "adding more does not pass the cap");
});

test("ALLOW: an untracked size has no cap (Large x6 stays 6)", () => {
  assert.equal(capQuantity(6, undefined), 6);
  const { cart } = addToCart(cookieBox(COOKIE_BOX_STOCK), "Large", 6);
  assert.equal(cart["cookie_Large"]?.quantity, 6);
  assert.equal("stock" in (cart["cookie_Large"] ?? {}), false);
});

test("REFUSE: checkout's stock refusal brings each line down and names how many are left", () => {
  const cart: Cart = {
    a: line("Cookie box (Small)", 6, 4),
    b: line("Cinnamon roll", 2, 0),
    c: line("Cookie box (Large)", 6),
  };
  const { cart: adjusted, changed } = clampCartToStock(cart);
  assert.equal(adjusted.a?.quantity, 4);
  assert.equal(adjusted.b, undefined, "a sold-out line leaves the bag");
  assert.equal(adjusted.c?.quantity, 6, "an untracked line is untouched");
  assert.equal(
    stockAdjustedMessage(changed),
    "Only 4 Cookie box (Small) left. Cinnamon roll has sold out. We've updated your bag.",
  );
});

test("ALLOW: a bag within stock is unchanged; a refusal it cannot place gets the plain fallback", () => {
  const cart: Cart = { a: line("Cookie box (Small)", 4, 4) };
  const { cart: adjusted, changed } = clampCartToStock(cart);
  assert.deepEqual(adjusted, cart);
  assert.deepEqual(changed, []);
  assert.equal(stockAdjustedMessage(changed), STOCK_REFUSAL_FALLBACK_COPY);
  assert.doesNotMatch(STOCK_REFUSAL_FALLBACK_COPY, /refresh/i, "a refresh changes nothing");
});

// Client #117: the counts come from the 409 response, not from stored stock.
test("ALLOW: a 409 with items lowers exactly those lines, from the response's counts", () => {
  const cart: Cart = {
    a: { ...line("Cookie box (Small)", 6, 10), priceID: "price_small" }, // stored stock is stale (10)
    b: { ...line("Cinnamon roll", 2), priceID: "price_roll" },
    c: { ...line("Cookie box (Large)", 6), priceID: "price_large" },
  };
  const { cart: adjusted, changed } = applyShortStock(cart, [
    { priceId: "price_small", available: 4 },
    { priceId: "price_roll", available: 0 },
  ]);
  assert.equal(adjusted.a?.quantity, 4, "set to the response's 4, not the stored 10");
  assert.equal(adjusted.a?.stock, 4, "and the line now caps there");
  assert.equal(adjusted.b, undefined, "0 available removes the line");
  assert.deepEqual(adjusted.c, cart.c, "a line the response did not name is untouched");
  assert.equal(
    stockAdjustedMessage(changed),
    "Only 4 Cookie box (Small) left. Cinnamon roll has sold out. We've updated your bag.",
  );
});

test("REFUSE: a 409 without items falls back to stored stock without crashing", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "Some of your bag has sold out since you added it. Lower the amount, then try again.", reason: "out_of_stock" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
  try {
    const cart: Cart = { a: line("Cookie box (Small)", 6, 4) };
    const err = await handleCheckout({ cart, requiresShipping: false, originUrl: "https://x.test" }).then(
      () => assert.fail("checkout should refuse"),
      (e: unknown) => e,
    );
    assert.ok(err instanceof CheckoutStockError);
    assert.equal(err.items, undefined);
    const { cart: adjusted, changed } = clampCartToStock(cart);
    assert.equal(adjusted.a?.quantity, 4);
    assert.equal(stockAdjustedMessage(changed), "Only 4 Cookie box (Small) left. We've updated your bag.");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("ALLOW: handleCheckout hands the named lines to the bag", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "x", reason: "out_of_stock", items: [{ priceId: "price_a", available: 2 }] }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
  try {
    const err = await handleCheckout({ cart: { a: line("A", 3) }, requiresShipping: false, originUrl: "https://x.test" }).then(
      () => assert.fail("checkout should refuse"),
      (e: unknown) => e,
    );
    assert.ok(err instanceof CheckoutStockError);
    assert.deepEqual(err.items, [{ priceId: "price_a", available: 2 }]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

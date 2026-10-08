import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldClearCartForOrder, CART_CLEARED_KEY_PREFIX, type ClearedOrderStore } from "./confirmedOrderCart.ts";

/** A faithful in-memory sessionStorage: getItem answers null for a missing key. */
function memoryStore(): ClearedOrderStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k, v) => {
      data.set(k, String(v));
    },
  };
}

const STRIPE = "cs_test_a1B2c3D4e5F6";
const SQUARE = "Xk9pQ2mNz7Lr4TbW";

test("ALLOW: a Stripe return with its Checkout Session id clears the cart", () => {
  const store = memoryStore();
  assert.equal(shouldClearCartForOrder(`?session_id=${STRIPE}`, store), true);
  assert.equal(store.data.get(`${CART_CLEARED_KEY_PREFIX}${STRIPE}`), "1");
});

test("ALLOW: a Square return with its order id clears the cart", () => {
  assert.equal(shouldClearCartForOrder(`?session_id=${SQUARE}`, memoryStore()), true);
});

test("REFUSE: no order id (a bare success page, or a cancelled checkout's URL) keeps the cart", () => {
  for (const search of ["", "?", "?foo=bar", "?session_id="]) {
    assert.equal(shouldClearCartForOrder(search, memoryStore()), false, search);
  }
});

test("REFUSE: an id that is not an order id keeps the cart", () => {
  for (const id of ["cs_", "short", "cs_has space", "<script>", "a".repeat(65)]) {
    assert.equal(shouldClearCartForOrder(`?session_id=${encodeURIComponent(id)}`, memoryStore()), false, id);
  }
});

test("once per order per tab: a reload after shopping again keeps the new cart", () => {
  const store = memoryStore();
  assert.equal(shouldClearCartForOrder(`?session_id=${STRIPE}`, store), true);
  assert.equal(shouldClearCartForOrder(`?session_id=${STRIPE}`, store), false);
  // A DIFFERENT order is its own confirmation.
  assert.equal(shouldClearCartForOrder(`?session_id=${SQUARE}`, store), true);
});

test("no storage, or storage that throws: a confirmed order still clears the cart", () => {
  assert.equal(shouldClearCartForOrder(`?session_id=${STRIPE}`, null), true);
  const throwing: ClearedOrderStore = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  assert.equal(shouldClearCartForOrder(`?session_id=${STRIPE}`, throwing), true);
  // ...and still never for a landing that is not an order.
  assert.equal(shouldClearCartForOrder("", null), false);
});

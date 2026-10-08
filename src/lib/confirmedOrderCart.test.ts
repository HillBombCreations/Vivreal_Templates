import { test } from "node:test";
import assert from "node:assert/strict";
import { clearCartIfOrderConfirmed, CART_CLEARED_KEY_PREFIX, type ClearedOrderStore } from "./confirmedOrderCart.ts";

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

/**
 * Runs the decision with a server answer of `confirmed` and records what was
 * asked and whether the cart was cleared.
 */
async function land(search: string, confirmed: boolean, storage: ClearedOrderStore | null = memoryStore()) {
  const asked: string[] = [];
  let cleared = 0;
  const result = await clearCartIfOrderConfirmed({
    search,
    confirm: async (id) => {
      asked.push(id);
      return confirmed;
    },
    storage,
    clear: () => {
      cleared += 1;
    },
  });
  return { result, asked, cleared };
}

test("ALLOW: a Stripe order the server confirms clears the cart, and is recorded", async () => {
  const store = memoryStore();
  const { result, asked, cleared } = await land(`?session_id=${STRIPE}`, true, store);
  assert.equal(result, true);
  assert.equal(cleared, 1);
  assert.deepEqual(asked, [STRIPE]);
  assert.equal(store.data.get(`${CART_CLEARED_KEY_PREFIX}${STRIPE}`), "1");
});

test("ALLOW: a Square order the server confirms clears the cart", async () => {
  const { result, cleared } = await land(`?session_id=${SQUARE}`, true);
  assert.equal(result, true);
  assert.equal(cleared, 1);
});

test("REFUSE (RW5): a crafted id that LOOKS valid but the server does not confirm keeps the cart", async () => {
  for (const id of [STRIPE, SQUARE, "cs_anything", "AAAAAAAAAAAAAAAA"]) {
    const store = memoryStore();
    const { result, asked, cleared } = await land(`?session_id=${id}`, false, store);
    assert.equal(result, false, id);
    assert.equal(cleared, 0, id);
    assert.deepEqual(asked, [id], "it did ask the server");
    assert.equal(store.data.size, 0, "an unconfirmed order is not recorded as cleared");
  }
});

test("REFUSE: an unconfirmed order is not recorded, so a later confirmed answer still clears", async () => {
  const store = memoryStore();
  assert.equal((await land(`?session_id=${STRIPE}`, false, store)).cleared, 0);
  assert.equal((await land(`?session_id=${STRIPE}`, true, store)).cleared, 1);
});

test("REFUSE: no order id (a bare success page, or a cancelled checkout's URL) keeps the cart and asks nothing", async () => {
  for (const search of ["", "?", "?foo=bar", "?session_id="]) {
    const { result, asked, cleared } = await land(search, true);
    assert.equal(result, false, search);
    assert.equal(cleared, 0, search);
    assert.deepEqual(asked, [], `${search} is never posted`);
  }
});

test("REFUSE: an id that is not an order id keeps the cart and asks nothing", async () => {
  for (const id of ["cs_", "short", "cs_has space", "<script>", "a".repeat(65)]) {
    const { result, asked } = await land(`?session_id=${encodeURIComponent(id)}`, true);
    assert.equal(result, false, id);
    assert.deepEqual(asked, [], id);
  }
});

test("once per order per tab: a reload after shopping again keeps the new cart", async () => {
  const store = memoryStore();
  assert.equal((await land(`?session_id=${STRIPE}`, true, store)).cleared, 1);
  assert.equal((await land(`?session_id=${STRIPE}`, true, store)).cleared, 0);
  // A DIFFERENT order is its own confirmation.
  assert.equal((await land(`?session_id=${SQUARE}`, true, store)).cleared, 1);
});

test("no storage, or storage that throws: a confirmed order still clears the cart", async () => {
  assert.equal((await land(`?session_id=${STRIPE}`, true, null)).cleared, 1);
  const throwing: ClearedOrderStore = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  assert.equal((await land(`?session_id=${STRIPE}`, true, throwing)).cleared, 1);
  // ...and still never for an order the server did not confirm.
  assert.equal((await land(`?session_id=${STRIPE}`, false, null)).cleared, 0);
});

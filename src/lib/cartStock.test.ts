import { test } from "node:test";
import assert from "node:assert/strict";
import {
  capQuantity,
  clampCartToStock,
  resolveLineStock,
  stockAdjustedMessage,
  STOCK_REFUSAL_FALLBACK_COPY,
} from "./cartStock.ts";
import { handleAddToCart } from "./utils/cartUtils/index.ts";
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

test("stock rule: the chosen size's count, a plain count, or untracked; never another size's", () => {
  assert.equal(resolveLineStock(COOKIE_BOX_STOCK, "Small"), 4);
  assert.equal(resolveLineStock(COOKIE_BOX_STOCK, "Large"), undefined, "Large is untracked, not Small's 4");
  assert.equal(resolveLineStock(12, "default"), 12);
  for (const untracked of [undefined, null, "4", { Small: "4" }, Number.NaN]) {
    assert.equal(resolveLineStock(untracked, "Small"), undefined, String(untracked));
  }
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

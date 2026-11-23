/**
 * D-P9-5 (release C, vivreal-hq design-dp95-per-size-stock.md, Templates T-2 to
 * T-5): a product with ONE checkout id and stock counted PER SIZE. The owner's
 * editor saves it when "Does the price change with Size?" is No and "Do you
 * count stock for each Size separately?" is Yes: a scalar `default_price` (or
 * Square `price`) beside a `stock` map. The bag read that map as "no count", so
 * QA TEST P7 (Small 2, Medium 10) let a shopper put 5 Small in the bag and buy
 * them (walk defect D-P9-5).
 *
 * The bag now caps the line at the size's own count, sends the size to checkout
 * as the line's `option`, and trims a short line by its size. Products priced
 * per size, and products counted as one, are unchanged, byte for byte.
 *
 * New helpers are read through the module namespaces, so at a base without them
 * each row fails on its own assertion rather than the file failing to load.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as cartStock from "./cartStock.ts";
import * as cartUtils from "./utils/cartUtils/index.ts";
import { checkoutRefusal } from "./checkoutRequest.ts";
import type { Cart, CartItem } from "../types/Cart";
import type { Product } from "../types/Products";

const SIZES = ["Small", "Medium"];

/** QA TEST P7's stored shape (Stripe): one price, a count per size. */
const p7 = (stock: Product["stock"] = { Small: 2, Medium: 10 }): Product =>
  ({
    _id: "p7",
    name: "QA TEST P7",
    price: "$20.00",
    description: "",
    imageUrl: "",
    default_price: "price_p7",
    checkoutIdentifier: "price_p7",
    usingVariant: { name: "Size", values: SIZES },
    stock,
  }) as Product; // a fixture with only the fields add-to-cart reads

/** The Square twin: no `default_price`, one variation id, a scalar price. */
const p7Square = (stock: Product["stock"] = { Small: 2, Medium: 3 }): Product =>
  ({
    _id: "p7sq",
    name: "QA TEST P7",
    price: "$20.00",
    description: "",
    imageUrl: "",
    checkoutIdentifier: "sq_p7",
    usingVariant: { name: "Size", values: SIZES },
    stock,
  }) as Product; // a fixture with only the fields add-to-cart reads

/** Priced per size (Stripe), counted per size: the price map finds the count. */
const perSizePriced = (): Product =>
  ({
    _id: "cookie",
    name: "Cookie box",
    price: { Small: "$4.50", Medium: "$6.75" },
    description: "",
    imageUrl: "",
    default_price: { Small: "price_small", Medium: "price_medium" },
    usingVariant: { name: "Size", values: SIZES },
    stock: { Small: 4, Medium: 1 },
  }) as Product; // a fixture with only the fields add-to-cart reads

/** One price, one count. */
const plain = (): Product =>
  ({ _id: "mug", name: "Mug", price: "$12.00", description: "", imageUrl: "", default_price: "price_mug", stock: 5 }) as Product; // a fixture with only the fields add-to-cart reads

function add(product: Product, variant: string | null, quantity: number, start: Cart): { added: boolean; cart: Cart } {
  let next: Cart = start;
  const added = cartUtils.handleAddToCart({
    product,
    selectedVariant: variant,
    quantity,
    cart: start,
    setCart: (u) => {
      next = typeof u === "function" ? u(next) : u;
    },
  });
  return { added, cart: next };
}

/** The `/api/checkout` body `handleCheckout` sends for `cart`, read off a refused request (no redirect). */
async function checkoutBody(cart: Cart): Promise<Record<string, unknown>> {
  const original = globalThis.fetch;
  let sent: string | undefined;
  // A test double for the global; it records the body and refuses, so no redirect runs.
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    sent = String(init?.body);
    return new Response(JSON.stringify({ error: "x" }), { status: 400 });
  }) as typeof fetch;
  try {
    await cartUtils.handleCheckout({ cart, requiresShipping: false, originUrl: "https://shop.example" }).catch(() => undefined);
  } finally {
    globalThis.fetch = original;
  }
  assert.ok(sent, "control: a checkout request was sent");
  return JSON.parse(sent) as Record<string, unknown>;
}

const optionLine = (variant: string, quantity: number, stock: number): CartItem => ({
  _id: "p7",
  quantity,
  name: `QA TEST P7 (${variant})`,
  price: "$20.00",
  priceID: "price_p7",
  imageUrl: "",
  variant,
  stock,
  optionStock: true,
});

// ---------------------------------------------------------------- T-2 bag

test("[D-P9-5 T-2 ALLOW] Small joins the bag at its own count of 2, marked as counted per size", () => {
  const { added, cart } = add(p7(), "Small", 1, {});
  assert.equal(added, true);
  assert.deepEqual(cart["p7_Small"], optionLine("Small", 1, 2));
});

test("[D-P9-5 T-2 REFUSE] plus stops at Small's 2, and a second Add of 2 Small stays 2", () => {
  const { cart } = add(p7(), "Small", 2, {});
  assert.equal(cart["p7_Small"]?.quantity, 2);
  assert.equal(cartStock.atLineCap(cart, "p7_Small"), true, "Increase quantity is off at 2");
  assert.equal(cartStock.nextLineQuantity(cart, "p7_Small", 3), 2, "plus never takes Small past 2");
  assert.equal(add(p7(), "Small", 2, cart).cart["p7_Small"]?.quantity, 2, "a second Add of 2 Small stays 2");
  assert.equal(add(p7(), "Small", 5, {}).cart["p7_Small"]?.quantity, 2, "an Add of 5 Small puts 2 in the bag");
});

test("[D-P9-5 T-2 ALLOW] Medium caps at its own 10, never Small's 2, beside Small in the bag", () => {
  let { cart } = add(p7(), "Small", 2, {});
  ({ cart } = add(p7(), "Medium", 12, cart));
  assert.deepEqual(cart["p7_Medium"], optionLine("Medium", 10, 10));
  assert.equal(cart["p7_Small"]?.quantity, 2, "Small is untouched");
  assert.equal(cartStock.atLineCap(cart, "p7_Medium"), true);
});

test("[D-P9-5 T-2 REFUSE] a size with 0 left never joins the bag, and reads as sold out in the bag's existing words", () => {
  const product = p7({ Small: 0, Medium: 10 });
  const { added, cart } = add(product, "Small", 1, {});
  assert.equal(added, false);
  assert.deepEqual(cart, {}, "no line of 0 is written");
  assert.deepEqual(cartUtils.addRefusal(product, "Small", {}), { title: "Sold out", description: cartUtils.SOLD_OUT_ITEM_MESSAGE });
});

test("[D-P9-5 T-2 REFUSE] a size the stock does not count never joins the bag (checkout would refuse it)", () => {
  const product = { ...p7(), usingVariant: { name: "Size", values: ["Small", "Medium", "Large"] } } as Product; // P7 plus a size with no count
  const { added, cart } = add(product, "Large", 1, {});
  assert.equal(added, false);
  assert.deepEqual(cart, {});
  assert.deepEqual(cartUtils.addRefusal(product, "Large", {}), { title: "Not available online", description: cartUtils.UNBUYABLE_ITEM_MESSAGE });
});

test("[D-P9-5 T-2 ALLOW] a size whose count is not a number joins the bag uncapped, still marked to send its size", () => {
  const { added, cart } = add(p7({ Small: "2", Medium: 10 } as unknown as Product["stock"]), "Small", 7, {}); // a stored string count, untracked by checkout's rule
  assert.equal(added, true);
  assert.equal(cart["p7_Small"]?.quantity, 7);
  assert.equal(cart["p7_Small"]?.stock, undefined);
  assert.equal(cart["p7_Small"]?.optionStock, true);
});

test("[D-P9-5 T-2 ALLOW, Square] the Square shape caps each size at its own count too", () => {
  let { cart } = add(p7Square(), "Small", 5, {});
  ({ cart } = add(p7Square(), "Medium", 5, cart));
  assert.equal(cart["p7sq_Small"]?.quantity, 2);
  assert.equal(cart["p7sq_Medium"]?.quantity, 3);
  assert.equal(cart["p7sq_Small"]?.optionStock, true);
  assert.equal(cart["p7sq_Small"]?.priceID, "sq_p7");
});

test("[D-P9-5 T-2 REFUSE] a product priced per size, and one counted as one, store lines deep-equal to today", () => {
  assert.deepEqual(add(perSizePriced(), "Small", 9, {}).cart["cookie_Small"], {
    _id: "cookie", quantity: 4, name: "Cookie box (Small)", price: "$4.50", priceID: "price_small", imageUrl: "", variant: "Small", stock: 4,
  });
  assert.deepEqual(add(plain(), null, 9, {}).cart["mug_default"], {
    _id: "mug", quantity: 5, name: "Mug", price: "$12.00", priceID: "price_mug", imageUrl: "", variant: "default", stock: 5,
  });
});

// ---------------------------------------------------------------- T-3 body

test("[D-P9-5 T-3 ALLOW] a line counted per size sends its size as `option`", async () => {
  const body = await checkoutBody({ p7_Small: optionLine("Small", 2, 2), p7_Medium: optionLine("Medium", 3, 10) });
  assert.deepEqual(body.products, [
    { price: "price_p7", quantity: 2, name: "QA TEST P7 (Small)", option: "Small" },
    { price: "price_p7", quantity: 3, name: "QA TEST P7 (Medium)", option: "Medium" },
  ]);
});

test("[D-P9-5 T-3 REFUSE] lines priced per size, and plain lines, send today's exact body (no `option`)", async () => {
  let cart: Cart = {};
  ({ cart } = add(perSizePriced(), "Small", 1, cart));
  ({ cart } = add(plain(), null, 1, cart));
  const body = await checkoutBody(cart);
  assert.equal(
    JSON.stringify(body),
    JSON.stringify({
      products: [
        { price: "price_small", quantity: 1, name: "Cookie box (Small)" },
        { price: "price_mug", quantity: 1, name: "Mug" },
      ],
      requiresShipping: false,
      originUrl: "https://shop.example",
    }),
  );
});

// ---------------------------------------------------------------- T-4 trim

test("[D-P9-5 T-4 ALLOW] checkout naming Small short moves only Small", () => {
  const cart: Cart = { p7_Small: optionLine("Small", 2, 2), p7_Medium: optionLine("Medium", 3, 10) };
  const { cart: next, changed } = cartStock.applyShortStock(cart, [{ priceId: "price_p7", option: "Small", available: 1 }]);
  assert.deepEqual(next["p7_Small"], optionLine("Small", 1, 1));
  assert.deepEqual(changed, [{ name: "QA TEST P7 (Small)", available: 1 }]);
  assert.equal(cartStock.stockAdjustedMessage(changed), "Only 1 QA TEST P7 (Small) left. We've updated your bag.");
});

test("[D-P9-5 T-4 REFUSE] the Medium line of the same price is untouched", () => {
  const cart: Cart = { p7_Small: optionLine("Small", 2, 2), p7_Medium: optionLine("Medium", 3, 10) };
  const { cart: next } = cartStock.applyShortStock(cart, [{ priceId: "price_p7", option: "Small", available: 1 }]);
  assert.deepEqual(next["p7_Medium"], cart["p7_Medium"]);
  // Small at 0: its line is removed, never written as 0, and Medium still stays.
  const { cart: gone } = cartStock.applyShortStock(cart, [{ priceId: "price_p7", option: "Small", available: 0 }]);
  assert.deepEqual(Object.keys(gone), ["p7_Medium"]);
  assert.deepEqual(gone["p7_Medium"], cart["p7_Medium"]);
});

test("[D-P9-5 T-4 ALLOW] an entry with no option still trims every line of its price, as before", () => {
  const cart: Cart = { mug_default: { _id: "mug", quantity: 4, name: "Mug", price: "$12.00", priceID: "price_mug", imageUrl: "", variant: "default", stock: 5 } };
  const { cart: next } = cartStock.applyShortStock(cart, [{ priceId: "price_mug", available: 2 }]);
  assert.equal(next["mug_default"]?.quantity, 2);
});

test("[D-P9-5 T-4 ALLOW] the route keeps a short line's size from checkout's 409", () => {
  const refusal = checkoutRefusal(409, "Not enough stock available", {
    errorCode: "INSUFFICIENT_STOCK",
    items: [{ priceId: "price_p7", option: "Small", available: 1 }, { priceId: "price_mug", available: 2 }],
  });
  assert.deepEqual(refusal.items, [{ priceId: "price_p7", option: "Small", available: 1 }, { priceId: "price_mug", available: 2 }]);
});

test("[D-P9-5 T-4 REFUSE] an entry whose option is not a non-empty string is dropped, never read as the whole price", () => {
  const refusal = checkoutRefusal(409, "Not enough stock available", {
    errorCode: "INSUFFICIENT_STOCK",
    items: [
      { priceId: "price_p7", option: 5, available: 0 },
      { priceId: "price_p7", option: "", available: 0 },
      { priceId: "price_p7", option: null, available: 0 },
      { priceId: "price_p7", option: "Small", available: 1 },
    ],
  });
  assert.deepEqual(refusal.items, [{ priceId: "price_p7", option: "Small", available: 1 }]);
});

// ---------------------------------------------------------------- T-5 Buy now

type BuyNowCart = (product: Product, variant: string | null, quantity: number, priceID: string) => Cart;

function buyNowCart(): BuyNowCart {
  const fn = (cartUtils as unknown as Record<string, unknown>).buyNowCart; // a named export, checked just below
  assert.equal(typeof fn, "function", "cartUtils exports buyNowCart");
  return fn as BuyNowCart; // checked above
}

test("[D-P9-5 T-5 ALLOW] Buy now on a size counted per size sends its size", async () => {
  const body = await checkoutBody(buyNowCart()(p7(), "Medium", 2, "price_p7"));
  assert.deepEqual(body.products, [{ price: "price_p7", quantity: 2, name: "QA TEST P7", option: "Medium" }]);
});

test("[D-P9-5 T-5 REFUSE] Buy now on a plain product, and on one priced per size, sends today's exact body", async () => {
  const plainBody = await checkoutBody(buyNowCart()(plain(), null, 1, "price_mug"));
  assert.equal(JSON.stringify(plainBody.products), JSON.stringify([{ price: "price_mug", quantity: 1, name: "Mug" }]));
  const sizedBody = await checkoutBody(buyNowCart()(perSizePriced(), "Small", 1, "price_small"));
  assert.equal(JSON.stringify(sizedBody.products), JSON.stringify([{ price: "price_small", quantity: 1, name: "Cookie box" }]));
});

/**
 * T-385 (F385, release B, SW-B25 option A): one stock number on a Stripe
 * product priced per option is ONE count shared by every option, and the bag
 * caps the SUM of that product's lines at it.
 *
 * The case is live (research-stock-oversell.md): a bread with 8 flavors, one
 * price per flavor, and `stock: 6`. On 2026-11-14 a shopper bought 5 with no
 * check, because every reader treated that number as untracked; the bag did
 * too, so it let any number in.
 *
 * The owners' three tests: (a) a single number on a product with options
 * limits the shared total; (b) per-option stock is unchanged; (c) a product
 * with no stock is still unlimited. The shopper's words are the bag's existing
 * ones. The helpers are read through the module namespace, so at a base
 * without them each row fails on its own assertion rather than the file
 * failing to load.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as cartStock from "./cartStock.ts";
import { SOLD_OUT_ITEM_MESSAGE, addRefusal, handleAddToCart } from "./utils/cartUtils/index.ts";
import type { Cart, CartItem } from "../types/Cart";
import type { Product } from "../types/Products";

const FLAVORS = ["Sourdough", "Rye", "Wheat", "Seeded", "Olive", "Garlic", "Cinnamon", "Plain"];

/** Her bread's shape: one price per flavor, one stock number. */
const bread = (stock: Product["stock"]): Product =>
  ({
    _id: "bread",
    name: "Bread",
    price: Object.fromEntries(FLAVORS.map((f) => [f, "$9.00"])),
    description: "",
    imageUrl: "",
    default_price: Object.fromEntries(FLAVORS.map((f) => [f, "price_" + f.toLowerCase()])),
    usingVariant: { name: "Bread Flavors", values: FLAVORS },
    stock,
  }) as Product; // a fixture with only the fields add-to-cart reads

/** Two sizes, one price each, for the per-option and untracked rows. */
const cookieBox = (stock: Product["stock"]): Product =>
  ({
    _id: "cookie",
    name: "Cookie box",
    price: { Small: "$4.50", Large: "$6.75" },
    description: "",
    imageUrl: "",
    default_price: { Small: "price_small", Large: "price_large" },
    usingVariant: { name: "Size", values: ["Small", "Large"] },
    stock,
  }) as Product; // a fixture with only the fields add-to-cart reads

function add(product: Product, variant: string, quantity: number, start: Cart): { added: boolean; cart: Cart } {
  let next: Cart = start;
  const added = handleAddToCart({
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

const sumOf = (cart: Cart, productId: string) =>
  Object.values(cart).filter((l) => l._id === productId).reduce((n, l) => n + l.quantity, 0);

/** A shared line as the bag stores it after an add. */
const sharedLine = (flavor: string, quantity: number, stock = 6): CartItem => ({
  _id: "bread",
  quantity,
  name: `Bread (${flavor})`,
  price: "$9.00",
  priceID: "price_" + flavor.toLowerCase(),
  imageUrl: "",
  variant: flavor,
  stock,
  sharedStock: true,
});

type Helpers = {
  lineCap: (cart: Cart, key: string) => number | undefined;
  atLineCap: (cart: Cart, key: string) => boolean;
  isSharedStock: (product: { default_price?: unknown; stock?: unknown }) => boolean;
};

function helpers(): Helpers {
  const ns = cartStock as unknown as Record<string, unknown>; // named exports, checked below
  for (const name of ["lineCap", "atLineCap", "isSharedStock"]) {
    assert.equal(typeof ns[name], "function", `cartStock exports ${name}`);
  }
  return ns as unknown as Helpers; // the three were just checked
}

test("[T-385 REFUSE (a)] a stock of 6 on a product with options never lets more than 6 into the bag across its flavors", () => {
  let cart: Cart = {};
  ({ cart } = add(bread(6), "Sourdough", 4, cart));
  ({ cart } = add(bread(6), "Rye", 4, cart));
  assert.ok(sumOf(cart, "bread") <= 6, `the bag holds ${sumOf(cart, "bread")} loaves against a count of 6`);
  assert.equal(cart["bread_Sourdough"]?.quantity, 4);
  assert.equal(cart["bread_Rye"]?.quantity, 2, "Rye gets what Sourdough leaves");

  const more = add(bread(6), "Sourdough", 3, cart);
  assert.equal(more.cart["bread_Sourdough"]?.quantity, 4, "an existing flavor never grows past what the others leave");
  assert.equal(sumOf(more.cart, "bread"), 6);

  const wheat = add(bread(6), "Wheat", 1, cart);
  assert.equal(wheat.added, false, "with all 6 in the bag, another flavor does not join");
  assert.equal(sumOf(wheat.cart, "bread"), 6);
});

test("[T-385 REFUSE (a)] that last refusal reads as sold out, in the bag's existing words", () => {
  const cart: Cart = { bread_Sourdough: sharedLine("Sourdough", 4), bread_Rye: sharedLine("Rye", 2) };
  assert.deepEqual(addRefusal(bread(6), "Wheat", cart), { title: "Sold out", description: SOLD_OUT_ITEM_MESSAGE });
  assert.equal(SOLD_OUT_ITEM_MESSAGE, "Sorry, that one has sold out. Check back soon.");
});

test("[T-385 REFUSE (a)] a bag above a shared count is brought within it, earlier lines first", () => {
  const cart: Cart = { bread_Sourdough: sharedLine("Sourdough", 5), bread_Rye: sharedLine("Rye", 4) };
  const { cart: next, changed } = cartStock.clampCartToStock(cart);
  assert.equal(next["bread_Sourdough"]?.quantity, 5);
  assert.equal(next["bread_Rye"]?.quantity, 1);
  assert.deepEqual(changed, [{ name: "Bread (Rye)", available: 1 }]);
  assert.equal(cartStock.stockAdjustedMessage(changed), "Only 1 Bread (Rye) left. We've updated your bag.");
});

test("[T-385 REFUSE (a)] the bag's + and quantity cap follow what the shared count leaves", () => {
  const { lineCap, atLineCap } = helpers();
  const cart: Cart = { bread_Sourdough: sharedLine("Sourdough", 4), bread_Rye: sharedLine("Rye", 2) };
  assert.equal(lineCap(cart, "bread_Sourdough"), 4);
  assert.equal(lineCap(cart, "bread_Rye"), 2);
  assert.equal(atLineCap(cart, "bread_Sourdough"), true);
  assert.equal(atLineCap(cart, "bread_Rye"), true);
  // A stale higher reading never lets the sum past a newer lower one.
  const mixed: Cart = { bread_Sourdough: sharedLine("Sourdough", 4, 6), bread_Rye: sharedLine("Rye", 1, 5) };
  assert.equal(lineCap(mixed, "bread_Sourdough"), 4);
});

test("[T-385 ALLOW (b)] a per-option map still caps each option on its own", () => {
  const { lineCap, isSharedStock } = helpers();
  const box = cookieBox({ Small: 4, Large: 2 });
  assert.equal(isSharedStock(box), false);
  let cart: Cart = {};
  ({ cart } = add(box, "Small", 6, cart));
  ({ cart } = add(box, "Large", 6, cart));
  assert.equal(cart["cookie_Small"]?.quantity, 4);
  assert.equal(cart["cookie_Large"]?.quantity, 2);
  assert.equal(cart["cookie_Small"]?.sharedStock, undefined);
  assert.equal(lineCap(cart, "cookie_Small"), 4, "the other size's lines do not count against it");
  assert.equal(cartStock.clampCartToStock(cart).changed.length, 0);
});

test("[T-385 ALLOW (c)] a product with no stock is still unlimited", () => {
  const { lineCap, atLineCap, isSharedStock } = helpers();
  const box = cookieBox(undefined);
  assert.equal(isSharedStock(box), false);
  let cart: Cart = {};
  ({ cart } = add(box, "Small", 50, cart));
  ({ cart } = add(box, "Large", 50, cart));
  assert.equal(sumOf(cart, "cookie"), 100);
  assert.equal("stock" in (cart["cookie_Small"] ?? {}), false);
  assert.equal(lineCap(cart, "cookie_Small"), undefined);
  assert.equal(atLineCap(cart, "cookie_Small"), false);
});

test("[T-385 ALLOW] a single-price product and a Square product keep their own rule", () => {
  const { isSharedStock } = helpers();
  assert.equal(isSharedStock({ default_price: "price_one", stock: 6 }), false, "one price, one count: per line as before");
  const square = { checkoutIdentifier: "sq_s", price: { Small: "$4.50" }, stock: 6 };
  assert.equal(isSharedStock(square), false, "Square with a scalar id: the size is unknown here, so never shared (T-385S covers the size map)");
  assert.equal(cartStock.bagLineStock({ default_price: "price_one", stock: 6 }, "price_one"), 6);
});

/*
 * T-385 review pass 1, B1: a cap that reaches 0 is never written as a line's
 * quantity. A line of 0 fails our own checkout route (400 "Invalid product
 * format", src/app/api/checkout/route.ts) and the quote counts it as 1.
 */

/** The bag's quantity control, read through the namespace (absent before the B1 fix). */
function nextQty(cart: Cart, key: string, asked: number): number {
  const ns = cartStock as unknown as Record<string, unknown>; // named export, checked here
  assert.equal(typeof ns.nextLineQuantity, "function", "cartStock exports nextLineQuantity");
  return (ns.nextLineQuantity as (c: Cart, k: string, n: number) => number)(cart, key, asked); // checked just above
}

const dialogSource = () => fs.readFileSync(new URL("../components/Navigation/CartDialog.tsx", import.meta.url), "utf8");

/** A per-line (not shared) line of the cookie box. */
const perLineCookie = (size: string, quantity: number, stock: number | undefined): CartItem => ({
  _id: "cookie",
  quantity,
  name: `Cookie box (${size})`,
  price: "$4.50",
  priceID: "price_" + size.toLowerCase(),
  imageUrl: "",
  variant: size,
  ...(stock !== undefined ? { stock } : {}),
});

test("[T-385 B1 REFUSE] the count falls to 3 with 3 + 3 in the bag: adding a flavor already there is refused and changes nothing, never a line of 0", () => {
  const cart: Cart = { bread_Sourdough: sharedLine("Sourdough", 3), bread_Rye: sharedLine("Rye", 3) };
  const { added, cart: after } = add(bread(3), "Sourdough", 1, cart);
  assert.equal(added, false, "refused, so the shopper is told rather than shown an open bag");
  assert.equal(after["bread_Sourdough"]?.quantity, 3, "Sourdough still 3");
  assert.ok(Object.values(after).every((l) => l.quantity > 0), "no line of 0");
  assert.deepEqual(addRefusal(bread(3), "Sourdough", cart), { title: "Sold out", description: SOLD_OUT_ITEM_MESSAGE });
});

test("[T-385 B1 REFUSE] the bag's - takes one off even when the shared count now leaves the line less; it never writes 0", () => {
  // Sourdough 3 + Rye 1, a count read lower since (2): Sourdough's cap is 1.
  const cart: Cart = { bread_Sourdough: sharedLine("Sourdough", 3, 6), bread_Rye: sharedLine("Rye", 1, 2) };
  assert.match(dialogSource(), /nextLineQuantity\(next, productId, nextQty\)/);
  assert.equal(nextQty(cart, "bread_Sourdough", 2), 2, "- from 3 is 2");
  assert.equal(nextQty(cart, "bread_Sourdough", 4), 3, "+ never takes the line below where it is");
});

test("[T-385 B1 ALLOW] with the count still 6 an existing flavor grows to what the others leave; + stops at the cap; - to 0 removes", () => {
  const cart: Cart = { bread_Sourdough: sharedLine("Sourdough", 3), bread_Rye: sharedLine("Rye", 2) };
  const { added, cart: after } = add(bread(6), "Sourdough", 1, cart);
  assert.equal(added, true);
  assert.equal(after["bread_Sourdough"]?.quantity, 4);
  assert.equal(nextQty(cart, "bread_Sourdough", 4), 4, "+ within the count");
  assert.equal(nextQty(cart, "bread_Sourdough", 9), 4, "+ stops at what Rye leaves");
  assert.equal(nextQty(cart, "bread_Rye", 0), 0, "- to 0: the caller removes the line");
  // A per-line count and an untracked line behave as before.
  assert.equal(nextQty({ cookie_Small: perLineCookie("Small", 2, 4) }, "cookie_Small", 9), 4);
  assert.equal(nextQty({ cookie_Large: perLineCookie("Large", 2, undefined) }, "cookie_Large", 50), 50);
});

/*
 * T-385 review pass 1, B2: after checkout refuses (SW-B25 (5)), a shared line's
 * `available` is what the count leaves AFTER the lines before it. The bag must
 * store the whole count, not that net number, or it counts the other lines
 * twice: a false "Sold out" with stock left, and a - that drops a line to 0.
 */

/** Bag Sourdough 3 + Rye 3 (stored 6); checkout refuses at a count of 4. */
function refusedAtFour(named: Array<{ priceId: string; available: number }>) {
  const cart: Cart = { bread_Sourdough: sharedLine("Sourdough", 3), bread_Rye: sharedLine("Rye", 3) };
  return cartStock.applyShortStock(cart, named);
}

test("[T-385 B2 REFUSE] after checkout's shared refusal the bag keeps the whole count: - on the other line is 2, and the loaves left can still be added", () => {
  const { cart, changed } = refusedAtFour([{ priceId: "price_rye", available: 1 }]);
  assert.deepEqual(changed, [{ name: "Bread (Rye)", available: 1 }]);
  assert.equal(cart["bread_Rye"]?.quantity, 1);
  assert.equal(cart["bread_Rye"]?.stock, 4, "the count, not the 1 left after Sourdough's 3");
  assert.equal(cartStock.lineCap(cart, "bread_Sourdough"), 3, "Sourdough may keep its 3");
  // Sourdough taken out: 3 of the 4 are free again, so another flavor can join.
  const withoutSourdough: Cart = { bread_Rye: cart["bread_Rye"] as CartItem }; // read and asserted just above
  const wheat = add(bread(4), "Wheat", 1, withoutSourdough);
  assert.equal(wheat.added, true, "not a false Sold out");
  assert.equal(wheat.cart["bread_Wheat"]?.quantity, 1);
  assert.notEqual(addRefusal(bread(4), "Wheat", withoutSourdough).title, "Sold out");
});

test("[T-385 B2 REFUSE] the same when checkout names every line of the product, in bag order", () => {
  const { cart } = refusedAtFour([
    { priceId: "price_sourdough", available: 4 },
    { priceId: "price_rye", available: 1 },
  ]);
  assert.equal(cart["bread_Sourdough"]?.quantity, 3);
  assert.equal(cart["bread_Rye"]?.quantity, 1);
  assert.equal(cart["bread_Rye"]?.stock, 4);
});

test("[T-385 B2 ALLOW] a per-line count is stored exactly as checkout named it, as before", () => {
  const cart: Cart = { cookie_Small: perLineCookie("Small", 4, 4), cookie_Large: perLineCookie("Large", 3, 3) };
  const { cart: next, changed } = cartStock.applyShortStock(cart, [{ priceId: "price_large", available: 2 }]);
  assert.deepEqual(changed, [{ name: "Cookie box (Large)", available: 2 }]);
  assert.equal(next["cookie_Large"]?.quantity, 2);
  assert.equal(next["cookie_Large"]?.stock, 2, "a per-line stock is the line's own count");
  assert.equal(next["cookie_Small"]?.stock, 4);
});

// F392 (release C; Templates #230 T-385 delta review notes N5 and N6, backlog
// F392): a bag trimmed by checkout never lets "+" pass the real count.

test("[F392 N6 REFUSE] a refusal that only removes a shared line teaches the bag the count: + on the line left stops there", () => {
  // Sourdough 2 + Rye 3 stored at 6; the real count is 2, so checkout keeps
  // Sourdough's 2 and names Rye with 0 left (the line is removed).
  const cart: Cart = { bread_Sourdough: sharedLine("Sourdough", 2), bread_Rye: sharedLine("Rye", 3) };
  const { cart: next, changed } = cartStock.applyShortStock(cart, [{ priceId: "price_rye", available: 0 }]);
  assert.deepEqual(changed, [{ name: "Bread (Rye)", available: 0 }]);
  assert.equal(next["bread_Rye"], undefined, "a line with none left is removed, never written as 0");
  assert.equal(next["bread_Sourdough"]?.stock, 2, "the line left stores the real count");
  assert.equal(cartStock.lineCap(next, "bread_Sourdough"), 2);
  assert.equal(cartStock.atLineCap(next, "bread_Sourdough"), true, "+ is off at the real count");
  assert.equal(cartStock.nextLineQuantity(next, "bread_Sourdough", 3), 2, "+ cannot pass it");
});

test("[F392 N6 REFUSE] a refusal that names a shared line it keeps teaches the bag the count too", () => {
  // Sourdough 2 + Rye 1 stored at 6; checkout names Sourdough with 3 left (kept).
  const cart: Cart = { bread_Sourdough: sharedLine("Sourdough", 2), bread_Rye: sharedLine("Rye", 1) };
  const { cart: next, changed } = cartStock.applyShortStock(cart, [{ priceId: "price_sourdough", available: 3 }]);
  assert.deepEqual(changed, [], "nothing was brought down");
  assert.equal(next["bread_Sourdough"]?.stock, 3);
  assert.equal(next["bread_Rye"]?.stock, 3, "every shared line of the product stores it");
  assert.equal(cartStock.lineCap(next, "bread_Rye"), 1, "Rye may keep 1 beside Sourdough's 2, no more");
});

test("[F392 N6 ALLOW] a product checkout did not name keeps its lines as they were, and a per-line count is its own", () => {
  const cart: Cart = { bread_Sourdough: sharedLine("Sourdough", 2), cookie_Large: perLineCookie("Large", 3, 3) };
  const { cart: next } = cartStock.applyShortStock(cart, [{ priceId: "price_large", available: 2 }]);
  assert.deepEqual(next["bread_Sourdough"], cart["bread_Sourdough"], "an unnamed product is untouched");
  assert.equal(next["cookie_Large"]?.stock, 2, "a per-line stock is the line's own count, as before");
});

test("[F392 N5 REFUSE] trash and - on a stored line with no numeric quantity remove it, never a quantity of NaN", () => {
  const broken = { ...sharedLine("Sourdough", 1), quantity: undefined } as unknown as CartItem; // a stored shape no writer makes
  const cart: Cart = { bread_Sourdough: broken };
  const qty = cartStock.nextLineQuantity(cart, "bread_Sourdough", 0);
  assert.equal(qty, 0, "0 means the caller removes the line");
  assert.equal(Number.isNaN(qty), false);
});

test("[F392 N5 ALLOW] an increase on a good line still stops at its cap", () => {
  const cart: Cart = { bread_Sourdough: sharedLine("Sourdough", 2, 4) };
  assert.equal(cartStock.nextLineQuantity(cart, "bread_Sourdough", 9), 4);
  assert.equal(cartStock.nextLineQuantity(cart, "bread_Sourdough", 1), 1, "a decrease is taken as asked");
});

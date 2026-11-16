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
  assert.equal(isSharedStock(square), false, "Square: no default_price");
  assert.equal(cartStock.bagLineStock({ default_price: "price_one", stock: 6 }, "price_one"), 6);
});

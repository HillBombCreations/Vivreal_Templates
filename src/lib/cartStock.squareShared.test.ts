/**
 * T-385S (F393, release B, SW-B25 amended; design-products.md D3): the Square
 * half of T-385. One stock number on a Square product priced per size is ONE
 * count shared by every size, and the bag caps the SUM of that product's lines
 * at it, as checkout does from Client CL-STK4 (`resolveSquareVariant.js`).
 *
 * The product comes through `rendererProductToTemplates`, the bridge the
 * storefront's add uses, in the shape renderer 1.84.2 hands the bag: a
 * size-to-variation `checkoutIdentifier` map, a `price` map, no
 * `default_price`. At #230's head before T-385S that shape with one number was
 * untracked, so the bag let any number in.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as cartStock from "./cartStock.ts";
import { SOLD_OUT_ITEM_MESSAGE, addRefusal, handleAddToCart } from "./utils/cartUtils/index.ts";
import { rendererProductToTemplates } from "./cartProduct.ts";
import type { DetailProductData } from "@hillbombcreations/site-renderer";
import type { Cart } from "../types/Cart";
import type { Product } from "../types/Products";

const SIZE_IDS = { Small: "sq_s", Medium: "sq_m", Large: "sq_l" };

/** A Square galette priced per size, as the renderer hands it to the bag. */
const galette = (stock: unknown): Product =>
  rendererProductToTemplates({
    _id: "galette",
    name: "Galette",
    price: { Small: "$4.50", Medium: "$5.50", Large: "$6.75" },
    usingVariant: { name: "Size", values: Object.keys(SIZE_IDS) },
    checkoutIdentifier: SIZE_IDS,
    stock,
  } as unknown as DetailProductData); // the renderer shape, only the fields the bag reads

function add(product: Product, size: string, quantity: number, start: Cart): { added: boolean; cart: Cart } {
  let next: Cart = start;
  const added = handleAddToCart({
    product,
    selectedVariant: size,
    quantity,
    cart: start,
    setCart: (u) => {
      next = typeof u === "function" ? u(next) : u;
    },
  });
  return { added, cart: next };
}

const sumOf = (cart: Cart) =>
  Object.values(cart).filter((l) => l._id === "galette").reduce((n, l) => n + l.quantity, 0);

test("[T-385S REFUSE] a stock of 6 on a Square product priced per size never lets more than 6 into the bag across its sizes", () => {
  let cart: Cart = {};
  ({ cart } = add(galette(6), "Small", 4, cart));
  ({ cart } = add(galette(6), "Large", 4, cart));
  assert.ok(sumOf(cart) <= 6, `the bag holds ${sumOf(cart)} galettes against a count of 6`);
  assert.equal(cart["galette_Small"]?.quantity, 4);
  assert.equal(cart["galette_Large"]?.quantity, 2, "Large gets what Small leaves");
  assert.equal(cart["galette_Large"]?.priceID, "sq_l", "the line still checks out with its own variation id");
  assert.equal(cart["galette_Large"]?.sharedStock, true);
  assert.equal(cart["galette_Large"]?.stock, 6);

  const more = add(galette(6), "Small", 3, cart);
  assert.equal(more.cart["galette_Small"]?.quantity, 4, "an existing size never grows past what the others leave");
  assert.equal(sumOf(more.cart), 6);

  const medium = add(galette(6), "Medium", 1, cart);
  assert.equal(medium.added, false, "with all 6 in the bag, another size does not join");
  assert.equal(sumOf(medium.cart), 6);
  assert.deepEqual(addRefusal(galette(6), "Medium", cart), { title: "Sold out", description: SOLD_OUT_ITEM_MESSAGE });
});

test("[T-385S REFUSE] the shared table's case: a plain count of 0 on a Square product priced per size is sold out in every size", () => {
  assert.equal(cartStock.bagLineStock(galette(0), "sq_s"), 0);
  assert.equal(cartStock.bagLineStock(galette(0), "sq_l"), 0);
  const { added, cart } = add(galette(0), "Large", 1, {});
  assert.equal(added, false);
  assert.deepEqual(cart, {});
  assert.deepEqual(addRefusal(galette(0), "Large", {}), { title: "Sold out", description: SOLD_OUT_ITEM_MESSAGE });
});

test("[T-385S REFUSE] the bag's + and quantity cap follow what the shared count leaves", () => {
  let cart: Cart = {};
  ({ cart } = add(galette(6), "Small", 4, cart));
  ({ cart } = add(galette(6), "Large", 2, cart));
  assert.equal(cartStock.lineCap(cart, "galette_Small"), 4);
  assert.equal(cartStock.atLineCap(cart, "galette_Small"), true);
  assert.equal(cartStock.atLineCap(cart, "galette_Large"), true);
  assert.equal(cartStock.nextLineQuantity(cart, "galette_Small", 9), 4, "+ stops at what Large leaves");
});

test("[T-385S REFUSE] after checkout's Square shared refusal (CL-STK4, SW-B25 (5)) the bag keeps the whole count", () => {
  // Small 3 + Large 3 at a count of 6; checkout refuses at 4, naming Large with
  // the 1 that Small's 3 leave.
  let cart: Cart = {};
  ({ cart } = add(galette(6), "Small", 3, cart));
  ({ cart } = add(galette(6), "Large", 3, cart));
  const { cart: next, changed } = cartStock.applyShortStock(cart, [{ priceId: "sq_l", available: 1 }]);
  assert.deepEqual(changed, [{ name: "Galette (Large)", available: 1 }]);
  assert.equal(next["galette_Large"]?.quantity, 1);
  assert.equal(next["galette_Large"]?.stock, 4, "the count, not the 1 left after Small's 3");
  assert.equal(cartStock.lineCap(next, "galette_Small"), 3, "Small may keep its 3");
});

test("[T-385S ALLOW] a Square per-size map still caps each size on its own", () => {
  const box = galette({ Small: 4, Large: 2 });
  assert.equal(cartStock.isSharedStock(box), false);
  let cart: Cart = {};
  ({ cart } = add(box, "Small", 6, cart));
  ({ cart } = add(box, "Large", 6, cart));
  ({ cart } = add(box, "Medium", 50, cart));
  assert.equal(cart["galette_Small"]?.quantity, 4);
  assert.equal(cart["galette_Large"]?.quantity, 2);
  assert.equal(cart["galette_Medium"]?.quantity, 50, "a size with no count is untracked, as before");
  assert.equal(cart["galette_Small"]?.sharedStock, undefined);
  assert.equal(cartStock.lineCap(cart, "galette_Small"), 4, "the other sizes' lines do not count against it");
  assert.equal(cartStock.clampCartToStock(cart).changed.length, 0);
});

test("[T-385S ALLOW] untracked Square products stay uncapped, and a single-price count stays per line", () => {
  const plain = galette(undefined);
  assert.equal(cartStock.isSharedStock(plain), false);
  let cart: Cart = {};
  ({ cart } = add(plain, "Small", 50, cart));
  ({ cart } = add(plain, "Large", 50, cart));
  assert.equal(sumOf(cart), 100);
  assert.equal("stock" in (cart["galette_Small"] ?? {}), false);
  assert.equal(cartStock.lineCap(cart, "galette_Small"), undefined);

  // An older payload: a scalar id with a price map, so the size checkout picks is unknown here.
  const scalarSized = { checkoutIdentifier: "sq_s", price: { Small: "$4.50", Large: "$6.75" }, stock: 6 };
  assert.equal(cartStock.bagLineStock(scalarSized, "sq_s"), undefined);
  assert.equal(cartStock.isSharedStock(scalarSized), false);

  const single = { checkoutIdentifier: "sq_one", price: "$5.00", stock: 6 };
  assert.equal(cartStock.bagLineStock(single, "sq_one"), 6);
  assert.equal(cartStock.isSharedStock(single), false, "one price, one count: per line as before");
});

test("[T-385S ALLOW] the Stripe rule is unchanged", () => {
  const sizes = { Small: "price_small", Large: "price_large" };
  assert.equal(cartStock.isSharedStock({ default_price: sizes, stock: 6 }), true);
  assert.equal(cartStock.isSharedStock({ default_price: sizes, stock: { Small: 4 } }), false);
  assert.equal(cartStock.isSharedStock({ default_price: sizes }), false);
  assert.equal(cartStock.isSharedStock({ default_price: "price_one", stock: 6 }), false);
  // A Stripe product that also carries a checkoutIdentifier is judged by its default_price, as before.
  assert.equal(
    cartStock.isSharedStock({ default_price: "price_one", checkoutIdentifier: sizes, price: { Small: "$1", Large: "$2" }, stock: 6 }),
    false,
  );
  assert.equal(cartStock.bagLineStock({ default_price: sizes, stock: 6 }, "price_large"), 6);
});

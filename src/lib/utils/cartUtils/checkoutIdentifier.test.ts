import { test } from "node:test";
import assert from "node:assert/strict";
// Explicit .ts extension: runs directly under plain Node
// (`node --experimental-strip-types --test`, see package.json "test").
import { handleAddToCart } from "./index.ts";
import type { Cart } from "@/types/Cart";
import type { Product } from "@/types/Products";

// Checkout-identifier resolution at the cart boundary (Square wiring): the
// cart line's `priceID` fills the `products[].price` wire slot, which Stripe
// reads as a price id and Square matches against `objectValue.variationId` —
// so `handleAddToCart` must resolve `checkoutIdentifier ?? default_price`.

/** Run handleAddToCart against an empty cart and capture the setCart result. */
function addToCart(product: Product): Cart {
  const cart: Cart = {};
  let next: Cart = cart;
  handleAddToCart({
    product,
    selectedVariant: null,
    quantity: 1,
    cart,
    setCart: (updater) => {
      next = typeof updater === "function" ? updater(next) : updater;
    },
  });
  return next;
}

function baseProduct(overrides: Partial<Product>): Product {
  return {
    _id: "prod1",
    name: "Widget",
    price: "$10",
    description: "",
    imageUrl: "",
    ...overrides,
  };
}

test("handleAddToCart: checkoutIdentifier only (Square) -> priceID uses it", () => {
  const cart = addToCart(baseProduct({ checkoutIdentifier: "SQVAR" }));
  assert.equal(cart["prod1_default"]?.priceID, "SQVAR");
});

test("handleAddToCart: both present -> checkoutIdentifier wins", () => {
  const cart = addToCart(
    baseProduct({ checkoutIdentifier: "SQVAR", default_price: "price_123" })
  );
  assert.equal(cart["prod1_default"]?.priceID, "SQVAR");
});

test("handleAddToCart: default_price only (legacy Stripe) -> priceID unchanged", () => {
  const cart = addToCart(baseProduct({ default_price: "price_123" }));
  assert.equal(cart["prod1_default"]?.priceID, "price_123");
});

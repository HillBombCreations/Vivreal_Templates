import { test } from "node:test";
import assert from "node:assert/strict";
// Explicit .ts extension: runs directly under plain Node
// (`node --experimental-strip-types --test`, see package.json "test"). This is
// why the pure mapping lives here and not in `./index.ts` (which is
// `server-only` and imports the fetch client, so it cannot load under plain
// Node).
import { transformProduct } from "./transformProduct.ts";

// Provider-agnostic checkout identifier resolution (Square checkout wiring):
// `checkoutIdentifier` must resolve as
//   objectValue.checkoutIdentifier ?? objectValue.default_price ?? scalar objectValue.variationId
// while `default_price` itself passes through UNCHANGED — legacy Stripe
// products (default_price only) must map byte-identically to before.

test("transformProduct: default_price passthrough unchanged + checkoutIdentifier mirrors it", () => {
  const p = transformProduct({
    _id: "p1",
    objectValue: { name: "Mug", price: "$12", default_price: "price_123" },
  });
  assert.equal(p.default_price, "price_123");
  assert.equal(p.checkoutIdentifier, "price_123");
});

test("transformProduct: variationId only (Square) -> checkoutIdentifier, default_price stays undefined", () => {
  const p = transformProduct({
    _id: "p2",
    objectValue: { name: "Tee", price: "$20", variationId: "SQVAR_1" },
  });
  assert.equal(p.default_price, undefined);
  assert.equal(p.checkoutIdentifier, "SQVAR_1");
});

test("transformProduct: both default_price and variationId -> default_price wins", () => {
  const p = transformProduct({
    _id: "p3",
    objectValue: { name: "Hat", price: "$15", default_price: "price_abc", variationId: "SQVAR_2" },
  });
  assert.equal(p.checkoutIdentifier, "price_abc");
});

test("transformProduct: authored objectValue.checkoutIdentifier wins over both fallbacks", () => {
  const p = transformProduct({
    _id: "p4",
    objectValue: {
      name: "Pin",
      price: "$5",
      checkoutIdentifier: "explicit_id",
      default_price: "price_xyz",
      variationId: "SQVAR_3",
    },
  });
  assert.equal(p.checkoutIdentifier, "explicit_id");
});

test("transformProduct: neither identifier present -> checkoutIdentifier undefined", () => {
  const p = transformProduct({
    _id: "p5",
    objectValue: { name: "Sticker", price: "$3" },
  });
  assert.equal(p.checkoutIdentifier, undefined);
});

test("transformProduct: non-string variationId is ignored", () => {
  const p = transformProduct({
    _id: "p6",
    objectValue: { name: "Card", price: "$4", variationId: 12345 },
  });
  assert.equal(p.checkoutIdentifier, undefined);
});

test("transformProduct: default_price null falls through to variationId", () => {
  const p = transformProduct({
    _id: "p7",
    objectValue: { name: "Poster", price: "$25", default_price: null, variationId: "SQVAR_4" },
  });
  assert.equal(p.default_price, undefined); // `?? undefined` normalises null
  assert.equal(p.checkoutIdentifier, "SQVAR_4");
});

test("transformProduct: variant-map default_price mirrors into checkoutIdentifier as-is", () => {
  const map = { small: "price_s", large: "price_l" };
  const p = transformProduct({
    _id: "p8",
    objectValue: { name: "Print", price: { small: "$10", large: "$18" }, default_price: map },
  });
  assert.deepEqual(p.default_price, map);
  assert.deepEqual(p.checkoutIdentifier, map);
});

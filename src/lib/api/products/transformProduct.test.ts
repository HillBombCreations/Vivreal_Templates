import { test } from "node:test";
import assert from "node:assert/strict";
// Explicit .ts extension: runs directly under plain Node
// (`node --experimental-strip-types --test`, see package.json "test"). This is
// why the pure mapping lives here and not in `./index.ts` (which is
// `server-only` and imports the fetch client, so it cannot load under plain
// Node).
import { transformProduct } from "./transformProduct.ts";
// The site engine's REAL per-option rule, by relative path on purpose: the
// package entry imports `next/link`, which plain node cannot load.
import { thresholdForOption } from "../../../../node_modules/@hillbombcreations/site-renderer/dist/lib/stock.js";

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

// Contract C7 (renderer A, 2026-10-08): the sale name reaches the items the
// renderer's cards and home showcase read.
test("ALLOW (C7): a named sale's name reaches the product item", () => {
  const product = transformProduct({
    _id: "p1",
    objectValue: { name: "Mug", price: "$10", salePercent: 15, saleName: "Spring sale" },
  });
  assert.equal(product.saleName, "Spring sale");
});

test("REFUSE (C7): an unnamed sale adds no key; a blank or non-string name is not a name", () => {
  for (const saleName of [undefined, null, "", "   ", 7]) {
    const product = transformProduct({
      _id: "p1",
      objectValue: { name: "Mug", price: "$10", salePercent: 15, saleName },
    });
    assert.equal("saleName" in product, false, JSON.stringify(saleName));
  }
});

// F417 (release C, SW-C15): the per-size low stock threshold reaches the
// product page, so each size is judged by its own number, as the shop cards do.
const thresholdOf = (lowStockThreshold: unknown) =>
  transformProduct({ _id: "p-low", objectValue: { name: "Loaf", price: "$8", lowStockThreshold } }).lowStockThreshold;

test("ALLOW (F417): a per-size threshold map reaches the product, and each size is judged by its own number", () => {
  const map = { Small: 2, Large: 10 };
  const kept = thresholdOf(map);
  assert.deepEqual(kept, { Small: 2, Large: 10 });
  assert.equal(thresholdForOption(kept, "Small"), 2);
  assert.equal(thresholdForOption(kept, "Large"), 10);
  assert.equal(thresholdOf(3), 3, "control: one number for the product, as before");
  assert.equal(thresholdOf(0), 0, "zero is a number");
});

test("REFUSE (F417): a malformed threshold is dropped, as before, and a map keeps only its numbers", () => {
  for (const bad of [undefined, null, "5", "", [], [2, 3], {}, { Small: "2" }, { Small: Number.NaN }, Number.POSITIVE_INFINITY, true]) {
    assert.equal(thresholdOf(bad), undefined, `${JSON.stringify(bad)} is unset`);
  }
  assert.deepEqual(thresholdOf({ Small: 2, Large: "10", Medium: null }), { Small: 2 }, "a size with no number is left out");
});

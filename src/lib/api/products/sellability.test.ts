import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformProduct } from "./transformProduct.ts";
// The next hop, the renderer's real buy-control rule, by relative path for the
// reason `src/lib/detail/productOffer.test.ts` gives.
import { resolveItemAction } from "../../../../node_modules/@hillbombcreations/site-renderer/dist/lib/itemAction.js";

// W1 (vivreal-hq design-stripe-archive-2026-10-23.md section 3, plan row T5):
// VR_Client_API (C1, PR #128) puts `purchasable` (always a boolean) and
// `notForSaleVariants` (only when non-empty) beside `objectValue` on every
// storefront item, and strips `saleState`. This allowlist is the only thing
// between those fields and the renderer, which draws "Not for sale right now"
// from them (renderer 1.89.0, `resolveItemAction`).
//
// Rows are the live Dougs Kitchen Stripe products captured for U4
// (`../../seo/__fixtures__/liveDetailDates.json`); C1 is not deployed yet, so
// the two W1 fields are added in exactly the shape C1's `applySellability`
// writes (VR_Client_API 933b12a4, src/services/tenant/getIntegrationObjects.js).

const fixture = JSON.parse(
  readFileSync(new URL("../../seo/__fixtures__/liveDetailDates.json", import.meta.url), "utf8"),
) as { stripeProducts: Record<string, unknown>[] };
const [scalarRow, sizedRow] = fixture.stripeProducts;

test("sanity: the live rows parsed, one scalar-named and one sized", () => {
  assert.equal(typeof (scalarRow.objectValue as { name: unknown }).name, "string");
  assert.equal(typeof (sizedRow.objectValue as { name: unknown }).name, "object");
});

test("ALLOW (D10): an item the API says cannot be bought carries purchasable: false", () => {
  const product = transformProduct({ ...scalarRow, purchasable: false });
  assert.equal(product.purchasable, false);
});

test("REFUSE (D10): purchasable true, absent, or anything but false adds no key, byte for byte", () => {
  const today = JSON.stringify(transformProduct(scalarRow));
  for (const purchasable of [true, undefined, null, "false", 0]) {
    const product = transformProduct({ ...scalarRow, purchasable });
    assert.equal(Object.hasOwn(product, "purchasable"), false, JSON.stringify(purchasable));
    assert.equal(JSON.stringify(product), today, JSON.stringify(purchasable));
  }
});

test("ALLOW (D14): the sizes the API lists as not for sale reach the product", () => {
  const product = transformProduct({ ...sizedRow, purchasable: true, notForSaleVariants: ["Monster"] });
  assert.deepEqual(product.notForSaleVariants, ["Monster"]);
  assert.equal(Object.hasOwn(product, "purchasable"), false, "one size off leaves the item buyable");
});

test("REFUSE (D14): an empty list, a non-list, or a list with a non-string entry adds no key", () => {
  const today = JSON.stringify(transformProduct(sizedRow));
  for (const notForSaleVariants of [[], "Monster", { Monster: true }, ["Monster", 3], [null]]) {
    const product = transformProduct({ ...sizedRow, purchasable: true, notForSaleVariants });
    assert.equal(Object.hasOwn(product, "notForSaleVariants"), false, JSON.stringify(notForSaleVariants));
    assert.equal(JSON.stringify(product), today, JSON.stringify(notForSaleVariants));
  }
});

test("REFUSE: saleState, VR_CMS_API's internal record, never reaches the site even if it arrives", () => {
  const product = transformProduct({
    ...sizedRow,
    purchasable: true,
    saleState: { inactivePriceIds: ["price_x"], noticeSentAt: "2026-10-23T00:00:00.000Z" },
  });
  assert.equal(Object.hasOwn(product, "saleState"), false);
  assert.equal(JSON.stringify(product).includes("price_x"), false);
});

test("NEXT HOP: the renderer draws Not for sale right now from what this allowlist passes, and Add when it passes nothing", () => {
  // The live sized row, priced the way a Stripe row is (the capture kept only names).
  const priced = {
    ...sizedRow,
    objectValue: {
      ...(sizedRow.objectValue as Record<string, unknown>),
      price: { "Chocolate Chip": "4.00", Monster: "4.50" },
      default_price: { "Chocolate Chip": "price_cc", Monster: "price_m" },
    },
    usingVariant: { name: "Cookie", values: ["Chocolate Chip", "Monster"] },
  };
  const commerce = { paymentsProvider: "stripe" };
  const action = (raw: Record<string, unknown>, variant: string | null) =>
    resolveItemAction({ product: transformProduct(raw), variant, commerce });

  assert.deepEqual(action({ ...priced, purchasable: true }, "Chocolate Chip"), { kind: "cart" }, "control: a buyable item adds to the bag");
  assert.deepEqual(action({ ...priced, purchasable: false }, "Chocolate Chip"), { kind: "not-for-sale", label: "Not for sale right now", scope: "item" });
  const oneSizeOff = { ...priced, purchasable: true, notForSaleVariants: ["Monster"] };
  assert.deepEqual(action(oneSizeOff, "Monster"), { kind: "not-for-sale", label: "Not for sale right now", scope: "variant" });
  assert.deepEqual(action(oneSizeOff, "Chocolate Chip"), { kind: "cart" }, "the other size keeps selling (D14)");
});

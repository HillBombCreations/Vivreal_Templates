import { test } from "node:test";
import assert from "node:assert/strict";
// Explicit .ts extension: runs under `node --experimental-strip-types --test`.
import { templatesProductToRenderer } from "./templatesProductToRenderer.ts";
import type { Product } from "@/types/Products";

/**
 * Contract C7 on the product page: the owner's sale name reaches the renderer's
 * detail item, and an unnamed sale leaves the item exactly as it was.
 */

const product = (overrides: Partial<Product>): Product => ({
  _id: "p1",
  name: "Mug",
  price: "$4.99",
  description: "",
  imageUrl: "",
  salePercent: 15,
  ...overrides,
});

test("ALLOW (C7): a named sale's name reaches the product page item", () => {
  const item = templatesProductToRenderer(product({ saleName: "Spring sale" }), "/logo.png");
  assert.equal(item.saleName, "Spring sale");
});

test("REFUSE (C7): an unnamed sale adds no key", () => {
  for (const saleName of [undefined, ""]) {
    const item = templatesProductToRenderer(product({ saleName }), "/logo.png");
    assert.equal("saleName" in item, false, JSON.stringify(saleName));
  }
});

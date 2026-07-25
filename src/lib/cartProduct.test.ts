/**
 * Pins the two cart projections (review follow-up, Task 3.2): each is an
 * explicit field-by-field whitelist, so silently dropping `checkoutIdentifier`
 * from either would break Square checkout (empty `priceID`) with no compile
 * error. Extracted from their `'use client'` modules precisely so this suite
 * can load them under `node --test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { rendererProductToTemplates } from "./cartProduct.ts";
import { templatesProductToRenderer } from "../components/PageTemplates/ProductDetailRenderer/templatesProductToRenderer.ts";
import type { Product } from "@/types/Products";

test("rendererProductToTemplates carries checkoutIdentifier (Square path)", () => {
  const p = rendererProductToTemplates({
    _id: "p1",
    name: "Widget",
    checkoutIdentifier: "SQVAR123",
  });
  assert.equal(p.checkoutIdentifier, "SQVAR123");
  assert.equal(p.default_price, undefined);
});

test("rendererProductToTemplates legacy Stripe shape is unchanged (no checkoutIdentifier)", () => {
  const p = rendererProductToTemplates({
    _id: "p1",
    name: "Widget",
    price: "$8",
    default_price: "price_123",
  });
  assert.equal(p.default_price, "price_123");
  assert.equal(p.checkoutIdentifier, undefined);
  assert.equal(p.name, "Widget");
  assert.equal(p.price, "$8");
});

test("templatesProductToRenderer carries checkoutIdentifier and default_price", () => {
  const product: Product = {
    _id: "p1",
    name: "Widget",
    price: "$8",
    description: "",
    imageUrl: "https://cdn/1.jpg",
    default_price: "price_123",
    checkoutIdentifier: "SQVAR123",
  };
  const d = templatesProductToRenderer(product, "/logo.png");
  assert.equal(d.checkoutIdentifier, "SQVAR123");
  assert.equal(d.default_price, "price_123");
  assert.equal(d.imageUrl, "https://cdn/1.jpg");
});

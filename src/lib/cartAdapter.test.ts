import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BUY_NOW_FAILED_MESSAGE,
  UNBUYABLE_ITEM_MESSAGE,
  UNBUYABLE_LINE_MESSAGE,
} from "./utils/cartUtils/index.ts";

// cartAdapter.ts is a `use client` React module, which the plain-Node runner
// cannot load (the cartProduct.ts precedent). The COPY it shows is imported and
// asserted directly; the structure around it is pinned from source.
const source = fs.readFileSync(new URL("./cartAdapter.ts", import.meta.url), "utf8");

const EM = String.fromCharCode(8212);
const EN = String.fromCharCode(8211);

const SHOPPER_COPY = [
  ["BUY_NOW_FAILED_MESSAGE", BUY_NOW_FAILED_MESSAGE],
  ["UNBUYABLE_ITEM_MESSAGE", UNBUYABLE_ITEM_MESSAGE],
  ["UNBUYABLE_LINE_MESSAGE", UNBUYABLE_LINE_MESSAGE],
] as const;

test("every shopper-facing refusal carries no em dash and no en dash", () => {
  for (const [name, copy] of SHOPPER_COPY) {
    assert.ok(!copy.includes(EM), `${name} has an em dash`);
    assert.ok(!copy.includes(EN), `${name} has an en dash`);
  }
});

test("the dash check can fail (control)", () => {
  const poisoned = `We could not start checkout ${EM} try again.`;
  assert.ok(poisoned.includes(EM), "the control string is not poisoned");
});

test("no refusal speaks in internal vocabulary", () => {
  // A shopper is never told about a provider, an integration or a group.
  const banned = [
    "Stripe", "Square", "integration", "provider", "group", "API",
    "endpoint", "schema", "render", "CDN", "400", "500", "null", "undefined",
  ];
  for (const [name, copy] of SHOPPER_COPY) {
    for (const word of banned) {
      assert.ok(
        !copy.toLowerCase().includes(word.toLowerCase()),
        `${name} says "${word}": ${copy}`,
      );
    }
  }
});

test("every refusal tells the shopper what to do next, not just no", () => {
  // H45: "visible and recoverable". A sentence that only says no is the dead
  // button with extra steps.
  const anAction = /try again|get in touch|remove it|refresh/i;
  for (const [name, copy] of SHOPPER_COPY) {
    assert.match(copy, anAction, `${name} offers no way forward: ${copy}`);
  }
});

test("H45: Buy now no longer fails silently", () => {
  // The whole hop used to be a bare `await handleCheckout({...})`. A refusal
  // became an unhandled rejection: spinner stopped, page unchanged, no words.
  assert.match(source, /await handleCheckout\(/);
  const checkoutAt = source.indexOf("await handleCheckout(");
  const tryAt = source.lastIndexOf("try {", checkoutAt);
  assert.ok(tryAt > -1 && tryAt < checkoutAt, "handleCheckout is not inside a try");
  const catchAt = source.indexOf("} catch (err) {", checkoutAt);
  assert.ok(catchAt > checkoutAt, "there is no catch after handleCheckout");
  assert.match(source.slice(catchAt), /toast\(\{/, "the catch says nothing to the shopper");
});

test("H45: a refused Add to cart is no longer discarded", () => {
  // `handleAddToCart` returns false for an item with no checkout price.
  assert.match(source, /const added = handleAddToCart\(/);
  assert.match(source, /if \(!added\) \{/);
});

test("both refusals are shown as failures, not as confirmations", () => {
  const destructive = source.match(/variant: "destructive"/g) ?? [];
  assert.equal(destructive.length, 2, "expected one destructive toast per refusal");
});

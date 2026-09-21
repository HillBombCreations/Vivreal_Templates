import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripComments } from "../../lib/source/stripComments.ts";

// CartDialog.tsx is a `use client` React module the plain-Node runner cannot
// load. The arithmetic it now delegates to is tested by being CALLED, in
// src/lib/cartPrice.test.ts; this pins that the dialog actually calls it, and
// the copy it shows.
const source = fs.readFileSync(new URL("./CartDialog.tsx", import.meta.url), "utf8");

/**
 * Comments removed for every check about what the shopper SEES. The comment
 * recording that a payment company was removed names that company, and the
 * comments explaining these fixes contain em dashes; run against raw source,
 * both checks below fail on the evidence of their own fix.
 */
const code = stripComments(source);

const EM = String.fromCharCode(8212);
const EN = String.fromCharCode(8211);

test("H34: the bag never coerces a price with a bare Number()", () => {
  // `Number("$24.99")` is NaN, the `|| 0` beside it floored that to zero, and
  // the shopper saw a Subtotal of $0.00 while checkout charged the real amount.
  assert.doesNotMatch(source, /Number\(resolvePrice/, "the old coercion is back");
  assert.doesNotMatch(source, /Number\([^)]*\.price/, "a price is coerced with Number()");
});

test("H34 control: that assertion really does catch the old expression", () => {
  const old = "acc + (Number(resolvePrice(item)) || 0) * (item.quantity || 0),";
  assert.match(old, /Number\(resolvePrice/);
});

test("H34: the bag reads prices through the shared tolerant parser", () => {
  assert.match(source, /from "@\/lib\/cartPrice"/);
  assert.match(source, /cartSubtotal\(itemsArray\)/);
  assert.match(source, /cartUnitPrice\(item\)/);
  assert.match(source, /cartLineTotal\(item\)/);
});

test("H36: the cart footer never names the payment company", () => {
  // The active provider is resolved server-side and is not always the same one,
  // so a hardcoded name told some shoppers the wrong company had their card.
  for (const company of ["Stripe", "Square", "PayPal"]) {
    assert.ok(!code.includes(company), `the cart footer still says ${company}`);
  }
  assert.match(source, /You&apos;ll be redirected to a secure checkout\./);
});

test("H36 control: the sentence that shipped would have failed that check", () => {
  const old = "You&apos;ll be redirected to a secure Stripe checkout.";
  assert.ok(old.includes("Stripe"));
});

test("no em dash or en dash reaches the shopper from this dialog", () => {
  // Copy here lives in JSX TEXT as much as in quoted strings, so this reads the
  // whole module rather than only the string literals. A sweep that only reads
  // quoted strings misses most of the words on the page.
  assert.ok(!code.includes(EM), "an em dash is in the cart dialog");
  assert.ok(!code.includes(EN), "an en dash is in the cart dialog");
});

test("the dash and company checks can both fail (control)", () => {
  // Proves the two checks above are reading something, and that stripping
  // comments did not simply empty the file.
  assert.ok(code.includes("Proceed to checkout"), "JSX text was stripped away");
  assert.ok(code.includes("Your cart is empty"), "an empty state was stripped away");
  assert.ok(source.includes(EM), "expected em dashes in the comments, found none");
  assert.ok(source.includes("Square"), "expected the word in a comment, found none");
});

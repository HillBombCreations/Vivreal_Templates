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
  // F4 moved the arithmetic into lib/cartQuote.ts, which falls back to the
  // tolerant parser for every line the quote does not carry (tested by being
  // CALLED in src/lib/cartQuote.test.ts). This pins both halves of that path.
  assert.match(source, /from "@\/lib\/cartQuote"/);
  assert.match(code, /bagTotals\(itemsArray, quote, appliedCode \? codeNewSubtotal : null\)/);
  assert.match(code, /const price = linePrice\(item, quote\);/);
  const quoteModule = fs.readFileSync(new URL("../../lib/cartQuote.ts", import.meta.url), "utf8");
  assert.match(quoteModule, /return \{ unit: cartUnitPrice\(item\), was: null, saleName: null \};/);
});

test("F4: the bag asks for the quote, re-asks at Checkout and waits for a second press on a rise", () => {
  assert.match(code, /useCartQuote\(cartLineItems, linesKey, open\)/);
  assert.match(
    code,
    /const shown = quote;\s*const fresh = await requote\(\);\s*if \(!fresh\.current\) return;\s*if \(quoteRaisedAPrice\(shown, fresh\.quote\)\) \{\s*setSaleEnded\(true\);\s*return;\s*\}/,
  );
  // handleCheckout is reached only after that check.
  assert.ok(code.indexOf("quoteRaisedAPrice(shown, fresh.quote)") < code.indexOf("await handleCheckout("));
  assert.match(code, /\{SALE_ENDED_COPY\}/);
});

test("F4 (review-3 BLOCK 5): the code discount is derived from the quoted subtotal, never stored", () => {
  assert.doesNotMatch(code, /setDiscount\(/);
  assert.doesNotMatch(code, /useState\(0\)/, "no stored discount figure");
  assert.match(code, /setCodeNewSubtotal\(result\.newSubtotal as number\);/);
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

test("RW3-4: a code is marked applied only when the preview takes something off", () => {
  assert.match(code, /import \{ couponPreviewDiscount, COUPON_NO_EFFECT_COPY \} from "@\/lib\/couponPreview"/);
  assert.match(code, /const previewDiscount = result\.valid \? couponPreviewDiscount\(result\.newSubtotal, subtotal\) : 0;/);
  assert.match(code, /if \(result\.valid && previewDiscount > 0\) \{\s*setAppliedCode\(code\);/);
  // The only setAppliedCode(code) is the one behind that guard.
  assert.equal((code.match(/setAppliedCode\(code\)/g) ?? []).length, 1);
});

test("RW3-4: a valid code with no effect clears the code and says it does not apply", () => {
  assert.match(
    code,
    /\} else if \(result\.valid\) \{\s*setAppliedCode\(null\);\s*setPromoCode\(null\);\s*setCodeNewSubtotal\(null\);\s*setCodeError\(COUPON_NO_EFFECT_COPY\);/,
  );
  // The old inline math, which set the code applied whatever it computed, is gone.
  assert.doesNotMatch(code, /newSubtotalDollars/);
});

const context = stripComments(fs.readFileSync(new URL("../../contexts/CartContext.tsx", import.meta.url), "utf8"));

test("TB-6: the applied code is stored beside the cart and hydrated with it", () => {
  assert.match(context, /store\.put\(\{ cart, promoCode, timestamp: Date\.now\(\) \} satisfies StoredCart, CART_KEY\)/);
  assert.match(context, /setCart\(stored\.cart\);\s*setPromoCode\(stored\.promoCode\);\s*setCartHydrated\(true\);/);
  assert.match(context, /isStoredPromoCode\(stored\.promoCode\) \? stored\.promoCode : null/);
  assert.match(context, /\[cart, promoCode, cartHydrated\]/);
});

test("TB-6: a stored code is rechecked once after hydration and shown only when kept", () => {
  assert.match(code, /if \(!cartHydrated \|\| restoreStarted\.current\) return;/);
  assert.match(code, /revalidateStoredPromoCode\(\{\s*stored: promoCode,\s*lines: cartLineItems,\s*subtotal,\s*validate: validateCoupon,\s*\}\)/);
  assert.match(code, /if \(restored\.kind === "kept"\) \{\s*setAppliedCode\(restored\.code\);\s*setCodeNewSubtotal\(restored\.newSubtotal\);/);
  assert.match(code, /restored\.kind === "dropped"\) \{\s*setPromoCode\(null\);\s*setCodeError\(PROMO_CODE_DROPPED_COPY\);/);
  assert.match(code, /if \(linesKeyRef\.current !== startedKey\) return;/, "a late answer cannot revive a dropped code");
});

test("TB-6: the stored code is written only on a successful apply and cleared on every other path", () => {
  assert.equal((code.match(/setPromoCode\(\{ code, linesKey \}\)/g) ?? []).length, 1);
  assert.match(code, /setAppliedCode\(code\);\s*setPromoCode\(\{ code, linesKey \}\);/);
  // no-effect, invalid, failed apply, remove, failed checkout, dropped, discard, cart change
  assert.ok((code.match(/setPromoCode\(null\)/g) ?? []).length >= 8);
  assert.match(code, /if \(promoCode && promoCode\.linesKey !== linesKey\) setPromoCode\(null\);/);
});

test("QA-W2-1: the bag caps quantity at stock, disables + at the cap, and handles a stock refusal", () => {
  assert.match(code, /quantity: capQuantity\(nextQty, next\[productId\]\.stock\)/);
  assert.match(code, /\(typeof item\.stock === "number" && \(item\.quantity \|\| 0\) >= item\.stock\)/);
  assert.match(
    code,
    /if \(err instanceof CheckoutStockError\) \{\s*const \{ cart: adjusted, changed \} = err\.items\s*\? applyShortStock\(cart \|\| \{\}, err\.items\)\s*: clampCartToStock\(cart \|\| \{\}\);\s*if \(changed\.length > 0\) setCart\(adjusted\);\s*setStockNotice\(stockAdjustedMessage\(changed\)\);\s*return;/,
  );
  // The stock branch runs before the branch that clears the promo code.
  const stockAt = code.indexOf("err instanceof CheckoutStockError");
  const clearCodeAt = code.search(/setCodeError\(\s*err instanceof Error/);
  assert.ok(stockAt > -1 && clearCodeAt > -1 && stockAt < clearCodeAt, "stock refusal handled first");
});

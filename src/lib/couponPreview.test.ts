import { test } from "node:test";
import assert from "node:assert/strict";
import { couponPreviewDiscount, COUPON_NO_EFFECT_COPY } from "./couponPreview.ts";

test("ALLOW: a code that lowers the total previews the drop, cents to dollars", () => {
  assert.equal(couponPreviewDiscount(4500, 50), 5);
  assert.equal(couponPreviewDiscount(0, 50), 50, "a 100% code takes the whole bag");
});

test("REFUSE (RW3-4): a valid code that leaves the total unchanged previews nothing", () => {
  assert.equal(couponPreviewDiscount(5000, 50), 0, "same total");
  assert.equal(couponPreviewDiscount(5100, 50), 0, "never a negative discount");
});

test("REFUSE: a missing or unreadable new subtotal previews nothing", () => {
  for (const v of [undefined, null, "4500", Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(couponPreviewDiscount(v, 50), 0, String(v));
  }
  assert.equal(couponPreviewDiscount(0, 0), 0, "an empty bag has nothing to take off");
});

test("never more than the bag", () => {
  assert.equal(couponPreviewDiscount(-1000, 50), 50);
});

test("the no-effect line is plain owner-visible copy with no dashes", () => {
  assert.equal(
    COUPON_NO_EFFECT_COPY,
    "This code would not lower your total. A sale price on these items may already save you more.",
  );
  assert.doesNotMatch(COUPON_NO_EFFECT_COPY, /[–—]/);
});

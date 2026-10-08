import { test } from "node:test";
import assert from "node:assert/strict";
import { isConfirmedOrderAnswer, isOrderConfirmationId } from "./orderConfirmationId.ts";

test("ALLOW: a Stripe Checkout Session id", () => {
  assert.equal(isOrderConfirmationId("cs_test_a1B2c3_D4"), true);
});

test("ALLOW: a Square order id (Square buyers now get their receipt)", () => {
  assert.equal(isOrderConfirmationId("pFJ7SghUInV8DZjJNwmVHj5iTMSZY"), true);
  assert.equal(isOrderConfirmationId("CAISENgvlJ6jLWAzERDzjyHVybY"), true);
});

test("REFUSE: anything that could reshape an upstream path, or is not an id at all", () => {
  for (const bad of [
    "", "short", "../../v2/orders", "abc/def/ghi/jkl", "has spaces in it ok", "cs_bad-dash",
    "a".repeat(65), "cs_", `cs_${"a".repeat(241)}`, 42, null, undefined, { id: "cs_x" },
  ]) {
    assert.equal(isOrderConfirmationId(bad), false, JSON.stringify(bad));
  }
});

test("ALLOW (RW5): upstream confirms an order it found paid, mailed now or before", () => {
  assert.equal(isConfirmedOrderAnswer({ success: true, data: { sent: true } }), true);
  assert.equal(isConfirmedOrderAnswer({ success: true, data: { sent: false, reason: "already-sent" } }), true);
});

test("REFUSE (RW5): unpaid, unsupported, unknown, or unreadable is not a confirmation", () => {
  for (const body of [
    { success: true, data: { sent: false, reason: "not-paid" } },
    { success: true, data: { sent: false, reason: "provider-not-supported" } },
    { success: false, data: null, error: "That order could not be found." },
    { success: true, data: { sent: "true" } },
    { sent: true },
    { reason: "already-sent" },
    null, undefined, "already-sent", 42, [],
  ]) {
    assert.equal(isConfirmedOrderAnswer(body), false, JSON.stringify(body));
  }
});

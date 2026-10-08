import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isConfirmedOrderAnswer,
  isOrderCheck,
  isOrderConfirmationId,
  orderCheckFromAnswer,
  orderCheckFromRefusal,
} from "./orderConfirmationId.ts";

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

test("(a) TB-5 final pass: an upstream confirmation is `confirmed`", () => {
  assert.equal(orderCheckFromAnswer({ success: true, data: { sent: true } }), "confirmed");
  assert.equal(orderCheckFromAnswer({ success: true, data: { sent: false, reason: "already-sent" } }), "confirmed");
});

test("(c): only `not-paid` and a 404 are a positive no, for Stripe and Square alike", () => {
  // VR_Client_API answers both providers' unpaid orders with `not-paid`, and
  // an unknown id, another location's order, or the other provider's shape with 404.
  assert.equal(orderCheckFromAnswer({ success: true, data: { sent: false, reason: "not-paid" } }), "no-paid-order");
  assert.equal(orderCheckFromRefusal(404), "no-paid-order");
});

test("REFUSE (b): an unsupported provider, an unreadable answer, or any other refusal is `unverified`", () => {
  for (const body of [
    { success: true, data: { sent: false, reason: "provider-not-supported" } },
    { success: true, data: { sent: false } },
    { success: true, data: { sent: false, reason: "NOT-PAID" } },
    { reason: "not-paid" },
    null, undefined, "not-paid", 42, [],
  ]) {
    assert.equal(orderCheckFromAnswer(body), "unverified", JSON.stringify(body));
  }
  for (const status of [400, 401, 403, 409, 429, 500, 502, 503, 504]) {
    assert.equal(orderCheckFromRefusal(status), "unverified", String(status));
  }
});

test("isOrderCheck accepts exactly the three outcomes", () => {
  for (const ok of ["confirmed", "no-paid-order", "unverified"]) assert.equal(isOrderCheck(ok), true, ok);
  for (const bad of ["Confirmed", "unconfirmed", "", null, undefined, true, 1]) assert.equal(isOrderCheck(bad), false, String(bad));
});

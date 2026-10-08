import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isConfirmedOrderAnswer,
  isOrderCheck,
  isOrderConfirmationId,
  orderCheckFromAnswer,
  orderCheckFromRefusal,
  ORDER_NOT_FOUND_ERROR,
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

// What VR_Client_API (fix/checkout-variant-label, sendOrderPlacedEmail.js,
// fetchPaidOrder.js, fetchPaidSquareOrder.js) answers for each provider state,
// and what the success page may say about it.
const NOT_PAID = { success: true, data: { sent: false, reason: "not-paid" } };
const orderNotFound = { success: false, data: null, error: "That order could not be found." };
const siteNotFound = { success: false, data: null, error: "That site could not be found." };

test("(c) ALLOW: only a 404 saying the ORDER is not found is a positive no, Stripe and Square", () => {
  // Stripe: an unknown session (Stripe 404), or a Square id on a Stripe store.
  // Square: an unknown order, another location's order, or a `cs_` id.
  assert.equal(orderCheckFromRefusal(404, orderNotFound), "no-paid-order");
  assert.equal(ORDER_NOT_FOUND_ERROR, orderNotFound.error, "the sentence upstream writes");
});

test("REFUSE: an existing order not paid yet is `unverified`, never a positive no", () => {
  // Every one of these reaches the page as a 200 `not-paid`:
  //   Stripe: session open (buyer still on Checkout), session complete with
  //     payment_status `unpaid` (a bank payment still processing), expired.
  //   Square: order OPEN (approved but not captured, or pending), DRAFT,
  //     CANCELED. Upstream does not say which, so none may read as missing.
  for (const provider of ["stripe open", "stripe processing", "stripe expired", "square OPEN", "square pending", "square CANCELED"]) {
    assert.equal(orderCheckFromAnswer(NOT_PAID), "unverified", provider);
  }
});

test("REFUSE: a configuration fault is `unverified`, never a positive no", () => {
  assert.equal(orderCheckFromRefusal(404, siteNotFound), "unverified", "misconfigured SITE_ID");
  assert.equal(orderCheckFromRefusal(404, { message: "Not Found" }), "unverified", "API Gateway 404, wrong API URL");
  assert.equal(orderCheckFromRefusal(404, null), "unverified", "an HTML 404 page, unparseable");
  assert.equal(orderCheckFromRefusal(400, { success: false, error: "No active Stripe integration found for this group" }), "unverified");
  assert.equal(orderCheckFromRefusal(400, { success: false, error: "No active Square integration found for this group" }), "unverified");
  assert.equal(orderCheckFromAnswer({ success: true, data: { sent: false, reason: "provider-not-supported" } }), "unverified");
});

test("REFUSE: the order-not-found sentence on any status but 404, or reworded, is `unverified`", () => {
  for (const status of [400, 401, 403, 409, 429, 500, 502, 503, 504]) {
    assert.equal(orderCheckFromRefusal(status, orderNotFound), "unverified", String(status));
  }
  for (const error of ["That order could not be found", "that order could not be found.", " That order could not be found.", "Order not found"]) {
    assert.equal(orderCheckFromRefusal(404, { success: false, error }), "unverified", error);
  }
  for (const body of [undefined, "That order could not be found.", 42, [], { data: { error: orderNotFound.error } }]) {
    assert.equal(orderCheckFromRefusal(404, body), "unverified", JSON.stringify(body));
  }
});

test("REFUSE (b): an unreadable 2xx answer is `unverified`", () => {
  for (const body of [{ success: true, data: { sent: false } }, { reason: "not-paid" }, null, undefined, "not-paid", 42, []]) {
    assert.equal(orderCheckFromAnswer(body), "unverified", JSON.stringify(body));
  }
});

test("isOrderCheck accepts exactly the three outcomes", () => {
  for (const ok of ["confirmed", "no-paid-order", "unverified"]) assert.equal(isOrderCheck(ok), true, ok);
  for (const bad of ["Confirmed", "unconfirmed", "", null, undefined, true, 1]) assert.equal(isOrderCheck(bad), false, String(bad));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { CHECKOUT_OUT_OF_STOCK, checkoutRefusal, checkoutSiteId } from "./checkoutRequest.ts";

/**
 * QA-W2-1: a stock refusal is told apart from every other failure. QA-W2-4: the
 * checkout carries this site's id so it is branded with the owner's business.
 */

const EM = String.fromCharCode(8212);
const EN = String.fromCharCode(8211);

test("REFUSE: checkout's two stock refusals map to the stock reason, never 'Refresh the page'", () => {
  for (const upstream of ["Not enough stock available", "This item is out of stock"]) {
    const refusal = checkoutRefusal(409, upstream);
    assert.equal(refusal.reason, CHECKOUT_OUT_OF_STOCK, upstream);
    assert.doesNotMatch(refusal.error, /refresh/i);
  }
});

test("ALLOW: every other failure keeps its generic sentence and no stock reason", () => {
  // A 409 with no `errorCode` (an older Client): nothing says why, so the bag
  // keeps the generic sentence. A `not_for_sale` 409 never reaches it (below).
  assert.deepEqual(checkoutRefusal(409, "This item cannot be bought online"), {
    error: "Something in your bag is no longer available. Refresh the page, then try again.",
  });
  assert.equal(checkoutRefusal(409, undefined).reason, undefined);
  assert.equal(checkoutRefusal(400, "Not enough stock available").reason, undefined, "only a 409 is a stock refusal");
  assert.match(checkoutRefusal(429, "x").error, /busy/);
  assert.match(checkoutRefusal(502, undefined).error, /just now/);
});

test("no refusal names a payment company or carries a dash", () => {
  for (const status of [400, 404, 409, 422, 429, 500, 502]) {
    for (const upstream of ["No active Stripe integration found for this group", "Not enough stock available"]) {
      const { error } = checkoutRefusal(status, upstream);
      assert.ok(!/stripe|square|integration|group/i.test(error), error);
      assert.ok(!error.includes(EM) && !error.includes(EN), error);
    }
  }
});

test("ALLOW (QA-W2-4): a real site id is sent, trimmed", () => {
  assert.equal(checkoutSiteId("6a8d1146a4e1b46a9083e668"), "6a8d1146a4e1b46a9083e668");
  assert.equal(checkoutSiteId(" 6A8D1146A4E1B46A9083E668 "), "6A8D1146A4E1B46A9083E668");
});

test("REFUSE (QA-W2-4): anything Client's validator would reject is left out, so checkout never 400s on it", () => {
  for (const bad of [undefined, null, "", "preview", "6a8d1146a4e1b46a9083e66", "6a8d1146a4e1b46a9083e668x", "zzzzzzzzzzzzzzzzzzzzzzzz"]) {
    assert.equal(checkoutSiteId(bad), undefined, String(bad));
  }
});

// Client #117: the over-stock 409 names the short lines.
const NAMED_409 = {
  success: false,
  data: null,
  error: "Not enough stock available",
  errorCode: "INSUFFICIENT_STOCK",
  items: [{ priceId: "price_small", available: 4 }, { priceId: "price_roll", available: 0 }],
};

test("ALLOW: a 409 with items carries exactly those lines to the bag", () => {
  const refusal = checkoutRefusal(409, NAMED_409.error, NAMED_409);
  assert.equal(refusal.reason, CHECKOUT_OUT_OF_STOCK);
  assert.deepEqual(refusal.items, NAMED_409.items);
});

test("REFUSE: a 409 without items (an older Client) or with malformed items still maps, with no items", () => {
  const older = checkoutRefusal(409, "Not enough stock available", { success: false, error: "Not enough stock available" });
  assert.equal(older.reason, CHECKOUT_OUT_OF_STOCK);
  assert.equal("items" in older, false);
  for (const items of [undefined, "x", [], [{ priceId: "", available: 1 }], [{ priceId: "p", available: -1 }], [{ priceId: "p", available: 1.5 }]]) {
    const refusal = checkoutRefusal(409, "Not enough stock available", { errorCode: "INSUFFICIENT_STOCK", items });
    assert.equal("items" in refusal, false, JSON.stringify(items));
  }
  assert.equal(checkoutRefusal(409, "anything", { errorCode: "INSUFFICIENT_STOCK" }).reason, CHECKOUT_OUT_OF_STOCK, "the code alone is enough");
});

test("REFUSE (review concern B): REQUEST_FAILED, and any unknown code, shows the generic failure with no stock reason", () => {
  for (const errorCode of ["REQUEST_FAILED", "SOMETHING_NEW", "insufficient_stock", undefined]) {
    const refusal = checkoutRefusal(409, "x", { success: false, error: "x", errorCode, items: [{ priceId: "p", available: 1 }] });
    assert.deepEqual(
      refusal,
      { error: "Something in your bag is no longer available. Refresh the page, then try again." },
      String(errorCode),
    );
  }
});

// FP2-06 and FP2-02: VR_Client_API 37454c9's recorded `not_for_sale` refusals
// (test/contracts/FP2-02/checkout-not-ready.json and
// F-C19/checkout-not-for-sale.json), copied byte for byte, plus F-C26's
// product-inactive sentence (`listCommerce.js` PRODUCT_INACTIVE_MESSAGE).
const NOT_READY_409 = {
  success: false,
  data: null,
  error: "This shop is not taking orders yet.",
  errorCode: "not_for_sale",
  ownerSafe: true,
  reason: "not_ready",
};
const PAUSED_409 = {
  success: false,
  data: null,
  error: "This item is not for sale right now. Take it out of your bag, then check out the rest.",
  errorCode: "not_for_sale",
  ownerSafe: true,
};
// W1 (D11): VR_Client_API's product-inactive refusal used to say "The shop has
// been told", a promise it could not keep. C1 (PR #128) sends the paused-list
// sentence instead, so the retired one is no longer on the closed list.
const RETIRED_INACTIVE_409 = { ...PAUSED_409, error: "This item is not available right now. The shop has been told." };

test("ALLOW (FP2-02): a shop that cannot take orders yet says so", () => {
  assert.deepEqual(checkoutRefusal(409, NOT_READY_409.error, NOT_READY_409), { error: "This shop is not taking orders yet." });
});

test("ALLOW (FP2-06): each not_for_sale sentence the server wrote for shoppers is shown as written", () => {
  assert.deepEqual(checkoutRefusal(409, PAUSED_409.error, PAUSED_409), { error: "This item is not for sale right now. Take it out of your bag, then check out the rest." });
});

test("REFUSE (W1, D11): the retired 'the shop has been told' sentence is never shown, even marked ownerSafe", () => {
  const refusal = checkoutRefusal(409, RETIRED_INACTIVE_409.error, RETIRED_INACTIVE_409);
  assert.doesNotMatch(refusal.error, /has been told/i);
  assert.deepEqual(refusal, { error: "This item is not for sale right now. Take it out of your bag, then check out the rest." });
});

test("REFUSE (FP2-06): no not_for_sale 409 ever says Refresh, and none carries the stock reason", () => {
  const bodies = [
    NOT_READY_409,
    PAUSED_409,
    RETIRED_INACTIVE_409,
    { errorCode: "not_for_sale" },
    { errorCode: "not_for_sale", error: "No active Stripe integration found for this group", ownerSafe: true },
    { errorCode: "not_for_sale", reason: "not_ready" },
  ];
  for (const body of bodies) {
    // Cast: the union of literal bodies above does not all declare `error`.
    const refusal = checkoutRefusal(409, (body as { error?: string }).error, body);
    assert.doesNotMatch(refusal.error, /refresh/i, JSON.stringify(body));
    assert.equal(refusal.reason, undefined, JSON.stringify(body));
  }
});

test("REFUSE (FP2-06): upstream text off the closed list, or not marked ownerSafe, is never echoed", () => {
  const leak = "No active Stripe integration found for this group";
  assert.deepEqual(checkoutRefusal(409, leak, { errorCode: "not_for_sale", ownerSafe: true, error: leak }), {
    error: "This item is not for sale right now. Take it out of your bag, then check out the rest.",
  });
  // A listed sentence without ownerSafe reads as the generic not_for_sale one.
  assert.deepEqual(checkoutRefusal(409, NOT_READY_409.error, { ...NOT_READY_409, reason: undefined, ownerSafe: undefined }), {
    error: "This item is not for sale right now. Take it out of your bag, then check out the rest.",
  });
  // An unknown reason does not borrow the shop sentence.
  assert.deepEqual(checkoutRefusal(409, "x", { ...PAUSED_409, reason: "something_else" }), {
    error: "This item is not for sale right now. Take it out of your bag, then check out the rest.",
  });
});

test("REFUSE (FP2-06): only a 409 reads not_for_sale; other statuses keep their own sentence", () => {
  assert.match(checkoutRefusal(422, NOT_READY_409.error, NOT_READY_409).error, /Refresh the page/);
  assert.match(checkoutRefusal(502, NOT_READY_409.error, NOT_READY_409).error, /just now/);
  assert.equal(checkoutRefusal(409, "x", "not_for_sale").error.includes("Refresh"), true, "a non-object body is not a code");
});

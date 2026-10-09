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

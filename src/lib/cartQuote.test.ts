import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bagTotals,
  isCartQuoteRequestLine,
  linePrice,
  parseCartQuote,
  quoteRaisedAPrice,
  SALE_ENDED_COPY,
  type CartQuote,
} from "./cartQuote.ts";
import { couponPreviewDiscount } from "./couponPreview.ts";

/**
 * F4 (storefront task T2, SF2): the bag shows the sale price from the live
 * quote and never shows less than checkout charges. Every test calls the same
 * functions CartDialog renders from.
 */

const quote = (...lines: Array<Record<string, unknown>>): CartQuote => {
  const parsed = parseCartQuote({ lines });
  assert.ok(parsed, "fixture quote parsed");
  return parsed;
};

const item = (priceID: string, price: string, quantity = 1) => ({ priceID, price, quantity });

test("REFUSE (review-3 BLOCK 5): a $10 item on a 10% sale with a 20% code shows $8.00, never $7.00", () => {
  const bag = [item("price_10", "$10.00")];
  const q = quote({ priceId: "price_10", unitCents: 1000, saleUnitCents: 900, saleName: null });
  // validateCoupon: the code wins the line, so newSubtotal is list less 20%.
  const totals = bagTotals(bag, q, 800);
  assert.equal(totals.subtotal, 9);
  assert.equal(totals.total, 8, "what checkout charges");
  assert.notEqual(totals.total, 7);
  // Control: the literal reading the review refused (the list based preview
  // taken off the quoted subtotal) really does produce $7.00.
  assert.equal(totals.subtotal - couponPreviewDiscount(800, 10), 7);
});

test("ALLOW: a running 15% sale on $4.99 shows $4.24, the struck $4.99 and the name", () => {
  const q = quote({ priceId: "price_mug", unitCents: 499, saleUnitCents: 424, saleName: "Spring sale" });
  assert.deepEqual(linePrice(item("price_mug", "$4.99"), q), { unit: 4.24, was: 4.99, saleName: "Spring sale" });
  assert.equal(bagTotals([item("price_mug", "$4.99", 2)], q, null).total, 8.48);
});

test("REFUSE: a sale that ends early never shows a total below the charge, and is announced", () => {
  const bag = [item("price_mug", "$4.99")];
  const shown = quote({ priceId: "price_mug", unitCents: 499, saleUnitCents: 424, saleName: "Spring sale" });
  const ended = quote({ priceId: "price_mug", unitCents: 499, saleUnitCents: null, saleName: null });

  assert.equal(quoteRaisedAPrice(shown, ended), true, "Checkout waits for a second press");
  assert.equal(bagTotals(bag, ended, null).total, 4.99, "full price, the charge");
  assert.deepEqual(linePrice(bag[0], ended), { unit: 4.99, was: null, saleName: null });
  assert.equal(SALE_ENDED_COPY, "A sale just ended. Prices are updated.");
});

test("ALLOW: the second press proceeds, because the shown quote is now the current one", () => {
  const ended = quote({ priceId: "price_mug", unitCents: 499, saleUnitCents: null, saleName: null });
  assert.equal(quoteRaisedAPrice(ended, ended), false);
});

test("REFUSE: a failed quote shows list prices, never a sale, and is not a sale ending", () => {
  const shown = quote({ priceId: "price_mug", unitCents: 499, saleUnitCents: 424, saleName: "Spring sale" });
  for (const raw of [null, undefined, "oops", {}, { lines: "x" }, { error: "Prices could not be checked" }]) {
    const failed = parseCartQuote(raw);
    assert.equal(failed, null, JSON.stringify(raw));
    assert.deepEqual(linePrice(item("price_mug", "$4.99"), failed), { unit: 4.99, was: null, saleName: null });
    assert.equal(quoteRaisedAPrice(shown, failed), false);
  }
});

test("REFUSE: a line saved before the deploy prices as today until it is quoted", () => {
  const saved = item("price_old", "$24.99", 2);
  assert.deepEqual(linePrice(saved, null), { unit: 24.99, was: null, saleName: null });
  assert.equal(bagTotals([saved], null, null).total, 49.98);
  // A quote that leaves the line out (no product carries it) also keeps list.
  const other = quote({ priceId: "price_new", unitCents: 100, saleUnitCents: null, saleName: null });
  assert.equal(linePrice(saved, other).unit, 24.99);
});

test("ALLOW: a code worse than the sale takes nothing off, so the total is the quoted one", () => {
  const q = quote({ priceId: "price_10", unitCents: 1000, saleUnitCents: 700, saleName: "Big sale" });
  // The sale wins the line, so validateCoupon's newSubtotal is the list subtotal.
  assert.deepEqual(bagTotals([item("price_10", "$10.00")], q, 1000), { subtotal: 7, discount: 0, total: 7 });
});

test("ALLOW: a price that drops is not a sale ending; a line new to the quote is not either", () => {
  const before = quote({ priceId: "a", unitCents: 500, saleUnitCents: null, saleName: null });
  const after = quote(
    { priceId: "a", unitCents: 500, saleUnitCents: 400, saleName: null },
    { priceId: "b", unitCents: 900, saleUnitCents: null, saleName: null },
  );
  assert.equal(quoteRaisedAPrice(before, after), false);
  assert.equal(quoteRaisedAPrice(null, after), false, "the first quote never announces anything");
});

test("parse: saleUnitCents 0 is a real sale at zero; null means no sale", () => {
  const q = quote(
    { priceId: "free", unitCents: 1500, saleUnitCents: 0, saleName: "Giveaway" },
    { priceId: "full", unitCents: 1500, saleUnitCents: null, saleName: null },
  );
  assert.deepEqual(linePrice(item("free", "$15"), q), { unit: 0, was: 15, saleName: "Giveaway" });
  assert.deepEqual(linePrice(item("full", "$15"), q), { unit: 15, was: null, saleName: null });
});

test("REFUSE parse: a malformed line is dropped to list price, never trusted", () => {
  const q = quote(
    { priceId: "above", unitCents: 500, saleUnitCents: 600, saleName: "Fake" },
    { priceId: "float", unitCents: 4.99, saleUnitCents: null, saleName: null },
    { priceId: "neg", unitCents: -1, saleUnitCents: null, saleName: null },
    { priceId: "", unitCents: 500, saleUnitCents: null, saleName: null },
    { priceId: "name", unitCents: 500, saleUnitCents: 400, saleName: 7 },
    { priceId: "ok", unitCents: 500, saleUnitCents: 400, saleName: "   " },
  );
  assert.deepEqual([...q.keys()], ["ok"]);
  assert.equal(q.get("ok")?.saleName, null, "a blank name is no name");
  assert.equal(linePrice(item("above", "$5"), q).unit, 5);
});

test("the request line check: ALLOW the validateCoupon shape, REFUSE anything else", () => {
  assert.equal(isCartQuoteRequestLine({ price: "price_1", quantity: 2 }), true);
  for (const bad of [null, {}, { price: "", quantity: 1 }, { price: "p", quantity: 0 }, { price: "p", quantity: 1.5 }, { price: 1, quantity: 1 }]) {
    assert.equal(isCartQuoteRequestLine(bad), false, JSON.stringify(bad));
  }
});

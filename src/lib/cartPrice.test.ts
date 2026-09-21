import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCartPrice,
  cartUnitPrice,
  cartLineTotal,
  cartSubtotal,
} from "./cartPrice.ts";

/**
 * The exact expression H34 replaced, kept here as the CONTROL. Every case in
 * SYMBOL_BEARING has to come back 0 from this and non-zero from the new code,
 * otherwise the test is passing on prices that never had the defect.
 */
const oldBehaviour = (price: unknown, qty: number) => (Number(price) || 0) * qty;

/** Prices an owner really types into the CMS price field. */
const SYMBOL_BEARING: Array<[string, number]> = [
  ["$24.99", 24.99],
  ["$18", 18],
  ["$1,299.00", 1299],
  ["24.99 USD", 24.99],
  ["USD 40", 40],
  [" $7.50 ", 7.5],
  ["$0.99", 0.99],
  ["12.00/lb", 12],
];

test("H34: a symbol-bearing price is a real number, not zero", () => {
  for (const [input, expected] of SYMBOL_BEARING) {
    assert.equal(parseCartPrice(input), expected, input);
  }
});

test("H34 control: every one of those cases really was zero before the fix", () => {
  assert.ok(SYMBOL_BEARING.length >= 8, "built the table");
  for (const [input] of SYMBOL_BEARING) {
    assert.equal(
      oldBehaviour(input, 1),
      0,
      `${input} was already parsing correctly, so it does not prove H34`,
    );
  }
});

test("plain numeric strings and numbers still parse (no regression)", () => {
  assert.equal(parseCartPrice("18"), 18);
  assert.equal(parseCartPrice("18.00"), 18);
  assert.equal(parseCartPrice(42), 42);
  assert.equal(parseCartPrice(0), 0);
  assert.equal(parseCartPrice(-5), -5);
});

test("a price with no number in it is undefined, never a silent zero", () => {
  for (const input of ["", "   ", "Free", "Call for pricing", "$", "-", ".", "$-"]) {
    assert.equal(parseCartPrice(input), undefined, JSON.stringify(input));
  }
  for (const input of [null, undefined, {}, [], true, NaN, Infinity]) {
    assert.equal(parseCartPrice(input), undefined, String(input));
  }
});

test("a range or any other unparseable numeric soup is undefined", () => {
  assert.equal(parseCartPrice("18-20"), undefined);
  assert.equal(parseCartPrice("1.2.3"), undefined);
});

test("cartUnitPrice resolves the legacy variant-to-price map", () => {
  const line = { price: { small: "$4.00", large: "$6.50" }, variant: "large", quantity: 1 };
  assert.equal(cartUnitPrice(line), 6.5);
  assert.equal(cartUnitPrice({ price: { small: "$4.00" }, variant: "missing" }), 0);
  // A map with no variant chosen cannot be priced, and must not throw.
  assert.equal(cartUnitPrice({ price: { small: "$4.00" }, variant: null }), 0);
});

test("cartUnitPrice is zero, not NaN, when a price is unreadable", () => {
  assert.equal(cartUnitPrice({ price: "Free", variant: "default" }), 0);
  assert.equal(cartUnitPrice(null), 0);
  assert.equal(cartUnitPrice(undefined), 0);
});

test("cartLineTotal multiplies by quantity and never returns NaN", () => {
  assert.equal(cartLineTotal({ price: "$24.99", variant: "default", quantity: 2 }), 49.98);
  assert.equal(cartLineTotal({ price: "$24.99", variant: "default", quantity: 0 }), 0);
  // A bag line persisted without a quantity must not poison the subtotal.
  assert.equal(cartLineTotal({ price: "$24.99", variant: "default" }), 0);
  assert.equal(cartLineTotal({ price: "$24.99", variant: "default", quantity: NaN }), 0);
  assert.equal(cartLineTotal({ price: "$24.99", variant: "default", quantity: null }), 0);
});

test("cartSubtotal sums a mixed bag, and one bad line cannot zero the rest", () => {
  const bag = [
    { price: "$24.99", variant: "default", quantity: 2 },
    { price: "$1,299.00", variant: "default", quantity: 1 },
    { price: "Call for pricing", variant: "default", quantity: 3 },
  ];
  assert.equal(cartSubtotal(bag), 49.98 + 1299);
  assert.equal(cartSubtotal([]), 0);
  // The control: the old expression made this whole bag $0.00.
  assert.equal(
    bag.reduce((a, l) => a + oldBehaviour(l.price, l.quantity), 0),
    0,
  );
});

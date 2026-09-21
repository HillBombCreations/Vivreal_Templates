import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCartPrice } from "./cartPrice.ts";
// The renderer's compiled parser, imported by PATH: the package's exports map
// publishes only the barrel, and the barrel pulls `next/link`, which plain Node
// cannot resolve (the storefrontConfig.parity.test.ts precedent). `sale.js` has
// no imports of its own, so it loads standalone.
import { parsePrice } from "../../node_modules/@hillbombcreations/site-renderer/dist/lib/sale.js";

/**
 * H34 closed by MIRRORING the renderer's `parsePrice` rather than importing it.
 * A mirror is only safe while it agrees, so this runs both over one table. If
 * the renderer's parser changes, this goes red here instead of splitting the
 * price a product card shows from the price the bag totals.
 */
const CASES: unknown[] = [
  // The H34 shapes.
  "$24.99", "$18", "$1,299.00", "24.99 USD", "USD 40", " $7.50 ", "$0.99", "12.00/lb",
  // Plain.
  "18", "18.00", "0", "-5", 42, 0, -5, 0.1,
  // Nothing parseable.
  "", "   ", "Free", "Call for pricing", "$", "-", ".", "$-", "--",
  // Numeric soup.
  "18-20", "1.2.3", "1,2,3",
  // Non-strings.
  null, undefined, {}, [], true, false, NaN, Infinity, -Infinity,
  // Separators and symbols from other locales.
  "£18.50", "€24.99", "¥1800", "18,50",
];

test("the bag's price parser agrees with the renderer's, case for case", () => {
  assert.ok(CASES.length >= 40, "built the table");
  for (const input of CASES) {
    assert.equal(
      parseCartPrice(input),
      parsePrice(input),
      `disagreed on ${JSON.stringify(input)}`,
    );
  }
});

test("the parity is not vacuous: most cases parse to a real number", () => {
  const parsed = CASES.filter((c) => parsePrice(c) !== undefined);
  assert.ok(
    parsed.length >= 15,
    `only ${parsed.length} cases produced a number, so agreement proves little`,
  );
});

test("the parity check can actually fail", () => {
  // A deliberately wrong parser must be caught by the same comparison, so a
  // green parity run means agreement rather than a comparison that never runs.
  const wrong = (v: unknown) => (typeof v === "string" ? Number(v) : parsePrice(v));
  const disagreements = CASES.filter((c) => {
    const a = wrong(c);
    const b = parsePrice(c);
    return !(Object.is(a, b) || (a === undefined && b === undefined));
  });
  assert.ok(disagreements.length > 0, "the comparison cannot detect a wrong parser");
});

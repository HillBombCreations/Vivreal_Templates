import { test } from "node:test";
import assert from "node:assert/strict";
import { readLowStockThreshold } from "./transformProduct.ts";
// The site engine's REAL reader, by relative path on purpose: the package entry
// imports `next/link`, which plain node cannot load (see transformProduct.ts).
import { readLowStockThreshold as engineReadLowStockThreshold } from "../../../../node_modules/@hillbombcreations/site-renderer/dist/lib/stock.js";

// F417 (release C, SW-C15): transformProduct's local copy of the site engine's
// threshold reader must agree with the engine's own, or the product page and
// the shop cards judge a size differently, which is the defect this row fixes.
test("F417 parity: this reader agrees with the site engine's own, case by case", () => {
  const cases: unknown[] = [
    undefined, null, 0, 3, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY, "5", "", true, [], [1],
    {}, { Small: 2 }, { Small: 2, Large: 10 }, { Small: "2" }, { Small: 2, Large: "x" }, { Small: Number.NaN }, { a: 0 },
  ];
  for (const value of cases) {
    assert.deepEqual(readLowStockThreshold(value), engineReadLowStockThreshold(value as never), `${JSON.stringify(value)}`); // the engine's JS takes any value
  }
});

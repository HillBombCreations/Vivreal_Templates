/**
 * F526 seasonal (release C; `design-seasonal-products.md` 6.4, test T12, walk
 * W4): when checkout refuses a line as no longer sold (out of season, or taken
 * off the site), the bag keeps the line, marked with "Remove from bag", but its
 * total leaves the line out at once and says so. Before, the total counted it
 * until the shopper removed it.
 *
 * The rule is read through the module namespace, so at a base without it each
 * row fails on its own assertion rather than the file failing to load. The
 * dialog is a `use client` module, read as comment-stripped source.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as cartStock from "./cartStock.ts";
import { bagTotals, type QuotableItem } from "./cartQuote.ts";
import { stripComments } from "./source/stripComments.ts";

type Rule = {
  linesCounted: <T extends { priceID?: string }>(items: readonly T[], refused: readonly string[]) => T[];
  withoutRefusedLine: (names: readonly string[]) => string | null;
};

function rule(): Rule {
  const ns = cartStock as unknown as Record<string, unknown>; // named exports, checked below
  for (const name of ["linesCounted", "withoutRefusedLine"]) assert.equal(typeof ns[name], "function", `cartStock exports ${name}`);
  return ns as unknown as Rule; // the two were just checked
}

const BAG: QuotableItem[] = [
  { priceID: "price_pumpkin", price: "$12.00", quantity: 1 },
  { priceID: "price_rye", price: "$8.00", quantity: 2 },
];

const dialog = stripComments(fs.readFileSync(new URL("../components/Navigation/CartDialog.tsx", import.meta.url), "utf8"));

test("REFUSE (F526 T12): a line checkout refused is left out of the total at once, and the bag says so", () => {
  const { linesCounted, withoutRefusedLine } = rule();
  assert.equal(bagTotals(BAG, null, null).total, 28, "control: the whole bag");
  assert.equal(bagTotals(linesCounted(BAG, ["price_pumpkin"]), null, null).total, 16, "the refused loaf is not in the total");
  assert.equal(withoutRefusedLine(["Pumpkin bread"]), "Without Pumpkin bread, which is no longer available.");
  assert.equal(withoutRefusedLine(["Pumpkin bread", "Rye"]), "Without Pumpkin bread and Rye, which are no longer available.");
  assert.equal(withoutRefusedLine(["A", "B", "C"]), "Without A, B and C, which are no longer available.");
  assert.match(dialog, /bagTotals\(linesCounted\(itemsArray, unavailable\?\.priceIds \?\? \[\]\), quote,/, "the dialog totals the counted lines");
  assert.match(dialog, /const totalLeavesOut = withoutRefusedLine\(unavailableNames\);/);
});

test("ALLOW (F526 T12): an accepted bag keeps its total and shows no Without line", () => {
  const { linesCounted, withoutRefusedLine } = rule();
  assert.deepEqual(linesCounted(BAG, []), BAG);
  assert.equal(bagTotals(linesCounted(BAG, []), null, null).total, 28);
  assert.equal(bagTotals(linesCounted(BAG, ["price_not_in_bag"]), null, null).total, 28, "a refusal naming no line of this bag changes nothing");
  assert.equal(withoutRefusedLine([]), null);
  for (const words of [withoutRefusedLine(["Pumpkin bread"]), withoutRefusedLine(["A", "B"])]) {
    assert.ok(words && !/[–—]/.test(words), "no dash reaches the shopper");
  }
});

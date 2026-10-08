import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cartLinesKey,
  isStoredPromoCode,
  revalidateStoredPromoCode,
  PROMO_CODE_DROPPED_COPY,
  type PromoLine,
  type PromoPreview,
} from "./promoCodeRestore.ts";

const LINES: PromoLine[] = [
  { price: "price_b", quantity: 2 },
  { price: "price_a", quantity: 1 },
];
const KEY = cartLinesKey(LINES);

async function restore(answer: PromoPreview | Error, opts: { lines?: PromoLine[]; linesKey?: string } = {}) {
  const asked: Array<{ code: string; lines: PromoLine[] }> = [];
  const result = await revalidateStoredPromoCode({
    stored: { code: "TBFIX", linesKey: opts.linesKey ?? KEY },
    lines: opts.lines ?? LINES,
    subtotal: 6,
    validate: async (code, lines) => {
      asked.push({ code, lines });
      if (answer instanceof Error) throw answer;
      return answer;
    },
  });
  return { result, asked };
}

test("the lines key ignores order and changes with any quantity or price", () => {
  assert.equal(KEY, cartLinesKey([...LINES].reverse()));
  assert.notEqual(KEY, cartLinesKey([{ price: "price_b", quantity: 3 }, { price: "price_a", quantity: 1 }]));
  assert.notEqual(KEY, cartLinesKey([{ price: "price_b", quantity: 2 }]));
  assert.equal(cartLinesKey([]), "");
});

test("ALLOW (TB-6): a still-valid code is kept after a reload, with its rechecked discount", async () => {
  const { result, asked } = await restore({ valid: true, newSubtotal: 300 });
  assert.deepEqual(result, { kind: "kept", code: "TBFIX", discount: 3 });
  assert.equal(asked.length, 1, "it asks VR_Client_API every load");
  assert.equal(asked[0].code, "TBFIX");
});

test("REFUSE: a code that is no longer valid is dropped", async () => {
  for (const reason of ["expired", "limit_reached", "not_found", "inactive", "min_subtotal", "scope_miss"]) {
    assert.deepEqual((await restore({ valid: false, reason })).result, { kind: "dropped" }, reason);
  }
});

test("REFUSE: a valid code that no longer takes anything off is dropped, never shown applied", async () => {
  assert.deepEqual((await restore({ valid: true, newSubtotal: 600 })).result, { kind: "dropped" });
  assert.deepEqual((await restore({ valid: true, newSubtotal: null })).result, { kind: "dropped" });
});

test("REFUSE: a bag that changed since the code was applied discards it without asking", async () => {
  const changed = await restore({ valid: true, newSubtotal: 300 }, { lines: [{ price: "price_a", quantity: 1 }] });
  assert.deepEqual(changed, { result: { kind: "discard" }, asked: [] });
  const emptied = await restore({ valid: true, newSubtotal: 300 }, { lines: [] });
  assert.deepEqual(emptied, { result: { kind: "discard" }, asked: [] });
});

test("a failed check is neither applied nor blamed on the code", async () => {
  assert.deepEqual((await restore(new Error("offline"))).result, { kind: "unchecked" });
  assert.deepEqual((await restore({ valid: false, reason: "error" })).result, { kind: "unchecked" });
});

test("the stored value is validated at the storage boundary", () => {
  assert.ok(isStoredPromoCode({ code: "TBFIX", linesKey: KEY }));
  for (const bad of [null, undefined, "TBFIX", {}, { code: "", linesKey: KEY }, { code: "  ", linesKey: KEY }, { code: "TBFIX" }, { code: "TBFIX", linesKey: "" }, { code: 1, linesKey: KEY }]) {
    assert.equal(isStoredPromoCode(bad), false, JSON.stringify(bad));
  }
});

test("the dropped line is short owner-visible copy with no dashes", () => {
  assert.equal(PROMO_CODE_DROPPED_COPY, "Your promo code no longer applies, so it was removed.");
  assert.doesNotMatch(PROMO_CODE_DROPPED_COPY, /[–—]/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { trackedStock, type StockProvider } from "./cartStock.ts";

/**
 * The shared tracked-stock table (#189 review concern C). The same file lives
 * byte for byte in VR_Client_API, which runs it against its own resolvers, so a
 * change to either side's rule fails that side's tests.
 */
interface StockCase {
  name: string;
  provider: StockProvider;
  objectValue: Record<string, unknown>;
  lineId: string;
  /** D-P9-5: the option the cart line names (the size the shopper picked), when the case names one. */
  option?: string;
  /** `null`: checkout finds no product for the line, so it is unavailable. */
  expected: { tracked: boolean; available: number | null } | null;
}

const raw = fs.readFileSync(new URL("../../test/fixtures/tracked-stock-cases.json", import.meta.url), "utf8");
const table = JSON.parse(raw) as { cases: StockCase[] }; // shape asserted just below

/**
 * VR_Client_API asserts the SAME hash of its copy, so the two files cannot drift
 * apart silently. Line endings are normalised first (this checkout writes CRLF).
 * Changing a case means changing it in both repos and both hashes together.
 */
// F385 (SW-B25 (2), release B): the sized plain-count case became "one shared
// count", a case for the other size was added, and `about` gained one sentence.
// F393 (SW-B25 amended, T-385S): the Square sized plain-count case became "one
// shared count" (tracked, available 0), and nothing else changed; Client pins
// the same hash at CL-STK4.
// D-P9-5 (release C, vivreal-hq design-dp95-per-size-stock.md S11): VR_Client_API
// owns the file; one `about` paragraph added, "stripe single-price, a size map is
// ignored" replaced by "no size named is unavailable", ten cases added, some
// naming the `option` the cart line sends. 21 cases became 31; Client pins the
// same hash (release-c/client `3555c68`).
const SHARED_TABLE_SHA256 = "f78fe0ac973a4b6773fb9648017c350c0e29b179e3c35ad4829595e096fc10d9";

test("the table is byte identical to Client's copy (sha256, LF line endings)", () => {
  const digest = createHash("sha256").update(raw.replace(/\r\n/g, "\n")).digest("hex");
  assert.equal(digest, SHARED_TABLE_SHA256);
});

test("the table is read and covers both providers and both verdicts", () => {
  assert.ok(table.cases.length >= 15, `only ${table.cases.length} cases`);
  assert.ok(table.cases.some((c) => c.expected === null), "an unavailable case is present");
  for (const provider of ["stripe", "square"]) {
    for (const tracked of [true, false]) {
      assert.ok(
        table.cases.some((c) => c.provider === provider && c.expected?.tracked === tracked),
        `${provider} has a ${tracked ? "tracked" : "untracked"} case`,
      );
    }
  }
});

/** D-P9-5 S1, written out here so the runner does not take the rule it checks from the code it checks. */
const isPlainObject = (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v);
const isShape = (c: StockCase) =>
  !isPlainObject(c.provider === "square" ? c.objectValue.price : c.objectValue.default_price) && isPlainObject(c.objectValue.stock);

test("[D-P9-5 T-1] the table holds 31 cases, and names an option both on the shape and on a product that ignores it", () => {
  assert.equal(table.cases.length, 31);
  assert.ok(table.cases.some((c) => c.option !== undefined && isShape(c)), "a case names a size of the shape");
  assert.ok(table.cases.some((c) => c.option !== undefined && !isShape(c)), "a case names a size another product ignores");
  assert.ok(table.cases.some((c) => c.option === undefined && isShape(c) && c.expected === null), "the shape with no size named is unavailable");
});

for (const c of table.cases) {
  test(`tracked-stock case: ${c.name}`, () => {
    assert.deepEqual(trackedStock(c.provider, c.objectValue, c.lineId, c.option), c.expected);
  });
}

test("control: a planted wrong expectation fails, so the loop is not inert", () => {
  // The case by its SW-B25 name (F385; backlog F390 note N3: never by the old
  // "a plain count is untracked", which no longer exists). The planted value is
  // today's old verdict, so a rule that slid back would equal it.
  const c = table.cases.find((x) => x.name === "stripe sized, a plain count is one shared count");
  assert.ok(c, "the shared-count case is found by its new name");
  assert.equal(table.cases.some((x) => x.name === "stripe sized, a plain count is untracked"), false, "the old case name is gone");
  assert.notDeepEqual(trackedStock(c.provider, c.objectValue, c.lineId), { tracked: false, available: null });
});

test("control (T-385S): the Square shared-count case is found by its new name, the old one is gone", () => {
  const c = table.cases.find((x) => x.name === "square sized, a plain count is one shared count");
  assert.ok(c, "the Square shared-count case is found by its new name");
  assert.equal(table.cases.some((x) => x.name === "square sized, a plain count is untracked"), false, "the old case name is gone");
  assert.notDeepEqual(trackedStock(c.provider, c.objectValue, c.lineId), { tracked: false, available: null });
});

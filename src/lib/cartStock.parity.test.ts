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
const SHARED_TABLE_SHA256 = "7b12b5f67b052fe88ef528809e6dac9aebeb595019ab4656adb4196a7bef7d7d";

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

for (const c of table.cases) {
  test(`tracked-stock case: ${c.name}`, () => {
    assert.deepEqual(trackedStock(c.provider, c.objectValue, c.lineId), c.expected);
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

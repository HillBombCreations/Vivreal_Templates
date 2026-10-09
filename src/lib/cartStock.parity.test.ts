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
const SHARED_TABLE_SHA256 = "7aed08184948601e335e7d686933c1f3b56ca210e73257522e7c0d9f9edc2a60";

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
  const c = table.cases.find((x) => x.name === "stripe sized, a plain count is untracked");
  assert.ok(c);
  assert.notDeepEqual(trackedStock(c.provider, c.objectValue, c.lineId), { tracked: true, available: 12 });
});

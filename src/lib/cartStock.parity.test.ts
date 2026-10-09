import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
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
  expected: { tracked: boolean; available: number | null };
}

const table = JSON.parse(
  fs.readFileSync(new URL("../../test/fixtures/tracked-stock-cases.json", import.meta.url), "utf8"),
) as { cases: StockCase[] }; // shape asserted just below

test("the table is read and covers both providers and both verdicts", () => {
  assert.ok(table.cases.length >= 15, `only ${table.cases.length} cases`);
  for (const provider of ["stripe", "square"]) {
    for (const tracked of [true, false]) {
      assert.ok(
        table.cases.some((c) => c.provider === provider && c.expected.tracked === tracked),
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

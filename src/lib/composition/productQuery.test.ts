import { test } from "node:test";
import assert from "node:assert/strict";
// Explicit .ts extension: runs directly under plain Node
// (`node --experimental-strip-types --test`, see package.json "test").
import { parseProductQuery } from "./productQuery.ts";

test("parseProductQuery: f_<key> params become filters keyed without the prefix", () => {
  const q = parseProductQuery({ f_category: "Merch", f_color: "blue" });
  assert.deepEqual(q.filters, { category: "Merch", color: "blue" });
});

test("parseProductQuery: search + sort pass through as strings", () => {
  const q = parseProductQuery({ search: "loaf", sort: "price-asc" });
  assert.equal(q.search, "loaf");
  assert.equal(q.sort, "price-asc");
});

test("parseProductQuery: array-valued and empty params are dropped", () => {
  // Next.js hands repeated params as arrays — the storefront contract is
  // single-valued; arrays and empty strings must not leak into the query.
  const q = parseProductQuery({
    f_category: ["a", "b"],
    f_empty: "",
    search: ["x"] as unknown as string,
    sort: undefined,
  });
  assert.deepEqual(q.filters, {});
  assert.equal(q.search, undefined);
  assert.equal(q.sort, undefined);
});

test("parseProductQuery: unrelated params are ignored", () => {
  const q = parseProductQuery({ view: "month", utm_source: "x", f_tag: "sale" });
  assert.deepEqual(q.filters, { tag: "sale" });
  assert.equal(q.search, undefined);
});

test("parseProductQuery: empty searchParams -> empty filters object (matches the old products-arm shape)", () => {
  // The pre-extraction products arm always produced `{ filters: {}, ... }` —
  // buildPageContext consumers rely on filters being an object, not undefined.
  const q = parseProductQuery({});
  assert.deepEqual(q.filters, {});
});

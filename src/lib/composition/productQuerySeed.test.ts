/**
 * F323 shop pages (release C, T-SH-2; vivreal-hq
 * docs/projects/next-release-C/design-f323-shop-pages.md 5): the storefront
 * controls are seeded from the query the route parsed and filtered by, not
 * from the address. The seed must equal what the server applied.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
// Explicit .ts extension: runs directly under plain Node
// (`node --experimental-strip-types --test`, see package.json "test").
import { seedForSearchParams, seedFromProductQuery } from "./productQuerySeed.ts";

/**
 * The oracle: the old hook's address loop (`useProductsLiveAdapters.ts:60-65`
 * at 776fd4b), over the request's query as the browser's address holds it
 * (a repeated key appended once per value).
 */
function oldHookSeed(sp: Record<string, string | string[] | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, val] of Object.entries(sp)) {
    if (val === undefined) continue;
    for (const v of Array.isArray(val) ? val : [val]) searchParams.append(key, v);
  }
  const initialFilters: Record<string, string> = {};
  for (const [key, val] of searchParams.entries()) {
    if (key.startsWith("f_") && val) initialFilters[key.slice(2)] = val;
  }
  const initialSearch = searchParams.get("search") ?? undefined;
  const initialSort = searchParams.get("sort") ?? undefined;
  return { initialFilters, initialSearch, initialSort };
}

test("ALLOW: a parsed query seeds exactly its filters, search and sort", () => {
  assert.deepEqual(seedFromProductQuery({ filters: { size: "L" }, search: "rye", sort: "price" }), {
    initialFilters: { size: "L" },
    initialSearch: "rye",
    initialSort: "price",
  });
});

test("ALLOW (parity): a single-valued request seeds what the old address loop seeded", () => {
  const sp = { f_size: "L", search: "rye", sort: "price", x: "1" };
  assert.deepEqual(seedForSearchParams(sp), oldHookSeed(sp));
});

test("REFUSE: a repeated filter key seeds no filter (the server applied none)", () => {
  assert.deepEqual(seedForSearchParams({ f_size: ["L", "M"] }).initialFilters, {});
});

test("REFUSE: a repeated search seeds no search (the server applied none)", () => {
  assert.equal(seedForSearchParams({ search: ["rye", "wheat"] }).initialSearch, undefined);
});

test("unchanged: no query and an empty query seed nothing", () => {
  const none = { initialFilters: {}, initialSearch: undefined, initialSort: undefined };
  assert.deepEqual(seedFromProductQuery(undefined), none);
  assert.deepEqual(seedFromProductQuery({}), none);
  assert.deepEqual(seedForSearchParams({}), none);
});

test("unchanged: `?f_=x` seeds the empty key, as parseProductQuery passes it to the server", () => {
  assert.deepEqual(seedForSearchParams({ f_: "x" }).initialFilters, { "": "x" });
});

test("the seed is a copy: changing it never changes the route's query", () => {
  const query = { filters: { size: "L" } };
  seedFromProductQuery(query).initialFilters.size = "M";
  assert.equal(query.filters.size, "L");
});

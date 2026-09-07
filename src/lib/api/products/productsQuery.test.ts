import { test } from "node:test";
import assert from "node:assert/strict";
// Explicit .ts extension: runs directly under plain Node
// (`node --experimental-strip-types --test`, see package.json "test"). Same
// reason as transformProduct.test.ts — `./index.ts` is `server-only`.
import { buildProductsQuery, PRODUCTS_FETCH_LIMIT } from "./productsQuery.ts";

/**
 * The product read used to send NO `limit`, so VR_Client_API applied its own
 * 20-row default (`services/tenant/getIntegrationObjects.js`). That truncated
 * every storefront over 20 products, and — because `getProductById` searches
 * only this window and there is no by-id read — it left product 21 with no
 * detail page at all.
 *
 * These fail on the pre-fix builder (no `limit` key at all) and pass after.
 */

test("the product read asks for an explicit window, not the server default", () => {
  const params = buildProductsQuery({ integrationType: "stripe" });
  // Guard: if the builder ever stops emitting `type`, the limit assertion below
  // would still be reading a real (empty) query and could pass by accident.
  assert.equal(params.get("type"), "stripe", "the query must still carry the integration type");
  assert.equal(params.get("limit"), String(PRODUCTS_FETCH_LIMIT));
});

test("the window is 100 — the VR_Client_API ceiling, and the window collections already use", () => {
  // buildPageContext asks for `limit: 100` per collection and the Studio
  // preview asks for 100 per integration. Anything smaller here is the
  // 20-vs-100 divergence coming back.
  assert.equal(PRODUCTS_FETCH_LIMIT, 100);
});

test("the limit rides along with filters, search and sort", () => {
  const params = buildProductsQuery({
    integrationType: "square",
    filters: { "filter-type": "bread", empty: "" },
    searchVal: "sour",
    sortVal: "price:asc",
  });
  assert.equal(params.get("type"), "square");
  assert.equal(params.get("limit"), "100");
  assert.equal(params.get("filters[filter-type]"), "bread");
  assert.equal(params.get("filters[empty]"), null, "blank filter values are still dropped");
  assert.equal(params.get("search"), "sour");
  assert.equal(params.get("sort"), "price:asc");
});

test("an omitted integration type still falls back to stripe", () => {
  const params = buildProductsQuery();
  assert.equal(params.get("type"), "stripe");
  assert.equal(params.get("limit"), "100");
});

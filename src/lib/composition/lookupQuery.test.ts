/**
 * src/lib/composition/lookupQuery.test.ts
 *
 * The one thread between the URL and the renderer's shipped search grammar.
 *
 * What actually breaks, in order:
 *   1. THE PARAM NAME. Hardcode `q` and a site that authored anything else
 *      renders its results page with the collection UNFILTERED at every URL —
 *      a search that always returns everything. HTTP 200, no error, no status
 *      check can see it. That is the failure this file exists to prevent, so
 *      it is pinned first.
 *   2. FORMAT GATING. Every non-lookup format must thread nothing, or the
 *      options object changes for the whole fleet.
 *   3. The binding it reads is the one the renderer FILTERS — the first that
 *      declares `queryFields`. Reading a different binding's `queryParam` is
 *      the same silent-unfiltered failure wearing a different hat.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readLookupQuery, lookupParamOf } from "./lookupQuery.ts";

const FIELDS = ["title", "description"];

const page = (bindings: unknown[], format = "lookup") => ({
  format,
  blocks: [{ config: { bindings } }],
});

/* ── 1. the param name comes from the page ─────────────────────────────────── */

test("the default is q, matching the renderer's own resolveLookup default", () => {
  assert.equal(lookupParamOf(page([{ sectionConfig: { queryFields: FIELDS } }])), "q");
  assert.equal(readLookupQuery({ q: "domains" }, page([{ sectionConfig: { queryFields: FIELDS } }])), "domains");
});

test("an authored queryParam is honoured, or the page silently returns everything", () => {
  const p = page([{ sectionConfig: { queryFields: FIELDS, queryParam: "search" } }]);
  assert.equal(lookupParamOf(p), "search");
  assert.equal(readLookupQuery({ search: "invoices" }, p), "invoices");
  // And the default is NOT also read: two live params would let a stale link
  // filter a page whose field submits under the other name.
  assert.equal(readLookupQuery({ q: "invoices" }, p), undefined);
});

test("a blank or non-string queryParam falls back rather than searching on ''", () => {
  for (const queryParam of ["", "   ", 7, null, {}]) {
    const p = page([{ sectionConfig: { queryFields: FIELDS, queryParam } }]);
    assert.equal(lookupParamOf(p), "q", `queryParam ${JSON.stringify(queryParam)} produced a bad name`);
  }
});

/* ── 2. every other format threads nothing ─────────────────────────────────── */

test("a non-lookup format reads no query at all", () => {
  for (const format of ["standard", "collection-list", "products", "about"]) {
    const p = page([{ sectionConfig: { queryFields: FIELDS } }], format);
    assert.equal(readLookupQuery({ q: "anything" }, p), undefined, `format '${format}' threaded a query`);
  }
  // Built literally rather than through the helper: its `format` parameter
  // DEFAULTS to 'lookup', so passing undefined through it tested the opposite
  // of what it claimed and passed for the wrong reason.
  assert.equal(
    readLookupQuery({ q: "anything" }, { blocks: [{ config: { bindings: [{ sectionConfig: { queryFields: FIELDS } }] } }] }),
    undefined,
    "a page with no format at all threaded a query",
  );
  assert.equal(readLookupQuery({ q: "anything" }, null), undefined);
  assert.equal(readLookupQuery({ q: "anything" }, undefined), undefined);
});

test("a lookup page with no query threads undefined, which is the landing state", () => {
  const p = page([{ sectionConfig: { queryFields: FIELDS } }]);
  assert.equal(readLookupQuery({}, p), undefined);
  // An EMPTY query is still a query: the reader submitted a blank field, and
  // the renderer trims it to '' and shows the whole collection. Dropping it to
  // undefined here would be the same outcome by accident rather than by rule.
  assert.equal(readLookupQuery({ q: "" }, p), "");
});

/* ── 3. the binding read is the binding filtered ───────────────────────────── */

test("the FIRST binding declaring queryFields wins, matching resolveLookup", () => {
  // A "related reading" rail before the results binding. The renderer skips it
  // (no queryFields), so this must skip it too or the two disagree about which
  // section the page is.
  const p = page([
    { sectionConfig: { queryParam: "rail" } },
    { sectionConfig: { queryFields: FIELDS, queryParam: "term" } },
  ]);
  assert.equal(lookupParamOf(p), "term");
});

test("a binding with an EMPTY queryFields is not the results binding", () => {
  const p = page([
    { sectionConfig: { queryFields: [], queryParam: "wrong" } },
    { sectionConfig: { queryFields: FIELDS, queryParam: "right" } },
  ]);
  assert.equal(lookupParamOf(p), "right");
});

test("a page with no bindings at all still resolves a name rather than throwing", () => {
  assert.equal(lookupParamOf({ format: "lookup", blocks: [] }), "q");
  assert.equal(lookupParamOf({ format: "lookup" }), "q");
  assert.equal(lookupParamOf({ format: "lookup", blocks: [null, { config: {} }] }), "q");
});

/* ── 4. a repeated param is one value, not a joined one ────────────────────── */

test("?q=a&q=b takes the first, never a string nobody typed", () => {
  const p = page([{ sectionConfig: { queryFields: FIELDS } }]);
  assert.equal(readLookupQuery({ q: ["domains", "billing"] }, p), "domains");
  assert.equal(readLookupQuery({ q: [] }, p), undefined);
});

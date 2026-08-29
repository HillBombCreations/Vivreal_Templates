import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * portal-simplification-pass B2.1/B2.2 — `route.ts` imports `next/server`, so
 * `node --test` cannot load it directly (same tradeoff as page.test.ts and
 * llmsTxtProxy.test.ts's header). This file pins the wiring a running Next
 * server would otherwise be needed to exercise: the route exists at the spec
 * location (https://llmstxt.org/), carries `runtime = 'edge'` AND
 * `dynamic = 'force-dynamic'` — the content is per-tenant and dynamic, so
 * without both a build would statically cache one tenant's llms.txt and
 * serve it to every other tenant, or serve a build-time snapshot forever —
 * and calls the ONE shared generator rather than duplicating the upstream
 * fetch. Content correctness for a real request is proven by
 * llmsTxtProxy.test.ts.
 *
 * Before B2.2, this file does not exist — `readFileSync` throws, which is
 * this suite's expression of "GET /llms.txt 404s today."
 */

const source = fs.readFileSync(new URL('./route.ts', import.meta.url), 'utf8');

test('runtime is edge', () => {
  assert.match(source, /export const runtime = 'edge';/);
});

test('dynamic is force-dynamic — without it the per-tenant content would be statically cached per build', () => {
  assert.match(source, /export const dynamic = 'force-dynamic';/);
});

test('GET reuses the shared generator instead of duplicating the upstream fetch', () => {
  assert.match(source, /fetchLlmsTxt/);
  // The exact marker llmsTxtProxy.ts uses to build the upstream URL. Matching
  // this (rather than the bare string ".well-known/llms.txt", which also
  // shows up in this file's own doc comment) catches a hand-rolled duplicate
  // fetch call without false-failing on prose that names the sibling route.
  assert.doesNotMatch(
    source,
    /\/sites\/\$\{encodeURIComponent/,
    "the route must not hand-roll the upstream fetch — that is llmsTxtProxy.ts's job"
  );
});

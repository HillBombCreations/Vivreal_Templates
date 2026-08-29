import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * portal-simplification-pass B2.3 — `.well-known/llms.txt` becomes a 301
 * redirect to `/llms.txt`, so there is exactly one generator (the spec
 * location's route.ts, tested in src/app/llms.txt/route.test.ts +
 * src/lib/llmsTxtProxy.test.ts). `route.ts` imports `next/server`, so
 * `node --test` cannot load it directly (same tradeoff as page.test.ts) —
 * this file pins the WIRING via source text (does it call the shared
 * target/status constants, is edge + force-dynamic set), same convention as
 * the sibling route.test.ts this mirrors.
 *
 * review.md TQ-1 — the redirect's REAL behaviour (the resolved target URL,
 * the actual status code) is covered genuinely, not by source-text
 * matching, in `src/lib/llmsTxtRedirect.test.ts` against the framework-free
 * `llmsTxtRedirectTarget`/`LLMS_TXT_REDIRECT_STATUS` this route calls.
 */

const source = fs.readFileSync(new URL('./route.ts', import.meta.url), 'utf8');

test('runtime is edge', () => {
  assert.match(source, /export const runtime = 'edge';/);
});

test('dynamic is force-dynamic', () => {
  assert.match(source, /export const dynamic = 'force-dynamic';/);
});

test('redirects using the shared target + status, not a hand-rolled URL/status literal', () => {
  assert.match(source, /NextResponse\.redirect\(/);
  assert.match(source, /llmsTxtRedirectTarget\(request\.url\)/);
  assert.match(source, /LLMS_TXT_REDIRECT_STATUS/);
  // Genuinely rejects a hand-rolled `new URL('/llms.txt', ...)` reintroduced
  // inline instead of importing the shared, behaviourally-tested target.
  assert.doesNotMatch(source, /new URL\('\/llms\.txt'/);
});

test('imports the target + status from the shared llmsTxtRedirect module', () => {
  assert.match(source, /from '@\/lib\/llmsTxtRedirect'/);
});

test('no longer hand-rolls the upstream fetch — that is llmsTxtProxy.ts / the /llms.txt route\'s job now', () => {
  assert.doesNotMatch(source, /\/sites\/\$\{encodeURIComponent/);
  assert.doesNotMatch(source, /fetchLlmsTxt/);
});

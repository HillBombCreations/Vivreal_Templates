import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * portal-simplification-pass B2.3 — `.well-known/llms.txt` becomes a 301
 * redirect to `/llms.txt`, so there is exactly one generator (the spec
 * location's route.ts, tested in src/app/llms.txt/route.test.ts +
 * src/lib/llmsTxtProxy.test.ts). `route.ts` imports `next/server`, so
 * `node --test` cannot load it directly (same tradeoff as page.test.ts) —
 * this file pins the wiring via source text, same convention as the sibling
 * route.test.ts this mirrors.
 */

const source = fs.readFileSync(new URL('./route.ts', import.meta.url), 'utf8');

test('runtime is edge', () => {
  assert.match(source, /export const runtime = 'edge';/);
});

test('dynamic is force-dynamic', () => {
  assert.match(source, /export const dynamic = 'force-dynamic';/);
});

test('redirects with a 301, not a 302 — this is a permanent move per the spec, not a temporary detour', () => {
  assert.match(source, /NextResponse\.redirect\(/);
  assert.match(source, /,\s*301\s*\);/, 'the redirect status code must be the literal 301');
});

test('redirects to /llms.txt', () => {
  assert.match(source, /new URL\('\/llms\.txt'/);
});

test('no longer hand-rolls the upstream fetch — that is llmsTxtProxy.ts / the /llms.txt route\'s job now', () => {
  assert.doesNotMatch(source, /\/sites\/\$\{encodeURIComponent/);
  assert.doesNotMatch(source, /fetchLlmsTxt/);
});

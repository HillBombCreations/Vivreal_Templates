/**
 * TP-13 (release B, F270): a source scan that no `fetch` to this app's own
 * routes and no hand-built `Location` is written without `sitePath`.
 *
 * Next adds the base path itself to `Link`, the router, `redirect()` and its
 * own assets, but NOT to a `fetch('/api/...')` or a `Location: '/x'` header.
 * Under the help site's base those reach vivreal.io's marketing app instead.
 * A regex is enough here (design-help-path.md TP-13): every `fetch(` whose
 * first argument is a root-relative literal or an UPPER_CASE constant, and
 * every `Location:` with a root-relative literal or an UPPER_CASE constant, is
 * a finding unless it is wrapped (`fetch(sitePath(...))`,
 * `Location: sitePath(...)`). A Location from a lowercase variable
 * (a signed media URL, a resolved target) is the caller's own; the two preview
 * routes are pinned by name below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** A bare root-relative literal or an UPPER_CASE constant as `fetch`'s first argument. */
const BARE_FETCH = /\bfetch\(\s*(?:['"`]\/|[A-Z][A-Z0-9_]*\b)/g;
/** The same as a `Location` header value. */
const BARE_LOCATION = /\bLocation\s*:\s*(?:['"`]\/|[A-Z][A-Z0-9_]*\b)/g;
const WRAPPED_FETCH = /\bfetch\(\s*sitePath\(/g;
const WRAPPED_LOCATION = /\bLocation\s*:\s*sitePath\(/g;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'testSupport' || entry.name === 'node_modules') continue;
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Every bare fetch and Location in `text`, as `label:line`. */
function findings(label: string, text: string): string[] {
  const found: string[] = [];
  for (const re of [BARE_FETCH, BARE_LOCATION]) {
    for (const match of text.matchAll(re)) {
      found.push(`${label}:${text.slice(0, match.index).split('\n').length}: ${match[0]}`);
    }
  }
  return found;
}

const count = (text: string, re: RegExp) => [...text.matchAll(re)].length;

test('[TP-13 REFUSE] the scan finds a planted bare fetch and a bare Location (positive control)', () => {
  const planted = [
    'await fetch("/api/x", { method: "POST" });',
    "await fetch('/api/y');",
    'await fetch(`/api/z?${q}`);',
    'await fetch(SOME_PATH, {});',
    "return new Response(null, { headers: { Location: '/icon' } });",
    'headers: { Location: SOME_REDIRECT_LOCATION },',
  ].join('\n');
  assert.equal(findings('planted', planted).length, 6, findings('planted', planted).join('\n'));
});

test('[TP-13 ALLOW] the wrapped forms and non-site values are not findings (negative control)', () => {
  const clean = [
    'await fetch(sitePath("/api/x"), {});',
    'await fetch(sitePath(SOME_PATH), {});',
    'await fetch(url, {});',
    'await fetch(`${CLIENT_API}/tenant/x`);',
    'headers: { Location: sitePath(target) },',
    'headers: { Location: signedUrl },',
    ' * shipped as `Location: https://localhost:3000/llms.txt`',
  ].join('\n');
  assert.deepEqual(findings('clean', clean), []);
});

test('[TP-13 REFUSE] no source file under src writes a bare site fetch or Location', () => {
  const files = sourceFiles(SRC);
  const all: string[] = [];
  let wrappedFetches = 0;
  let wrappedLocations = 0;
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    all.push(...findings(path.relative(SRC, file), text));
    wrappedFetches += count(text, WRAPPED_FETCH);
    wrappedLocations += count(text, WRAPPED_LOCATION);
  }
  console.log(`sitePathCoverage: ${files.length} files, ${wrappedFetches} wrapped fetches, ${wrappedLocations} wrapped Locations`);
  assert.deepEqual(all, []);
  // The 13 own-route fetches of design-help-path.md 2.5, and the five
  // hand-built Locations (favicon, llms.txt, MCP connect, preview enable and
  // disable). A count that drops means a site was unwrapped or deleted.
  assert.equal(wrappedFetches, 13);
  assert.equal(wrappedLocations, 5);
});

test('[TP-13 ALLOW] the preview routes write their variable Locations through sitePath', () => {
  for (const route of ['app/api/preview/enable/route.ts', 'app/api/preview/disable/route.ts']) {
    const text = fs.readFileSync(path.join(SRC, route), 'utf8');
    assert.match(text, /Location: sitePath\((location|target)\)/, route);
  }
});

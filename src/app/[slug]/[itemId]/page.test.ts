import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// page.tsx contains JSX, so it can't be imported directly under
// `node --experimental-strip-types` (.tsx is unsupported by that loader
// regardless of content). Pinning the wiring via source-text assertion
// matches this repo's existing convention for the same constraint (see the
// pre-79df69d/a244691 history on this exact file).

test('all five detail JSON-LD shapes use the shared detail URL helper', () => {
  const source = fs.readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
  const calls = source.match(/buildDetailUrl\(siteData, slug, itemId\)/g) ?? [];
  assert.equal(calls.length, 5, 'each of the five schema shapes resolves its detail URL once');
  assert.doesNotMatch(source, /https:\/\/\$\{siteData\.domainName\}\/\$\{slug\}\/\$\{itemId\}/);
});

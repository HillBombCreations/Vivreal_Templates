import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('all five detail JSON-LD shapes use the central detail URL helper', () => {
  const source = fs.readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
  const calls = source.match(/buildDetailUrl\(siteData, slug, itemId\)/g) ?? [];
  assert.equal(calls.length, 5, 'each of the five schema shapes resolves its detail URL once');
  assert.doesNotMatch(source, /https:\/\/\$\{siteData\.domainName\}\/\$\{slug\}\/\$\{itemId\}/);
});

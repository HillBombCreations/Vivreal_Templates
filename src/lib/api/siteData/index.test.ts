import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// index.tsx can't be imported directly under `node --experimental-strip-types`
// (.tsx is unsupported by that loader regardless of content). Pinning the
// wiring via source-text assertion matches this repo's existing convention
// for the same constraint (see JsonLd/index.test.ts, robots.test.ts, and
// [slug]/[itemId]/page.test.ts).

test('getSiteMap resolves buildSitemapEntries origin via resolveOrigin({ prefer: "durable" }), not raw domainName', () => {
  const source = fs.readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ resolveOrigin \} from '@\/lib\/og\/ogImage'/);
  assert.match(
    source,
    /buildSitemapEntries\(\s*raw\.pages,\s*resolveOrigin\(\{ domainName: raw\.domainName, domainInformation: raw\.domainInformation \}, \{ prefer: 'durable' \}\),/,
  );
  assert.doesNotMatch(source, /buildSitemapEntries\(\s*raw\.pages,\s*raw\.domainName \?\? ''/);
});

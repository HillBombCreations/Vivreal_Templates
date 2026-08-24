import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// robots.tsx can't be imported directly under `node --experimental-strip-types`
// (.tsx is unsupported by that loader regardless of content). Pinning the
// wiring via source-text assertion matches this repo's existing convention
// for the same constraint (see JsonLd/index.test.ts and
// [slug]/[itemId]/page.test.ts).

test('the Sitemap: line resolves through the durable-preferring origin resolver, not raw domainName', () => {
  const source = fs.readFileSync(new URL('./robots.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ resolveOrigin \} from '@\/lib\/og\/ogImage'/);
  assert.match(source, /const siteOrigin = resolveOrigin\(siteData, \{ prefer: 'durable' \}\)/);
  assert.match(source, /sitemap: `\$\{siteOrigin\}\/sitemap\.xml`/);
  assert.doesNotMatch(source, /https:\/\/\$\{siteData\.domainName\}\/sitemap\.xml/);
});

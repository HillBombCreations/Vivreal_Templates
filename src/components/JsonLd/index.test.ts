import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// index.tsx contains JSX (the JsonLd component), so it can't be imported
// directly under `node --experimental-strip-types` (.tsx is unsupported by
// that loader regardless of content). Pinning the wiring via source-text
// assertion matches this repo's existing convention for the same constraint
// (see the pre-79df69d/a244691 history on src/app/[slug]/[itemId]/page.tsx).

test('site-level JSON-LD resolves its URL through the durable-preferring origin resolver', () => {
  const source = fs.readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ resolveOrigin \} from '@\/lib\/og\/ogImage'/);
  assert.match(source, /resolveOrigin\(siteData, \{ prefer: 'durable' \}\) \|\| undefined/);
  assert.doesNotMatch(source, /`https:\/\/\$\{domain\}`/);
});

test('site-level JSON-LD `url` is demo-gated, matching robots.txt and the sitemap', () => {
  const source = fs.readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ isDemoSite \} from '@\/lib\/seo\/demoSafety'/);
  assert.match(source, /const url = isDemoSite\(siteData\) \? undefined : resolveOrigin/);
});

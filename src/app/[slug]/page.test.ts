import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * page.tsx contains JSX, so `node --experimental-strip-types` cannot load it at
 * all (.tsx is unsupported by that loader regardless of content), and
 * `generateMetadata` reads `getSiteData()`, which is `server-only`. Every gate
 * in this area was moved into a plain .ts module precisely so it could be
 * tested by CALLING it, and `buildPageRobotsMetadata`'s behaviour IS tested for
 * real in src/lib/seo/pageIndexing.test.ts. This file pins only that the route
 * still reaches it — the same tradeoff, for the same reason, as
 * src/app/[slug]/[itemId]/page.test.ts.
 *
 * Matched on the function NAME, never on formatting or argument layout, so a
 * behaviour-preserving reformat cannot turn this red.
 */

const source = fs.readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

test('generateMetadata composes its robots policy through the shared builder', () => {
  assert.match(source, /buildPageRobotsMetadata\(/, 'the route must reach the tested composer');
  assert.match(
    source,
    /import \{ buildPageRobotsMetadata \} from "@\/lib\/seo\/pageIndexing"/,
    'imported from the module that owns the non-indexable page-type list',
  );
});

test('the robots policy is no longer decided inline in the route module', () => {
  // The pre-change form. Inline, it could only ever see the author-set flag, so
  // the Stripe checkout result pages emitted no `noindex` at all — and being
  // inside a .tsx meant no test could reach it either.
  assert.doesNotMatch(source, /seo\?\.noindex \? \{ robots:/);
});

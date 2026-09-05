import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// route.tsx builds an ImageResponse and is therefore JSX, which
// `node --experimental-strip-types` cannot load. Its DECISIONS live in
// src/lib/og/ogCard.ts and are tested by being called (ogCard.test.ts,
// including the two-items-two-cards pair that is this feature's exit
// criterion). This file pins that the route reaches them, and that it keeps the
// one property a social card cannot lose.

const source = fs.readFileSync(new URL('./route.tsx', import.meta.url), 'utf8');

test('the card is planned by the tested decision function', () => {
  assert.match(source, /planOgItemCard\(lookup\?\.item, pageHeading\)/);
  assert.match(source, /from '@\/lib\/og\/ogCard'/);
});

test('the card resolves its item through the same helper the page uses', () => {
  // Two resolvers would eventually disagree, and the symptom is a correct page
  // under a different recipe's card.
  assert.match(source, /lookupDetailItem\(siteData, pageConfig, itemId\)/);
});

test('the route is force-dynamic', () => {
  // Item media is a CloudFront-SIGNED URL. Caching this route would freeze one
  // signature into the response, and a crawler re-fetching an og:image hours
  // later would get a 403 and a blank card on the exact link she posted.
  assert.match(source, /export const dynamic = 'force-dynamic'/);
});

test('the item photo is proxied as bytes, never redirected to', () => {
  // A redirect would hand the crawler the signed URL itself, which is the
  // expiring thing we are re-signing per request to avoid.
  assert.match(source, /proxyImageBytes\(plan\.signedUrl\)/);
  assert.doesNotMatch(source, /Response\.redirect|NextResponse\.redirect/);
});

test('a photo-less item still gets a card of its own', () => {
  // Falling back to the site-wide default share image here would put one
  // picture back on every recipe, which is the defect this route exists to fix.
  assert.match(source, /renderBrandedOgCard\(\{\s*\n\s*heading: plan\.heading,/);
  assert.doesNotMatch(source, /defaultOgImage/);
});

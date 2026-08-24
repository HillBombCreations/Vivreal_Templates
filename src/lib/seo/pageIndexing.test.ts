import { test } from 'node:test';
import assert from 'node:assert/strict';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`,
// which has no tsconfig `paths` resolution.
import {
  NON_INDEXABLE_PAGE_FORMATS,
  buildPageRobotsMetadata,
  isNonIndexablePageFormat,
} from './pageIndexing.ts';

// The live defect this module fixes, verified against production on 2026-08-24:
//
//   $ curl https://dougs-kitchen.com/sitemap.xml
//   ... <loc>https://dougs-kitchen.com/checkoutsuccess</loc>
//   ... <loc>https://dougs-kitchen.com/checkoutcancel</loc>
//
// Note the SLUGS carry no separator while the FORMATS do. Every assertion below
// keys on the format for exactly that reason.

test('the membership list is EXACTLY the two checkout result formats — widening it must be a deliberate, visible edit', () => {
  // A `deepEqual` on the whole set, not a series of `.has()` probes. Adding a
  // format turns this red, which is the point: silently widening what a fleet
  // of live sites withholds from search is the failure mode this pins.
  assert.deepEqual([...NON_INDEXABLE_PAGE_FORMATS].sort(), ['checkout-cancel', 'checkout-success']);
});

test('both Stripe checkout result page types are non-indexable', () => {
  assert.equal(isNonIndexablePageFormat('checkout-success'), true);
  assert.equal(isNonIndexablePageFormat('checkout-cancel'), true);
});

test('every OTHER shipped page type stays indexable, including the conversion pages', () => {
  // The full `PageFormat` universe: the site-loader blueprint enum, plus the
  // portal-only system formats, minus the two above. A page type that quietly
  // fell out of a fleet's sitemap would be invisible until traffic dropped.
  const indexable = [
    'home', 'about', 'static', 'shows', 'team', 'products', 'schedule', 'menu',
    'form', 'subscribe', 'list', 'grid', 'standard', 'collection-list', 'catalog',
    'location-hub', 'craft', 'profile', 'panorama', 'discography', 'inquiry',
    'spaces', 'tour', 'booking-hub', 'quiz', 'intake', 'pricing', 'collection',
    'detail', 'collection-detail',
  ];
  for (const format of indexable) {
    assert.equal(isNonIndexablePageFormat(format), false, `${format} must stay indexable`);
  }
});

test('the conversion page types are called out by name: being a FORM is not being transactional', () => {
  // The borderline group. A business actively wants "contact us", "book",
  // "sell with us" and "find your treatment" found in search; they are the top
  // of the funnel, not the receipt at the bottom of it.
  for (const format of ['form', 'inquiry', 'intake', 'booking-hub', 'quiz', 'subscribe']) {
    assert.equal(isNonIndexablePageFormat(format), false, `${format} is a conversion page, not a receipt`);
  }
});

test('an absent or unknown format is indexable — a page type this build has never heard of is never silently deindexed', () => {
  assert.equal(isNonIndexablePageFormat(undefined), false);
  assert.equal(isNonIndexablePageFormat(''), false);
  assert.equal(isNonIndexablePageFormat('some-future-kit-format'), false);
});

test('membership is EXACT, never a substring or prefix match on the format string', () => {
  // A `format.startsWith('checkout')` implementation would pass every test
  // above and fail these. The set is a lookup, not a pattern.
  for (const format of ['checkout', 'checkout-guide', 'checkout-success-story', 'pre-checkout-cancel']) {
    assert.equal(isNonIndexablePageFormat(format), false, format);
  }
});

// ───────────────────────── page-level robots metadata ────────────────────────

test('an ordinary page emits NO robots key at all, so the root layout demo rule stands alone', () => {
  const metadata = buildPageRobotsMetadata('about', undefined);
  // `in`, not a truthiness check: a present-but-undefined key would still
  // override the layout value when the caller spreads this object.
  assert.equal('robots' in metadata, false);
  assert.deepEqual(metadata, {});
});

test('a checkout result page emits noindex, follow — absence from the sitemap alone cannot deindex an already-crawled URL', () => {
  assert.deepEqual(buildPageRobotsMetadata('checkout-success', undefined), {
    robots: { index: false, follow: true },
  });
  assert.deepEqual(buildPageRobotsMetadata('checkout-cancel', undefined), {
    robots: { index: false, follow: true },
  });
});

test('an author-set seo.noindex still emits noindex, nofollow — byte-identical to before this module existed', () => {
  assert.deepEqual(buildPageRobotsMetadata('about', true), {
    robots: { index: false, follow: false },
  });
});

test('the author-set flag WINS on a checkout page: turning the Studio toggle on can never make a page less hidden', () => {
  assert.deepEqual(buildPageRobotsMetadata('checkout-success', true), {
    robots: { index: false, follow: false },
  });
});

test('seo.noindex === false is treated as "not set", exactly as the negative-stored field intends', () => {
  // The field stores the NEGATIVE, so `false` is the default state, not an
  // assertion. An ordinary page with it explicitly false must still emit no key.
  assert.deepEqual(buildPageRobotsMetadata('about', false), {});
  // ...and it must not un-hide a checkout page either.
  assert.deepEqual(buildPageRobotsMetadata('checkout-cancel', false), {
    robots: { index: false, follow: true },
  });
});

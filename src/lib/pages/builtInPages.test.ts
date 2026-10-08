import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { PageConfig } from '@/types/SiteData';
import { CHECKOUT_RESULT_PAGES, CHECKOUT_RESULT_SLUGS, resolvePageForSlug } from './builtInPages.ts';
import { isPageTurnedOff } from './pageEnabled.ts';
import { isNonIndexablePageFormat } from '../seo/pageIndexing.ts';
import { stripComments } from '../source/stripComments.ts';

/**
 * `[slug]/page.tsx` cannot be loaded by the node test runner (JSX, server-only
 * imports), so the decision it delegates, "which page config does this slug
 * render", lives here and is tested by CALLING it. page.test.ts pins that the
 * route still reaches this resolver.
 *
 * The defect (vivreal-hq docs/bugs/storefront-checkout-2026-10-07): Stripe
 * returns the buyer to `/checkoutsuccess`, a slug VR_Client_API hardcodes, and
 * a site with no STORED page of that slug answered 404 and sent no receipt.
 */

const page = (slug: string, format = 'standard', extra: Partial<PageConfig> = {}): PageConfig => ({
  name: slug,
  slug,
  format,
  collectionId: null,
  labels: {},
  ...extra,
});

// A store that became a store AFTER its first build: a shop page bound to
// Stripe and no checkout result pages (Cobalt & Crumb, 2026-10-07).
const storeWithoutCheckoutPages: PageConfig[] = [page('about'), page('shop', 'catalog')];

// ── ALLOW: a site with no stored checkout pages still serves both ──────────

test('checkoutsuccess resolves to a success page on a site that stores none', () => {
  const resolved = resolvePageForSlug(storeWithoutCheckoutPages, 'checkoutsuccess');
  assert.ok(resolved, 'must not fall through to notFound()');
  assert.equal(resolved.slug, 'checkoutsuccess');
  assert.equal(resolved.format, 'checkout-success');
  assert.equal(resolved.name, 'Order confirmed');
});

test('checkoutcancel resolves to a cancel page on a site that stores none', () => {
  const resolved = resolvePageForSlug(storeWithoutCheckoutPages, 'checkoutcancel');
  assert.ok(resolved, 'must not fall through to notFound()');
  assert.equal(resolved.slug, 'checkoutcancel');
  assert.equal(resolved.format, 'checkout-cancel');
  assert.equal(resolved.name, 'Checkout cancelled');
});

test('the built-in pages are served even on a site with no pages at all', () => {
  // `pageConfigs` absent is not a degraded read here: the route's
  // assertUpstreamHealthy() runs first and refuses a degraded read on its own.
  for (const pages of [undefined, []]) {
    assert.equal(resolvePageForSlug(pages, 'checkoutsuccess')?.format, 'checkout-success');
    assert.equal(resolvePageForSlug(pages, 'checkoutcancel')?.format, 'checkout-cancel');
  }
});

test('the built-in page is bare, so it renders exactly like a seeded bare page', () => {
  // No blocks and empty labels make the route synthesize the checkout-status
  // block and the renderer's canonical copy render, the same as the page the
  // site-loader seeds (checkoutResultPages.js: labels {}, no blocks).
  const resolved = resolvePageForSlug([], 'checkoutsuccess');
  assert.equal(isPageTurnedOff(resolved), false, 'a built-in page is never "off"');
  assert.deepEqual(resolved, {
    slug: 'checkoutsuccess',
    name: 'Order confirmed',
    format: 'checkout-success',
    collectionId: null,
    labels: {},
  });
});

test('the built-in pages stay out of search engines', () => {
  for (const slug of CHECKOUT_RESULT_SLUGS) {
    const resolved = resolvePageForSlug([], slug);
    assert.ok(resolved);
    assert.equal(isNonIndexablePageFormat(resolved.format), true, `${slug} must be noindex`);
  }
});

test('each call returns a fresh object, so one request cannot mutate the next', () => {
  const a = resolvePageForSlug([], 'checkoutsuccess');
  const b = resolvePageForSlug([], 'checkoutsuccess');
  assert.ok(a && b);
  assert.notEqual(a, b);
  assert.notEqual(a.labels, b.labels);
  a.labels.heading = 'mutated';
  assert.deepEqual(resolvePageForSlug([], 'checkoutsuccess')?.labels, {});
});

// ── The confirmation email fires from the built-in success page, and only it ─

test('the built-in success page carries the exact format the confirmation trigger is gated on', () => {
  // The route mounts OrderConfirmationTrigger on `format === "checkout-success"`.
  // Read that gate out of the route rather than restating the string, so a
  // rename on either side goes red here.
  const route = stripComments(
    fs.readFileSync(new URL('../../app/[slug]/page.tsx', import.meta.url), 'utf8'),
  );
  const gate = route.match(/format === "([^"]+)" && <OrderConfirmationTrigger \/>/);
  assert.ok(gate, 'the route still gates the trigger on a format literal');
  assert.equal(resolvePageForSlug([], 'checkoutsuccess')?.format, gate[1]);
  assert.notEqual(
    resolvePageForSlug([], 'checkoutcancel')?.format,
    gate[1],
    'a cancelled checkout has no order to confirm',
  );
});

// ── REFUSE: a site's stored pages win, unchanged ───────────────────────────

test('a stored checkoutsuccess page is returned as stored, the same object', () => {
  const stored = page('checkoutsuccess', 'checkout-success', {
    name: 'Thank you!',
    labels: { heading: 'Your bread is on its way', body: 'See you soon.' },
    blocks: [
      {
        id: 'cs-1',
        type: { kind: 'page-template', dispatchId: 'checkout-status' },
        order: 0,
        enabled: true,
        config: { labels: { success: true } },
      },
      // Cast: a fixture literal; the renderer's Block union is wider than this
      // test needs to spell out, and the resolver never reads block contents.
    ] as PageConfig['blocks'],
  });
  const before = structuredClone(stored);
  const resolved = resolvePageForSlug([page('shop', 'products'), stored], 'checkoutsuccess');
  assert.equal(resolved, stored, 'the stored page itself, not a synthesized one');
  assert.deepEqual(stored, before, 'and it is not modified');
});

test('a stored checkoutcancel page is returned as stored', () => {
  const stored = page('checkoutcancel', 'checkout-cancel', { labels: { heading: 'No worries' } });
  assert.equal(resolvePageForSlug([stored], 'checkoutcancel'), stored);
});

test('a stored checkout page the owner switched OFF stays off', () => {
  // Returned as stored, so the route's isPageTurnedOff guard still 404s it.
  // A built-in fallback here would quietly override the owner's switch.
  const off = page('checkoutsuccess', 'checkout-success', { enabled: false });
  const resolved = resolvePageForSlug([off], 'checkoutsuccess');
  assert.equal(resolved, off);
  assert.equal(isPageTurnedOff(resolved), true);
});

test('a stored page with a checkout slug but another format keeps its own format', () => {
  // Stored wins outright; the resolver never second-guesses authored data.
  const custom = page('checkoutsuccess', 'standard');
  assert.equal(resolvePageForSlug([custom], 'checkoutsuccess')?.format, 'standard');
});

// ── REFUSE: nothing else becomes routable ──────────────────────────────────

test('an unrelated unknown slug still resolves to nothing (the route 404s it)', () => {
  // privacy/terms are absent here on purpose: the route serves those through
  // its own STATIC_SLUGS fallback, not through this resolver.
  for (const slug of ['nope', 'checkout', 'order', 'privacy', 'terms', 'subscribers', '']) {
    assert.equal(resolvePageForSlug(storeWithoutCheckoutPages, slug), undefined, slug);
  }
});

test('near-miss checkout slugs are refused: exact match only', () => {
  for (const slug of [
    'CheckoutSuccess',
    'CHECKOUTSUCCESS',
    'checkout-success',
    'checkout_success',
    ' checkoutsuccess',
    'checkoutsuccess ',
    'checkoutsuccess/',
    'checkoutcancel/x',
    'Checkoutcancel',
    'checkoutsuccesss',
  ]) {
    assert.equal(resolvePageForSlug([], slug), undefined, JSON.stringify(slug));
  }
});

test('a stored page still resolves normally (control)', () => {
  const about = page('about');
  assert.equal(resolvePageForSlug([about, page('shop')], 'about'), about);
});

test('the slug list is exactly the two pages, frozen', () => {
  assert.deepEqual([...CHECKOUT_RESULT_SLUGS], ['checkoutsuccess', 'checkoutcancel']);
  assert.ok(Object.isFrozen(CHECKOUT_RESULT_SLUGS));
  assert.ok(Object.isFrozen(CHECKOUT_RESULT_PAGES));
  assert.ok(CHECKOUT_RESULT_PAGES.every((p) => Object.isFrozen(p)));
});

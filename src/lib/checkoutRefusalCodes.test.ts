/**
 * Every checkout refusal code VR_Client_API answers (its PR #137, open-backlog
 * release) reaches the shopper in the cart's own words, never the generic
 * "Refresh the page" sentence and never the upstream text. The list is the
 * Client's passthrough set for checkout (`errorHandler.js` SHOP_RULE_CODES,
 * CATALOG_REFUSAL_CODES and INSUFFICIENT_STOCK).
 *
 * Namespace imports, so at a base without a helper each test fails on its
 * own assertion rather than the file failing to load.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as request from './checkoutRequest.ts';
import * as stock from './cartStock.ts';
import * as cartUtils from './utils/cartUtils/index.ts';
import type { Cart } from '../types/Cart';

const CLIENT_CHECKOUT_CODES = [
  'BELOW_DELIVERY_MINIMUM', 'BELOW_MINIMUM', 'CART_NEEDS_SITE', 'DELIVERY_DAY_UNAVAILABLE', 'DELIVERY_ORIGIN_MISSING',
  'DELIVERY_PRICE_MISSING', 'INSUFFICIENT_STOCK', 'ITEM_NO_LONGER_AVAILABLE', 'NO_WAY_TO_GET_ORDER', 'OUT_OF_AREA',
  'PICKUP_NOT_OFFERED', 'PICKUP_UNAVAILABLE', 'SHIPPING_RATE_UNAVAILABLE', 'ZIP_NOT_RECOGNIZED',
] as const;

const GENERIC = new Set([
  'Something in your bag is no longer available. Refresh the page, then try again.',
  'We could not start checkout. Refresh the page, then try again.',
  'We could not start checkout just now. Please try again in a moment.',
  'Checkout is busy right now. Wait a moment, then try again.',
]);
const EM = String.fromCharCode(8212);
const EN = String.fromCharCode(8211);
const UPSTREAM = 'An item in your bag is no longer available (upstream wording, Stripe)';

const dialog = fs.readFileSync(new URL('../components/Navigation/CartDialog.tsx', import.meta.url), 'utf8');

test('REFUSE: no Client checkout code gets the generic sentence; each gets the cart\'s own words', () => {
  assert.equal(CLIENT_CHECKOUT_CODES.length, 14);
  for (const code of CLIENT_CHECKOUT_CODES) {
    const body = { errorCode: code, ownerSafe: true, error: UPSTREAM, items: [{ priceId: 'price_1', available: 0 }] };
    const r = request.checkoutRefusal(409, UPSTREAM, body, '85004');
    assert.ok(!GENERIC.has(r.error), `${code}: not the generic sentence (got "${r.error}")`);
    assert.ok(r.reason, `${code}: the cart branches on a reason`);
    assert.ok(!r.error.includes('upstream') && !/Stripe|Square/.test(r.error), `${code}: never the upstream text or a payment company`);
    assert.ok(!r.error.includes(EM) && !r.error.includes(EN), `${code}: no dashes`);
    assert.doesNotMatch(r.error, /refresh/i, `${code}: refreshing cannot help a bag kept in the browser`);
  }
});

test('ALLOW: the four codes new to this cart, word for word', () => {
  const words = (code: string) => request.checkoutRefusal(409, 'x', { errorCode: code, ownerSafe: true }).error;
  assert.equal(words('CART_NEEDS_SITE'), "Choose how you'd like to get your order, then check out again.");
  assert.equal(words('DELIVERY_DAY_UNAVAILABLE'), 'That delivery day is no longer available. Pick another day.');
  assert.equal(words('SHIPPING_RATE_UNAVAILABLE'), 'That shipping choice is no longer offered. Pick another.');
  assert.equal(words('ITEM_NO_LONGER_AVAILABLE'), 'Something in your order is no longer available. Remove it, then check out again.');
});

test('ALLOW: ITEM_NO_LONGER_AVAILABLE names its lines, and the bag takes them out in one tap', () => {
  const r = request.checkoutRefusal(409, 'x', {
    errorCode: 'ITEM_NO_LONGER_AVAILABLE',
    items: [{ priceId: 'price_rye' }, { priceId: '' }, { nope: 1 }, 'price_x', { priceId: 'price_tart' }],
  }) as request.CheckoutRefusal & { unavailable?: string[] };
  assert.equal(r.reason, 'no_longer_available');
  assert.deepEqual(r.unavailable, ['price_rye', 'price_tart'], 'malformed entries dropped');
  const withoutLines = (stock as unknown as Record<string, unknown>).withoutUnavailableLines; // a named export, checked next
  assert.equal(typeof withoutLines, 'function', 'cartStock exports withoutUnavailableLines');
  const bag = {
    a: { priceID: 'price_rye', name: 'Rye loaf', quantity: 1 },
    b: { priceID: 'price_sour', name: 'Sourdough', quantity: 2 },
    c: { priceID: 'price_tart', name: 'Lemon tart', quantity: 1 },
  } as unknown as Cart; // only the fields the helper reads
  const out = (withoutLines as (c: Cart, ids: string[]) => { cart: Cart; removed: string[] })(bag, r.unavailable ?? []); // checked above
  assert.deepEqual(out.removed, ['Rye loaf', 'Lemon tart']);
  assert.deepEqual(Object.keys(out.cart), ['b'], 'a line checkout did not name stays');
  assert.match(dialog, /if \(err instanceof CheckoutUnavailableError\) \{\s*\/\/[^\n]*\n\s*setUnavailable\(\{ message: err\.message, priceIds: err\.priceIds \?\? \[\] \}\);\s*return;/);
  assert.match(dialog, /setCart\(withoutUnavailableLines\(cart \|\| \{\}, unavailable\.priceIds\)\.cart\);/);
  assert.match(dialog, /\{REMOVE_UNAVAILABLE_LABEL\}/);
});

test('REFUSE: no named line from an older Client keeps the words and the bag as it is', () => {
  const r = request.checkoutRefusal(409, 'x', { errorCode: 'ITEM_NO_LONGER_AVAILABLE' }) as request.CheckoutRefusal & { unavailable?: string[] };
  assert.equal(r.reason, 'no_longer_available');
  assert.equal(r.unavailable, undefined);
  assert.equal(request.checkoutRefusal(404, 'x', { errorCode: 'ITEM_NO_LONGER_AVAILABLE' }).reason, undefined, 'only the 409 Client sends');
});

test('ALLOW: the bag\'s checkout call turns the route\'s answer into the one-tap error', async () => {
  const Unavailable = (cartUtils as unknown as Record<string, unknown>).CheckoutUnavailableError; // a named export, checked next
  assert.equal(typeof Unavailable, 'function', 'cartUtils exports CheckoutUnavailableError');
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: 'Something in your order is no longer available. Remove it, then check out again.', reason: 'no_longer_available', unavailable: ['price_rye'] }), { status: 409 })) as typeof fetch;
  try {
    await assert.rejects(
      cartUtils.handleCheckout({ cart: { a: { priceID: 'price_rye', name: 'Rye loaf', quantity: 1 } } as unknown as Cart, requiresShipping: false, originUrl: 'https://shop.example' }), // only the fields checkout reads
      (err: unknown) => err instanceof (Unavailable as new () => Error) && (err as { priceIds?: string[] }).priceIds?.join() === 'price_rye',
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

/**
 * Owner ideas 2026-10-29, T13 and T15 (plan 3.9, 3.10): the cart's settings,
 * its delivery words, and what checkout sends.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CART_DEFAULTS,
  cartNeedsChoices,
  checkoutChoice,
  checkoutExtras,
  choiceBlock,
  currentKind,
  FULFILMENT_LABELS,
  NO_PICKUP_TIMES,
  cleanNote,
  deliveryTotalLine,
  forwardedCheckoutExtras,
  fulfilmentChoices,
  minimumLine,
  readCartSettings,
  readDeliveryQuote,
} from './cartSettings.ts';
import { CHECKOUT_SHOP_RULE, checkoutRefusal } from '../checkoutRequest.ts';

const dialog = fs.readFileSync(new URL('../../components/Navigation/CartDialog.tsx', import.meta.url), 'utf8');

test('REFUSE: absent settings are today\'s cart, word for word', () => {
  const s = readCartSettings(undefined);
  assert.deepEqual(
    { title: s.title, emptyText: s.emptyText, checkoutLabel: s.checkoutLabel },
    { title: 'Your cart', emptyText: 'Your cart is empty', checkoutLabel: 'Proceed to checkout' },
  );
  assert.equal(s.note.on, false);
  assert.equal(s.pickup.on, false);
  assert.equal(s.minimumOrder, null);
  assert.equal(s.showPromo, true);
  assert.deepEqual(checkoutExtras({ note: '', zip: '' }), {}, 'no choice sends nothing: today\'s checkout body');
  assert.equal(cartNeedsChoices(s, { deliveryOn: true, ships: true }), false, 'the quick card and Buy now check out as before');
  assert.equal(s.saved, false);
  // The dialog draws those values, nowhere a second literal.
  for (const word of [CART_DEFAULTS.title, CART_DEFAULTS.emptyText, CART_DEFAULTS.checkoutLabel]) {
    assert.ok(!dialog.includes(`>${word}<`), `"${word}" is no longer hard-coded in the dialog`);
  }
  assert.match(dialog, /\{settings\.title\}/);
  assert.match(dialog, /\{settings\.emptyText\}/);
  assert.match(dialog, /\{settings\.checkoutLabel\}/);
});

test('ALLOW: custom words are read; REFUSE: an empty or over-long word falls back', () => {
  const s = readCartSettings({ title: ' Your bag ', emptyText: 'Nothing here yet', checkoutLabel: 'Pay now', note: { on: true, label: 'Allergies?' } });
  assert.deepEqual([s.title, s.emptyText, s.checkoutLabel, s.note.label], ['Your bag', 'Nothing here yet', 'Pay now', 'Allergies?']);
  const bad = readCartSettings({ title: 'x'.repeat(41), emptyText: '', checkoutLabel: 7, note: { on: 'yes' }, pickup: { on: true, noticeMinutes: 7, daysAhead: 99 }, minimumOrder: -5 });
  assert.equal(bad.title, 'Your cart');
  assert.equal(bad.emptyText, 'Your cart is empty');
  assert.equal(bad.checkoutLabel, 'Proceed to checkout');
  assert.equal(bad.note.on, false, 'only a real true switches the note on');
  assert.deepEqual(bad.pickup, { on: true, noticeMinutes: 120, daysAhead: 7 });
  assert.equal(bad.minimumOrder, null);
  assert.equal(readCartSettings('junk').title, 'Your cart');
});

test('REFUSE: under the minimum the button stays disabled; ALLOW: exactly at it', () => {
  assert.equal(minimumLine(15, 20), 'Minimum order $20. Add $5 more.');
  assert.equal(minimumLine(19.99, 20), 'Minimum order $20. Add $0.01 more.');
  assert.equal(minimumLine(20, 20), null);
  assert.equal(minimumLine(0.1 + 0.2, 0.3), null, 'compared in cents, not floats');
  assert.equal(minimumLine(5, null), null);
  assert.match(dialog, /const belowMinimum = minimumLine\(total, settings\.minimumOrder\);/, 'on the total after the code');
  assert.match(dialog, /disabled=\{!itemsArray\.length \|\| loadingCheckout \|\| Boolean\(belowMinimum\) \|\| choiceMissing\}/);
});

test('ALLOW: the promo box hides when switched off', () => {
  assert.equal(readCartSettings({ showPromo: false }).showPromo, false);
  assert.match(dialog, /\{itemsArray\.length > 0 && settings\.showPromo \? \(/);
});

test('ALLOW: a pickup time and a note ride checkout; the note is cleaned and capped', () => {
  assert.deepEqual(checkoutExtras({ note: '  Ring twice ', kind: 'pickup', pickupAt: '2026-11-04T21:00:00.000Z' }), {
    note: 'Ring twice',
    fulfilment: { kind: 'pickup', pickupAt: '2026-11-04T21:00:00.000Z' },
  });
  assert.equal(cleanNote(`a${String.fromCharCode(0)}b${String.fromCharCode(7)}c\nd`), 'abc\nd');
  assert.equal(cleanNote('x'.repeat(300)).length, 250);
  assert.deepEqual(checkoutExtras({ kind: 'delivery', zip: '6061' }), {}, 'a delivery with no valid ZIP sends nothing');
});

test('REFUSE: checkout never forwards a fee, and nothing without a site id', () => {
  const browser = { note: 'hi', fulfilment: { kind: 'delivery', zip: '60614', fee: 1, feeCents: 0 }, fee: 5, deliveryFee: 2, products: [] };
  const out = forwardedCheckoutExtras(browser, true);
  assert.deepEqual(out, { note: 'hi', fulfilment: { kind: 'delivery', zip: '60614' } });
  assert.ok(!/fee/i.test(JSON.stringify(out)));
  assert.deepEqual(forwardedCheckoutExtras(browser, false), {});
  // Review B3: ship is a real choice now; an unknown kind is still dropped.
  assert.deepEqual(forwardedCheckoutExtras({ fulfilment: { kind: 'ship' } }, true), { fulfilment: { kind: 'ship' } });
  assert.deepEqual(forwardedCheckoutExtras({ fulfilment: { kind: 'drone' } }, true), {});
  const route = fs.readFileSync(new URL('../../app/api/checkout/route.ts', import.meta.url), 'utf8');
  assert.match(route, /const extras = forwardedCheckoutExtras\(body, Boolean\(siteId\)\);/);
  assert.match(route, /\.\.\.extras,/);
});

test('ALLOW: the cart shows the server\'s delivery words and total line; REFUSE: malformed answers show nothing', () => {
  const inArea = readDeliveryQuote({ lines: [], delivery: { inArea: true, feeCents: 500, freeOverCents: 4000, minimumCents: null, waived: false, words: 'We deliver to 60614. Delivery $5.' } });
  assert.equal(inArea?.words, 'We deliver to 60614. Delivery $5.');
  assert.equal(deliveryTotalLine(inArea), 'Delivery $5');
  assert.equal(deliveryTotalLine(readDeliveryQuote({ delivery: { inArea: true, feeCents: 500, waived: true, words: 'Free delivery.' } })), 'Delivery free');
  const out = readDeliveryQuote({ delivery: { inArea: false, feeCents: null, waived: false, words: "We don't deliver to 60614 yet." } });
  assert.equal(deliveryTotalLine(out), null);
  assert.equal(readDeliveryQuote({ delivery: { inArea: 'yes', words: 'x' } }), null);
  assert.equal(readDeliveryQuote({ lines: [] }), null);
  const choices = fs.readFileSync(new URL('../../components/Navigation/CartChoices.tsx', import.meta.url), 'utf8');
  assert.match(choices, /delivery\.inArea \? delivery\.words : `\$\{delivery\.words\} Pickup is available\.`/);
});

test('ALLOW: once saved, pickup and delivery are offered together only when Local delivery is on and shown', () => {
  const s = readCartSettings({});
  assert.deepEqual(fulfilmentChoices(s, { deliveryOn: true, ships: false }), ['pickup', 'delivery']);
  assert.deepEqual(fulfilmentChoices(s, { deliveryOn: false, ships: false }), ['pickup']);
  assert.deepEqual(fulfilmentChoices(readCartSettings({ showDelivery: false }), { deliveryOn: true, ships: false }), ['pickup']);
  assert.equal(cartNeedsChoices(s, { deliveryOn: true, ships: false }), true, 'the quick card opens the cart to choose');
});

/* ── review B3 (owner decision 2026-10-29: opt-in, plus Ship) ──────────── */

const ON = { deliveryOn: true, ships: true };

test('REFUSE (B3): no values.cart, delivery on, ships: the checkout body is today\'s and nothing else', () => {
  const settings = readCartSettings(undefined);
  const choices = fulfilmentChoices(settings, ON);
  assert.deepEqual(choices, [], 'no choice radio at all');
  const kind = currentKind(choices, null);
  assert.equal(kind, null);
  // Whatever the shopper's state holds, nothing new is sent.
  const extras = checkoutExtras(checkoutChoice({ settings, choices, kind, note: 'typed anyway', pickupAt: '2026-11-04T21:00:00.000Z', zip: '60614' }));
  assert.deepEqual(extras, {});
  assert.equal(cartNeedsChoices(settings, ON), false, 'Buy now checks out as today');
  assert.equal(choiceBlock({ settings, kind, pickupOffered: false, pickupAt: null, deliveryInArea: false }), null, 'nothing blocks checkout');
  assert.match(dialog, /extras: checkoutExtras\(checkoutChoice\(\{ settings, choices, kind, note, pickupAt, zip \}\)\)/, 'the dialog sends exactly this');
  assert.match(dialog, /const kind = currentKind\(choices, pickedKind\);/);
});

test('ALLOW (B3): saved settings and a shop that ships default to "Ship it to me", which sends kind ship', () => {
  const settings = readCartSettings({ title: 'Your bag' });
  const choices = fulfilmentChoices(settings, ON);
  assert.deepEqual(choices, ['ship', 'pickup', 'delivery']);
  const kind = currentKind(choices, null);
  assert.equal(kind, 'ship');
  assert.equal(FULFILMENT_LABELS.ship, 'Ship it to me');
  assert.deepEqual(checkoutExtras(checkoutChoice({ settings, choices, kind, note: '', pickupAt: null, zip: '' })), { fulfilment: { kind: 'ship' } });
  assert.equal(choiceBlock({ settings, kind, pickupOffered: false, pickupAt: null, deliveryInArea: false }), null);
  assert.deepEqual(forwardedCheckoutExtras({ fulfilment: { kind: 'ship', fee: 9 } }, true), { fulfilment: { kind: 'ship' } }, 'the route forwards ship, never a fee');
});

test('ALLOW (B3): Pickup works when chosen, with a time when pickup times are on', () => {
  const settings = readCartSettings({ pickup: { on: true, noticeMinutes: 60, daysAhead: 3 } });
  const choices = fulfilmentChoices(settings, ON);
  const kind = currentKind(choices, 'pickup');
  assert.equal(kind, 'pickup');
  assert.equal(choiceBlock({ settings, kind, pickupOffered: true, pickupAt: null, deliveryInArea: false }), 'pick-a-time');
  const extras = checkoutExtras(checkoutChoice({ settings, choices, kind, note: '', pickupAt: '2026-11-04T21:00:00.000Z', zip: '' }));
  assert.deepEqual(extras, { fulfilment: { kind: 'pickup', pickupAt: '2026-11-04T21:00:00.000Z' } });
  assert.equal(currentKind(['pickup'], 'delivery'), 'pickup', 'a pick no longer offered falls back to the default');
});

test('REFUSE (review note 2): pickup times on with none offered says so and blocks, never a doomed checkout', () => {
  const settings = readCartSettings({ pickup: { on: true } });
  assert.equal(choiceBlock({ settings, kind: 'pickup', pickupOffered: false, pickupAt: null, deliveryInArea: false }), 'no-pickup-times');
  assert.equal(NO_PICKUP_TIMES, 'No pickup times right now.');
  const choicesSrc = fs.readFileSync(new URL('../../components/Navigation/CartChoices.tsx', import.meta.url), 'utf8');
  assert.match(choicesSrc, /\{noPickupTimes \? \(/);
  assert.match(dialog, /noPickupTimes=\{blocked === "no-pickup-times"\}/);
});

test('REFUSE: a shop rule keeps the cart open with its own words; an unknown code does not pass', () => {
  for (const code of ['BELOW_MINIMUM', 'BELOW_DELIVERY_MINIMUM', 'OUT_OF_AREA', 'PICKUP_UNAVAILABLE']) {
    const r = checkoutRefusal(409, 'upstream text', { errorCode: code, ownerSafe: true });
    assert.equal(r.reason, CHECKOUT_SHOP_RULE, code);
    assert.ok(!r.error.includes('upstream text'));
  }
  assert.equal(checkoutRefusal(409, 'x', { errorCode: 'PICKUP_UNAVAILABLE' }).error, 'This pickup time is no longer available. Pick another.');
  assert.equal(checkoutRefusal(409, 'x', { errorCode: 'constructor' }).reason, undefined, 'never resolved through the prototype');
  assert.match(dialog, /if \(err instanceof CheckoutShopRuleError\) \{\s*setRuleNotice\(err\.message\);\s*return;/, 'the code and choices are kept');
});

test('REFUSE: the two shortcuts past the cart (Added to bag, Buy now) open it when a choice is needed', () => {
  for (const rel of ['../../components/PageTemplates/ProductDetailClient/FloatingCartDialog.tsx', '../cartAdapter.ts']) {
    const src = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
    const ask = src.indexOf('if (cartNeedsChoices(readCartSettings(siteData?.cart), { deliveryOn: deliveryConfigOf(siteData?.pageConfigs)?.enabled === true, ships: shipsOrders(siteData?.businessInfo) })) {');
    assert.ok(ask > 0, `${rel} asks first`);
    assert.ok(ask < src.indexOf('await handleCheckout('), `${rel} asks before checking out`);
  }
});

test('REFUSE: the cart quote forwards only a cleaned ZIP and this site\'s id, never a fee', () => {
  const route = fs.readFileSync(new URL('../../app/api/cart-quote/route.ts', import.meta.url), 'utf8');
  assert.match(route, /cleanZip\(rawFulfilment\.zip\)/);
  assert.match(route, /zip && siteId \? \{ siteId, fulfilment: \{ kind: "delivery", zip \} \} : \{\}/);
  assert.ok(!/fee/i.test(route.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'no fee anywhere in the code');
});

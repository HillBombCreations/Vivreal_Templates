/**
 * F59 (OD-03, OD-04, plan 5.T T4; review 1 B8, review 2 item 4): the shop's
 * flat shipping rates in the cart. The line "Shipping from $<lowest>, free
 * over $<freeOver>", the rates to pick once the way is Ship, and the pick
 * sent to checkout as `fulfilment.shipRateId` (the rate's stable id, never
 * its name or amount). Client CL6 charges the stored rate by that id; with no
 * pick it charges the lowest, which is what the line says.
 *
 * A namespace import, so at a base without the helpers each test fails on
 * its own assertion rather than the whole file failing to load.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as cart from './cartSettings.ts';
import { CHECKOUT_SHOP_RULE, checkoutRefusal } from '../checkoutRequest.ts';

const dialog = fs.readFileSync(new URL('../../components/Navigation/CartDialog.tsx', import.meta.url), 'utf8');
const choicesSrc = fs.readFileSync(new URL('../../components/Navigation/CartChoices.tsx', import.meta.url), 'utf8');

type Fn = (...args: unknown[]) => unknown;
const helper = (name: string): Fn => {
  const fn = (cart as unknown as Record<string, unknown>)[name]; // a named export, checked on the next line
  assert.equal(typeof fn, 'function', `cartSettings exports ${name}`);
  return fn as Fn; // checked to be a function above
};

const RATES = {
  rates: [
    { id: 'express', name: 'Express', amountCents: 1500, estimate: '1 to 2 days' },
    { id: 'standard', name: 'Standard', amountCents: 600, estimate: '3 to 5 days' },
    { id: 'standard-too', name: 'Ground', amountCents: 600 },
  ],
  freeOverCents: 5000,
};
const SHIP_AND_PICKUP = { deliveryOn: false, ships: true };

function checkout(raw: unknown, kind: cart.FulfilmentKind, shipRateId: string | null, ways = SHIP_AND_PICKUP) {
  const settings = cart.readCartSettings(raw);
  const choices = cart.fulfilmentChoices(settings, ways);
  const input = { settings, choices, kind, note: '', pickupAt: null, zip: '', shipRateId };
  return cart.checkoutExtras(cart.checkoutChoice(input as Parameters<typeof cart.checkoutChoice>[0]));
}

test('ALLOW: with rates the cart says "Shipping from" the lowest, and "free over" only with a threshold', () => {
  const line = helper('shippingFromLine');
  assert.equal(line(cart.readCartSettings({ shipping: RATES }).shipping), 'Shipping from $6, free over $50');
  assert.equal(line(cart.readCartSettings({ shipping: { ...RATES, freeOverCents: null } }).shipping), 'Shipping from $6');
  assert.equal(line(cart.readCartSettings({ shipping: { rates: [{ id: 'flat', name: 'Flat', amountCents: 650 }] } }).shipping), 'Shipping from $6.50');
  assert.equal((helper('lowestShipRate')(RATES.rates) as cart.ShipRate).id, 'standard', 'the first of equals, as Client charges');
  assert.match(dialog, /const shippingLine = shipsOrders\(businessInfo\) && kind !== "pickup" && kind !== "delivery" \? shippingFromLine\(settings\.shipping\) : null;/);
});

test('ALLOW: once the way is Ship the rates are offered, the lowest picked first, and the pick goes to checkout by id', () => {
  const section = helper('shippingSection');
  const settings = cart.readCartSettings({ shipping: RATES });
  const shown = section(settings, 'ship', 20) as { show: string; rates: cart.ShipRate[] };
  assert.equal(shown.show, 'rates');
  assert.deepEqual(shown.rates.map((r) => r.id), ['express', 'standard', 'standard-too'], 'in the shop\'s order');
  assert.equal(helper('currentShipRate')(shown.rates, null), 'standard', 'until a pick, the rate checkout would charge');
  assert.equal(helper('currentShipRate')(shown.rates, 'express'), 'express');
  const extras = checkout({ shipping: RATES }, 'ship', 'express');
  assert.deepEqual(extras, { fulfilment: { kind: 'ship', shipRateId: 'express' } }, 'the $15 rate by its id');
  assert.deepEqual(cart.forwardedCheckoutExtras({ ...extras, fee: 1 }, true), extras, 'the route forwards the id, never an amount');
  // Ship as the only way still names itself when a rate is picked, so checkout charges that rate.
  assert.deepEqual(checkout({ shipping: RATES, offerPickup: false }, 'ship', 'express'), { fulfilment: { kind: 'ship', shipRateId: 'express' } });
  assert.equal(helper('shipRateAmount')(shown.rates[0]), '$15');
  assert.equal(cart.CHOOSE_SHIPPING, 'Choose shipping');
});

test('ALLOW: at the free-over amount the cart says "Free shipping" and sends no pick', () => {
  const section = helper('shippingSection');
  const settings = cart.readCartSettings({ shipping: RATES });
  assert.deepEqual(section(settings, 'ship', 50), { show: 'free' });
  assert.deepEqual(section(settings, 'ship', 49.99), { show: 'rates', rates: settings.shipping.rates });
  assert.equal(cart.FREE_SHIPPING, 'Free shipping');
  assert.match(dialog, /const shipRateId = shipping\.show === "rates" \? currentShipRate\(shipping\.rates, pickedRate\) : null;/);
});

test('REFUSE: no rates, no line and no list; the checkout body is today\'s', () => {
  const section = helper('shippingSection');
  const settings = cart.readCartSettings({});
  assert.equal(helper('shippingFromLine')(settings.shipping), null);
  assert.deepEqual(section(settings, 'ship', 20), { show: 'none' });
  assert.deepEqual(checkout({}, 'ship', 'express'), { fulfilment: { kind: 'ship' } }, 'an id the shop does not have is never sent');
  assert.deepEqual(checkout({}, 'ship', null, { deliveryOn: false, ships: true }), { fulfilment: { kind: 'ship' } });
  assert.deepEqual(cart.checkoutExtras(cart.checkoutChoice({ settings: cart.readCartSettings(undefined), choices: [], kind: null, note: '', pickupAt: null, zip: '' })), {}, 'no saved settings: nothing new');
});

test('REFUSE: no shipRateId when the way is not Ship, and none the shop does not store', () => {
  helper('shippingSection');
  assert.deepEqual(checkout({ shipping: RATES }, 'pickup', 'express'), { fulfilment: { kind: 'pickup' } });
  assert.deepEqual(checkout({ shipping: RATES }, 'delivery', 'express', { deliveryOn: true, ships: true }), {}, 'a delivery with no ZIP sends no way at all, and never the rate');
  assert.deepEqual(checkout({ shipping: RATES }, 'ship', 'overnight'), { fulfilment: { kind: 'ship' } });
  assert.deepEqual(
    cart.forwardedCheckoutExtras({ fulfilment: { kind: 'pickup', shipRateId: 'express' } }, true),
    { fulfilment: { kind: 'pickup' } },
    'the route never puts a rate on another way',
  );
  assert.deepEqual(cart.forwardedCheckoutExtras({ fulfilment: { kind: 'ship', shipRateId: 'Express Rate' } }, true), { fulfilment: { kind: 'ship' } }, 'a name is not an id');
  assert.deepEqual(helper('shippingSection')(cart.readCartSettings({ shipping: RATES }), 'pickup', 20), { show: 'none' });
});

test('REFUSE: rates that are not the saved shape are dropped, at most five, as Client reads them', () => {
  helper('shippingSection');
  const read = cart.readCartSettings({
    shipping: {
      rates: [
        { id: 'Bad Id', name: 'A', amountCents: 100 },
        { id: 'neg', name: 'B', amountCents: -1 },
        { id: 'frac', name: 'C', amountCents: 1.5 },
        { id: 'noname', name: '   ', amountCents: 100 },
        { id: 'a', name: 'A', amountCents: 100 }, { id: 'b', name: 'B', amountCents: 200 }, { id: 'c', name: 'C', amountCents: 300 },
        { id: 'd', name: 'D', amountCents: 400 }, { id: 'e', name: 'E', amountCents: 500 }, { id: 'f', name: 'F', amountCents: 600 },
      ],
      freeOverCents: 0,
    },
  }).shipping;
  assert.deepEqual(read.rates.map((r) => r.id), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(read.freeOverCents, null, 'zero is not a free-over amount');
});

test('REFUSE: a rate checkout no longer offers says so in the cart\'s words, and the pick falls back', () => {
  helper('shippingSection');
  const r = checkoutRefusal(409, 'upstream', { errorCode: 'SHIPPING_RATE_UNAVAILABLE', ownerSafe: true });
  assert.equal(r.reason, CHECKOUT_SHOP_RULE);
  assert.equal(r.error, 'That shipping choice is no longer offered. Pick another.');
  assert.match(dialog, /if \(err\.code === "SHIPPING_RATE_UNAVAILABLE"\) setPickedRate\(null\);/);
  assert.match(dialog, /extras: checkoutExtras\(checkoutChoice\(\{ settings, choices, kind, note, pickupAt, zip, deliveryOn: deliveryDay, shipRateId \}\)\)/);
  const rates = choicesSrc.indexOf('{shipping.show === "rates" ? (');
  const free = choicesSrc.indexOf('{shipping.show === "free" ? (');
  assert.ok(rates > 0 && free > 0, 'the cart draws the list and the free line from the section');
  assert.match(choicesSrc, /aria-checked=\{shipRateId === rate\.id\}/);
});

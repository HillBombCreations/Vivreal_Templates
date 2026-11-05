/**
 * F81 N-A2 (plan 5.T T5): a cart whose one way is Pickup draws no choice
 * radio, so until now it said nothing about how the order is got. It now says
 * "You'll pick up this order from the shop." Client fills the way in at
 * checkout for that cart (F81 N-A1).
 *
 * A namespace import, so at a base without the helper the test fails on its
 * own assertion rather than the whole file failing to load.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as cart from './cartSettings.ts';

const choicesSrc = fs.readFileSync(new URL('../../components/Navigation/CartChoices.tsx', import.meta.url), 'utf8');

function lineFor(raw: unknown, ways: { deliveryOn: boolean; ships: boolean }): unknown {
  const fn = (cart as unknown as Record<string, unknown>).pickupOnlyLine; // a named export, checked on the next line
  assert.equal(typeof fn, 'function', 'cartSettings exports pickupOnlyLine');
  return (fn as (choices: unknown) => unknown)(cart.fulfilmentChoices(cart.readCartSettings(raw), ways)); // checked above
}

test('REFUSE (the gap): a pickup-only cart says how the order is got', () => {
  const pickupOnly = { title: 'Your bag' };
  assert.deepEqual(cart.fulfilmentChoices(cart.readCartSettings(pickupOnly), { deliveryOn: false, ships: false }), ['pickup'], 'control: pickup is the one way');
  assert.equal(lineFor(pickupOnly, { deliveryOn: false, ships: false }), "You'll pick up this order from the shop.");
  // Drawn where the radio would be, from the helper, never a second literal.
  const radio = choicesSrc.indexOf('{choices.length > 1 ? (');
  const line = choicesSrc.indexOf('{pickupOnly ? (');
  assert.ok(radio > 0 && line > radio, 'drawn after the choice radio');
  assert.match(choicesSrc, /const pickupOnly = pickupOnlyLine\(choices\);/);
});

test('ALLOW: a cart with more than one way, another one way, or no saved settings is unchanged', () => {
  assert.equal(lineFor({ title: 'Your bag' }, { deliveryOn: true, ships: false }), null, 'pickup and delivery: the radio says it');
  assert.equal(lineFor({ title: 'Your bag' }, { deliveryOn: false, ships: true }), null, 'ship and pickup');
  assert.equal(lineFor({ offerPickup: false }, { deliveryOn: false, ships: true }), null, 'ship only');
  assert.equal(lineFor({ offerPickup: false }, { deliveryOn: true, ships: false }), null, 'delivery only');
  assert.equal(lineFor(undefined, { deliveryOn: false, ships: false }), null, 'no saved settings: today\'s cart');
});

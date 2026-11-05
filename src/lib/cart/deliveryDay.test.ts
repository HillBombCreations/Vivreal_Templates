/**
 * F58 (OD-02, plan 5.T T3): customers choose a delivery day in the cart when
 * the owner turns the switch on (`cart.deliveryDay.on`, Secure S4). The days
 * come from the cart quote (`deliveryDates`, Client CL5); the pick goes to
 * checkout as `fulfilment.deliveryOn`, which Client re-checks.
 *
 * A namespace import, so at a base without the helpers each test fails on
 * its own assertion rather than the whole file failing to load.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as cart from './cartSettings.ts';
import { CHECKOUT_SHOP_RULE, checkoutRefusal } from '../checkoutRequest.ts';

const choicesSrc = fs.readFileSync(new URL('../../components/Navigation/CartChoices.tsx', import.meta.url), 'utf8');
const dialog = fs.readFileSync(new URL('../../components/Navigation/CartDialog.tsx', import.meta.url), 'utf8');

type Fn = (...args: unknown[]) => unknown;
const helper = (name: string): Fn => {
  const fn = (cart as unknown as Record<string, unknown>)[name]; // a named export, checked on the next line
  assert.equal(typeof fn, 'function', `cartSettings exports ${name}`);
  return fn as Fn; // checked to be a function above
};

const ON = { deliveryOn: true, ships: true };
const DAYS = ['2026-11-07', '2026-11-14'];
const quote = (over: Record<string, unknown> = {}) =>
  cart.readDeliveryQuote({ delivery: { inArea: true, status: 'in-area', feeCents: 500, words: 'We deliver to 85004. Delivery $5.', deliveryDates: DAYS, ...over } });

function choose(raw: unknown, kind: cart.FulfilmentKind, deliveryOn: string | null) {
  const settings = cart.readCartSettings(raw);
  const choices = cart.fulfilmentChoices(settings, ON);
  const input = { settings, choices, kind, note: '', pickupAt: null, zip: '85004', deliveryOn };
  return cart.checkoutExtras(cart.checkoutChoice(input as Parameters<typeof cart.checkoutChoice>[0]));
}

test('ALLOW: with the switch on and Delivery chosen, the picked day rides checkout and the route forwards it', () => {
  const section = helper('deliveryDaySection');
  const settings = cart.readCartSettings({ deliveryDay: { on: true } });
  assert.deepEqual(section(settings, quote()), { show: 'days', dates: DAYS }, 'the quote\'s days are offered');
  const extras = choose({ deliveryDay: { on: true } }, 'delivery', '2026-11-14');
  assert.deepEqual(extras, { fulfilment: { kind: 'delivery', zip: '85004', deliveryOn: '2026-11-14' } });
  assert.deepEqual(cart.forwardedCheckoutExtras({ ...extras, fee: 9 }, true), extras, 'the route forwards the day, never a fee');
  assert.equal(cart.readDeliveryQuote({ delivery: { inArea: true, words: 'x', deliveryDates: ['2026-11-07', 'Sat', 7] } })?.deliveryDates?.join(), '2026-11-07', 'only real days are read');
});

test('REFUSE: no deliveryOn when the switch is off, or the way is not Delivery', () => {
  helper('deliveryDaySection');
  assert.deepEqual(choose({}, 'delivery', '2026-11-14'), { fulfilment: { kind: 'delivery', zip: '85004' } }, 'switch off: today\'s delivery body');
  assert.deepEqual(choose({ deliveryDay: { on: 'yes' } }, 'delivery', '2026-11-14'), { fulfilment: { kind: 'delivery', zip: '85004' } }, 'only true is on');
  assert.deepEqual(choose({ deliveryDay: { on: true } }, 'pickup', '2026-11-14'), { fulfilment: { kind: 'pickup' } });
  assert.deepEqual(choose({ deliveryDay: { on: true } }, 'ship', '2026-11-14'), { fulfilment: { kind: 'ship' } });
  assert.deepEqual(choose({ deliveryDay: { on: true } }, 'delivery', 'next Saturday'), { fulfilment: { kind: 'delivery', zip: '85004' } }, 'a malformed day is dropped');
  assert.deepEqual(
    cart.forwardedCheckoutExtras({ fulfilment: { kind: 'pickup', deliveryOn: '2026-11-14' } }, true),
    { fulfilment: { kind: 'pickup' } },
    'the route never puts a day on another way',
  );
});

test('ALLOW (render): the days show only on an in-area quote; REFUSE: before the ZIP is checked, out of the area, switch off', () => {
  const section = helper('deliveryDaySection');
  const on = cart.readCartSettings({ deliveryDay: { on: true } });
  const off = cart.readCartSettings({});
  assert.deepEqual(section(on, null), { show: 'none' }, 'nothing until the ZIP is checked');
  const out = cart.readDeliveryQuote({ delivery: { inArea: false, status: 'out-of-area', words: 'We do not deliver to 90210 yet.', deliveryDates: DAYS } });
  assert.equal(out?.deliveryDates, null, 'an out-of-area answer carries no days');
  assert.deepEqual(section(on, out), { show: 'none' });
  assert.deepEqual(section(on, quote({ deliveryDates: [] })), { show: 'note' }, 'in area with no day free: the shop arranges it');
  assert.deepEqual(section(off, quote()), { show: 'note' }, 'switch off: today\'s note even when days arrive');
  // The section draws what the helper decides, inside the Delivery block only.
  const delivery = choicesSrc.indexOf('{kind === "delivery" ? (');
  const days = choicesSrc.indexOf('{daySection.show === "days" ? (');
  const pickupNote = choicesSrc.indexOf('{noPickupTimes ? (');
  assert.ok(delivery > 0 && days > delivery && days < pickupNote, 'the day list sits inside the Delivery section');
  assert.match(choicesSrc, /\{daySection\.show === "note" \? <div className="mt-1\.5 text-xs text-black\/60">\{DELIVERY_DAY_NOTE\}<\/div> : null\}/, 'today\'s note, unchanged, when off');
  assert.match(choicesSrc, /const daySection = deliveryDaySection\(settings, delivery\);/);
  assert.match(choicesSrc, /\{CHOOSE_DELIVERY_DAY\}/);
  assert.equal(cart.CHOOSE_DELIVERY_DAY, 'Choose your delivery day');
  assert.equal(helper('cartDayLabel')('2026-11-07'), 'Sat Nov 7');
});

test('REFUSE: a day checkout no longer takes says so, and the cart asks the shop\'s days again', () => {
  helper('deliveryDaySection');
  const r = checkoutRefusal(409, 'upstream', { errorCode: 'DELIVERY_DAY_UNAVAILABLE', ownerSafe: true });
  assert.equal(r.reason, CHECKOUT_SHOP_RULE);
  assert.equal(r.error, 'That delivery day is no longer available. Pick another day.');
  assert.match(dialog, /if \(err\.code === "DELIVERY_DAY_UNAVAILABLE"\) void onCheckZip\(\);/);
  assert.match(dialog, /extras: checkoutExtras\(checkoutChoice\(\{ settings, choices, kind, note, pickupAt, zip, deliveryOn: deliveryDay(, shipRateId)? \}\)\)/);
  // A new ZIP, a new bag or a new quote clears the pick.
  assert.equal((dialog.match(/setDeliveryDay\(null\);/g) ?? []).length, 3);
});

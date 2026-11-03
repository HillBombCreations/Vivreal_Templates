/**
 * F54 fix round (vivreal-hq docs/projects/next-release-2026-12/f54-fix-round.md
 * section 5, owner answers 7a): the cart's Pickup switch, the delivery words
 * per status, the new checkout refusals, and the cart lines around them.
 *
 * A namespace import, so each test fails on its own assertion when a helper
 * is missing rather than the whole file failing to load.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as cart from './cartSettings.ts';
import * as request from '../checkoutRequest.ts';
import { CHECKOUT_SHOP_RULE, checkoutRefusal } from '../checkoutRequest.ts';

const dialog = fs.readFileSync(new URL('../../components/Navigation/CartDialog.tsx', import.meta.url), 'utf8');
const choicesSrc = fs.readFileSync(new URL('../../components/Navigation/CartChoices.tsx', import.meta.url), 'utf8');
const route = fs.readFileSync(new URL('../../app/api/checkout/route.ts', import.meta.url), 'utf8');
const EM = String.fromCharCode(8212);
const EN = String.fromCharCode(8211);

type Fn = (...args: unknown[]) => unknown;
const helper = (name: string): Fn => {
  const fn = (cart as unknown as Record<string, unknown>)[name]; // reads a named export; checked on the next line
  assert.equal(typeof fn, 'function', `cartSettings exports ${name}`);
  return fn as Fn; // checked to be a function above
};

/* L-10 D5: Offer pickup */

test('REFUSE (D5): a saved cart with offerPickup false offers no Pickup', () => {
  const off = cart.readCartSettings({ offerPickup: false, title: 'Your bag' });
  assert.ok(!cart.fulfilmentChoices(off, { deliveryOn: true, ships: true }).includes('pickup'), 'no Pickup with the switch off');
  assert.deepEqual(cart.fulfilmentChoices(off, { deliveryOn: true, ships: true }), ['ship', 'delivery']);
  assert.deepEqual(cart.fulfilmentChoices(off, { deliveryOn: false, ships: true }), ['ship']);
  assert.equal(cart.cartNeedsChoices(off, { deliveryOn: false, ships: true }), false, 'ship only: Buy now checks out as before');
});

test('ALLOW (D5): absent or true keeps Pickup, so saved carts keep it', () => {
  for (const raw of [{}, { offerPickup: true }, { offerPickup: 'no' }, { offerPickup: null }]) {
    assert.deepEqual(cart.fulfilmentChoices(cart.readCartSettings(raw), { deliveryOn: false, ships: true }), ['ship', 'pickup'], JSON.stringify(raw));
  }
});

test('REFUSE (D5): delivery as the only way still opens the cart and still sends the delivery with its ZIP', () => {
  const settings = cart.readCartSettings({ offerPickup: false });
  const ways = { deliveryOn: true, ships: false };
  const choices = cart.fulfilmentChoices(settings, ways);
  assert.deepEqual(choices, ['delivery']);
  assert.equal(cart.cartNeedsChoices(settings, ways), true, 'Buy now opens the cart for the ZIP');
  const kind = cart.currentKind(choices, null);
  assert.equal(kind, 'delivery');
  const extras = cart.checkoutExtras(cart.checkoutChoice({ settings, choices, kind, note: '', pickupAt: null, zip: '60614' }));
  assert.deepEqual(extras, { fulfilment: { kind: 'delivery', zip: '60614' } }, 'never a delivery checked out with no ZIP');
});

/* L-10 D6: the server's words per status */

test('REFUSE (D6): a no never ends "Pickup is available." unless pickup is really offered', () => {
  assert.ok(!choicesSrc.includes('`${delivery.words} Pickup is available.`'), 'the cart no longer adds pickup to every no');
  const answer = helper('deliveryAnswerLine');
  const notChecked = cart.readDeliveryQuote({
    delivery: { inArea: false, status: 'zip-not-recognized', feeCents: null, waived: false, pickupOffered: false, words: 'We could not check 99999. Send us your address and we will let you know right away.' },
  });
  assert.ok(notChecked);
  assert.equal(answer(notChecked, true), 'We could not check 99999. Send us your address and we will let you know right away.', 'the shop does not offer pickup');
  const out = cart.readDeliveryQuote({ delivery: { inArea: false, status: 'out-of-area', pickupOffered: true, words: 'We do not deliver to 85001 yet.' } });
  assert.ok(out);
  assert.equal(answer(out, false), 'We do not deliver to 85001 yet.', 'this cart offers no Pickup');
  const missing = cart.readDeliveryQuote({ delivery: { inArea: false, status: 'price-missing', pickupOffered: false, words: 'Delivery is not available online yet. Contact the shop to arrange it.' } });
  assert.ok(missing);
  assert.equal(missing.status, 'price-missing');
  assert.equal(answer(missing, true), 'Delivery is not available online yet. Contact the shop to arrange it.');
  assert.equal(cart.deliveryTotalLine(missing), null, 'a delivery with no price is never "Delivery free"');
  assert.equal(cart.choiceBlock({ settings: cart.readCartSettings({}), kind: 'delivery', pickupOffered: false, pickupAt: null, deliveryInArea: missing.inArea }), 'check-zip', 'checkout stays off');
});

test('ALLOW (D6): a no with pickup offered by the shop and the cart adds it; in area shows the words as sent', () => {
  const answer = helper('deliveryAnswerLine');
  const out = cart.readDeliveryQuote({ delivery: { inArea: false, status: 'out-of-area', pickupOffered: true, words: 'We do not deliver to 85001 yet.' } });
  assert.equal(answer(out, true), 'We do not deliver to 85001 yet. Pickup is available.');
  const older = cart.readDeliveryQuote({ delivery: { inArea: false, words: "We don't deliver to 85001 yet." } });
  assert.ok(older);
  assert.equal(older.status, null);
  assert.equal(older.pickupOffered, true, 'an older Client sends no pickupOffered: the cart decides');
  assert.equal(answer(older, true), "We don't deliver to 85001 yet. Pickup is available.");
  const yes = cart.readDeliveryQuote({ delivery: { inArea: true, status: 'in-area', feeCents: 500, pickupOffered: true, words: 'We deliver to 60614. Delivery $5.' } });
  assert.equal(answer(yes, true), 'We deliver to 60614. Delivery $5.');
  assert.match(choicesSrc, /\{deliveryAnswerLine\(delivery, choices\.includes\("pickup"\)\)\}/, 'the cart draws exactly this');
});

/* The new Client refusal codes, in the server's words */

test('REFUSE (codes): each F54 refusal keeps the cart open with the server\'s words, the ZIP named', () => {
  const cases: Array<[string, string]> = [
    ['DELIVERY_PRICE_MISSING', 'Delivery is not available online yet. Contact the shop to arrange it.'],
    ['ZIP_NOT_RECOGNIZED', 'We could not check 99999. Send us your address and we will let you know right away.'],
    ['DELIVERY_ORIGIN_MISSING', 'We cannot check delivery just yet. Send us your address and we will let you know right away.'],
    ['PICKUP_NOT_OFFERED', 'This shop does not offer pickup.'],
    ['OUT_OF_AREA', 'We do not deliver to 99999 yet.'],
  ];
  for (const [code, words] of cases) {
    const r = checkoutRefusal(409, 'upstream text', { error: 'upstream text', errorCode: code, ownerSafe: true }, '99999');
    assert.equal(r.reason, CHECKOUT_SHOP_RULE, code);
    assert.equal(r.error, words, code);
    assert.ok(!r.error.includes(EM) && !r.error.includes(EN), code);
  }
  assert.doesNotMatch(checkoutRefusal(409, 'x', { errorCode: 'OUT_OF_AREA' }, '99999').error, /pickup/i, 'never offers a pickup the shop may not offer');
  assert.match(route, /checkoutRefusal\(res\.status, data\?\.error, data, extras\.fulfilment\?\.zip\)/, 'the route names the ZIP it sent');
});

test('ALLOW (codes): no ZIP, or a malformed one, reads "that ZIP"', () => {
  assert.equal(checkoutRefusal(409, 'x', { errorCode: 'ZIP_NOT_RECOGNIZED' }).error, 'We could not check that ZIP. Send us your address and we will let you know right away.');
  assert.equal(checkoutRefusal(409, 'x', { errorCode: 'OUT_OF_AREA' }, '<b>1').error, 'We do not deliver to that ZIP yet.');
  assert.equal(checkoutRefusal(400, 'x', { errorCode: 'PICKUP_NOT_OFFERED' }).reason, undefined, 'only a 409 is a shop rule');
});

/* L-10 D7: no "No shipping" per line with Pickup or Delivery */

test('REFUSE (D7): no per-line "No shipping" or "Shipping calculated" when Pickup or Delivery is chosen', () => {
  assert.ok(!dialog.includes(': "No shipping"'), 'the dialog no longer hard-codes the per-line words');
  const note = helper('lineShippingNote');
  for (const kind of ['delivery', 'pickup']) {
    assert.equal(note(false, kind), null, kind);
    assert.equal(note(true, kind), null, kind);
  }
  assert.match(dialog, /const shippingNote = lineShippingNote\(shipsOrders\(businessInfo\), kind\);/);
});

test('ALLOW (D7): no choice, or Ship, keeps today\'s words', () => {
  const note = helper('lineShippingNote');
  assert.equal(note(false, null), 'No shipping');
  assert.equal(note(true, null), 'Shipping calculated at checkout');
  assert.equal(note(true, 'ship'), 'Shipping calculated at checkout');
});

/* L-10 D9: the radius line */

const deliveryPage = (sectionConfig: Record<string, unknown>, collectionId?: string) => [
  { blocks: [{ type: { dispatchId: 'delivery-check' }, config: { bindings: [{ sectionConfig, ...(collectionId ? { collectionId } : {}) }] } }] },
];

test('REFUSE (D9): no 25 mile default, and no radius line when the site has zones', () => {
  assert.ok(!/deliveryRadiusMiles\)\s*\|\|\s*25/.test(dialog), 'the 25 default is gone');
  const line = helper('deliveryRadiusLine');
  const bound = helper('deliveryZonesBound');
  assert.equal(line({}, false), null, 'an empty box says nothing');
  assert.equal(line(undefined, false), null);
  assert.equal(line({ deliveryRadiusMiles: 0 }, false), null);
  assert.equal(line({ deliveryRadiusMiles: '10' }, false), null);
  const zoned = deliveryPage({ deliveryRadiusMiles: 10 }, '0123456789abcdef01234567');
  assert.equal(bound(zoned), true);
  assert.equal(line({ deliveryRadiusMiles: 10 }, bound(zoned)), null, 'zones decide the area');
});

test('ALLOW (D9): a set radius on a site with no zones is shown', () => {
  const line = helper('deliveryRadiusLine');
  const bound = helper('deliveryZonesBound');
  const plain = deliveryPage({ deliveryRadiusMiles: 10 });
  assert.equal(bound(plain), false);
  assert.equal(bound(deliveryPage({}, 'not-an-id')), false, 'a malformed id is not a zone table');
  assert.equal(bound([{ blocks: [{ type: { dispatchId: 'delivery-check' }, enabled: false, config: { bindings: [{ collectionId: '0123456789abcdef01234567' }] } }] }]), false, 'a switched-off check is skipped');
  assert.equal(line({ deliveryRadiusMiles: 10 }, bound(plain)), 10);
  assert.match(choicesSrc, /We deliver within \{radiusMiles\} miles\./);
});

/* L-10 D10: name the shop's zone under the pickup times */

test('REFUSE (D10): a customer in another zone is told whose clock the pickup times are on', () => {
  assert.match(choicesSrc, /shopTimeZoneNote\(timeZone, Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone\)/, 'the picker names the shop zone');
  const zone = helper('shopTimeZoneNote');
  assert.equal(zone('America/Phoenix', 'America/New_York'), 'Times are Phoenix time.');
  assert.equal(zone('America/Los_Angeles', 'Europe/London'), 'Times are Los Angeles time.');
});

test('ALLOW (D10): the same zone, or an unknown one, adds nothing', () => {
  const zone = helper('shopTimeZoneNote');
  assert.equal(zone('America/Phoenix', 'America/Phoenix'), null);
  assert.equal(zone('Not/AZone', 'America/Phoenix'), null);
  assert.equal(zone(undefined, 'America/Phoenix'), null);
  assert.equal(zone('America/Phoenix', ''), null);
});

/* L-10 D11 (owner answer 3): the shop confirms the delivery day */

test('REFUSE (D11): with Delivery chosen the cart says the shop will confirm the day', () => {
  const words = (cart as unknown as Record<string, unknown>).DELIVERY_DAY_NOTE; // a named export, checked below
  assert.equal(words, 'The shop will confirm your delivery day.');
  const delivery = choicesSrc.indexOf('{kind === "delivery" ? (');
  const note = choicesSrc.indexOf('{DELIVERY_DAY_NOTE}');
  const pickupNote = choicesSrc.indexOf('{noPickupTimes ? (');
  assert.ok(delivery > 0 && note > delivery && note < pickupNote, 'drawn inside the Delivery section only');
});

/* Coordinator 2026-11-03: no refusal suggests Pickup when the shop does not offer it */

const BELOW_DELIVERY = 'Your order is below the minimum for delivery. Add a little more, or choose pickup.';
const BELOW_DELIVERY_NO_PICKUP = 'Your order is below the minimum for delivery. Add a little more.';

const ruleWords = (): Fn => {
  const fn = (request as unknown as Record<string, unknown>).shopRuleWords; // reads a named export; checked on the next line
  assert.equal(typeof fn, 'function', 'checkoutRequest exports shopRuleWords');
  return fn as Fn; // checked to be a function above
};

test('REFUSE (pickup words): below the delivery minimum never says "or choose pickup" when Pickup is not offered', () => {
  assert.match(dialog, /setRuleNotice\(shopRuleWords\(err\.code, err\.message, cartOffersPickup\)\)/, 'the cart picks the words by whether Pickup is offered');
  assert.match(dialog, /const cartOffersPickup = choices\.includes\("pickup"\) && delivery\?\.pickupOffered !== false;/);
  const refusal = checkoutRefusal(409, 'x', { errorCode: 'BELOW_DELIVERY_MINIMUM' }, '60614') as { error: string; code?: string };
  assert.equal(refusal.code, 'BELOW_DELIVERY_MINIMUM', 'the route names the rule');
  const words = ruleWords();
  assert.equal(words(refusal.code, refusal.error, false), BELOW_DELIVERY_NO_PICKUP);
  assert.doesNotMatch(String(words(refusal.code, refusal.error, false)), /pickup/i);
});

test('ALLOW (pickup words): with Pickup offered the message is unchanged; other rules are untouched', () => {
  const words = ruleWords();
  const refusal = checkoutRefusal(409, 'x', { errorCode: 'BELOW_DELIVERY_MINIMUM' }) as { error: string; code?: string };
  assert.equal(words(refusal.code, refusal.error, true), BELOW_DELIVERY);
  const out = checkoutRefusal(409, 'x', { errorCode: 'OUT_OF_AREA' }, '85001') as { error: string; code?: string };
  assert.equal(words(out.code, out.error, false), 'We do not deliver to 85001 yet.');
  assert.equal(words(undefined, 'Some message.', false), 'Some message.', 'no code keeps the message');
  assert.equal(words('constructor', 'Some message.', false), 'Some message.', 'never resolved through the prototype');
  // Every shop-rule sentence naming pickup has a no-pickup form, except the
  // pickup-only rules, which only ever answer a pickup.
  for (const [code, text] of Object.entries(request.SHOP_RULE_SENTENCES)) {
    if (!/pickup/i.test(text) || code.startsWith('PICKUP_')) continue;
    assert.doesNotMatch(String(words(code, text, false)), /pickup/i, code);
  }
});

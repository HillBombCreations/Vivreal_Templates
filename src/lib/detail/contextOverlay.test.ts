import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyContextOverrides } from './contextOverlay.ts';

const item = { id: 'i1', raw: { bookingUrl: 'https://default.example', price: '$199' } };

test('applyContextOverrides: absent context ⇒ item returned untouched (byte-identical)', () => {
  const out = applyContextOverrides(item, undefined, { bookingUrl: 'bookingUrl' });
  assert.equal(out, item);
});

test('applyContextOverrides: absent overrides ⇒ item returned untouched', () => {
  const out = applyContextOverrides(item, { bookingUrl: 'https://sm.example' }, undefined);
  assert.equal(out, item);
});

test('applyContextOverrides: listed field is replaced, everything else untouched', () => {
  const out = applyContextOverrides(
    item,
    { bookingUrl: 'https://sm.example' },
    { bookingUrl: 'bookingUrl' },
  );
  assert.equal(out.raw?.bookingUrl, 'https://sm.example');
  assert.equal(out.raw?.price, '$199', 'unlisted field untouched');
  assert.notEqual(out, item, 'a clone, not a mutation of the original');
  assert.equal(item.raw.bookingUrl, 'https://default.example', 'original item never mutated');
});

test('applyContextOverrides: a contextField the context object does not carry is a no-op for that mapping', () => {
  const out = applyContextOverrides(
    item,
    { phone: '555-0100' },
    { bookingUrl: 'bookingUrl' }, // context has no 'bookingUrl' key
  );
  assert.equal(out, item, 'no listed override resolved, so nothing changed — same reference');
});

test('applyContextOverrides: itemField ← contextField can rename across different keys', () => {
  const out = applyContextOverrides(
    item,
    { locationBookingUrl: 'https://sm.example' },
    { bookingUrl: 'locationBookingUrl' },
  );
  assert.equal(out.raw?.bookingUrl, 'https://sm.example');
});

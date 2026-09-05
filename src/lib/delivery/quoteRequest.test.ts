import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_BODY_CHARS,
  prepareDeliveryQuoteRequest,
} from './quoteRequest.ts';

function ok(bodyText: string) {
  const result = prepareDeliveryQuoteRequest(bodyText);
  assert.equal(result.ok, true, `expected a prepared request, got ${JSON.stringify(result)}`);
  // Narrowed by the assertion above; TypeScript cannot see through `assert`.
  return (result as { ok: true; body: Record<string, unknown> }).body;
}

test('deliveryDays survives the round trip, verbatim', () => {
  // The field is authored in the renderer's block config and read by the date
  // arithmetic in VR_Client_API. This layer's only job is to not lose it. A
  // proxy that rebuilds the request from the fields it knows about is exactly
  // how a correctly built endpoint returns the wrong delivery date.
  const body = ok(
    JSON.stringify({ zip: '37604', deliveryDays: ['saturday'] }),
  );
  assert.deepEqual(body.deliveryDays, ['saturday']);
});

test('a full week of delivery days survives, in order and in case', () => {
  // Lowercase day NAMES, never numbers: three repos and a Mongo document have
  // to agree, and 0-meaning-Sunday-or-Monday is the off-by-one nobody notices
  // until a customer is told the wrong date.
  const days = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  assert.deepEqual(ok(JSON.stringify({ zip: '37604', deliveryDays: days })).deliveryDays, days);
});

test('an absent deliveryDays stays absent, and is not filled in', () => {
  // Absent or empty means any day, which is today's behaviour for every other
  // site. Inventing a default here would change it for all of them.
  const body = ok(JSON.stringify({ zip: '37604' }));
  assert.equal('deliveryDays' in body, false);

  const empty = ok(JSON.stringify({ zip: '37604', deliveryDays: [] }));
  assert.deepEqual(empty.deliveryDays, []);
});

test('zones, originZip and nested values pass through untouched', () => {
  const zones = [
    { zoneName: 'Close by', maxMiles: 8, fee: 8, leadTimeDays: 2 },
    { zoneName: 'Tri-Cities', maxMiles: 25, fee: 12, leadTimeDays: 3, notes: 'Saturdays only' },
  ];
  const body = ok(JSON.stringify({ zip: '37604', originZip: '37659', zones }));
  assert.deepEqual(body.zones, zones);
  assert.equal(body.originZip, '37659');
});

test('a key this proxy has never heard of still reaches the upstream', () => {
  // The next field added to this contract must not need a change here.
  const body = ok(JSON.stringify({ zip: '37604', somethingAddedLater: { a: [1, 2] } }));
  assert.deepEqual(body.somethingAddedLater, { a: [1, 2] });
});

test('the ZIP is trimmed and nothing else is normalised', () => {
  const body = ok(JSON.stringify({ zip: '  37604 ', zoneName: '  Close by  ' }));
  assert.equal(body.zip, '37604');
  assert.equal(body.zoneName, '  Close by  ', 'only the field this layer validates is touched');
});

test('anything that is not five digits is rejected before any upstream work', () => {
  for (const zip of ['3760', '376045', '37604-1234', 'ABCDE', '', '  ', '3760a']) {
    const result = prepareDeliveryQuoteRequest(JSON.stringify({ zip }));
    assert.equal(result.ok, false, `expected ${JSON.stringify(zip)} to be rejected`);
    assert.equal((result as { status: number }).status, 400);
  }
});

test('a missing or non-string ZIP is rejected, never coerced', () => {
  // `zip: 37604` as a NUMBER would stringify to a valid-looking ZIP and lose
  // any leading zero on the way (00501 is a real ZIP).
  for (const body of [{}, { zip: null }, { zip: 37604 }, { zip: ['37604'] }]) {
    const result = prepareDeliveryQuoteRequest(JSON.stringify(body));
    assert.equal(result.ok, false, `expected ${JSON.stringify(body)} to be rejected`);
  }
});

test('a body that is not a JSON object is rejected', () => {
  for (const text of ['not json', '[]', 'null', '"37604"', '42', '']) {
    const result = prepareDeliveryQuoteRequest(text);
    assert.equal(result.ok, false, `expected ${JSON.stringify(text)} to be rejected`);
    assert.equal((result as { status: number }).status, 400);
  }
});

test('an oversized body is refused rather than relayed', () => {
  // Public and unauthenticated: an anonymous caller must not be able to make us
  // relay an arbitrary payload to a Lambda on the read path.
  const huge = JSON.stringify({ zip: '37604', pad: 'x'.repeat(MAX_BODY_CHARS) });
  const result = prepareDeliveryQuoteRequest(huge);
  assert.equal(result.ok, false);
  assert.equal((result as { status: number }).status, 413);
});

test('a body right at the cap is still accepted', () => {
  // The cap must not be so tight that a real zone list trips it.
  const base = JSON.stringify({ zip: '37604', pad: '' });
  const pad = 'x'.repeat(MAX_BODY_CHARS - base.length);
  const body = ok(JSON.stringify({ zip: '37604', pad }));
  assert.equal((body.pad as string).length, pad.length);
});

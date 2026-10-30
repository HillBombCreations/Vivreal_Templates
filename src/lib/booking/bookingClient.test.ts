/**
 * Owner ideas 2026-10-29, T2 and T4: reading the booking routes' answers in
 * the browser, and the cancel page's handling of its token.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MANAGE_TOKEN, readCancel, readLookup, slotsForDay } from './bookingClient.ts';

test('ALLOW: a day\'s open times are the ones on that day on the shop\'s clock', () => {
  const body = {
    timeZone: 'America/Chicago',
    slots: [
      { start: '2026-11-04T04:30:00.000Z', end: 'x' }, // Nov 3, 10:30 pm Chicago
      { start: '2026-11-04T15:00:00.000Z', end: 'x' }, // Nov 4, 9:00 am Chicago
      { start: '2026-11-05T15:00:00.000Z', end: 'x' },
      { start: 'not a date' },
    ],
  };
  assert.deepEqual(slotsForDay(body, '2026-11-04'), [{ start: '2026-11-04T15:00:00.000Z' }]);
  assert.deepEqual(slotsForDay(null, '2026-11-04'), []);
});

test('ALLOW: a lookup reads the booking; REFUSE: an invalid link reads as expired, a failure as a failure', () => {
  const found = readLookup(200, { booking: { serviceName: 'Cut', staffName: 'Sam', start: '2026-11-04T15:00:00.000Z', status: 'booked', cancelable: true } });
  assert.deepEqual(found, { kind: 'found', booking: { serviceName: 'Cut', staffName: 'Sam', start: '2026-11-04T15:00:00.000Z', cancelable: true } });
  const canceled = readLookup(200, { booking: { serviceName: 'Cut', start: '2026-11-04T15:00:00.000Z', status: 'cancelled', cancelable: true } });
  assert.equal(canceled.kind === 'found' && canceled.booking.cancelable, false, 'a canceled booking offers no cancel');
  assert.deepEqual(readLookup(404, { errorCode: 'BOOKING_LINK_INVALID' }), { kind: 'invalid' });
  assert.deepEqual(readLookup(502, {}), { kind: 'error' });
  assert.deepEqual(readLookup(200, { booking: { start: 'nope' } }), { kind: 'error' });
});

test('ALLOW: a cancel answer maps to the renderer\'s three outcomes', () => {
  assert.equal(readCancel(200, { canceled: true }), 'canceled');
  assert.equal(readCancel(409, { errorCode: 'ALREADY_CANCELED' }), 'canceled');
  assert.equal(readCancel(409, { errorCode: 'CANCEL_TOO_LATE' }), 'too-late');
  assert.equal(readCancel(500, {}), 'error');
  assert.equal(readCancel(200, {}), 'error', 'a 200 that does not say canceled is not a cancel');
});

test('REFUSE: a token that is not `<24 hex>.<43 base64url>` is never sent', () => {
  assert.ok(MANAGE_TOKEN.test(`${'a'.repeat(24)}.${'B'.repeat(43)}`));
  for (const bad of ['', 'x', `${'a'.repeat(24)}.${'B'.repeat(42)}`, `${'g'.repeat(24)}.${'B'.repeat(43)}`, `${'a'.repeat(24)}.${'B'.repeat(43)}x`]) {
    assert.equal(MANAGE_TOKEN.test(bad), false, bad);
  }
  const client = fs.readFileSync(new URL('../../components/Booking/BookingManageClient.tsx', import.meta.url), 'utf8');
  assert.match(client, /if \(!MANAGE_TOKEN\.test\(t\)\) \{\s*setView\(\{ kind: "ready", booking: null \}\);\s*return;/);
  assert.match(client, /window\.history\.replaceState\(/, 'the token leaves the visible address');
});

test('REFUSE: the cancel page is never indexed and sends no referrer', () => {
  const page = fs.readFileSync(new URL('../../app/booking/manage/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /referrer: "no-referrer"/);
  assert.match(page, /export const dynamic = "force-dynamic";/);
});

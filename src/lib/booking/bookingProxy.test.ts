/**
 * Owner ideas 2026-10-29, T3 (plan 3.4): the website's booking routes.
 *
 *   ALLOW  a request forwards to VR_Client_API with the site key, carrying only
 *          the validator's fields;
 *   REFUSE a filled honeypot is answered as sent and NEVER forwarded;
 *   REFUSE an oversized body, a non-object body and a malformed slots query
 *          never reach upstream;
 *   REFUSE a refusal shows the browser its code, never the upstream sentence.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { handleBookingRoute, mapUpstream, MAX_BODY_BYTES, type BookingRequestLike, type FetchLike } from './bookingProxy.ts';

const ENV = { apiKey: 'site-key-123', clientApiUrl: 'https://client.example', siteId: '6a68169fe1457c2f3fd04530' };

function post(body: unknown, headers: Record<string, string> = {}): BookingRequestLike {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return { method: 'POST', url: 'https://shop.example/api/booking/request', headers: { get: (n) => headers[n.toLowerCase()] ?? null }, text: async () => text };
}

function spy(status = 200, json: unknown = { success: true, data: { ok: true, emailed: true } }) {
  const calls: Array<{ url: string; init: Parameters<FetchLike>[1] }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return { status, json: async () => json };
  };
  return { calls, fetchImpl };
}

const REQUEST = { what: 'Haircut', day: '2026-11-08', timeOfDay: 'morning', name: 'Sam', phone: '555 123 4567', email: '', note: 'first visit', website: '' };

test('ALLOW: a request forwards to Client API with the site key and only the validator fields', async () => {
  const { calls, fetchImpl } = spy();
  const answer = await handleBookingRoute('request', post({ ...REQUEST, groupID: 'someone-else', siteId: 'x', fee: 1 }), ENV, fetchImpl);
  assert.deepEqual(answer, { status: 200, body: { ok: true, emailed: true } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://client.example/tenant/bookingRequest');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'site-key-123');
  assert.equal(calls[0].init.cache, 'no-store');
  assert.deepEqual(JSON.parse(calls[0].init.body ?? ''), {
    what: 'Haircut', day: '2026-11-08', timeOfDay: 'morning', name: 'Sam', phone: '555 123 4567', note: 'first visit',
  }, 'no groupID, no visitor siteId, no stray key, and empty optionals dropped');
});

test('ALLOW: the visitor\'s address rides to Client so its per-visitor limit is per visitor', async () => {
  const { calls, fetchImpl } = spy();
  await handleBookingRoute('request', post(REQUEST, { 'cloudfront-viewer-address': '[2001:db8::7]:443', 'x-forwarded-for': '10.0.0.1' }), ENV, fetchImpl);
  assert.equal(calls[0].init.headers['x-forwarded-for'], '2001:db8::7', 'CloudFront viewer address wins, unbracketed, port dropped');
  await handleBookingRoute('request', post(REQUEST, { 'x-forwarded-for': '203.0.113.9' }), ENV, fetchImpl);
  assert.equal(calls[1].init.headers['x-forwarded-for'], '203.0.113.9');
});

test('REFUSE: with no visitor address no header is invented', async () => {
  const { calls, fetchImpl } = spy();
  await handleBookingRoute('request', post(REQUEST), ENV, fetchImpl);
  assert.equal('x-forwarded-for' in calls[0].init.headers, false);
});

test('REFUSE: a filled honeypot is answered as sent and never forwarded', async () => {
  for (const route of ['request', 'create'] as const) {
    const { calls, fetchImpl } = spy();
    const answer = await handleBookingRoute(route, post({ ...REQUEST, website: 'https://spam.example' }), ENV, fetchImpl);
    assert.equal(calls.length, 0, `${route} must not forward`);
    assert.equal(answer.status, 200);
    assert.equal(answer.body.ok, true, 'the bot sees a success');
  }
});

test('ALLOW: create carries this deployment\'s SITE_ID, never the visitor\'s', async () => {
  const { calls, fetchImpl } = spy(200, { success: true, data: { ok: true, serviceName: 'Cut', start: '2026-11-04T20:30:00.000Z', email: 'a@b.co' } });
  await handleBookingRoute('create', post({ serviceItemId: 'a'.repeat(24), start: '2026-11-04T20:30:00.000Z', name: 'Sam', phone: '5551234567', email: 'a@b.co', website: '', siteId: 'b'.repeat(24) }), ENV, fetchImpl);
  assert.equal(JSON.parse(calls[0].init.body ?? '').siteId, ENV.siteId);
});

test('REFUSE: an oversized, malformed or non-object body never reaches upstream', async () => {
  const { calls, fetchImpl } = spy();
  assert.equal((await handleBookingRoute('request', post('x'.repeat(MAX_BODY_BYTES + 1)), ENV, fetchImpl)).status, 413);
  assert.equal((await handleBookingRoute('request', post({}, { 'content-length': String(MAX_BODY_BYTES + 1) }), ENV, fetchImpl)).status, 413);
  assert.equal((await handleBookingRoute('request', post('{not json'), ENV, fetchImpl)).status, 400);
  assert.equal((await handleBookingRoute('request', post('[1,2]'), ENV, fetchImpl)).status, 400);
  assert.equal(calls.length, 0);
});

test('REFUSE: no site key answers 503 with no request made', async () => {
  const { calls, fetchImpl } = spy();
  assert.equal((await handleBookingRoute('request', post(REQUEST), { ...ENV, apiKey: undefined }, fetchImpl)).status, 503);
  assert.equal(calls.length, 0);
});

test('ALLOW: slots rebuilds its query from validated values; REFUSE: anything else is a 400 with no request', async () => {
  const { calls, fetchImpl } = spy(200, { success: true, data: { timeZone: 'America/Chicago', slots: [] } });
  const get = (q: string): BookingRequestLike => ({ method: 'GET', url: `https://shop.example/api/booking/slots?${q}`, headers: { get: () => null }, text: async () => '' });
  const ok = await handleBookingRoute('slots', get(`serviceItemId=${'a'.repeat(24)}&from=2026-11-04&extra=1`), ENV, fetchImpl);
  assert.equal(ok.status, 200);
  assert.equal(calls[0].url, `https://client.example/tenant/bookingSlots?serviceItemId=${'a'.repeat(24)}&from=2026-11-04`);
  assert.equal(calls[0].init.method, 'GET');
  for (const bad of ['serviceItemId=x&from=2026-11-04', `serviceItemId=${'a'.repeat(24)}&from=tomorrow`, `serviceItemId=${'a'.repeat(24)}&from=2026-11-04&staffId=<x>`]) {
    assert.equal((await handleBookingRoute('slots', get(bad), ENV, fetchImpl)).status, 400, bad);
  }
  assert.equal(calls.length, 1);
});

test('REFUSE: a refusal shows only its code, the next times and the allowlisted reason', () => {
  const taken = mapUpstream(409, { success: false, error: 'Someone just took that time.', errorCode: 'SLOT_TAKEN', items: [{ start: '2026-11-04T21:00:00.000Z', end: 'x' }, 'junk'], ownerSafe: true });
  assert.deepEqual(taken, { status: 409, body: { errorCode: 'SLOT_TAKEN', items: [{ start: '2026-11-04T21:00:00.000Z' }] } });
  assert.deepEqual(mapUpstream(409, { errorCode: 'ONLINE_BOOKING_OFF', reason: 'request' }).body, { errorCode: 'ONLINE_BOOKING_OFF', reason: 'request' });
  assert.deepEqual(mapUpstream(400, { errorCode: 'SOMETHING_NEW', error: 'raw <b>text</b>' }).body, {}, 'an unknown code is not echoed');
  assert.deepEqual(mapUpstream(500, { errorCode: 'INTERNAL' }), { status: 502, body: {} });
});

test('every booking route file is a thin call site of the tested handler, no-store', () => {
  for (const [route, method] of [['request', 'POST'], ['slots', 'GET'], ['create', 'POST'], ['lookup', 'POST'], ['cancel', 'POST']]) {
    const source = fs.readFileSync(new URL(`../../app/api/booking/${route}/route.ts`, import.meta.url), 'utf8');
    assert.match(source, new RegExp(`export async function ${method}\\(`), route);
    assert.match(source, new RegExp(`handleBookingRoute\\(\\s*"${route}"`), route);
    assert.match(source, /"Cache-Control": "no-store"/, route);
  }
});

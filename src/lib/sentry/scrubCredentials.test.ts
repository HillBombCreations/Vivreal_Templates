/**
 * Next release 2026-11, plan 3.PII, T8: the credential and IP scrub, fed the
 * INSTALLED SDK's own output. `httpHeadersToSpanAttributes` is the
 * `@sentry/core` helper that writes `http.request.header.*` span keys (the
 * shape every deployed SDK uses: lower-cased, hyphens as underscores, one key
 * per cookie); `@sentry/core` is pinned as a devDependency at the lockfile's
 * version so this reads exactly what production would write.
 *
 * Positive control first (the keys and every sentinel are present before the
 * hook), then the EXACT surviving key set after it, then no sentinel anywhere
 * in the serialized event. The SDK already writes `cookie.token`,
 * `cookie.refreshtoken` and `authorization` as `[Filtered]`, so for those the
 * exact key set is the assertion that can fail, not the sentinel search.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { httpHeadersToSpanAttributes } from '@sentry/core';
import { FLEET_SECRET_HEADERS, scrubBreadcrumbCredentials, scrubCredentials } from './scrubCredentials.ts';

const COOKIES = ['token', 'active_ctx', 'user_ctx', 'refreshToken', 'csrf_token', 'session', 'sid', 'zz_other', 'vr-preview-token'];
const sentinel = (name: string) => `SENTINEL_${name.replace(/[^a-z0-9]/gi, '_')}_7f3c`;

/** A request carrying every fleet header and every cookie, each with its own sentinel, plus two harmless headers. */
function requestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'user-agent': 'Mozilla/5.0 (probe)',
    'x-vr-check-control': 'kept-control-value',
  };
  for (const name of FLEET_SECRET_HEADERS) if (name !== 'cookie') headers[name] = sentinel(name);
  headers.cookie = COOKIES.map((c) => `${c}=${sentinel(`cookie_${c}`)}`).join('; ');
  return headers;
}

const ALL_SENTINELS = [
  ...FLEET_SECRET_HEADERS.filter((n) => n !== 'cookie').map(sentinel),
  ...COOKIES.map((c) => sentinel(`cookie_${c}`)),
];

function buildEvent() {
  const headers = requestHeaders();
  const spanData = (): Record<string, unknown> => ({
    'http.method': 'GET',
    'http.client_ip': '203.0.113.9',
    'client.address': '203.0.113.9',
    ...httpHeadersToSpanAttributes(headers, false),
  });
  return {
    message: 'probe',
    request: { url: 'https://shop.example/', method: 'GET', headers: { ...headers }, cookies: Object.fromEntries(COOKIES.map((c) => [c, sentinel(`cookie_${c}`)])) },
    user: { email: 'owner@shop.example', ip_address: '203.0.113.9' },
    contexts: { trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16), data: spanData() } },
    spans: [{ span_id: 'c'.repeat(16), data: spanData() }],
  };
}

test('the list is the fleet list: 33 names, lower case, no duplicates, and never the kept control header', () => {
  assert.equal(FLEET_SECRET_HEADERS.length, 33);
  assert.equal(new Set(FLEET_SECRET_HEADERS).size, 33);
  for (const n of FLEET_SECRET_HEADERS) assert.equal(n, n.toLowerCase());
  assert.ok(!FLEET_SECRET_HEADERS.includes('x-vr-check-control'), 'x-vr-check-control stays off every list (RB-SCHK control)');
  for (const n of ['x-vr-sentry-canary', 'x-vivreal-internal', 'x-vivreal-preview', 'x-vivreal-preview-token', 'x-vivreal-signature', 'x-forwarded-for']) {
    assert.ok(FLEET_SECRET_HEADERS.includes(n), n);
  }
});

test('POSITIVE CONTROL: the installed SDK writes every header and cookie as a span key', () => {
  const data = buildEvent().contexts.trace.data;
  const keys = Object.keys(data);
  const spanKey = (name: string) => `http.request.header.${name.toLowerCase().replace(/-/g, '_')}`;
  for (const name of FLEET_SECRET_HEADERS.filter((n) => n !== 'cookie')) {
    // A cookie-shaped header (set-cookie) is written one key per cookie, under its own prefix.
    assert.ok(keys.some((k) => k === spanKey(name) || k.startsWith(`${spanKey(name)}.`)), `the SDK wrote ${spanKey(name)}`);
  }
  for (const c of COOKIES) {
    const k = `http.request.header.cookie.${c.toLowerCase()}`;
    assert.ok(keys.includes(k) || keys.includes(k.replace(/-/g, '_')), `the SDK wrote a key for cookie ${c}`);
  }
  // Raw values the hook must remove, not only keys: the session cookie the
  // portal leaked in full before the server rules, and two fleet headers.
  assert.equal(data['http.request.header.cookie.active_ctx'], sentinel('cookie_active_ctx'));
  assert.equal(data['http.request.header.x_active_ctx'], sentinel('x-active-ctx'));
  assert.equal(data['http.request.header.x_vivreal_internal'], sentinel('x-vivreal-internal'));
  assert.equal(data['http.request.header.x_vr_check_control'], 'kept-control-value');
  // The SDK's own filter covers only names that look secret; the rest arrive raw.
  const raw = JSON.stringify(buildEvent());
  const filteredBySdk = ALL_SENTINELS.filter((s) => !raw.includes(s));
  assert.ok(filteredBySdk.length < ALL_SENTINELS.length / 2, `most values arrive raw (SDK filtered ${filteredBySdk.length})`);
});

test('REFUSE: after beforeSend only harmless keys survive, and no sentinel or IP is anywhere', () => {
  const event = scrubCredentials(buildEvent());
  assert.deepEqual(Object.keys(event.request.headers).sort(), ['user-agent', 'x-vr-check-control']);
  assert.equal('cookies' in event.request, false);
  assert.deepEqual(event.user, { email: 'owner@shop.example' }, 'IP gone; the email the app set itself is kept');
  for (const data of [event.contexts.trace.data, event.spans[0].data]) {
    assert.deepEqual(Object.keys(data).sort(), [
      'http.method',
      'http.request.header.user_agent',
      'http.request.header.x_vr_check_control',
    ]);
  }
  const raw = JSON.stringify(event);
  for (const s of ALL_SENTINELS) assert.ok(!raw.includes(s), `${s} survived`);
  assert.ok(!raw.includes('203.0.113.9'), 'no client address');
});

test('REFUSE: the transaction hook is the same scrub (header names in any letter case, both spellings)', () => {
  const tx = {
    type: 'transaction',
    request: { headers: { Cookie: 'a=1', 'X-Vivreal-Internal': 'v1.x.y', Authorization: 'Bearer z', Accept: 'text/html' } },
    contexts: { trace: { data: { 'http.request.header.x-vivreal-internal': 'v1.x.y', 'http.response.header.set_cookie.sid': 's', 'http.response.header.set-cookie': 's', 'http.response.header.content_type': 'text/html' } } },
  };
  const out = scrubCredentials(tx);
  assert.deepEqual(out.request.headers, { Accept: 'text/html' });
  assert.deepEqual(out.contexts.trace.data, { 'http.response.header.content_type': 'text/html' });
});

test('REFUSE: a breadcrumb carries no listed header or cookie key; ALLOW: its url and status stay', () => {
  const crumb = scrubBreadcrumbCredentials({
    category: 'fetch',
    data: { url: 'https://client.vivreal.io/tenant/siteDetails', status_code: 200, authorization: 'k', 'x-vivreal-internal': 't', 'http.request.header.cookie.token': 'c' },
  });
  assert.deepEqual(crumb.data, { url: 'https://client.vivreal.io/tenant/siteDetails', status_code: 200 });
});

test('ALLOW: shapes the hooks do not expect pass through untouched and never throw', () => {
  for (const v of [null, undefined, 'x', 1, {}, { request: null }, { request: { headers: 'x' } }, { contexts: { trace: null } }, { spans: 'x' }]) {
    assert.doesNotThrow(() => scrubCredentials(v));
    assert.doesNotThrow(() => scrubBreadcrumbCredentials(v));
  }
  const plain = { message: 'm', request: { url: 'u', headers: { accept: 'a' } } };
  assert.deepEqual(scrubCredentials(structuredClone(plain)), plain, 'nothing to remove means nothing changes');
});

test('the module list is exactly the copy the real-SDK test sends (no drift between the two)', async () => {
  const fs = await import('node:fs');
  const sdkTest = fs.readFileSync(new URL('../api/scrubbedCapture.sdk.test.ts', import.meta.url), 'utf8');
  const block = sdkTest.slice(sdkTest.indexOf('const FLEET_SECRET_HEADERS = ['), sdkTest.indexOf('];', sdkTest.indexOf('const FLEET_SECRET_HEADERS = [')));
  const copied = [...block.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
  assert.equal(copied.length, 33, 'positive control: parsed the 33 copied names');
  assert.deepEqual(copied, [...FLEET_SECRET_HEADERS]);
});

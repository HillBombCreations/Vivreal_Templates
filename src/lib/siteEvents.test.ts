/**
 * Owner ideas 2026-10-29, T5 (plan 3.3, D15, D16, D32): the beacon's ad signal,
 * campaign tags and events.
 *
 * The paid-visit rule: a landing with a Google ad click id sends `a: 1` and
 * NEVER the id; the path never carries the query.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  AD_CLICK_ID_PARAMS,
  buildPageViewPayload,
  configureSiteEvents,
  isValidSiteEvent,
  pagePath,
  readLandingSignals,
  sendSiteEvent,
} from './siteEvents.ts';

const GCLID = 'Cj0KCQjw-abcdefghijklmnopqrstuvwxyz0123456789_ABCDEFG';

function view(search: string, path = '/menu') {
  return buildPageViewPayload({ siteId: 'site1', hostname: 'shop.example', path, referrer: 'https://www.google.com/', width: 390, search });
}

beforeEach(() => configureSiteEvents(null));

test('ALLOW: a gclid landing sends a:1 and no trace of the id', () => {
  const payload = view(`?gclid=${GCLID}&utm_source=google&utm_medium=cpc&utm_campaign=Fall_Menu`);
  assert.equal(payload.a, 1);
  assert.deepEqual(payload.u, { s: 'google', m: 'cpc', c: 'fall_menu' });
  const wire = JSON.stringify(payload);
  assert.ok(!wire.includes(GCLID), 'the click id is never sent');
  assert.ok(!wire.includes('gclid'), 'not even the parameter name');
});

test('ALLOW: gbraid and wbraid count as ad landings too', () => {
  for (const name of AD_CLICK_ID_PARAMS) {
    assert.equal(view(`?${name}=abc123`).a, 1, name);
  }
});

test('REFUSE: the path never carries the query, even when the router hands one over', () => {
  const payload = view(`?gclid=${GCLID}`, `/menu?gclid=${GCLID}&session_id=cs_live_123#top`);
  assert.equal(payload.p, '/menu');
  assert.equal(pagePath('/a?b=c'), '/a');
  assert.equal(pagePath('/a#b'), '/a');
  assert.equal(pagePath('/a'), '/a');
});

test('REFUSE: a plain visit adds no key, so its payload is exactly today\'s', () => {
  assert.deepEqual(Object.keys(view('')), ['s', 'h', 'p', 'r', 'w']);
  assert.deepEqual(Object.keys(view('?q=bread')), ['s', 'h', 'p', 'r', 'w']);
  assert.equal(view('?gclid=').a, undefined, 'an empty click id is not an ad landing');
});

test('REFUSE: a tag with a space, a bad character or 41 characters is dropped, not cut', () => {
  const signals = readLandingSignals(`?utm_source=${'a'.repeat(41)}&utm_medium=pay%20per&utm_campaign=<script>`);
  assert.equal(signals.u, undefined);
  assert.deepEqual(readLandingSignals(`?utm_source=${'a'.repeat(40)}`).u, { s: 'a'.repeat(40) });
  assert.deepEqual(readLandingSignals('?utm_source=%20QR%20').u, { s: 'qr' }, 'trimmed and lowercased');
});

test('REFUSE: an event is sent only after the page view gate configured it', () => {
  const sent: string[] = [];
  assert.equal(sendSiteEvent({ k: 'lt', l: 'abc123' }, { hostname: 'h', path: '/links' }), false);
  configureSiteEvents({ siteId: 'site1', endpoint: 'https://collect.example/e', transport: (_e, p) => sent.push(p) });
  assert.equal(sendSiteEvent({ k: 'lt', l: 'abc123' }, { hostname: 'h', path: '/links?x=1' }), true);
  assert.deepEqual(JSON.parse(sent[0]), { s: 'site1', h: 'h', p: '/links', k: 'lt', l: 'abc123' });
});

test('ALLOW: a result event names its goal; REFUSE: anything malformed is not sent', () => {
  const sent: string[] = [];
  configureSiteEvents({ siteId: 'site1', endpoint: 'e', transport: (_e, p) => sent.push(p) });
  assert.equal(sendSiteEvent({ k: 'gl', g: 'booking' }, { hostname: 'h', path: '/book' }), true);
  assert.deepEqual(JSON.parse(sent[0]), { s: 'site1', h: 'h', p: '/book', k: 'gl', g: 'booking' });
  for (const bad of [{ k: 'gl', g: 'signup' }, { k: 'lt', l: 'AB' }, { k: 'lt', l: 'has space' }, { k: 'pv' }, null, 'lt']) {
    assert.equal(isValidSiteEvent(bad), false, JSON.stringify(bad));
    // And through the send itself, so the gate inside sendSiteEvent is what refuses.
    assert.equal(sendSiteEvent(bad as never, { hostname: 'h', path: '/' }), false, `sent ${JSON.stringify(bad)}`);
  }
  assert.equal(sent.length, 1);
});

test('REFUSE: a transport that throws never reaches the caller', () => {
  configureSiteEvents({ siteId: 's', endpoint: 'e', transport: () => { throw new Error('blocked'); } });
  assert.equal(sendSiteEvent({ k: 'gl', g: 'message' }, { hostname: 'h', path: '/' }), false);
});

test('REFUSE: <SiteBeacon> builds its page view through buildPageViewPayload, never a hand-rolled path', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../components/SiteBeacon/index.tsx', import.meta.url), 'utf8');
  assert.match(source, /buildPageViewPayload\(/);
  assert.match(source, /configureSiteEvents\(/);
  assert.doesNotMatch(source, /p:\s*path/, 'the old raw path field is gone');
});

test('ALLOW: recordLinkTap sends one lt beacon at the current page', async () => {
  const { recordLinkTap } = await import('./siteEvents.ts');
  const sent: string[] = [];
  configureSiteEvents({ siteId: 'site1', endpoint: 'e', transport: (_e, p) => sent.push(p) });
  const g = globalThis as unknown as { window?: unknown };
  const before = g.window;
  g.window = { location: { hostname: 'shop.example', pathname: '/links' } };
  try {
    recordLinkTap('lnk0001');
  } finally {
    g.window = before;
  }
  assert.deepEqual(JSON.parse(sent[0]), { s: 'site1', h: 'shop.example', p: '/links', k: 'lt', l: 'lnk0001' });
});

// ── next release 2026-11, N2 (D7): the renderer's onGoal ──────────────────
function atPage<T>(hostname: string, pathname: string, run: () => T): T {
  const g = globalThis as unknown as { window?: unknown };
  const before = g.window;
  g.window = { location: { hostname, pathname } };
  try {
    return run();
  } finally {
    g.window = before;
  }
}

test('ALLOW (N2): recordGoal sends exactly {k:"gl", g:"message"} at the current page', async () => {
  const mod = await import('./siteEvents.ts');
  assert.equal(typeof mod.recordGoal, 'function', 'siteEvents exports recordGoal for the renderer onGoal');
  const sent: string[] = [];
  configureSiteEvents({ siteId: 'site1', endpoint: 'e', transport: (_e, p) => sent.push(p) });
  atPage('shop.example', '/contact', () => mod.recordGoal('message'));
  assert.equal(sent.length, 1, 'one beacon per accepted message');
  assert.deepEqual(JSON.parse(sent[0]), { s: 'site1', h: 'shop.example', p: '/contact', k: 'gl', g: 'message' });
});

test('REFUSE (N2): on SITE_ID "preview" the page view gate configures nothing, so a goal sends nothing', async () => {
  const mod = await import('./siteEvents.ts');
  const { shouldSendBeacon } = await import('./beaconPolicy.ts');
  // The gate <SiteBeacon> runs before configureSiteEvents: a preview build never passes it.
  assert.equal(shouldSendBeacon({ siteId: 'preview', vivrealOwnSite: false, hostname: 'shop.example', referrer: '', cookie: '' }), false);
  configureSiteEvents(null);
  const sent: string[] = [];
  const transport = (_e: string, p: string) => void sent.push(p);
  atPage('shop.example', '/contact', () => mod.recordGoal?.('message'));
  assert.deepEqual(sent, [], 'nothing leaves while the gate has not configured events');
  // Positive control: the same call does send once the gate allowed a real site.
  configureSiteEvents({ siteId: 'site1', endpoint: 'e', transport });
  atPage('shop.example', '/contact', () => mod.recordGoal?.('message'));
  assert.equal(sent.length, 1, 'control: a configured site sends');
});

test('REFUSE (N2): recordGoal drops a goal word the ingest does not accept', async () => {
  const mod = await import('./siteEvents.ts');
  const sent: string[] = [];
  configureSiteEvents({ siteId: 'site1', endpoint: 'e', transport: (_e, p) => sent.push(p) });
  atPage('shop.example', '/', () => mod.recordGoal?.('signup' as never));
  assert.deepEqual(sent, []);
});

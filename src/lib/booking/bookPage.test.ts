/**
 * Owner ideas 2026-10-29, T2 and T14 (plan 3.4, 3.11, D29, D61, D62): what
 * `/book` serves, and the reserved page names.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
// Leaf files of the renderer, by path: its root entry imports `next/link`,
// which plain Node cannot resolve. These three import nothing from Next.
import BookingRequestForm from '../../../node_modules/@hillbombcreations/site-renderer/dist/components/booking/BookingRequestForm.js';
import { RESERVED_PAGE_SLUGS } from '../../../node_modules/@hillbombcreations/site-renderer/dist/lib/reservedPageSlugs.js';
import { bookingModeOf } from '../../../node_modules/@hillbombcreations/site-renderer/dist/lib/itemAction.js';
import {
  bookingMode,
  bookingDays,
  decideBookPage,
  effectiveMode,
  initialServiceId,
  serviceChoices,
  serviceIds,
  staffChoices,
} from './bookPage.ts';
import { readBooking } from '../api/siteData/booking.ts';

const OWNER_BOOK = { slug: 'book', format: 'standard' };
const ABOUT = { slug: 'about', format: 'about' };

test('ALLOW: request mode serves the form, and the form shows the bold "not booked yet" line', () => {
  const site = { pageConfigs: [ABOUT], ...readBooking({ booking: { mode: 'request', staff: [], services: [] } }) };
  assert.deepEqual(decideBookPage(site), { kind: 'form', mode: 'request' });
  const html = renderToStaticMarkup(
    createElement(BookingRequestForm, {
      shopName: 'Clipper Lane',
      shopPhone: '555 0100',
      days: bookingDays(new Date('2026-11-03T15:00:00Z'), 'America/Chicago'),
      onSubmit: async () => ({ ok: true, emailed: false }),
    }),
  );
  assert.match(html, /This is a request, not a booking yet\. Clipper Lane will call or text you to confirm\./);
  assert.match(html, /Send my request/);
});

test('REFUSE: booking off 404s, and so does any mode word but the two exact ones', () => {
  assert.deepEqual(decideBookPage({ pageConfigs: [ABOUT] }), { kind: 'not-found' }, 'lever off: Client sends no booking');
  for (const mode of ['off', 'ON', 'Request', '', null, 1]) {
    const site = { pageConfigs: [ABOUT], ...readBooking({ booking: { mode } }) };
    assert.deepEqual(decideBookPage(site), { kind: 'not-found' }, String(mode));
    assert.equal('booking' in site, false, `readBooking drops mode ${String(mode)}`);
    // And the page's own rule refuses it too, whatever reaches it.
    assert.deepEqual(decideBookPage({ pageConfigs: [ABOUT], booking: { mode } }), { kind: 'not-found' }, `raw ${String(mode)}`);
  }
});

test('the local mode rule is the renderer\'s bookingModeOf, value for value', () => {
  for (const mode of ['request', 'online', 'off', 'ON', '', null, undefined, 1, {}]) {
    assert.equal(bookingMode({ booking: { mode } }), bookingModeOf({ booking: { mode } }), String(mode));
  }
  assert.equal(bookingMode({}), bookingModeOf({}));
  assert.equal(bookingMode({ booking: null }), bookingModeOf({ booking: null }));
});

test('ALLOW (T14): booking off serves the owner\'s own book page through the [slug] render', () => {
  assert.deepEqual(decideBookPage({ pageConfigs: [ABOUT, OWNER_BOOK] }), { kind: 'owner-page' });
  const source = fs.readFileSync(new URL('../../app/book/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /if \(decision\.kind === "owner-page"\) return SlugPage\(\{ params: BOOK_PARAMS, searchParams \}\);/);
  assert.match(source, /if \(decision\.kind === "owner-page"\) return slugMetadata\(\{ params: BOOK_PARAMS, searchParams \}\);/);
  assert.match(source, /import SlugPage, \{ generateMetadata as slugMetadata \} from "\.\.\/\[slug\]\/page";/);
});

test('ALLOW (T14): booking on serves the form even where an owner page exists (the rename is D62\'s portal sheet)', () => {
  const site = { pageConfigs: [OWNER_BOOK], ...readBooking({ booking: { mode: 'online', staff: [], services: [] } }) };
  assert.deepEqual(decideBookPage(site), { kind: 'form', mode: 'online' });
});

test('REFUSE: online mode with no nameable service falls back to requests', () => {
  assert.equal(effectiveMode('online', []), 'request');
  assert.equal(effectiveMode('online', [{ id: 'a', name: 'Cut' }]), 'online');
  assert.equal(effectiveMode('request', [{ id: 'a', name: 'Cut' }]), 'request');
  const names = new Map([['svc1', 'Haircut']]);
  assert.deepEqual(serviceChoices(['svc1', 'svc2'], names), [{ id: 'svc1', name: 'Haircut' }], 'an unnamed service is not offered');
});

test('REFUSE: malformed staff and service rows are dropped; ?service= preselects only an offered one', () => {
  const booking = { mode: 'online', staff: [{ id: 's1', name: 'Sam' }, { id: '<x>', name: 'Bad' }, { id: 's2' }, 'junk'], services: [{ itemId: 'svc1', minutes: 30 }, { itemId: 'bad id' }] };
  assert.deepEqual(staffChoices(booking), [{ id: 's1', name: 'Sam' }]);
  assert.deepEqual(serviceIds(booking), ['svc1']);
  const offered = [{ id: 'svc1', name: 'Cut' }];
  assert.equal(initialServiceId('svc1', offered), 'svc1');
  assert.equal(initialServiceId('svc9', offered), undefined);
  assert.equal(initialServiceId(['svc1'], offered), undefined);
});

test('ALLOW: 30 days on the shop\'s clock, with no gap or repeat across the 2026-11-01 fall-back', () => {
  // 03:30 UTC on Nov 1 is still Oct 31 in Chicago.
  const days = bookingDays(new Date('2026-11-01T03:30:00Z'), 'America/Chicago');
  assert.equal(days.length, 30);
  assert.deepEqual(days.slice(0, 3).map((d) => d.date), ['2026-10-31', '2026-11-01', '2026-11-02']);
  assert.equal(days[0].label, 'Sat Oct 31');
  assert.equal(new Set(days.map((d) => d.date)).size, 30);
  assert.equal(bookingDays(new Date('2026-11-01T03:30:00Z'), 'Not/AZone')[0].date, '2026-11-01', 'an unknown zone reads UTC');
});

/* ── T14: every fixed top-level route is a reserved page name ───────────── */

/** The page addresses `src/app`'s top-level entries take, dynamic segments and app files excluded. */
function fixedTopLevelAddresses(entries: readonly string[]): string[] {
  const APP_FILES = /^(page|layout|error|global-error|not-found|loading|template|default)\.tsx?$/;
  return entries.flatMap((name) => {
    if (name.startsWith('[') || name.startsWith('(') || name.startsWith('_')) return [];
    if (APP_FILES.test(name) || /\.test\.ts$/.test(name)) return [];
    if (name === 'robots.tsx' || name === 'robots.ts') return ['robots.txt'];
    if (/^(icon|apple-icon)\.tsx?$/.test(name)) return [name.replace(/\.tsx?$/, '')];
    return [name];
  });
}

function unlisted(entries: readonly string[]): string[] {
  const reserved = new Set(RESERVED_PAGE_SLUGS);
  return fixedTopLevelAddresses(entries).filter((address) => !reserved.has(address));
}

test('REFUSE: a top-level route missing from RESERVED_PAGE_SLUGS fails (planted-entry control)', () => {
  const real = fs.readdirSync(new URL('../../app/', import.meta.url));
  assert.ok(real.includes('book') && real.includes('booking'), 'the listing sees the new routes');
  assert.deepEqual(unlisted([...real, 'gift-cards']), ['gift-cards'], 'a planted route is caught');
});

test('ALLOW: every fixed top-level route in src/app is reserved', () => {
  const real = fs.readdirSync(new URL('../../app/', import.meta.url));
  assert.ok(fixedTopLevelAddresses(real).length >= 15, 'the listing parsed real routes');
  assert.deepEqual(unlisted(real), []);
});

// ── next release 2026-11, N3: closed weekdays, the shop zone, service names ─
// The fixture is VR_Client_API's own CL1 test (closedWeekdays.test.js): a shop
// closed Sunday and Monday gives [0, 1]. Pinning the same array here pins the
// day numbering across the repo boundary: 0 = Sunday, as getUTCDay numbers it.
const CLIENT_BODY = {
  booking: {
    mode: 'request',
    staff: [],
    services: [],
    timeZone: 'America/Chicago',
    closedWeekdays: [0, 1],
  },
};

/** Each day button the renderer's real request form draws: its label and whether it is disabled. */
function dayButtons(days: ReturnType<typeof bookingDays>): Array<{ label: string; disabled: boolean }> {
  const html = renderToStaticMarkup(
    createElement(BookingRequestForm, { shopName: 'Clipper Lane', days, onSubmit: async () => ({ ok: true, emailed: false }) }),
  );
  const out: Array<{ label: string; disabled: boolean }> = [];
  for (const m of html.matchAll(/<button type="button"( disabled="")?[^>]*>([A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2})<\/button>/g)) {
    out.push({ label: m[2], disabled: Boolean(m[1]) });
  }
  return out;
}

test('ALLOW (N3): the Client [0,1] fixture greys every Sunday and Monday on the form, and nothing else', () => {
  const site = readBooking(CLIENT_BODY);
  assert.deepEqual(site.booking?.closedWeekdays, [0, 1], 'readBooking carries closedWeekdays');
  assert.equal(site.booking?.timeZone, 'America/Chicago', 'readBooking carries timeZone');
  // Tue 2026-11-03 in Chicago: 30 days run to Wed Dec 2.
  const buttons = dayButtons(bookingDays(new Date('2026-11-03T15:00:00Z'), site.booking?.timeZone, site.booking?.closedWeekdays));
  assert.equal(buttons.length, 30, 'positive control: the form drew all 30 days');
  const greyed = buttons.filter((b) => b.disabled).map((b) => b.label.slice(0, 3));
  assert.ok(greyed.length > 0, 'some days are greyed');
  assert.deepEqual([...new Set(greyed)].sort(), ['Mon', 'Sun'], 'only Sundays and Mondays are greyed');
  const open = buttons.filter((b) => !b.disabled).map((b) => b.label.slice(0, 3));
  assert.ok(!open.includes('Sun') && !open.includes('Mon'), 'no Sunday or Monday is offered');
  assert.equal(greyed.length + open.length, 30);
});

test('REFUSE (N3): an absent closedWeekdays greys nothing, and the days are byte-identical to today', () => {
  const site = readBooking({ booking: { mode: 'request', staff: [], services: [] } });
  assert.equal('closedWeekdays' in (site.booking ?? {}), false, 'absent stays absent');
  const now = new Date('2026-11-03T15:00:00Z');
  const days = bookingDays(now, 'America/Chicago', site.booking?.closedWeekdays);
  assert.equal(days.some((d) => 'closed' in d), false, 'no day carries a closed key');
  assert.deepEqual(days, bookingDays(now, 'America/Chicago'), 'identical to the call without the argument');
  assert.equal(dayButtons(days).filter((b) => b.disabled).length, 0);
});

test('REFUSE (N3): a malformed closedWeekdays entry never greys a day', () => {
  const site = readBooking({ booking: { mode: 'request', staff: [], services: [], closedWeekdays: [7, -1, '0', 1.5, null, 3, 3] } });
  assert.deepEqual(site.booking?.closedWeekdays, [3], 'only whole numbers 0 to 6 survive, once each');
  const greyed = dayButtons(bookingDays(new Date('2026-11-03T15:00:00Z'), 'America/Chicago', site.booking?.closedWeekdays))
    .filter((b) => b.disabled)
    .map((b) => b.label.slice(0, 3));
  assert.deepEqual([...new Set(greyed)], ['Wed'], 'only Wednesday, 3');
});

test('ALLOW (N3): service names Client sent come first; REFUSE: a blank name is not a name', async () => {
  const mod = await import('./bookPage.ts');
  assert.equal(typeof mod.subsetServiceNames, 'function', 'bookPage exports subsetServiceNames');
  const site = readBooking({
    booking: {
      mode: 'online',
      staff: [],
      services: [
        { itemId: 'svc1', minutes: 30, name: ' Haircut ' },
        { itemId: 'svc2', minutes: 45, name: '   ' },
        { itemId: 'svc3', minutes: 60 },
      ],
    },
  });
  assert.deepEqual(site.booking?.services, [
    { itemId: 'svc1', minutes: 30, name: 'Haircut' },
    { itemId: 'svc2', minutes: 45 },
    { itemId: 'svc3', minutes: 60 },
  ]);
  const names = mod.subsetServiceNames(site.booking);
  assert.deepEqual([...names], [['svc1', 'Haircut']], 'only the named one');
});

test('/book reads the shop zone and closed days from the subset and names from Client first', () => {
  const source = fs.readFileSync(new URL('../../app/book/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /const timeZone = siteData\.booking\?\.timeZone \?\? siteData\.timezone;/);
  assert.match(source, /timeZone=\{timeZone\}/, 'the picker takes the same zone');
  assert.match(source, /days=\{bookingDays\(new Date\(\), timeZone, siteData\.booking\?\.closedWeekdays\)\}/);
  assert.match(source, /const names = subsetServiceNames\(siteData\.booking\);/);
  assert.match(source, /resolveServiceNames\(siteData, unnamed\)/, 'only the ids Client did not name are looked up');
});

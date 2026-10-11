import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SiteData } from '@/types/SiteData';
import { contactButtonsSiteData, type ContactButtonsSiteData } from './contactButtons.ts';
// The renderer's own gate, by file path: its package entry point loads React
// components the plain-Node runner cannot, and this module is pure.
import { resolveContactButtons as rendererGate } from '../../node_modules/@hillbombcreations/site-renderer/dist/chrome/ContactButtons.js';

// Cast: the slice is exactly what layout.tsx hands the renderer (same cast there).
const resolveContactButtons = (slice: ContactButtonsSiteData | null) =>
  rendererGate((slice ?? undefined) as unknown as Parameters<typeof rendererGate>[0]);

// Cast: a fixture carries only the fields this reading touches.
const site = (over: Partial<SiteData>) => ({ pageConfigs: [], pages: {}, siteMap: [], ...over } as unknown as SiteData);
const WITH_PHONE = { name: 'Cobalt', contactInfo: { phoneNumber: '(865) 555-0100' } };

test('ALLOW (R3): a business with a phone gets the Call button', () => {
  const slice = contactButtonsSiteData(site({ businessInfo: WITH_PHONE, primary: '#123456' }));
  assert.ok(slice);
  const plan = resolveContactButtons(slice);
  assert.deepEqual(plan?.call, { label: 'Call', href: 'tel:8655550100' });
  assert.equal(plan?.directions, null);
});

test('REFUSE (R3): no phone and no address, no bar', () => {
  const slice = contactButtonsSiteData(site({ businessInfo: { name: 'Cobalt', contactInfo: {} } }));
  assert.equal(resolveContactButtons(slice), null);
});

test('REFUSE (R3): the owner switched them off', () => {
  const slice = contactButtonsSiteData(site({ businessInfo: WITH_PHONE, contactButtons: false }));
  assert.deepEqual(slice?.contactButtons, false);
  assert.equal(resolveContactButtons(slice), null);
});

test('REFUSE (R3): an authored utility dock already is the bottom bar, so nothing mounts', () => {
  // Cast: the dock's own fields are irrelevant to the gate, only its presence is.
  const docked = site({ businessInfo: WITH_PHONE, utilityDock: { phone: '1' } as unknown as SiteData['utilityDock'] });
  assert.equal(contactButtonsSiteData(docked), null);
});

test('ALLOW (R3): street and town give Directions', () => {
  const slice = contactButtonsSiteData(
    site({ businessInfo: { name: 'Cobalt', contactInfo: {}, address: { street1: '1 Main St', city: 'Knoxville', state: 'TN' } } }),
  );
  assert.match(resolveContactButtons(slice)?.directions?.href ?? '', /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=1%20Main%20St/);
});

// W25-6cb: the bar stands aside for any control fixed to the bottom of a phone.
const STRIP = { enabled: true, links: [{ label: 'Order for pickup', href: '/order' }] } as unknown as SiteData['fulfillmentStrip'];

test('REFUSE (W25-6cb): a fulfillment strip with links (Butter & Bloom) gets no bar', () => {
  assert.equal(contactButtonsSiteData(site({ businessInfo: WITH_PHONE, fulfillmentStrip: STRIP })), null);
});

test('REFUSE (W25-6cb): a floating button, authored or the restaurant one, gets no bar', () => {
  const fab = { label: 'Book a look', link: '/book' } as unknown as SiteData['floatingCta'];
  assert.equal(contactButtonsSiteData(site({ businessInfo: WITH_PHONE, floatingCta: fab })), null);
  // Cast: only templateType is read.
  const restaurant = { templateType: 'restaurant' } as unknown as SiteData['siteInfo'];
  assert.equal(contactButtonsSiteData(site({ businessInfo: WITH_PHONE, siteInfo: restaurant })), null);
});

test('ALLOW (W25-6cb): a switched-off or empty strip, a floating button with no link, and an EdgeDock (hidden on phones) keep the bar', () => {
  const off = { ...STRIP, enabled: false } as unknown as SiteData['fulfillmentStrip'];
  const empty = { enabled: true, links: [{ label: ' ', href: '/x' }] } as unknown as SiteData['fulfillmentStrip'];
  const noLink = { label: 'Hi' } as unknown as SiteData['floatingCta'];
  const edge = { items: [{ kind: 'call', href: 'tel:1' }] } as unknown as SiteData['edgeDock'];
  for (const over of [{ fulfillmentStrip: off }, { fulfillmentStrip: empty }, { floatingCta: noLink }, { edgeDock: edge }]) {
    const slice = contactButtonsSiteData(site({ businessInfo: WITH_PHONE, ...over }));
    assert.ok(resolveContactButtons(slice)?.call, JSON.stringify(over));
  }
});

// RT5-181: Inquire (renderer 1.85.4 reads it; the slice only carries it).
const PAGES = [
  { name: 'Weddings', slug: 'weddings', format: 'standard' },
  { name: 'Inquire', slug: 'inquire', format: 'inquiry' },
] as unknown as SiteData['pageConfigs']; // a page here carries only what the slice reads

test('RT5-181 ALLOW: a site that turned Inquire on hands the renderer the switch and its inquiry page', () => {
  const slice = contactButtonsSiteData(site({ businessInfo: WITH_PHONE, contactButtonsInquire: true, pageConfigs: PAGES }));
  assert.equal(slice?.contactButtonsInquire, true);
  assert.deepEqual(slice?.pageConfigs, [{ slug: 'inquire', format: 'inquiry' }]);
});

test('RT5-181 REFUSE: without the switch, or with no inquiry page, the slice is exactly what it was', () => {
  const off = contactButtonsSiteData(site({ businessInfo: WITH_PHONE, pageConfigs: PAGES }));
  assert.deepEqual(Object.keys(off ?? {}).sort(), ['businessInfo']);
  const noPage = contactButtonsSiteData(site({ businessInfo: WITH_PHONE, contactButtonsInquire: true, pageConfigs: PAGES.slice(0, 1) }));
  assert.deepEqual(Object.keys(noPage ?? {}).sort(), ['businessInfo']);
});

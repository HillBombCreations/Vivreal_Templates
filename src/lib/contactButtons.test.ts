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

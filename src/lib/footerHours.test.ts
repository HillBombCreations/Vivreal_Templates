import { test } from 'node:test';
import assert from 'node:assert/strict';
import { footerHours } from './footerHours.ts';

const WEEK = { weekly: ['Mon: Closed', 'Wed: 4pm to 10pm'], changes: [], note: '' };
const block = (dispatchId: string, labels?: Record<string, unknown>, children?: unknown[]) => ({
  type: { dispatchId },
  config: { ...(labels ? { labels } : {}), ...(children ? { children } : {}) },
});
// Cast: a fixture carries only the fields the rule reads.
const site = (homeBlocks: unknown[], pageBlocks: unknown[] = []) =>
  ({
    businessInfo: { hours: WEEK },
    homePageConfig: { slug: 'home', blocks: homeBlocks },
    pageConfigs: [{ slug: 'about', blocks: pageBlocks }],
  }) as unknown as Parameters<typeof footerHours>[0];

test('ALLOW (W25-5ca): the site\'s one hours set is drawn in the footer', () => {
  assert.equal(footerHours(site([block('hero')], [block('opening-hours', { heading: 'Hours' })])), WEEK);
});

test('REFUSE (W25-5ca): Vesper\'s shape, rooms with their own hours and an authored hours block, draws no footer week', () => {
  const home = [block('locations'), block('opening-hours', { heading: 'When we are open', hours: ['Mon to Thu: 4pm to 11pm', 'Fri to Sun: 12pm to 1am'] })];
  assert.equal(footerHours(site(home)), null);
});

test('REFUSE (W25-5ca): a locations list alone, or an authored hours block alone (in a group), is another hours set', () => {
  assert.equal(footerHours(site([block('locations')])), null);
  assert.equal(footerHours(site([], [block('group', undefined, [block('opening-hours', { hours: ['Daily: 9am to 5pm'] })])])), null);
});

test('ALLOW (W25-5ca): an hours block with blank lines draws the business week, so it is the same set', () => {
  assert.equal(footerHours(site([block('opening-hours', { hours: ['  '] })])), WEEK);
});

test('REFUSE: no business hours, nothing to draw', () => {
  assert.equal(footerHours({ businessInfo: {}, pageConfigs: [] } as unknown as Parameters<typeof footerHours>[0]), null);
});

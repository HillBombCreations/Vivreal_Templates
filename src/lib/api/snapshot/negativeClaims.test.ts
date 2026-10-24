import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DegradedUpstreamError, refuseNegativeClaimFromFloor } from '../siteData/degraded.ts';
import { markFloorValue } from './floorValue.ts';
import { decideDetailItemMiss } from '../../detail/itemMiss.ts';
import { decidePageEmptiness } from '../composition/pageEmptiness.ts';

/**
 * T8 (site-first-read-fallback plan, section 5.5): negative claims are never
 * made from the floor. A page or item created after the build is absent from
 * build-time data, so a 404 drawn from that absence would deindex a live URL.
 */

const siteDataWithout = (slug: string) => ({ pageConfigs: [{ slug: 'menu' }].filter((p) => p.slug !== slug) });

test('T8 REFUSE: floor-sourced site data without /new-page refuses (5xx), it does not 404', () => {
  const floorSite = markFloorValue(siteDataWithout('new-page'));
  assert.throws(() => refuseNegativeClaimFromFloor(floorSite), DegradedUpstreamError);
});

test('T8 ALLOW: live site data without /new-page still 404s (the guard is a no-op)', () => {
  assert.doesNotThrow(() => refuseNegativeClaimFromFloor(siteDataWithout('new-page')));
  assert.doesNotThrow(() => refuseNegativeClaimFromFloor(null));
});

test('T8 REFUSE: an item missing from a floor-sourced list is unknown, not missing', () => {
  const verdict = decideDetailItemMiss({ found: undefined, reads: [{ source: 'collection', degraded: false, fromFloor: true }] });
  assert.deepEqual(verdict, { isMissing: false, existenceUnknown: true });
});

test('T8 ALLOW: an item missing from a live list is missing (a real 404)', () => {
  const verdict = decideDetailItemMiss({ found: undefined, reads: [{ source: 'collection', degraded: false, fromFloor: false }] });
  assert.deepEqual(verdict, { isMissing: true, existenceUnknown: false });
});

test('T8 ALLOW: an item FOUND in a floor-sourced list renders (a positive claim is fine)', () => {
  const verdict = decideDetailItemMiss({ found: { id: 'i1' }, reads: [{ source: 'collection', degraded: false, fromFloor: true }] });
  assert.deepEqual(verdict, { isMissing: false, existenceUnknown: false });
});

test('T8 REFUSE: a generic page empty on floor data is unknown, not empty', () => {
  const verdict = decidePageEmptiness({ isHome: false, format: 'standard', reads: [{ sourceCount: 0, degraded: false, fromFloor: true }] });
  assert.deepEqual(verdict, { isEmpty: false, emptinessUnknown: true });
});

test('T8 ALLOW: a generic page empty on live data is empty (the 404 it always was)', () => {
  const verdict = decidePageEmptiness({ isHome: false, format: 'standard', reads: [{ sourceCount: 0, degraded: false, fromFloor: false }] });
  assert.deepEqual(verdict, { isEmpty: true, emptinessUnknown: false });
});

/*
 * The routes import `server-only`, so their wiring is pinned by reading the
 * source: in every branch that answers "no such page" from site data, the
 * floor guard runs before `notFound()`. The freeze reproduction
 * (`scripts/freeze-repro.mjs`) proves the same end to end on a real server.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const app = (p: string) => fs.readFileSync(path.join(here, '../../../app', p), 'utf8');

const guardedBranches: Array<{ file: string; marker: string }> = [
  { file: '[slug]/page.tsx', marker: 'resolveMissingItemRedirect(siteData.redirects, `/${slug}`);' },
  { file: '[slug]/page.tsx', marker: 'if (isPageTurnedOff(pageConfig)) {' },
  { file: '[slug]/[itemId]/page.tsx', marker: 'resolveMissingItemRedirect(siteData.redirects, `/${slug}/${itemId}`);' },
  { file: '[slug]/[itemId]/page.tsx', marker: 'if (isPageTurnedOff(nestedPage)) {' },
  { file: '[slug]/[itemId]/page.tsx', marker: 'if (isPageTurnedOff(pageConfig)) {' },
  { file: '[...segments]/page.tsx', marker: 'resolveMissingItemRedirect(siteData.redirects, path);' },
];

for (const { file, marker } of guardedBranches) {
  test(`T8 wiring: ${file} refuses on floor data before the notFound() after \`${marker.slice(0, 48)}\``, () => {
    const code = app(file);
    const at = code.indexOf(marker);
    assert.ok(at !== -1, `marker not found in ${file}: the branch moved, re-point this test`);
    const after = code.slice(at, at + 600);
    const guard = after.indexOf('refuseNegativeClaimFromFloor(siteData)');
    const notFound = after.indexOf('return notFound()');
    assert.ok(guard !== -1 && notFound !== -1 && guard < notFound, 'the floor guard must run before notFound()');
  });
}

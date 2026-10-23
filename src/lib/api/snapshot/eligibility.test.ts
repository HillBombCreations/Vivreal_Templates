import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectionIdOf, isFloorEligiblePath, keyShape } from './eligibility.ts';
import { collectionObjectsPath, integrationObjectsPath, siteDetailsPath } from '../readPaths.ts';

/**
 * T4 (site-first-read-fallback plan): one ALLOW and one REFUSE per row of the
 * floor table (section 5.2). The ALLOW keys are the live key shapes measured
 * over every failed read 10-16 to 10-23, built through the same builders the
 * runtime readers use.
 */

const SITE = '6900a3f732b0727413c502b7';
const OTHER_SITE = '68bfac783bc7c024975c90cb';
const NONE: readonly string[] = [];

const rows: Array<{ row: string; allow: string; refuse: string; excluded?: readonly string[] }> = [
  {
    row: '1 siteDetails: this site only',
    allow: siteDetailsPath(SITE),
    refuse: siteDetailsPath(OTHER_SITE),
  },
  {
    row: '2 collection list read',
    allow: collectionObjectsPath('68f92deb0e2d5d1f8a286789', { limit: 100 }),
    refuse: '/tenant/collectionObjects?limit=100',
  },
  {
    row: '2 integration list read (social)',
    allow: integrationObjectsPath('tiktok', { limit: 100 }),
    refuse: integrationObjectsPath('stripe', { limit: 100 }),
  },
  {
    row: '3 sitemap and detail windows (skip, sort)',
    allow: collectionObjectsPath('c1', { limit: 100, skip: 100, sort: 'publishDate:desc' }),
    refuse: '/tenant/collectionObjects?limit=100&skip=100&skip=200&collectionId=c1',
  },
  {
    row: '5 supplemental feed at limit 10',
    allow: integrationObjectsPath('instagram', { limit: 10 }),
    refuse: integrationObjectsPath('square', { limit: 10 }),
  },
  {
    row: '7 storefront collection excluded',
    allow: collectionObjectsPath('not-sold', { limit: 100 }),
    refuse: collectionObjectsPath('sold-here', { limit: 100 }),
    excluded: ['sold-here'],
  },
  {
    row: '11 search and filters never',
    allow: collectionObjectsPath('c1', { limit: 100 }),
    refuse: collectionObjectsPath('c1', { limit: 100, search: 'tart' }),
  },
  {
    row: '11 filter params never',
    allow: collectionObjectsPath('c1', { limit: 100 }),
    refuse: collectionObjectsPath('c1', { limit: 100, filters: { size: 'L' } }),
  },
  {
    row: '11 unknown routes and writes never',
    allow: collectionObjectsPath('c1'),
    refuse: '/tenant/definedCollectionObject?collectionId=c1',
  },
];

for (const { row, allow, refuse, excluded } of rows) {
  test(`T4 row ${row}: ALLOW ${allow}`, () => {
    assert.equal(isFloorEligiblePath(allow, SITE, excluded ?? NONE), true);
  });
  test(`T4 row ${row}: REFUSE ${refuse}`, () => {
    assert.equal(isFloorEligiblePath(refuse, SITE, excluded ?? NONE), false);
  });
}

test('T4: an empty SITE_ID makes no siteDetails key eligible, not even an empty one', () => {
  assert.equal(isFloorEligiblePath(siteDetailsPath(''), '', NONE), false);
});

test('T4: a payments type is refused in any casing', () => {
  assert.equal(isFloorEligiblePath('/tenant/integrationObjects?limit=100&type=Stripe', SITE, NONE), false);
});

test('T4: no query at all is never eligible', () => {
  assert.equal(isFloorEligiblePath('/tenant/siteDetails', SITE, NONE), false);
});

test('the builders produce the measured production key shapes byte for byte', () => {
  // The census keys (plan 5.2). A builder that reorders parameters would make
  // every floor lookup miss while the file is present.
  assert.equal(collectionObjectsPath('68f92deb0e2d5d1f8a286789', { limit: 100 }), '/tenant/collectionObjects?limit=100&collectionId=68f92deb0e2d5d1f8a286789');
  assert.equal(integrationObjectsPath('tiktok', { limit: 100 }), '/tenant/integrationObjects?limit=100&type=tiktok');
  assert.equal(siteDetailsPath(SITE), `/tenant/siteDetails?siteId=${SITE}`);
});

test('collectionIdOf and keyShape read a key without carrying its ids into a log', () => {
  const key = collectionObjectsPath('abc', { limit: 100, skip: 0 });
  assert.equal(collectionIdOf(key), 'abc');
  assert.equal(collectionIdOf(siteDetailsPath(SITE)), undefined);
  assert.equal(keyShape(key), 'collectionObjects?limit&skip&collectionId');
  assert.ok(!keyShape(siteDetailsPath(SITE)).includes(SITE));
});

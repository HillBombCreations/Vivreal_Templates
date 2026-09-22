/**
 * Unit tests for the fleet gate (design C1/C2/C9 "All three want the same
 * runtime gate", test-plan item 2).
 *
 * This predicate is the single thing standing between Vivreal's own
 * instrumentation and every customer site in the fleet.
 *
 * ── WHY THIS FILE LOOKS NOTHING LIKE ITS PREVIOUS VERSION ────────────────
 *
 * The previous version tested a HOSTNAME predicate, and it could not fail. Its
 * reject list was named "rejects every customer-shaped host" and contained
 * `acme.com`, `vivreal.io.evil.com`, `notvivreal.io`, `localhost` and friends:
 * every shape except the one customer sites are actually served from, which is
 * a plain subdomain of `vivreal.io`. Eleven lines above it, `a.b.vivreal.io`
 * was asserted TRUE. So the suite pinned the over-match as correct and the
 * defect was invisible to the only check that existed for it.
 *
 * Adding one real customer host to that reject list turned it red immediately,
 * against unchanged source. That is the evidence the gate had to move, and the
 * reason the populations below are REAL deployed site ids rather than
 * synthetic ones: a gate over the fleet should be pinned against the fleet.
 *
 * The site ids here were read on 2026-09-22 from the live Amplify apps that
 * build this repo's `stable` branch. Site ids are not credentials, and this
 * repo already carries several (`data/mockData.ts`, `domains/publicSearch.ts`
 * and its suite).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isVivrealOwnSite,
  VIVREAL_OWN_SITE_IDS,
  VIVREAL_MARKETING_SITE_ID,
  VIVREAL_HELP_SITE_ID,
} from './vivrealApex.ts';

/**
 * The fleet as it is actually deployed, one row per population the gate has to
 * separate. `host` is documentation, not an input: the whole point of the fix
 * is that the gate never sees it.
 */
const FLEET: ReadonlyArray<{
  label: string;
  siteId: string;
  host: string;
  vivrealOwned: boolean;
}> = [
  {
    label: "Vivreal's marketing site",
    siteId: VIVREAL_MARKETING_SITE_ID,
    host: 'vivreal.io',
    vivrealOwned: true,
  },
  {
    label: "Vivreal's help site",
    siteId: VIVREAL_HELP_SITE_ID,
    host: 'help.vivreal.io',
    vivrealOwned: true,
  },
  {
    // THE REGRESSION. This row is the whole defect: a customer whose site is
    // served from a subdomain of vivreal.io, which the old hostname gate could
    // not distinguish from the two rows above and therefore treated as ours.
    label: 'a customer site on a vivreal.io subdomain',
    siteId: '6a970dc72d516b82acd56107',
    host: 'windward-house.vivreal.io',
    vivrealOwned: false,
  },
  {
    label: 'a second customer site on a vivreal.io subdomain',
    siteId: '6aade02781d33918c94f7bdd',
    host: 'qa-test-2026-09-18.vivreal.io',
    vivrealOwned: false,
  },
  {
    // The population the old gate DID handle. Kept so a fix that swings the
    // other way, and starts treating Vivreal's own sites as customers or the
    // reverse, cannot pass either.
    label: 'a customer site on a purchased domain',
    siteId: '68bfac783bc7c024975c90cb',
    host: 'dougs-kitchen.com',
    vivrealOwned: false,
  },
  {
    label: 'a second customer site on a purchased domain',
    siteId: '6900a3f732b0727413c502b7',
    host: 'comedycollectivechi.com',
    vivrealOwned: false,
  },
];

test('every deployed population gets the exact gate result it should', () => {
  for (const site of FLEET) {
    assert.equal(
      isVivrealOwnSite(site.siteId),
      site.vivrealOwned,
      `${site.label} (${site.host}, ${site.siteId}) must be ${site.vivrealOwned ? '' : 'NOT '}Vivreal owned`,
    );
  }
});

test('the fleet fixture covers both answers, so the loop above cannot pass vacuously', () => {
  const owned = FLEET.filter((s) => s.vivrealOwned).length;
  const customer = FLEET.length - owned;
  assert.equal(owned, 2, 'both Vivreal properties must be represented');
  assert.ok(customer >= 4, 'customers must be represented on both host shapes');
  // Both customer host shapes must be present, or this file drifts back into
  // testing only the population the old gate already handled.
  assert.ok(
    FLEET.some((s) => !s.vivrealOwned && s.host.endsWith('.vivreal.io')),
    'a customer on a vivreal.io subdomain is the regression case and must be here',
  );
  assert.ok(
    FLEET.some((s) => !s.vivrealOwned && !s.host.endsWith('.vivreal.io')),
    'a customer on a purchased domain must be here too',
  );
});

test('the allowlist is exactly the two Vivreal properties', () => {
  assert.deepEqual(
    [...VIVREAL_OWN_SITE_IDS].sort(),
    [VIVREAL_MARKETING_SITE_ID, VIVREAL_HELP_SITE_ID].sort(),
  );
  assert.notEqual(
    VIVREAL_MARKETING_SITE_ID,
    VIVREAL_HELP_SITE_ID,
    'two distinct sites, or one of them is unprotected',
  );
});

/**
 * The id-space version of the suffix confusion the old hostname suite covered.
 *
 * That suite existed because `includes()` and a bare `endsWith()` accept
 * `vivreal.io.evil.com` and `notvivreal.io`. The identical mistake against an
 * allowlist of ids is a substring or prefix match, so the same shapes are
 * carried over onto the thing that is now load-bearing. A real id with one
 * character added, removed or changed must fail.
 */
test('near-miss site ids are rejected (the id-space suffix confusion)', () => {
  const nearMisses = [
    `${VIVREAL_MARKETING_SITE_ID}x`,
    `x${VIVREAL_MARKETING_SITE_ID}`,
    `${VIVREAL_MARKETING_SITE_ID}.evil`,
    `evil.${VIVREAL_MARKETING_SITE_ID}`,
    VIVREAL_MARKETING_SITE_ID.slice(0, -1),
    VIVREAL_MARKETING_SITE_ID.slice(1),
    VIVREAL_MARKETING_SITE_ID.toUpperCase(),
    `${VIVREAL_HELP_SITE_ID}x`,
    VIVREAL_HELP_SITE_ID.slice(0, -1),
    `${VIVREAL_MARKETING_SITE_ID},${VIVREAL_HELP_SITE_ID}`,
    `${VIVREAL_MARKETING_SITE_ID}\n${VIVREAL_HELP_SITE_ID}`,
  ];
  for (const id of nearMisses) {
    assert.equal(isVivrealOwnSite(id), false, `${JSON.stringify(id)} must not pass the gate`);
  }
  // The control: the exact ids these are near misses OF do pass, so the loop
  // above is not passing because the predicate refuses everything.
  assert.equal(isVivrealOwnSite(VIVREAL_MARKETING_SITE_ID), true);
  assert.equal(isVivrealOwnSite(VIVREAL_HELP_SITE_ID), true);
});

test('surrounding whitespace is tolerated, because an env var carries it', () => {
  assert.equal(isVivrealOwnSite(`  ${VIVREAL_MARKETING_SITE_ID}  `), true);
  assert.equal(isVivrealOwnSite(`\t${VIVREAL_HELP_SITE_ID}\n`), true);
});

test('absent, empty and non-string SITE_ID are fail-closed', () => {
  // `SITE_ID` is 'preview' in local and preview builds, and unset is possible
  // in any environment the deploy pipeline has not touched. Every one of these
  // must read as "not Vivreal", so the failure mode of a broken deploy is a
  // missing banner rather than a banner on someone else's site.
  for (const value of [undefined, null, '', '   ', 'preview', 'undefined', 'null']) {
    assert.equal(isVivrealOwnSite(value as unknown as string), false, `${value} must fail closed`);
  }
  assert.equal(isVivrealOwnSite(123 as unknown as string), false);
  assert.equal(isVivrealOwnSite({} as unknown as string), false);
  assert.equal(isVivrealOwnSite([VIVREAL_MARKETING_SITE_ID] as unknown as string), false);
});

test('an empty allowlist gates nothing (the must-fail control for the gate itself)', () => {
  // If this returned true, every assertion above would be meaningless: the
  // predicate would be answering from something other than the allowlist.
  assert.equal(isVivrealOwnSite(VIVREAL_MARKETING_SITE_ID, []), false);
  assert.equal(isVivrealOwnSite(VIVREAL_HELP_SITE_ID, []), false);
});

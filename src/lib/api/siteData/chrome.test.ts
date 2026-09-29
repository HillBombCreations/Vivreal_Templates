import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  SITE_CHROME_FIELDS,
  resolveSiteChrome,
  type SiteChromeField,
} from './chrome.ts';

/**
 * The stale nested mirror must never reach a rendered page.
 *
 * These are unit assertions on the seam the behavioural proof exercises
 * end-to-end. They exist because the seam is the only place this defect ever
 * lived: VR_Secure_API wrote the right value, VR_Client_API returned a
 * well-formed payload, and Templates rendered exactly what it was handed. Each
 * layer was correct and the site was still wrong.
 */

/** A value distinguishable per field and per storage home. */
const topValue = (field: string) => `TOP_${field}`;
const nestedValue = (field: string) => `NESTED_${field}`;

/**
 * The raw response shape as it really arrives: a top-level home for every
 * chrome field AND a fully-populated legacy mirror underneath.
 */
function makeRaw(overrides: Record<string, unknown> = {}) {
  const raw: Record<string, unknown> = {};
  const values: Record<string, unknown> = {};
  for (const field of SITE_CHROME_FIELDS) {
    raw[field] = topValue(field);
    values[field] = nestedValue(field);
  }
  raw.siteDetails = { schema: {}, values };
  return { ...raw, ...overrides };
}

test('every chrome field resolves from its top-level home', () => {
  const chrome = resolveSiteChrome(makeRaw() as never) as Record<string, unknown>;

  for (const field of SITE_CHROME_FIELDS) {
    assert.equal(
      chrome[field],
      topValue(field),
      `${field} must come from the top-level home, not the stale siteDetails.values mirror`
    );
  }
});

test('an unset top-level field does NOT fall back to the nested mirror', () => {
  // The mirror is populated for every field here. Falling back to it is the
  // bug: a site whose value still lives only in the mirror must read as unset
  // so the backfill supplies it, not a value the owner last saw months ago.
  for (const field of SITE_CHROME_FIELDS) {
    const raw = makeRaw();
    delete raw[field];

    const chrome = resolveSiteChrome(raw as never) as Record<string, unknown>;

    assert.equal(
      chrome[field],
      undefined,
      `${field} must read as unset when absent top-level, never the mirror value`
    );
  }
});

test('an explicit null top-level value normalises to undefined, not the mirror', () => {
  // VR_Client_API emits `null` for an unset field (`site.<field> || null`).
  // That must stay unset here rather than resurrect the mirror.
  const raw = makeRaw({ announcement: null, favicon: null });
  const chrome = resolveSiteChrome(raw as never) as Record<string, unknown>;

  assert.equal(chrome.announcement, undefined);
  assert.equal(chrome.favicon, undefined);
});

test('the returned key set is EXACTLY the declared contract', () => {
  // resolveSiteChrome casts its accumulator to SiteChrome. This is the
  // assertion that cast is making, checked at runtime.
  const chrome = resolveSiteChrome(makeRaw() as never);

  assert.deepEqual(
    Object.keys(chrome).sort(),
    [...SITE_CHROME_FIELDS].sort(),
    'resolveSiteChrome must return every declared chrome field and nothing else'
  );
});

test('getSiteData spreads the chrome slice AFTER the values spread', () => {
  // The load-bearing claim in index.tsx is about ORDER inside one object
  // literal, and until this existed nothing failed if someone moved the line.
  // The test below it demonstrates the override property on a hand-built
  // literal, which passes happily against a broken index.tsx -- it replicates
  // the composition instead of inspecting it.
  //
  // Source read for the same reason as src/components/chromePreviewParity.test.ts
  // and src/app/[slug]/page.test.ts: index.tsx is a .tsx that
  // `node --experimental-strip-types` cannot load, and it imports
  // `server-only`. Matching on NAMES, not formatting, so a reformat cannot
  // turn this red.
  const source = fs.readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');
  assert.ok(source.length > 500, 'index.tsx was not read (moved or renamed?)');

  const originSourceAt = source.indexOf('...originSource,');
  const chromeAt = source.indexOf('...resolveSiteChrome(raw),');

  // Assert BOTH markers were found before comparing indices. Two -1s compare
  // equal and two misses would otherwise read as a pass -- the exact silent
  // hole this file is about.
  assert.notEqual(originSourceAt, -1, 'could not find the `...originSource` spread');
  assert.notEqual(chromeAt, -1, 'could not find the `...resolveSiteChrome(raw)` spread');

  assert.ok(
    chromeAt > originSourceAt,
    'resolveSiteChrome must be spread AFTER ...originSource. Above it, the stale '
    + '`siteDetails.values` mirror wins again for all ten chrome fields and every '
    + 'owner edit silently stops reaching the live site.'
  );

  // No chrome field may be re-declared after the chrome spread, which would
  // clobber it exactly the way the old `emailPopup` mapping clobbered a good
  // value the spread had already delivered.
  const tail = source.slice(chromeAt + 1);
  for (const field of SITE_CHROME_FIELDS) {
    assert.equal(
      new RegExp(`^\\s{4}${field}:`, 'm').test(tail),
      false,
      `${field} is re-declared after the chrome spread, which overrides it`
    );
  }
});

test('every key is PRESENT even when unset, so it overrides the values spread', () => {
  // getSiteData() spreads `...siteDetails.values` and then spreads this. An
  // omitted key would let the mirror through; a present-but-undefined key
  // overrides it. That distinction IS the fix, so it gets its own test.
  const chrome = resolveSiteChrome({}) as Record<string, unknown>;

  for (const field of SITE_CHROME_FIELDS) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(chrome, field),
      `${field} must be an own property even when unset`
    );
  }

  // The property-presence contract, demonstrated the way getSiteData uses it.
  const merged = { ...{ announcement: 'STALE_MIRROR' }, ...chrome };
  assert.equal(
    merged.announcement,
    undefined,
    'spreading the chrome slice must clear a stale mirror value, not leave it standing'
  );
});

test('the contract covers every field VR_Client_API emits top-level', () => {
  // Hand-mirrored from VR_Client_API's TOP_LEVEL_CHROME_FIELDS and
  // VR_Secure_API's updateSiteValues `updateDoc.<field>` blocks. A field added
  // upstream and forgotten here is the original defect, exactly.
  const upstream: SiteChromeField[] = [
    'emailPopup',
    'announcement',
    'utilityStrip',
    'fulfillmentStrip',
    'utilityDock',
    'edgeDock',
    'footerNewsletter',
    'floatingCta',
    'favicon',
    'motionPreset',
  ];

  assert.deepEqual([...SITE_CHROME_FIELDS].sort(), [...upstream].sort());
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`.
import { isPageTurnedOff } from './pageEnabled.ts';

test('a page is off ONLY on the literal false the portal persists', () => {
  assert.equal(isPageTurnedOff({ enabled: false }), true, 'the switch is off');
  assert.equal(isPageTurnedOff({ enabled: true }), false, 'the switch is on');
});

test('absence is ON, which is what every page that predates the field carries', () => {
  // The fleet majority. If any of these read as "off", the first deploy takes
  // most pages on most sites off the live site and out of the sitemap at once.
  assert.equal(isPageTurnedOff({}), false, 'no field at all');
  assert.equal(isPageTurnedOff(undefined), false, 'no page');
  assert.equal(isPageTurnedOff(null), false, 'null page');
  assert.equal(
    isPageTurnedOff({ enabled: undefined }),
    false,
    'the key is present and undefined, which a round trip through JSON can produce',
  );
});

test('it reads the flag the way the renderer nav rule reads it, so the two cannot disagree', () => {
  // `deriveMenuItems` / `deriveFooterColumns` (vivreal-site-renderer
  // src/chrome/deriveChrome.ts) skip a page on `p.enabled === false` and
  // nothing else. Mirrored here value by value: every input the nav keeps must
  // stay servable, and the one input the nav drops is the one this reports.
  const navKeeps: Array<{ enabled?: boolean } | null | undefined> = [
    { enabled: true },
    {},
    { enabled: undefined },
    undefined,
    null,
  ];
  for (const page of navKeeps) {
    assert.equal(isPageTurnedOff(page), false, `nav keeps ${JSON.stringify(page)}, so the route must serve it`);
  }
  assert.equal(isPageTurnedOff({ enabled: false }), true, 'the one case nav drops');
});

test('a falsy-but-not-false value is NOT off: the rule is the boolean, never truthiness', () => {
  // A hand-edited document, or a legacy `pages` Record whose value was a bare
  // string, must not be able to take a live page down. `=== false` is the only
  // form that cannot be widened by accident.
  const oddities = [0, '', 'false', NaN] as unknown as boolean[];
  for (const value of oddities) {
    assert.equal(
      isPageTurnedOff({ enabled: value }),
      false,
      `${String(value)} is not the portal's off switch`,
    );
  }
});

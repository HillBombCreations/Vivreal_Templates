import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { currentSlugFromPathname, isPageAllowed } from './pageGating.ts';

/**
 * W10.11 — the site-chrome page gate.
 *
 * Two things are being pinned here:
 *
 *  1. That the gate EXISTS for the announcement strip at all. The renderer
 *     documents `pages` as consumer-owned and shipped no enforcement; the
 *     Templates Navbar wrapper passed the config straight through. So the
 *     Studio offered per-page targeting and the live site ignored it — "Home
 *     only" put the bar on every page, silently.
 *  2. The home-page slug mismatch, which made an explicit "include: Home" match
 *     NOTHING in the pre-existing EmailPopup copy of this rule. The Studio
 *     stores `UniversalPage.slug` (`'home'`); the live route is `/` (strips to
 *     `''`). Nothing types the two together.
 */

describe('currentSlugFromPathname', () => {
  test('the home route collapses to the empty token', () => {
    assert.equal(currentSlugFromPathname('/'), '');
    assert.equal(currentSlugFromPathname(''), '');
    // usePathname() can be null during some render passes.
    assert.equal(currentSlugFromPathname(null), '');
    assert.equal(currentSlugFromPathname(undefined), '');
  });

  test('interior routes strip their slashes', () => {
    assert.equal(currentSlugFromPathname('/about'), 'about');
    assert.equal(currentSlugFromPathname('/about/'), 'about');
    assert.equal(currentSlugFromPathname('//about//'), 'about');
  });

  test('a literal /home route is treated as home, not a page named "home"', () => {
    assert.equal(currentSlugFromPathname('/home'), '');
  });
});

describe('isPageAllowed — unauthored gate falls back to the caller', () => {
  test('absent config uses the fallback (each consumer differs)', () => {
    // Announcement: every page. Email popup: home only. Neither default belongs
    // in the resolver, so both are exercised.
    assert.equal(isPageAllowed(undefined, 'about', true), true);
    assert.equal(isPageAllowed(undefined, 'about', false), false);
    assert.equal(isPageAllowed(null, '', false), false);
  });

  test('a config with no mode is treated as unauthored', () => {
    assert.equal(isPageAllowed({ slugs: ['about'] } as never, 'about', true), true);
  });
});

describe('isPageAllowed — authored modes', () => {
  test("'all' shows everywhere regardless of slugs", () => {
    assert.equal(isPageAllowed({ mode: 'all' }, 'about', false), true);
    assert.equal(isPageAllowed({ mode: 'all', slugs: ['contact'] }, 'about', false), true);
  });

  test("'include' shows only on listed pages", () => {
    const gate = { mode: 'include' as const, slugs: ['about', 'contact'] };
    assert.equal(isPageAllowed(gate, 'about', true), true);
    assert.equal(isPageAllowed(gate, 'contact', true), true);
    assert.equal(isPageAllowed(gate, 'products', true), false);
    // The fallback must NOT leak through an authored gate.
    assert.equal(isPageAllowed(gate, 'products', true), false);
  });

  test("'exclude' hides only on listed pages", () => {
    const gate = { mode: 'exclude' as const, slugs: ['checkout'] };
    assert.equal(isPageAllowed(gate, 'checkout', true), false);
    assert.equal(isPageAllowed(gate, 'about', false), true);
  });
});

describe('isPageAllowed — the home-slug mismatch (the latent bug)', () => {
  test('"include: Home" matches the / route', () => {
    // THE regression. The picker writes 'home'; the route strips to ''.
    // A naive slugs.includes(current) returns false here and the chrome never
    // renders on the one page the user picked.
    assert.equal(isPageAllowed({ mode: 'include', slugs: ['home'] }, '', true), true);
  });

  test("'/' as an authored slug also matches", () => {
    // Some page docs carry '/' rather than 'home'.
    assert.equal(isPageAllowed({ mode: 'include', slugs: ['/'] }, '', true), true);
  });

  test('"exclude: Home" hides on / and shows elsewhere', () => {
    const gate = { mode: 'exclude' as const, slugs: ['home'] };
    assert.equal(isPageAllowed(gate, '', true), false);
    assert.equal(isPageAllowed(gate, 'about', true), true);
  });

  test('home targeting does not leak onto other pages', () => {
    assert.equal(isPageAllowed({ mode: 'include', slugs: ['home'] }, 'about', true), false);
  });
});

describe('isPageAllowed — empty slug list stays literal', () => {
  test("'include' with nothing ticked shows nowhere", () => {
    // Deliberately NOT reinterpreted as "no restriction": that is what the words
    // say, and it is what EmailPopup has always done. Flipping it would change
    // behavior on live sites relying on the current reading.
    assert.equal(isPageAllowed({ mode: 'include', slugs: [] }, 'about', true), false);
    assert.equal(isPageAllowed({ mode: 'include' }, 'about', true), false);
  });

  test("'exclude' with nothing ticked shows everywhere", () => {
    assert.equal(isPageAllowed({ mode: 'exclude', slugs: [] }, 'about', false), true);
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
// The renderer's compiled sanitizer, imported by PATH rather than by package
// name, for the reason `titleBandAdoption.test.ts` documents: the package
// barrel pulls `next/link` through NextSiteRendererProvider and Node's resolver
// rejects that extensionless specifier outside a Next build. This module has no
// imports at all, so it loads standalone.
import { sanitizeHtml } from '../../node_modules/@hillbombcreations/site-renderer/dist/lib/sanitizeHtml.js';

/**
 * Every rich-text field on a customer site goes through this sanitizer, and the
 * `target` it decides is the difference between a reader following a link and a
 * reader accumulating tabs. Renderer 1.69.0 changed that decision and this
 * repository had nothing that could see it: the whole suite stayed green while
 * every internal link on every live site stopped opening a new tab.
 *
 * That change was correct. What was missing is a tripwire, and the reason one is
 * worth having is not the ergonomics half. It is that the SAME rule decides
 * which hrefs keep `rel="noopener noreferrer"`. Four of the shapes below look
 * root-relative and are cross-origin, and a future "simplify this to
 * startsWith('/')" is a real refactor someone will reach for. It would read as
 * a tidy-up and it would hand `//evil.com` a same-tab, rel-less link on every
 * site in the fleet.
 *
 * So the security cases are pinned as the point of this file, and the same-tab
 * cases are pinned so the fix cannot silently roll back either.
 *
 * These assert on rendered MARKUP, not on an internal predicate. `SAME_TAB_HREF`
 * is not exported and should not be: what ships to a browser is the attribute
 * string, so that is what is asserted.
 */

/** The exact attribute suffix a cross-origin link must carry. Byte for byte. */
const NEW_TAB = ' target="_blank" rel="noopener noreferrer"';

/** Sanitize one anchor and hand back just the opening `<a …>` tag. */
function anchor(href: string): string {
  const html = sanitizeHtml(`<p><a href="${href}">Read this</a></p>`);
  const match = /<a\b[^>]*>/.exec(html);
  // Vacuity guard. Every assertion below reads this tag, so a sanitizer that
  // dropped the anchor entirely (or that this file failed to load) must fail
  // loudly rather than compare two empty strings.
  assert.ok(match, `no anchor survived sanitizing href ${JSON.stringify(href)}`);
  return match[0];
}

test('the imported sanitizer is the real thing (guards every assertion below)', () => {
  assert.equal(typeof sanitizeHtml, 'function', 'sanitizeHtml did not come across from the renderer dist');
  // It must actually rewrite something, or a sanitizer that returned its input
  // unchanged would satisfy several of the assertions below by accident.
  assert.equal(
    sanitizeHtml('<p onclick="steal()">hi <script>bad()</script></p>'),
    '<p>hi </p>',
    'the sanitizer is not stripping attributes and script bodies; it is not the real one',
  );
});

/* ── same origin by construction: no target, and deliberately no rel ───────── */

/**
 * A fragment cannot leave the document and a root-relative path cannot leave the
 * origin, so both stay in the reader's tab. `#installation` is the case with no
 * defensible reading at all: with a forced `_blank` it opened a DUPLICATE of the
 * page the reader was already on and then jumped to the anchor on the copy.
 */
const SAME_TAB = [
  '/pricing',
  '/',
  '/shows/2026-01-15',
  '/search?q=comedy',
  '/a?b=c#d',
  '#installation',
  '#',
];

for (const href of SAME_TAB) {
  test(`same tab: ${JSON.stringify(href)} renders with no target and no rel`, () => {
    const tag = anchor(href);
    assert.equal(tag, `<a href="${href}">`);
    assert.ok(!tag.includes('target='), 'an internal link must not open a new tab');
    // No rel, and that is a decision rather than an omission. `noopener` is
    // inert with no new browsing context, and `noreferrer` would strip the
    // Referer from the site's own internal navigation, costing the customer
    // their internal-path analytics for no security gain.
    assert.ok(!tag.includes('rel='), 'an internal link must not carry a rel');
  });
}

/* ── leaves the origin: today's exact target plus rel, byte for byte ───────── */

const NEW_TAB_HREFS = [
  'https://example.com/x',
  'http://example.com',
  'mailto:hello@vivreal.io',
  'tel:+15551234567',
];

for (const href of NEW_TAB_HREFS) {
  test(`new tab: ${JSON.stringify(href)} keeps target and the full rel`, () => {
    assert.equal(anchor(href), `<a href="${href}"${NEW_TAB}>`);
  });
}

/* ── the four that LOOK internal and are not ──────────────────────────────── */

/**
 * Each of these starts with a slash and each one reaches the browser as a
 * CROSS-ORIGIN request. They are the whole reason the same-tab test is an
 * allowlist of the character after the slash rather than `startsWith('/')`, and
 * they are what a future simplification would break.
 *
 * The failure mode being guarded is not a thrown error. It is a link that
 * quietly loses `rel="noopener noreferrer"` and opens attacker-controlled
 * content in the reader's own tab, on every customer site at once.
 */
const CROSS_ORIGIN_LOOKALIKES: Array<[string, string]> = [
  ['//evil.com', 'protocol-relative, so it is a different origin entirely'],
  ['/\\evil.com', 'the URL spec normalises the backslash to //evil.com for special schemes'],
  ['/\t/evil.com', 'browsers strip tabs from URLs, so this resolves as //evil.com'],
  ['/\n/evil.com', 'browsers strip newlines from URLs, so this resolves as //evil.com'],
  ['/&#47;evil.com', 'the entity reaches the browser as a slash, giving //evil.com'],
];

for (const [href, why] of CROSS_ORIGIN_LOOKALIKES) {
  test(`cross origin: ${JSON.stringify(href)} keeps target and rel (${why})`, () => {
    const tag = anchor(href);
    assert.ok(
      tag.endsWith(`${NEW_TAB}>`),
      `${JSON.stringify(href)} is cross-origin and must keep target="_blank" plus the full rel, got ${tag}`,
    );
    assert.ok(tag.includes('rel="noopener noreferrer"'), 'the full rel, not half of it');
  });
}

test('the lookalikes are genuinely a different answer from the same-tab paths', () => {
  // Without this the block above could pass on a sanitizer that gave EVERY href
  // a new tab, which is exactly the 1.68.0 behaviour these tests replaced.
  const lookalikes = CROSS_ORIGIN_LOOKALIKES.map(([href]) => anchor(href));
  const internal = SAME_TAB.map((href) => anchor(href));
  assert.ok(lookalikes.every((tag) => tag.includes('target=')), 'setup: lookalikes should all be new-tab');
  assert.ok(internal.every((tag) => !tag.includes('target=')), 'setup: internal links should all be same-tab');
});

/* ── the scheme allowlist is untouched ────────────────────────────────────── */

test('a javascript: href is still rejected outright', () => {
  // Narrowing the target must never have widened what an href may be. The
  // anchor survives, stripped of the href, so the text stays readable.
  for (const href of ['javascript:alert(1)', 'java&#115;cript:alert(1)', 'JaVaScRiPt:alert(1)']) {
    const tag = anchor(href);
    assert.ok(!tag.includes('href='), `${JSON.stringify(href)} must not keep an href, got ${tag}`);
    assert.ok(!tag.includes('javascript'), 'no part of the scheme may survive into the markup');
  }
});

test('an unrecognised shape fails closed, keeping the new tab', () => {
  // The same-tab test is an allowlist, so anything it cannot vouch for keeps
  // 1.68.0's exact behaviour. A false negative costs an internal link a new
  // tab, which is the status quo; a false positive would cost a rel.
  for (const href of ['//', '/ /evil.com', '/&quot;x']) {
    assert.ok(anchor(href).includes(NEW_TAB.trim().split(' ')[0]), `${JSON.stringify(href)} should fail closed`);
  }
});

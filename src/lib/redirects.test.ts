import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`.
import {
  resolveRedirect,
  isSameOriginRedirectTarget,
  resolveMissingItemRedirect,
} from './redirects.ts';
// edgeSiteMap.ts is edge-safe / dependency-free (no `next/server`, see its
// own header comment), so it -- unlike `middleware.ts` -- can be imported
// directly under plain `node --test`.
import { isSelfRedirectLoop } from './edgeSiteMap.ts';

// resolveRedirect is the read side of the WS3 301 mechanism (two-axis-detail-
// route-design.md §5.1) — the migrator writes `blueprint.redirects` onto
// siteData.redirects; this resolves a request path against that map.

test('absent redirects ⇒ undefined (byte-identical no-op — the fleet default)', () => {
  assert.equal(resolveRedirect(undefined, '/old-page'), undefined);
  assert.equal(resolveRedirect(null, '/old-page'), undefined);
});

test('empty redirects array ⇒ undefined', () => {
  assert.equal(resolveRedirect([], '/old-page'), undefined);
});

test('exact single-segment match', () => {
  const redirects = [{ from: '/old-page', to: '/new-page', status: 301 as const }];
  assert.equal(resolveRedirect(redirects, '/old-page'), '/new-page');
});

test('exact multi-segment match (a flattened deep slug source)', () => {
  const redirects = [
    { from: '/classes/category/baking-classes', to: '/baking-classes', status: 301 as const },
  ];
  assert.equal(
    resolveRedirect(redirects, '/classes/category/baking-classes'),
    '/baking-classes',
  );
});

test('no match ⇒ undefined', () => {
  const redirects = [{ from: '/old-page', to: '/new-page', status: 301 as const }];
  assert.equal(resolveRedirect(redirects, '/unrelated'), undefined);
});

test('trailing slash / missing leading slash on the incoming path are normalized', () => {
  const redirects = [{ from: '/old-page', to: '/new-page', status: 301 as const }];
  assert.equal(resolveRedirect(redirects, '/old-page/'), '/new-page');
  assert.equal(resolveRedirect(redirects, 'old-page'), '/new-page');
});

test('trailing slash authored on the redirect entry itself still matches', () => {
  const redirects = [{ from: '/old-page/', to: '/new-page', status: 301 as const }];
  assert.equal(resolveRedirect(redirects, '/old-page'), '/new-page');
});

test('picks the correct entry out of several', () => {
  const redirects = [
    { from: '/a', to: '/a2', status: 301 as const },
    { from: '/b', to: '/b2', status: 301 as const },
    { from: '/c', to: '/c2', status: 301 as const },
  ];
  assert.equal(resolveRedirect(redirects, '/b'), '/b2');
});

test('a malformed entry in the array is skipped, not thrown on', () => {
  const redirects = [null, { from: '/old-page', to: '/new-page', status: 301 as const }] as unknown as {
    from: string;
    to: string;
  }[];
  assert.equal(resolveRedirect(redirects, '/old-page'), '/new-page');
});

test('is case-sensitive and does not fuzzy-match (design doc §10 — no fuzzy matching, ever)', () => {
  const redirects = [{ from: '/Old-Page', to: '/new-page', status: 301 as const }];
  assert.equal(resolveRedirect(redirects, '/old-page'), undefined);
});

// isSameOriginRedirectTarget — relocated here from `@/lib/edgeSiteMap`
// (docs/bugs/templates-soft-404-and-301-status, Change A) when it became a
// shared guard: `middleware.ts` follows it with an authoritative
// resolved-URL origin check; `src/app/[slug]/[itemId]/page.tsx`'s
// `redirectOrNotFound()` has no request object to check against, so this
// predicate is its ONLY guard before calling `permanentRedirect()`.

// review pass 1, Item 2 -- open redirect + uncaught throw. `resolveRedirect`
// returns migrator-authored content, which callers must not hand to
// `new URL(...)` / `permanentRedirect()` unvalidated.
test('isSameOriginRedirectTarget: rejects a protocol-relative target ("//evil.com")', () => {
  assert.equal(isSameOriginRedirectTarget('//evil.com'), false);
});

test('isSameOriginRedirectTarget: rejects an absolute-URL target ("https://evil.com/x")', () => {
  assert.equal(isSameOriginRedirectTarget('https://evil.com/x'), false);
});

test('isSameOriginRedirectTarget: rejects a pseudo-protocol target ("javascript:alert(1)")', () => {
  assert.equal(isSameOriginRedirectTarget('javascript:alert(1)'), false);
});

test('isSameOriginRedirectTarget: rejects malformed targets ("//" and "http://") that would otherwise throw out of `new URL()`', () => {
  assert.equal(isSameOriginRedirectTarget('//'), false);
  assert.equal(isSameOriginRedirectTarget('http://'), false);
});

test('isSameOriginRedirectTarget: accepts a valid same-origin absolute path ("/contact")', () => {
  assert.equal(isSameOriginRedirectTarget('/contact'), true);
});

// review pass 2, FAIL 1 -- open-redirect guard bypass, reproduced end-to-end
// against `next build` + `next start` (real 301 to http://evil.com/). The
// raw-string predicate `target.startsWith('/') && !target.startsWith('//')`
// does not model how the WHATWG URL parser normalises input BEFORE parsing:
// for special schemes (http/https) it treats `\` as `/` during relative
// resolution, and it strips TAB/LF/CR from ANYWHERE in the input. Each case
// below asserts BOTH the predicate's boolean AND the resolved-origin
// behaviour it exists to prevent -- i.e. that `new URL(target, requestOrigin)`
// genuinely resolves off-origin, proving these are not hypothetical payloads.
const REQUEST_ORIGIN = 'https://mysite.example';

/** Mirrors the authoritative check in middleware.ts -- resolves `target`
 * against `REQUEST_ORIGIN` exactly as `new URL(target, request.url)` does,
 * and reports whether the result left the request's own origin. */
function resolvesOffOrigin(target: string): boolean {
  try {
    return new URL(target, REQUEST_ORIGIN).origin !== REQUEST_ORIGIN;
  } catch {
    return false;
  }
}

test('isSameOriginRedirectTarget: rejects backslash-as-slash smuggling ("/\\evil.com") which resolves off-origin', () => {
  const target = '/\\evil.com';
  assert.equal(resolvesOffOrigin(target), true, 'sanity: this payload really does resolve off-origin');
  assert.equal(isSameOriginRedirectTarget(target), false);
});

test('isSameOriginRedirectTarget: rejects a leading-TAB smuggled target ("/\\t/evil.com") which resolves off-origin', () => {
  const target = '/\t/evil.com';
  assert.equal(resolvesOffOrigin(target), true, 'sanity: this payload really does resolve off-origin');
  assert.equal(isSameOriginRedirectTarget(target), false);
});

test('isSameOriginRedirectTarget: rejects a leading-LF smuggled target ("/\\n/evil.com") which resolves off-origin', () => {
  const target = '/\n/evil.com';
  assert.equal(resolvesOffOrigin(target), true, 'sanity: this payload really does resolve off-origin');
  assert.equal(isSameOriginRedirectTarget(target), false);
});

test('isSameOriginRedirectTarget: rejects a leading-CR smuggled target ("/\\r/evil.com") which resolves off-origin', () => {
  const target = '/\r/evil.com';
  assert.equal(resolvesOffOrigin(target), true, 'sanity: this payload really does resolve off-origin');
  assert.equal(isSameOriginRedirectTarget(target), false);
});

test('isSameOriginRedirectTarget: rejects a doubled-backslash target ("/\\\\evil.com") which resolves off-origin', () => {
  const target = '/\\\\evil.com';
  assert.equal(resolvesOffOrigin(target), true, 'sanity: this payload really does resolve off-origin');
  assert.equal(isSameOriginRedirectTarget(target), false);
});

test('isSameOriginRedirectTarget: rejects mixed/multiple control characters ("/\\t\\r\\n/evil.com") which resolves off-origin', () => {
  // TAB/CR/LF are stripped from ANYWHERE in the input before parsing -- once
  // stripped, the remaining `//` (this `/` plus the one before `evil.com`)
  // is what triggers the off-origin resolution. Without a `/` surviving
  // between the stripped controls and `evil.com`, stripping alone collapses
  // to an ordinary same-origin path (verified separately) -- this case
  // proves the guard catches the genuinely dangerous mixed-control shape.
  const target = '/\t\r\n/evil.com';
  assert.equal(resolvesOffOrigin(target), true, 'sanity: this payload really does resolve off-origin');
  assert.equal(isSameOriginRedirectTarget(target), false);
});

test('isSameOriginRedirectTarget: a bare backslash with no leading slash ("\\evil.com") is already rejected by the leading-slash requirement', () => {
  const target = '\\evil.com';
  // Distinct from the cases above: this one never reaches the `\`-content
  // check because it fails `startsWith('/')` first -- included so the
  // pre-filter's ordering stays covered.
  assert.equal(isSameOriginRedirectTarget(target), false);
});

test('isSameOriginRedirectTarget: percent-encoded slashes ("/%2F%2Fevil.com") are accepted and correctly stay same-origin', () => {
  const target = '/%2F%2Fevil.com';
  // Percent-encoding is not re-decoded during path resolution, so this stays
  // a same-origin path -- must NOT be a false positive in the guard.
  assert.equal(resolvesOffOrigin(target), false, 'sanity: this payload resolves same-origin');
  assert.equal(isSameOriginRedirectTarget(target), true);
});

test('isSameOriginRedirectTarget: a leading-space path segment ("/ /evil.com") is accepted and correctly stays same-origin', () => {
  const target = '/ /evil.com';
  assert.equal(resolvesOffOrigin(target), false, 'sanity: this payload resolves same-origin');
  assert.equal(isSameOriginRedirectTarget(target), true);
});

// Review note N1 (page-layer-unvalidated-redirect-target): the blocklist
// above (`\`, TAB, LF, CR) let every OTHER C0 control through. Node's HTTP
// header validation throws `ERR_INVALID_CHAR` on a raw control byte in a
// `Location` header value -- so an authored `to` carrying one of these used
// to turn a clean 404 into a 500, not just an open redirect. Widened to
// reject every C0 control plus DEL (`[\x00-\x1f\x7f]`).
//
// Review pass 4, FAIL 2 (templates-soft-404-and-301-status): a prior version
// of this guard ALSO rejected non-ASCII (a printable-ASCII-only allowlist,
// `/^[\x20-\x7e]*$/`) on the theory that it shared the same ERR_INVALID_CHAR
// risk as a control character. Measured false: both `NextResponse.redirect()`
// and `permanentRedirect()` build the `Location` header via `new URL()`,
// whose WHATWG parser percent-encodes non-ASCII on the way out -- a raw
// non-ASCII `to` never reaches the header as a raw byte. That allowlist form
// only narrowed working 301s to 404s; it added no security, since the
// review's 31-payload sweep showed every hostile payload is already caught
// by the control-char clause or the `\`/`//`/leading-slash clauses. Reverted
// -- non-ASCII must pass this guard.

test('isSameOriginRedirectTarget: rejects a NUL byte ("/\\x00evil.com") -- would ERR_INVALID_CHAR out of a Location header if handed through unvalidated', () => {
  const target = '/\x00evil.com';
  assert.equal(isSameOriginRedirectTarget(target), false);
});

test('isSameOriginRedirectTarget: rejects DEL (0x7F) ("/\\x7Fevil.com") -- same ERR_INVALID_CHAR class as NUL/TAB/LF/CR', () => {
  const target = '/\x7Fevil.com';
  assert.equal(isSameOriginRedirectTarget(target), false);
});

test('isSameOriginRedirectTarget: rejects an arbitrary C0 control ("/\\x01evil.com") not individually enumerated elsewhere', () => {
  const target = '/\x01evil.com';
  assert.equal(isSameOriginRedirectTarget(target), false);
});

test('isSameOriginRedirectTarget: accepts a raw Latin-1 non-ASCII path ("/café") -- the URL parser percent-encodes it, so it is safe and must not 404', () => {
  const target = '/café';
  assert.equal(resolvesOffOrigin(target), false, 'sanity: this payload resolves same-origin');
  assert.equal(isSameOriginRedirectTarget(target), true);
});

test('isSameOriginRedirectTarget: accepts a raw non-Latin-1 non-ASCII path ("/日本") for the same reason', () => {
  const target = '/日本';
  assert.equal(resolvesOffOrigin(target), false, 'sanity: this payload resolves same-origin');
  assert.equal(isSameOriginRedirectTarget(target), true);
});

test('isSameOriginRedirectTarget: a legitimate printable-ASCII target ("/pages/contact-us") still passes', () => {
  const target = '/pages/contact-us';
  assert.equal(resolvesOffOrigin(target), false, 'sanity: this payload resolves same-origin');
  assert.equal(isSameOriginRedirectTarget(target), true);
});

// resolveMissingItemRedirect — the pure decision table behind
// `redirectOrNotFound()` in `src/app/[slug]/[itemId]/page.tsx`
// (docs/bugs/templates-soft-404-and-301-status, Open Question 2 fix /
// Change A). The route file's `redirectOrNotFound()` is an untested thin
// wrapper (`permanentRedirect(target)` / `notFound()`) around this.

test('resolveMissingItemRedirect: an authored redirect with a valid same-origin target ⇒ the target', () => {
  const redirects = [{ from: '/shop/retired-sku', to: '/shop', status: 301 as const }];
  assert.equal(resolveMissingItemRedirect(redirects, '/shop/retired-sku'), '/shop');
});

test('resolveMissingItemRedirect: an authored redirect with a hostile target ("/\\evil.com") ⇒ undefined, never the hostile target', () => {
  const redirects = [{ from: '/shop/retired-sku', to: '/\\evil.com', status: 301 as const }];
  assert.equal(resolveMissingItemRedirect(redirects, '/shop/retired-sku'), undefined);
});

test('resolveMissingItemRedirect: an authored redirect with a TAB-smuggled target ("/\\t/evil.com") ⇒ undefined', () => {
  const redirects = [{ from: '/shop/retired-sku', to: '/\t/evil.com', status: 301 as const }];
  assert.equal(resolveMissingItemRedirect(redirects, '/shop/retired-sku'), undefined);
});

test('resolveMissingItemRedirect: an authored redirect with a protocol-relative target ("//evil.com") ⇒ undefined', () => {
  const redirects = [{ from: '/shop/retired-sku', to: '//evil.com', status: 301 as const }];
  assert.equal(resolveMissingItemRedirect(redirects, '/shop/retired-sku'), undefined);
});

test('resolveMissingItemRedirect: an authored redirect with an absolute-URL target ("https://evil.com/x") ⇒ undefined', () => {
  const redirects = [{ from: '/shop/retired-sku', to: 'https://evil.com/x', status: 301 as const }];
  assert.equal(resolveMissingItemRedirect(redirects, '/shop/retired-sku'), undefined);
});

test('resolveMissingItemRedirect: no authored redirect for the path ⇒ undefined', () => {
  const redirects = [{ from: '/some-other-page', to: '/elsewhere', status: 301 as const }];
  assert.equal(resolveMissingItemRedirect(redirects, '/shop/retired-sku'), undefined);
});

test('resolveMissingItemRedirect: absent/empty redirects ⇒ undefined', () => {
  assert.equal(resolveMissingItemRedirect(undefined, '/shop/retired-sku'), undefined);
  assert.equal(resolveMissingItemRedirect([], '/shop/retired-sku'), undefined);
});

// page-layer-unvalidated-redirect-target DoD: `redirects` arrives off an
// envelope cast with no runtime validation of authored content, so `r.to`
// can in practice be a non-string. Must fail safe to `undefined` (⇒
// notFound() at the call site), not throw `.startsWith is not a function`
// out of the render.
test('resolveMissingItemRedirect: a non-string `to` (malformed authored data) ⇒ undefined, fails safe instead of throwing', () => {
  const redirects = [{ from: '/shop/retired-sku', to: 12345 }] as unknown as {
    from: string;
    to: string;
  }[];
  assert.doesNotThrow(() => resolveMissingItemRedirect(redirects, '/shop/retired-sku'));
  assert.equal(resolveMissingItemRedirect(redirects, '/shop/retired-sku'), undefined);
});

// review pass 4, FAIL 1 (templates-soft-404-and-301-status): `middleware.ts`
// used to call the BARE `resolveRedirect()` -- which has no `typeof target
// === 'string'` guard -- instead of the composed `resolveMissingItemRedirect()`
// every page-layer call site uses. `redirects.test.ts:268`'s malformed-`to`
// case above covers `resolveMissingItemRedirect()` in isolation only, which
// is exactly why that never caught the bug: middleware never called it. This
// test instead drives the FULL sequence `middleware.ts` runs once a site map
// is available (resolveMissingItemRedirect() -> isSelfRedirectLoop() -> the
// resolved-target handoff to `new URL()`), using the same real, unmodified
// functions from `@/lib/redirects` and `@/lib/edgeSiteMap`, in the same
// order -- not a reimplementation of that logic. `middleware.ts` itself
// cannot be imported directly under plain `node --test` (it statically
// imports the bare specifier `next/server`, which has no `exports` map in
// `next`'s own `package.json` and so only resolves under Next's own
// bundler, and it imports via the `@/*` tsconfig path alias, which this
// project's `node --test` invocation has no loader for) -- this test and
// the wiring guard immediately below it are the closest equivalent
// available in this harness.
test('middleware sequence: a malformed authored `to` (non-string) never reaches new URL() / a throw, and the sequence falls through', () => {
  const redirects = [{ from: '/legacy-malformed', to: 42 }] as unknown as {
    from: string;
    to: string;
  }[];
  const pathname = '/legacy-malformed';

  assert.doesNotThrow(() => {
    // middleware.ts:85 -- resolve via the composed helper.
    const target = resolveMissingItemRedirect(redirects, pathname);
    assert.equal(
      target,
      undefined,
      'a non-string `to` must resolve to undefined (fallthrough), never the raw 42',
    );
    // middleware.ts:87-89 -- `if (!target) return fallthrough()`. `target`
    // is falsy here, so the real middleware body returns before ever
    // reaching isSelfRedirectLoop() or `new URL()` -- asserted explicitly
    // rather than assumed, since that ordering is exactly what the prior
    // bug got wrong.
    if (target) {
      isSelfRedirectLoop(pathname, target);
      new URL(target, 'https://mysite.example');
    }
  });
});

// Wiring guard: reads middleware.ts's own source and asserts it calls the
// composed helper, not a bare resolveRedirect(). A source-text assertion,
// not a behavioural one -- deliberately, since middleware.ts cannot be
// executed directly in this harness (see the comment above). This is what
// actually guards against the regression class in FAIL 1: someone
// reintroducing `resolveRedirect(siteMap.redirects, pathname)` in
// middleware.ts without the `typeof`/same-origin guard
// `resolveMissingItemRedirect()` composes in.
test('middleware.ts wiring: calls the composed resolveMissingItemRedirect(), never a bare resolveRedirect()', () => {
  const middlewarePath = fileURLToPath(new URL('../middleware.ts', import.meta.url));
  const source = readFileSync(middlewarePath, 'utf8');
  // Strip `//` line comments first -- the prose in this file's own doc
  // comments legitimately mentions `resolveRedirect()` by name (e.g. to
  // explain what the composed helper wraps); only CODE must be checked.
  const code = source
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
  assert.match(
    code,
    /resolveMissingItemRedirect\(/,
    'middleware.ts must resolve redirects via the composed, guarded helper',
  );
  assert.doesNotMatch(
    code,
    /\bresolveRedirect\(/,
    'middleware.ts must not call the bare, unguarded resolveRedirect() directly',
  );
});

// "item exists ⇒ neither redirect nor not-found" is NOT expressible as a
// resolveMissingItemRedirect() unit test — the function has no notion of
// item existence by design (matching resolveRedirect()'s own documented
// contract above). The invariant is enforced structurally instead: every
// call site in src/app/[slug]/[itemId]/page.tsx invokes
// redirectOrNotFound()/resolveMissingItemRedirect() ONLY from a format arm's
// own "item not found" branch (`if (!item) return redirectOrNotFound(...)`),
// never on the success path — so an existing item can never reach this
// function. Stated plainly per the test-plan instruction: this half of the
// decision table is a call-site invariant, not a unit-testable branch.

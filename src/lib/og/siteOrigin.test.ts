import { test } from 'node:test';
import assert from 'node:assert/strict';
// Explicit .ts extension (not the `@/` alias): runs under
// `node --experimental-strip-types --test`, which has no tsconfig `paths`
// resolution — same convention every other module in src/lib/og and
// src/lib/seo follows.
import { resolveCanonicalUrl } from './siteOrigin.ts';

// canonical-emission-review.md Pass 2 BLOCK A: parseHttpsOrigin's three
// guards (credentials, path/query/fragment, length/control-chars) had ZERO
// regression coverage — each could be deleted individually and the suite
// stayed green. These tests exist so the fix can never silently regress
// again; each was verified to go RED when its guard was removed (see the
// coder's report for the mutation output).
const live = (canonicalUrl: string) => ({ lifecycleState: 'live' as const, canonicalUrl });

test('BLOCK A guard 1 — credentials in the URL are rejected, never emitted', () => {
  assert.equal(resolveCanonicalUrl(live('https://user:pass@evil.com')), '');
  assert.equal(resolveCanonicalUrl(live('https://user@evil.com')), '');
  assert.equal(resolveCanonicalUrl(live('https://:pass@evil.com')), '');
});

test('BLOCK A guard 2 — path, query, or fragment are rejected, never emitted', () => {
  assert.equal(resolveCanonicalUrl(live('https://example.com/some/path')), '');
  assert.equal(resolveCanonicalUrl(live('https://example.com/home?src=a')), '');
  assert.equal(resolveCanonicalUrl(live('https://example.com?q=1')), '');
  assert.equal(resolveCanonicalUrl(live('https://example.com#frag')), '');
  assert.equal(resolveCanonicalUrl(live('https://evil.com#@good.com')), '');
});

test('BLOCK A guard 3 — oversize or control-character/whitespace values are rejected, never emitted', () => {
  assert.equal(resolveCanonicalUrl(live(`https://${'a'.repeat(2040)}.example`)), ''); // 2052 chars, over the 2048 cap
  assert.equal(resolveCanonicalUrl(live('https://exa\nmple.com')), ''); // embedded newline
  assert.equal(resolveCanonicalUrl(live('https://exa\tmple.com')), ''); // embedded tab
  assert.equal(resolveCanonicalUrl(live('https://exa mple.com')), ''); // embedded space
});

test('a well-formed value normalizes to the parsed origin, never the raw input', () => {
  assert.equal(resolveCanonicalUrl(live('HTTPS://EXAMPLE.COM/')), 'https://example.com', 'uppercase scheme/host normalize');
  assert.equal(resolveCanonicalUrl(live('https://exаmple.com')), 'https://xn--exmple-4nf.com', 'Cyrillic а homograph is punycode-normalized, not passed through raw');
  assert.equal(resolveCanonicalUrl(live('https:\\\\evil.com')), 'https://evil.com', 'backslashes normalize rather than emitting verbatim');
  assert.equal(resolveCanonicalUrl(live('https://example.com:443')), 'https://example.com', 'the default https port is dropped');
});

// canonical-emission-review.md Pass 2 CONCERN A: a non-string canonicalUrl
// threw inside generateMetadata() via `.trim()` on a non-string, silently
// stripping <title>/description/every og:* tag from every page (HTTP 200,
// swallowed TypeError). `siteDetails.values` is a loose Mongo Mixed field —
// any JSON type can land in `canonicalUrl`, not just a string.
test('CONCERN A — a non-string canonicalUrl never throws; treated exactly like "nothing authored"', () => {
  const base = { lifecycleState: 'live' as const };
  // `as unknown as` — deliberately outside canonicalUrl's declared `string`
  // type: the exact runtime shape a loose Mixed Mongo field can carry.
  assert.doesNotThrow(() => resolveCanonicalUrl({ ...base, canonicalUrl: 12345 } as unknown as Parameters<typeof resolveCanonicalUrl>[0]));
  assert.equal(resolveCanonicalUrl({ ...base, canonicalUrl: 12345 } as unknown as Parameters<typeof resolveCanonicalUrl>[0]), '');
  assert.equal(resolveCanonicalUrl({ ...base, canonicalUrl: true } as unknown as Parameters<typeof resolveCanonicalUrl>[0]), '');
  assert.equal(resolveCanonicalUrl({ ...base, canonicalUrl: { v: 'https://evil.com' } } as unknown as Parameters<typeof resolveCanonicalUrl>[0]), '');
  assert.equal(resolveCanonicalUrl({ ...base, canonicalUrl: ['https://evil.com'] } as unknown as Parameters<typeof resolveCanonicalUrl>[0]), '');
});

// canonical-emission-review.md Pass 2 CONCERN C: parseHttpsOrigin accepted
// host forms design.md's "no...arbitrary host" excludes. None of these can
// be a legitimate PUBLIC canonical apex.
test('CONCERN C — trailing-dot, dot-only, and double-dot hosts are rejected', () => {
  assert.equal(resolveCanonicalUrl(live('https://prod-apex.example.')), '', 'trailing-dot FQDN — a distinct origin that normally fails TLS SNI');
  assert.equal(resolveCanonicalUrl(live('https://example.com..')), '');
  assert.equal(resolveCanonicalUrl(live('https://.')), '');
});

test('CONCERN C — bracketed IPv6 literals are rejected, with or without an explicit port', () => {
  assert.equal(resolveCanonicalUrl(live('https://[::1]')), '');
  assert.equal(resolveCanonicalUrl(live('https://[2001:db8::1]:8443')), '');
});

test('CONCERN C — bare IPv4 literals and localhost are rejected', () => {
  assert.equal(resolveCanonicalUrl(live('https://127.0.0.1')), '');
  assert.equal(resolveCanonicalUrl(live('https://localhost')), '');
  assert.equal(resolveCanonicalUrl(live('https://sub.localhost')), '');
});

test('CONCERN C — an explicit non-default port is rejected; the default 443 is still accepted', () => {
  assert.equal(resolveCanonicalUrl(live('https://example.com:8443')), '', 'a public canonical apex never legitimately carries an explicit port');
  assert.equal(resolveCanonicalUrl(live('https://example.com:443')), 'https://example.com', 'default port normalizes away and is not "explicit" from the parser\'s perspective');
});

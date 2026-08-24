import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
// Explicit .ts extension (not the `@/` alias): runs under
// `node --experimental-strip-types --test`, which has no tsconfig `paths`
// resolution — same convention every other module in src/lib/og and
// src/lib/seo follows. Importing siteOrigin.ts rather than the ogImage.ts
// re-export is required, not preference: ogImage.ts carries
// `import 'server-only'`, a Next.js build-time sentinel with no npm package
// behind it, so it cannot resolve under plain `node --test`.
import { resolveCanonicalUrl, resolveSiteOrigin, buildDetailUrl } from './siteOrigin.ts';

// ONE resolver, ONE precedence chain (design.md Option A):
//   canonicalUrl -> NEXT_PUBLIC_SITE_URL -> domainInformation.live_url -> domainName
// The required `prefer` discriminant does NOT reorder that chain. It selects
// how strict the resolver is about the answer: 'durable' (JSON-LD `url`,
// robots.txt `Sitemap:`, sitemap `<loc>`, crawler-cached for days) refuses a
// `*.amplifyapp.com` candidate; 'deployed' (metadataBase/OG, per-request)
// accepts it, which is what those surfaces did before this resolver existed.

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_SITE_URL;
const ORIGINAL_LIFECYCLE = process.env.SITE_LIFECYCLE;
afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_ENV;
  if (ORIGINAL_LIFECYCLE === undefined) delete process.env.SITE_LIFECYCLE;
  else process.env.SITE_LIFECYCLE = ORIGINAL_LIFECYCLE;
});

const live = (canonicalUrl: string) => ({ lifecycleState: 'live' as const, canonicalUrl });
const BOTH_MODES = [{ prefer: 'durable' as const }, { prefer: 'deployed' as const }];

// ───────────────────────── precedence: ONE order, BOTH modes ─────────────────

test('precedence is canonicalUrl > NEXT_PUBLIC_SITE_URL > live_url > domainName, identically in both modes', () => {
  delete process.env.SITE_LIFECYCLE;
  const noCanonical = {
    lifecycleState: 'live' as const,
    domainInformation: { live_url: 'https://next.vivreal.io' },
    domainName: 'legacy.example',
  };
  const full = { ...noCanonical, canonicalUrl: 'https://vivreal.io/' };
  for (const mode of BOTH_MODES) {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://env.example/';
    assert.equal(resolveSiteOrigin(full, mode), 'https://vivreal.io', `${mode.prefer}: canonicalUrl wins`);
    assert.equal(resolveSiteOrigin(noCanonical, mode), 'https://env.example', `${mode.prefer}: env is level 2`);

    delete process.env.NEXT_PUBLIC_SITE_URL;
    assert.equal(resolveSiteOrigin(noCanonical, mode), 'https://next.vivreal.io', `${mode.prefer}: live_url is level 3`);
    assert.equal(
      resolveSiteOrigin({ lifecycleState: 'live', domainName: 'legacy.example' }, mode),
      'https://legacy.example',
      `${mode.prefer}: domainName is level 4`,
    );
    assert.equal(resolveSiteOrigin({}, mode), '', `${mode.prefer}: nothing known ⇒ empty`);
    assert.equal(resolveSiteOrigin(null, mode), '');
    assert.equal(resolveSiteOrigin(undefined, mode), '');
  }
});

// This is the case the dropped `durable` precedence inversion would have
// flipped. Pinned in both modes so a future reader cannot reintroduce a
// second order without turning this red: `og:url` and sitemap `<loc>` naming
// different hosts on the same document is precisely what one order prevents.
test('live_url outranks domainName in BOTH modes: the resolver never ships two orders', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  const site = {
    domainName: 'legacy.example',
    domainInformation: { live_url: 'https://deployed.example' },
  };
  assert.equal(resolveSiteOrigin(site, { prefer: 'durable' }), 'https://deployed.example');
  assert.equal(resolveSiteOrigin(site, { prefer: 'deployed' }), 'https://deployed.example');
});

// ───────────────────────── backward compatibility, per input shape ───────────
// The fleet-wide hard requirement: a site with no canonicalUrl and no
// NEXT_PUBLIC_SITE_URL (which is set on ZERO of the 20 fleet Amplify apps)
// must resolve byte-for-byte as it did before this change, in the mode its
// surfaces actually use.

test('BACKCOMPAT: every real fleet input shape resolves to exactly the pre-change bytes', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_LIFECYCLE;
  const cases: Array<[string, Parameters<typeof resolveSiteOrigin>[0], string]> = [
    // Subdomain-only site (the fleet majority): live_url only.
    ['live_url only', { domainInformation: { live_url: 'https://classichousephx.vivreal.io' } }, 'https://classichousephx.vivreal.io'],
    // Legacy custom-apex site: domainName only.
    ['domainName only', { domainName: 'comedycollectivechi.com' }, 'https://comedycollectivechi.com'],
    // www host on domainName.
    ['www domainName', { domainName: 'www.dougs-kitchen.com' }, 'https://www.dougs-kitchen.com'],
    // Both present and in agreement (every fleet site observed live).
    ['both, agreeing', { domainName: 'wavesofgrainco.com', domainInformation: { live_url: 'https://wavesofgrainco.com' } }, 'https://wavesofgrainco.com'],
    // Trailing slashes were stripped before; still are.
    ['trailing slash on live_url', { domainInformation: { live_url: 'https://sub.vivreal.io/' } }, 'https://sub.vivreal.io'],
    ['trailing slash on domainName', { domainName: 'acme.test/' }, 'https://acme.test'],
    // Nothing known.
    ['neither', {}, ''],
  ];
  for (const [label, siteData, expected] of cases) {
    for (const mode of BOTH_MODES) {
      assert.equal(resolveSiteOrigin(siteData, mode), expected, `${label} (${mode.prefer})`);
    }
  }
});

test('BACKCOMPAT: a site with no lifecycleState at all still resolves its origin (never deindexed by absence)', () => {
  delete process.env.SITE_LIFECYCLE;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(
    resolveSiteOrigin({ domainName: 'legacy-no-lifecycle.example' }, { prefer: 'durable' }),
    'https://legacy-no-lifecycle.example',
  );
});

test('NEXT_PUBLIC_SITE_URL override wins over both fallbacks in both modes, trailing slash stripped', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://override.test/';
  const site = { domainName: 'wavesofgrainco.com', domainInformation: { live_url: 'https://classichousephx.vivreal.io' } };
  assert.equal(resolveSiteOrigin(site, { prefer: 'durable' }), 'https://override.test');
  assert.equal(resolveSiteOrigin(site, { prefer: 'deployed' }), 'https://override.test');
});

test('a slash-only NEXT_PUBLIC_SITE_URL is treated as absent, in BOTH modes, falling through to live_url', () => {
  // Fixture R from the origin-unification review: the pre-collapse code tested
  // the trimmed-but-unstripped env value ("/", truthy) and returned the
  // STRIPPED result (''), so a slash-only override blanked the origin entirely
  // even though a real live_url/domainName was known. Stripping before testing
  // means the empty result is correctly falsy and the override is ignored.
  process.env.NEXT_PUBLIC_SITE_URL = '/';
  const site = { domainName: 'wavesofgrainco.com', domainInformation: { live_url: 'https://classichousephx.vivreal.io' } };
  assert.equal(resolveSiteOrigin(site, { prefer: 'durable' }), 'https://classichousephx.vivreal.io');
  assert.equal(resolveSiteOrigin(site, { prefer: 'deployed' }), 'https://classichousephx.vivreal.io');
});

// ───────────────────────── the amplifyapp refusal (durable only) ─────────────

test('durable: a bare amplifyapp live_url with no domainName is refused, not emitted', () => {
  // Fixture E from the origin-unification review: no domainName, and live_url
  // durably holds an amplifyapp host (the `$.domain === ""` deploy state-machine
  // path, where markSiteLive writes the amplifyapp default as the TERMINAL
  // value). Emitting nothing is what these surfaces did before the resolver
  // existed, so refusing is a safe floor rather than a new failure mode.
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(
    resolveSiteOrigin(
      { domainInformation: { live_url: 'https://stable.d1a2b3c4d5.amplifyapp.com' } },
      { prefer: 'durable' },
    ),
    '',
  );
});

test('durable: an amplifyapp candidate is SKIPPED, not aborted on, so a good domainName still wins', () => {
  // review-templates-106.md C4: the original guard computed the winner first
  // and then refused it, so a site with an amplifyapp live_url AND a perfectly
  // good domainName resolved to '' and threw away a valid origin. Filtering per
  // candidate is the same number of lines and cannot discard a good answer.
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(
    resolveSiteOrigin(
      { domainName: 'wavesofgrainco.com', domainInformation: { live_url: 'https://main.d1234abcd.amplifyapp.com' } },
      { prefer: 'durable' },
    ),
    'https://wavesofgrainco.com',
  );
});

test('deployed: an amplifyapp live_url is accepted, unchanged from pre-resolver behaviour', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(
    resolveSiteOrigin(
      { domainName: 'wavesofgrainco.com', domainInformation: { live_url: 'https://stable.d1a2b3c4d5.amplifyapp.com' } },
      { prefer: 'deployed' },
    ),
    'https://stable.d1a2b3c4d5.amplifyapp.com',
  );
});

test('durable: the amplifyapp refusal applies to EVERY level, including a misconfigured canonicalUrl and env', () => {
  // The guard used to sit below the mode branch and only saw the winner. It is
  // now a per-candidate filter, so no level can smuggle an Amplify build host
  // into a crawler-cached surface.
  delete process.env.SITE_LIFECYCLE;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://stable.denv.amplifyapp.com';
  assert.equal(
    resolveSiteOrigin({ lifecycleState: 'live', domainName: 'wavesofgrainco.com' }, { prefer: 'durable' }),
    'https://wavesofgrainco.com',
    'an amplifyapp env override is skipped, not emitted',
  );
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(
    resolveSiteOrigin(
      { lifecycleState: 'live', canonicalUrl: 'https://stable.dcanon.amplifyapp.com', domainName: 'wavesofgrainco.com' },
      { prefer: 'durable' },
    ),
    'https://wavesofgrainco.com',
    'an amplifyapp canonicalUrl is skipped, not emitted',
  );
});

test('the three amplifyapp host bypasses the regex alone could not close are closed by the origin allowlist', () => {
  // review-templates-106.md C3 probed `AMPLIFYAPP_HOST_RE` against
  // `new URL(origin).hostname` and found three host forms that slipped past:
  // a trailing-dot FQDN, a protocol-relative value, and a scheme-less value.
  // All three are now rejected one step earlier, by the HTTPS-origin allowlist
  // that every candidate goes through, so none of them can be emitted at all.
  delete process.env.NEXT_PUBLIC_SITE_URL;
  for (const liveUrl of [
    'https://stable.d1.amplifyapp.com.',
    '//stable.d1.amplifyapp.com',
    'stable.d1.amplifyapp.com',
  ]) {
    assert.equal(
      resolveSiteOrigin({ domainInformation: { live_url: liveUrl } }, { prefer: 'durable' }),
      '',
      `${liveUrl} must not resolve`,
    );
  }
});

test('an unrecognized prefer literal fails safe to durable, not the less-safe deployed answer', () => {
  // TypeScript rejects every bad `prefer` form at compile time; this pins the
  // JS-runtime fallback for a value that reaches here anyway (an omitted
  // options object, a typo'd literal from an untyped caller). Testing
  // positively for 'deployed' is what makes the unrecognized value land on the
  // stricter path.
  delete process.env.NEXT_PUBLIC_SITE_URL;
  const site = { domainInformation: { live_url: 'https://stable.d1a2b3c4d5.amplifyapp.com' } };
  // @ts-expect-error — intentionally an unrecognized `prefer` literal, not one of
  // the two values the OriginPreference union allows.
  assert.equal(resolveSiteOrigin(site, { prefer: 'indexed' }), '');
});

// ───────────────────────── the HTTPS-origin allowlist, EVERY candidate ───────
// design.md item 28: "Canonical origins are HTTPS-origin allowlisted (no path,
// query, fragment, credentials, or arbitrary host)" (OWASP ASVS 5.1). The
// allowlist used to guard `canonicalUrl` only, so an unvalidated `live_url`
// reached robots.txt and sitemap `<loc>` (review-templates-106.md C2).

test('C2: a live_url carrying a path or query is refused, not concatenated into Sitemap:/<loc>', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  for (const liveUrl of ['https://acme.com/site?x=1', 'https://acme.com/site', 'https://acme.com/?utm=1', 'https://acme.com/#top']) {
    for (const mode of BOTH_MODES) {
      assert.equal(resolveSiteOrigin({ domainInformation: { live_url: liveUrl } }, mode), '', `${liveUrl} (${mode.prefer})`);
    }
  }
});

test('C2: a scheme-less or non-https live_url is refused rather than emitted as a relative directive', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  for (const liveUrl of ['acme.com', 'http://acme.com', '//acme.com', 'ftp://acme.com']) {
    assert.equal(resolveSiteOrigin({ domainInformation: { live_url: liveUrl } }, { prefer: 'durable' }), '', liveUrl);
  }
});

test('C2: credentials, an explicit port, and a non-public host are refused on live_url and domainName alike', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  const refused: Array<Parameters<typeof resolveSiteOrigin>[0]> = [
    { domainInformation: { live_url: 'https://user:pass@acme.com' } },
    { domainInformation: { live_url: 'https://acme.com:8443' } },
    { domainInformation: { live_url: 'https://localhost' } },
    { domainInformation: { live_url: 'https://127.0.0.1' } },
    { domainInformation: { live_url: 'https://[::1]' } },
    { domainName: 'user:pass@acme.com' },
    { domainName: 'acme.com:8443' },
    { domainName: 'localhost' },
    { domainName: 'acme.com/path' },
    { domainName: 'https://acme.com' }, // already a URL: would have become https://https://acme.com
  ];
  for (const siteData of refused) {
    assert.equal(resolveSiteOrigin(siteData, { prefer: 'durable' }), '', JSON.stringify(siteData));
  }
});

test('C13: the resolver only ever returns "" or a string new URL() can parse', () => {
  // layout.tsx does `metadataBase: new URL(origin)`, and its catch path does it
  // a SECOND time. An unparseable env value used to be able to throw there,
  // uncaught, taking generateMetadata() down for every page on the site.
  process.env.NEXT_PUBLIC_SITE_URL = 'not a url at all';
  const origin = resolveSiteOrigin({ domainName: 'acme.test' }, { prefer: 'deployed' });
  assert.equal(origin, 'https://acme.test', 'a garbage env value is skipped, not returned');
  assert.doesNotThrow(() => new URL(origin));
});

test('a well-formed value normalizes to the parsed origin, never the raw input', () => {
  delete process.env.SITE_LIFECYCLE;
  assert.equal(resolveCanonicalUrl(live('HTTPS://EXAMPLE.COM/')), 'https://example.com', 'uppercase scheme/host normalize');
  assert.equal(resolveCanonicalUrl(live('https://exаmple.com')), 'https://xn--exmple-4nf.com', 'Cyrillic а homograph is punycode-normalized, not passed through raw');
  assert.equal(resolveCanonicalUrl(live('https:\\\\evil.com')), 'https://evil.com', 'backslashes normalize rather than emitting verbatim');
  assert.equal(resolveCanonicalUrl(live('https://example.com:443')), 'https://example.com', 'the default https port is dropped');
});

// ───────────────────────── canonicalUrl: the level-1 guards ──────────────────
// canonical-emission-review.md Pass 2 BLOCK A: parseHttpsOrigin's three guards
// (credentials, path/query/fragment, length/control-chars) had ZERO regression
// coverage — each could be deleted individually and the suite stayed green.

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

// canonical-emission-review.md Pass 2 CONCERN A: a non-string canonicalUrl
// threw inside generateMetadata() via `.trim()` on a non-string, silently
// stripping <title>/description/every og:* tag from every page (HTTP 200,
// swallowed TypeError). `siteDetails.values` is a loose Mongo Mixed field —
// any JSON type can land in any of these fields, not just a string.
test('CONCERN A — a non-string canonicalUrl never throws; treated exactly like "nothing authored"', () => {
  const base = { lifecycleState: 'live' as const };
  // `as unknown as` — deliberately outside canonicalUrl's declared `string`
  // type: the exact runtime shape a loose Mixed Mongo field can carry.
  const asInput = (canonicalUrl: unknown) =>
    ({ ...base, canonicalUrl }) as unknown as Parameters<typeof resolveCanonicalUrl>[0];
  assert.doesNotThrow(() => resolveCanonicalUrl(asInput(12345)));
  assert.equal(resolveCanonicalUrl(asInput(12345)), '');
  assert.equal(resolveCanonicalUrl(asInput(true)), '');
  assert.equal(resolveCanonicalUrl(asInput({ v: 'https://evil.com' })), '');
  assert.equal(resolveCanonicalUrl(asInput(['https://evil.com'])), '');
});

test('CONCERN A: a non-string live_url or domainName never throws either', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  const asInput = (siteData: unknown) => siteData as Parameters<typeof resolveSiteOrigin>[0];
  assert.doesNotThrow(() => resolveSiteOrigin(asInput({ domainName: 12345 }), { prefer: 'durable' }));
  assert.equal(resolveSiteOrigin(asInput({ domainName: 12345 }), { prefer: 'durable' }), '');
  assert.equal(
    resolveSiteOrigin(asInput({ domainInformation: { live_url: { v: 1 } }, domainName: 'acme.test' }), { prefer: 'durable' }),
    'https://acme.test',
    'a non-string live_url is skipped, and the good domainName still resolves',
  );
});

// canonical-emission-review.md Pass 2 CONCERN C: parseHttpsOrigin accepted
// host forms design.md's "no...arbitrary host" excludes. None of these can be a
// legitimate PUBLIC canonical apex.
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

// canonical-emission-review.md Pass 3 CONCERN K: isPublicHostname checked shape
// but never length, so a hostname that can never exist in DNS (RFC 1035 §3.1:
// name <= 253 octets, each label <= 63) was still accepted and emitted as the
// canonical. `MAX_HOSTNAME_LENGTH` and `MAX_LABEL_LENGTH` are two INDEPENDENT
// guards, not one compound condition — each case below isolates its own bound
// and stays under the other one, so a mutation that deletes either guard alone
// turns the matching case red on its own.
test('CONCERN K — a hostname over the RFC 1035 total-length cap is rejected even when every label is short', () => {
  // 5 labels of 50 chars joined by 4 dots = 254 total, over the 253 cap.
  const oversizeTotal = Array.from({ length: 5 }, () => 'a'.repeat(50)).join('.');
  assert.equal(oversizeTotal.length, 254);
  assert.ok(oversizeTotal.split('.').every((label) => label.length <= 63));
  assert.equal(resolveCanonicalUrl(live(`https://${oversizeTotal}`)), '');
});

test('CONCERN K — a single label over the RFC 1035 63-char cap is rejected even when the total host is short', () => {
  // A 68-char label plus ".example" is 76 chars total, well under the 253 cap.
  const oversizeLabel = 'a'.repeat(68);
  const hostname = `${oversizeLabel}.example`;
  assert.ok(hostname.length < 253);
  assert.equal(resolveCanonicalUrl(live(`https://${hostname}`)), '');
});

test('CONCERN K — a hostname exactly at both RFC 1035 caps is accepted', () => {
  // Three 63-char labels + one 61-char label + 3 dots = 253.
  const label63 = 'a'.repeat(63);
  const label61 = 'a'.repeat(61);
  const hostname = [label63, label63, label63, label61].join('.');
  assert.equal(hostname.length, 253);
  assert.equal(resolveCanonicalUrl(live(`https://${hostname}`)), `https://${hostname}`);
});

test('CONCERN K — the rendered proof from the review (300-char label, and a 68-char label) is rejected; a normal host still emits', () => {
  assert.equal(resolveCanonicalUrl(live(`https://${'a'.repeat(300)}.example`)), '');
  assert.equal(resolveCanonicalUrl(live('https://prod-apex.example')), 'https://prod-apex.example');
});

// ───────────────────────── demo gating, inside the resolver ──────────────────

test('SEO demo-safety: a demo site never resolves its origin from a populated canonicalUrl, in either mode', () => {
  delete process.env.SITE_LIFECYCLE;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  // The cutover endpoint can write canonicalUrl BEFORE lifecycleState flips to
  // 'live' (write-ahead so Stage 6 can confirm it pre-mutation) — a demo site
  // must never resolve to that pre-cutover value, live_url/domainName only.
  for (const mode of BOTH_MODES) {
    assert.equal(
      resolveSiteOrigin(
        {
          lifecycleState: 'demo',
          canonicalUrl: 'https://vivreal.io',
          domainInformation: { live_url: 'https://demo-sub.vivreal.io' },
          domainName: 'legacy.example',
        },
        mode,
      ),
      'https://demo-sub.vivreal.io',
      `${mode.prefer}: falls through to live_url, ignoring the persisted canonicalUrl entirely`,
    );
    assert.equal(
      resolveSiteOrigin({ lifecycleState: 'demo', canonicalUrl: 'https://vivreal.io', domainName: 'legacy.example' }, mode),
      'https://legacy.example',
      `${mode.prefer}: falls through to domainName when live_url is absent too`,
    );
  }
  // Same gate as isDemoSite's env fallback: an in-flight demo protected by
  // SITE_LIFECYCLE alone (doc flag not yet written) is covered too.
  process.env.SITE_LIFECYCLE = 'demo';
  assert.equal(
    resolveSiteOrigin({ canonicalUrl: 'https://vivreal.io', domainName: 'legacy.example' }, { prefer: 'deployed' }),
    'https://legacy.example',
  );
});

test('a malformed, relative, or non-https canonicalUrl is rejected and falls back rather than emitting garbage', () => {
  delete process.env.SITE_LIFECYCLE;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  for (const canonicalUrl of ['not-a-url', '/relative/path', 'http://insecure.example', 'javascript:alert(1)', '   ']) {
    assert.equal(
      resolveSiteOrigin({ canonicalUrl, domainName: 'legacy.example' }, { prefer: 'deployed' }),
      'https://legacy.example',
      canonicalUrl,
    );
  }
  // A well-formed value still wins over every fallback.
  assert.equal(
    resolveSiteOrigin({ canonicalUrl: 'https://vivreal.io', domainName: 'legacy.example' }, { prefer: 'deployed' }),
    'https://vivreal.io',
  );
});

// ───────────────────────── buildDetailUrl ────────────────────────────────────

test('buildDetailUrl composes the resolved (durable) origin with slug/itemId', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(
    buildDetailUrl({ domainName: 'wavesofgrainco.com' }, 'menu', 'abc123'),
    'https://wavesofgrainco.com/menu/abc123',
  );
});

test('buildDetailUrl strips a leading slash on slug, matching buildSitemapEntries', () => {
  // A pageConfig.slug is stored WITH a leading slash, which is why
  // buildSitemapEntries strips it. review-templates-106.md C11: one of the two
  // helpers normalized and the other did not.
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(
    buildDetailUrl({ domainName: 'wavesofgrainco.com' }, '/menu', 'abc123'),
    'https://wavesofgrainco.com/menu/abc123',
  );
});

test('buildDetailUrl returns undefined when no origin is known, or the only origin is an amplifyapp host', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(buildDetailUrl({}, 'menu', 'abc123'), undefined);
  assert.equal(
    buildDetailUrl({ domainInformation: { live_url: 'https://stable.d1a2b3c4d5.amplifyapp.com' } }, 'menu', 'abc123'),
    undefined,
  );
});

test('buildDetailUrl is demo-gated at the canonicalUrl level, like every other surface', () => {
  delete process.env.SITE_LIFECYCLE;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(
    buildDetailUrl(
      { lifecycleState: 'demo', canonicalUrl: 'https://vivreal.io', domainName: 'demo-sub.vivreal.io' },
      'shows',
      'abc123',
    ),
    'https://demo-sub.vivreal.io/shows/abc123',
    'a demo never composes a detail URL on the pre-cutover apex',
  );
});

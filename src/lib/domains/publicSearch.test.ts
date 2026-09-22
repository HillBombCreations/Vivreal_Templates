import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`.
import {
  DEFAULT_DOMAIN_SEARCH_API,
  DOMAIN_GUIDE,
  DOMAIN_SEARCH_COPY,
  domainFaqSchema,
  domainGuideStrings,
  withDomainsSitemapEntry,
  FREE_YEAR_OFFER,
  FREE_YEAR_SOURCE,
  SIMPLE_GET_INIT,
  VIVREAL_MARKETING_SITE_ID,
  availabilityUrl,
  domainSearchApiBase,
  evaluateQuery,
  formatCapUsd,
  messageForFailure,
  normalizeQuery,
  parseAvailability,
  parseSuggestions,
  registerHref,
  servesPublicDomainSearch,
  suggestionsUrl,
} from './publicSearch.ts';

// ─── The fleet gate ──────────────────────────────────────────────────────
//
// This is the highest-consequence assertion in the file. Vivreal_Templates is
// one codebase for vivreal.io AND every customer site, promoted fleet-wide in
// one action, and a static route under src/app/ outranks `[slug]`. Get this
// wrong and a bakery's own domain grows a page selling Vivreal web addresses.

test('the gate passes only the Vivreal marketing site', () => {
  assert.equal(servesPublicDomainSearch(VIVREAL_MARKETING_SITE_ID), true);
  assert.equal(servesPublicDomainSearch('6900a3f732b0727413c502b7'), false, 'comedy collective');
  assert.equal(servesPublicDomainSearch('68adda65762dfc328d91382d'), false, 'waves of grain');
});

test('the gate fails closed on every shape of missing site id', () => {
  for (const bad of [undefined, null, '', '   ', 0, false, {}, []] as unknown[]) {
    assert.equal(
      servesPublicDomainSearch(bad as string | null | undefined),
      false,
      `expected false for ${JSON.stringify(bad)}`,
    );
  }
});

test('the gate trims, because an Amplify env value can carry whitespace', () => {
  assert.equal(servesPublicDomainSearch(` ${VIVREAL_MARKETING_SITE_ID}\n`), true);
});

test('the gate is not a prefix or substring match', () => {
  assert.equal(servesPublicDomainSearch(`${VIVREAL_MARKETING_SITE_ID}0`), false);
  assert.equal(servesPublicDomainSearch(VIVREAL_MARKETING_SITE_ID.slice(0, -1)), false);
});

test('the expected site id is overridable, so a re-created site is config not a deploy', () => {
  assert.equal(servesPublicDomainSearch('abc123', 'abc123'), true);
  assert.equal(servesPublicDomainSearch(VIVREAL_MARKETING_SITE_ID, 'abc123'), false);
});

// ─── The API base ────────────────────────────────────────────────────────

test('the API base defaults to the live service', () => {
  assert.equal(domainSearchApiBase(undefined), DEFAULT_DOMAIN_SEARCH_API);
  assert.equal(domainSearchApiBase(''), DEFAULT_DOMAIN_SEARCH_API);
  assert.equal(domainSearchApiBase('   '), DEFAULT_DOMAIN_SEARCH_API);
});

test('a trailing slash is stripped, or every request 404s on a doubled slash', () => {
  assert.equal(domainSearchApiBase('https://example.test/'), 'https://example.test');
  assert.equal(domainSearchApiBase('https://example.test///'), 'https://example.test');
  assert.equal(
    availabilityUrl('mybusiness.com', domainSearchApiBase('https://example.test/')),
    'https://example.test/public/availability?domain=mybusiness.com',
  );
});

test('both routes are built against the paths the service actually registers', () => {
  // `src/main.js` ROUTES on vivreal-domain-search: /public/parked,
  // /public/availability, /public/suggestions. The query parameter is `domain`,
  // and it is the only one the origin request policy forwards.
  assert.equal(
    availabilityUrl('mybusiness.com', 'https://d.test'),
    'https://d.test/public/availability?domain=mybusiness.com',
  );
  assert.equal(
    suggestionsUrl('mybusiness.com', 'https://d.test'),
    'https://d.test/public/suggestions?domain=mybusiness.com',
  );
});

test('the domain is encoded, so a crafted value cannot add a query parameter', () => {
  const url = availabilityUrl('a.com&domain=b.com', 'https://d.test');
  assert.equal(url, 'https://d.test/public/availability?domain=a.com%26domain%3Db.com');
  assert.equal(url.split('domain=').length - 1, 1, 'exactly one domain parameter');
});

// ─── The request has to stay a SIMPLE request ────────────────────────────
//
// The domain-search distribution allows GET and HEAD only and answers OPTIONS
// with a 403 of its own, verified live 2026-09-08. Anything that makes the
// browser preflight dies at the edge before the CORS policy is consulted, and
// surfaces as a CORS error naming nothing. This is the guard on that.

test('the fetch init carries nothing that would trigger a preflight', () => {
  assert.equal(SIMPLE_GET_INIT.method, 'GET');
  const keys = Object.keys(SIMPLE_GET_INIT);
  assert.deepEqual(keys, ['method'], `unexpected init keys: ${keys.join(', ')}`);
  assert.ok(Object.isFrozen(SIMPLE_GET_INIT), 'frozen, so a caller cannot add headers to it');
});

// ─── Input validation ────────────────────────────────────────────────────
//
// Behaviour ported from the portal's evaluateQuery. A name accepted here must
// be a name the hub accepts after signup, or this page has made a promise the
// next screen breaks.

test('a plausible address passes', () => {
  for (const good of ['mybusiness.com', 'my-business.co.uk', 'a1.io', 'x-y-z.net']) {
    assert.equal(evaluateQuery(good).ok, true, good);
  }
});

test('the rejections carry the hint the portal shows for the same input', () => {
  assert.deepEqual(evaluateQuery(''), { ok: false, hint: null });
  assert.deepEqual(evaluateQuery('mybusiness'), {
    ok: false,
    hint: 'Add an ending like .com, for example mybusiness.com',
  });
  assert.deepEqual(evaluateQuery('.com'), {
    ok: false,
    hint: 'Put a name before the ending, for example mybusiness.com',
  });
  assert.deepEqual(evaluateQuery('mybusiness.c'), {
    ok: false,
    hint: 'The ending needs at least two letters, like .com',
  });
  assert.deepEqual(evaluateQuery('my business.com'), {
    ok: false,
    hint: 'Use letters, numbers and dashes only',
  });
});

test('case and padding do not change the verdict, and normalizeQuery is what is sent', () => {
  assert.equal(evaluateQuery('  MyBusiness.COM  ').ok, true);
  assert.equal(normalizeQuery('  MyBusiness.COM  '), 'mybusiness.com');
});

// ─── The handoff ─────────────────────────────────────────────────────────

test('the register link is relative and carries the address the portal reads', () => {
  // Relative because CloudFront routes /app and /app/* on this same host to the
  // portal. An absolute URL would also force apex visitors through www.
  const href = registerHref('mybusiness.com');
  assert.equal(href, '/app/register?domain=mybusiness.com');
  assert.ok(!href.startsWith('http'), 'must not be absolute');
  assert.match(href, /^\/app\/register\?domain=/);
});

test('the register link encodes the address', () => {
  assert.equal(
    registerHref('a.com&next=/evil'),
    '/app/register?domain=a.com%26next%3D%2Fevil',
  );
});

// ─── Reading the service's answers ───────────────────────────────────────

test('an available answer keeps its price', () => {
  const parsed = parseAvailability({
    domain: 'mybusiness.com',
    status: 'available',
    price: {
      tld: 'com',
      priceId: 'price_123',
      unitAmount: 2500,
      currency: 'usd',
      displayPrice: '25.00',
    },
  });
  assert.ok(parsed, 'expected a parsed answer');
  assert.equal(parsed.status, 'available');
  assert.ok(parsed.price, 'expected a price');
  assert.equal(parsed.price.displayPrice, '25.00');
  assert.equal(parsed.price.unitAmount, 2500);
});

test('a price is dropped from every status except available', () => {
  // The service already guarantees this. Enforced again here because a price
  // rendered beside an address we cannot sell is the exact failure the
  // service's own header calls out.
  for (const status of ['taken', 'unsupported', 'unknown'] as const) {
    const parsed = parseAvailability({
      domain: 'mybusiness.com',
      status,
      price: { tld: 'com', priceId: 'p', unitAmount: 2500, currency: 'usd', displayPrice: '25.00' },
    });
    assert.ok(parsed, status);
    assert.equal(parsed.price, null, `${status} must carry no price`);
  }
});

test('a malformed body is refused rather than guessed at', () => {
  const bad: unknown[] = [
    null,
    undefined,
    'available',
    42,
    {},
    { domain: 'a.com' },
    { status: 'available' },
    { domain: '', status: 'available' },
    { domain: 'a.com', status: 'maybe' },
    { domain: 'a.com', status: 'AVAILABLE' },
  ];
  for (const raw of bad) {
    assert.equal(parseAvailability(raw), null, `expected null for ${JSON.stringify(raw)}`);
  }
});

test('an available answer with an unreadable price is available with no price', () => {
  // Better than refusing the whole answer: the visitor still learns the name is
  // free. The page renders no number rather than a wrong one.
  const parsed = parseAvailability({
    domain: 'a.com',
    status: 'available',
    price: { unitAmount: 'lots', displayPrice: '25.00' },
  });
  assert.ok(parsed);
  assert.equal(parsed.status, 'available');
  assert.equal(parsed.price, null);
});

test('suggestions parse, and unpriced entries are dropped', () => {
  const parsed = parseSuggestions({
    domain: 'mybusiness.com',
    suggestions: [
      { domain: 'mybusiness.net', price: { tld: 'net', priceId: 'p1', unitAmount: 2500, currency: 'usd', displayPrice: '25.00' } },
      { domain: 'mybusiness.us' },
      { domain: '', price: { tld: 'com', priceId: 'p2', unitAmount: 2500, currency: 'usd', displayPrice: '25.00' } },
      'nonsense',
    ],
  });
  assert.ok(parsed, 'expected a list');
  assert.equal(parsed.length, 1, 'exactly one usable suggestion survived');
  assert.equal(parsed[0].domain, 'mybusiness.net');
  assert.equal(parsed[0].price.displayPrice, '25.00');
});

test('an empty suggestion list is an answer, and a broken body is not', () => {
  // These must never look the same on screen: one says "nothing close", the
  // other says "we could not ask".
  assert.deepEqual(parseSuggestions({ domain: 'a.com', suggestions: [] }), []);
  assert.equal(parseSuggestions({ domain: 'a.com' }), null);
  assert.equal(parseSuggestions({ domain: 'a.com', suggestions: 'none' }), null);
  assert.equal(parseSuggestions(null), null);
});

// ─── Failure copy ────────────────────────────────────────────────────────
//
// This is the branch that runs TODAY. Both search routes 503 because
// STRIPE_RESTRICTED_KEY is empty on the live function, so until that is fixed
// every search on this page ends in messageForFailure().

test('a failure never says anything about the address itself', () => {
  for (const status of [null, 500, 502, 503, 504]) {
    const message = messageForFailure(status);
    assert.ok(message.length > 0);
    for (const forbidden of ['taken', 'unavailable', 'available', 'free']) {
      assert.ok(
        !message.toLowerCase().includes(forbidden),
        `"${forbidden}" in a failure message would answer a question nobody asked: ${message}`,
      );
    }
  }
});

// ─── D14-16: the docblock that said the whole page was dead ─────────────
//
// `messageForFailure` stated as present-tense fact that both public endpoints
// had answered 503 to every request since Wave 4 and that its own branch was
// the only one that runs. `vivreal-domain-search` fixed that in 2d82702 and
// 57e35c2, both merged before that repo's origin/main, and the comment stayed.
// An engineer reading it would have concluded the feature was dead while it was
// working. Corrected, and pinned here so it cannot drift back unnoticed: a
// comment is the one kind of claim nothing else in a build ever checks.
//
// The needles below are the ORIGINAL sentences, not fragments of them. The
// correction quotes the old wording on purpose, in the past tense, so a
// fragment match would fail against the fix itself.

test('the failure docblock does not claim the public endpoints are dead', () => {
  const source = fs.readFileSync(
    path.join(import.meta.dirname, 'publicSearch.ts'),
    'utf8',
  );

  // Control: guard the read before trusting the absences. A mis-resolved path
  // returning an empty string would satisfy every assertion below.
  assert.ok(source.length > 5000, 'publicSearch.ts read back too short to be the real file');
  assert.ok(source.includes('export function messageForFailure'),
    'messageForFailure is not in the file this test read');

  for (const stale of [
    'TODAY THIS IS THE ONLY BRANCH THAT RUNS',
    'have answered 503 to every request',
    'every search on this page ends here',
  ]) {
    assert.ok(!source.includes(stale), `publicSearch.ts still asserts: "${stale}"`);
  }

  // And the correction is present rather than the claim merely deleted.
  assert.ok(source.includes('VERIFIED LIVE 2026-09-21'),
    'the docblock no longer records when the live behaviour was checked');
});

// The service answers these routes correctly (verified live 2026-09-21: 200
// with a real price object through the browser's own Origin, control 404 on a
// bogus path on the same host). This branch is the exception again rather than
// the only branch that runs, which is what messageForFailure's docblock used to
// claim. The copy still has to be right, because this is what a visitor sees on
// a bad day.
test('the 503 message says plainly that the name is not the problem', () => {
  assert.match(messageForFailure(503), /Nothing is wrong with the name you typed/);
});

test('rate limiting and bad input get their own message', () => {
  assert.match(messageForFailure(429), /Give it a minute/);
  assert.match(messageForFailure(400), /mybusiness\.com/);
  assert.notEqual(messageForFailure(429), messageForFailure(503));
});

// ─── The offer ───────────────────────────────────────────────────────────

test('the free-year sentence is the portal\'s, byte for byte', () => {
  // Source of truth: Vivreal_Portal_Mobile/src/lib/domains/freeYear.ts,
  // FREE_YEAR_OFFER, itself built from DOMAIN_BUNDLE in
  // @hillbombcreations/tier-quotas. Pinned as a literal here because a second
  // private GitHub Packages dependency is a known way to break the fleet build.
  // If this test fails, the portal changed the offer and this page is now
  // contradicting it.
  assert.equal(
    FREE_YEAR_OFFER,
    'Free for the first year on yearly Pro, on addresses up to $25. One per account.',
  );
  assert.equal(DOMAIN_SEARCH_COPY.freeYearOffer, FREE_YEAR_OFFER);
});

// ─── D14-20: the sentence and the recorded package values, in lockstep ───
//
// The assertion above is a round trip: it pins a literal against a literal and
// would stay green while the package it was copied from moved underneath it.
// These tie every clause of the sentence to a field in FREE_YEAR_SOURCE, so
// editing one alone is red. freeYearPackage.test.ts is the other half, and is
// the one that reads the real package.

test('the cap formatter turns package cents into the money string the sentence uses', () => {
  assert.equal(formatCapUsd(2500), '$25');
  assert.equal(formatCapUsd(4000), '$40');
  // Not $25.5. The fraction branch exists for this, not because a fractional
  // cap is expected.
  assert.equal(formatCapUsd(2550), '$25.50');
  assert.equal(formatCapUsd(0), '$0');
});

test('the price in the sentence is the recorded maxCatalogPriceCents, and the only price in it', () => {
  const cap = formatCapUsd(FREE_YEAR_SOURCE.maxCatalogPriceCents);
  assert.equal(cap, '$25', 'the recorded cap changed without this test being updated');
  assert.ok(FREE_YEAR_OFFER.includes(cap), `sentence does not quote ${cap}: ${FREE_YEAR_OFFER}`);

  // One money string, so nobody can add a second and have the check above
  // keep passing on the first.
  const amounts = FREE_YEAR_OFFER.match(/\$\d+(?:\.\d{2})?/g) ?? [];
  assert.deepEqual(amounts, [cap]);
});

test('the sentence names the eligible tier, the eligible period, and the per-group limit', () => {
  assert.deepEqual([...FREE_YEAR_SOURCE.eligibleTiers], ['pro']);
  assert.deepEqual([...FREE_YEAR_SOURCE.eligibleBillingPeriods], ['annual']);
  assert.equal(FREE_YEAR_SOURCE.perGroupLimit, 1);

  const lower = FREE_YEAR_OFFER.toLowerCase();
  for (const tier of FREE_YEAR_SOURCE.eligibleTiers) {
    assert.ok(lower.includes(tier), `sentence does not name the eligible tier "${tier}"`);
  }
  // 'annual' is the package's word; 'yearly' is the owner's. The rule is that
  // the sentence says one of them, never neither.
  assert.ok(lower.includes('yearly') || lower.includes('annual'),
    'sentence does not say the offer is on the yearly plan');
  assert.ok(lower.includes('one per account'),
    'sentence does not carry perGroupLimit: 1');
});

test('the sentence names no retired plan', () => {
  // Pro Plus folded into Pro in tier-quotas 4.0.0. Naming it would point a
  // stranger at a plan they cannot buy, and this is the exact string the
  // repo-wide copy audit found still alive elsewhere.
  const lower = FREE_YEAR_OFFER.toLowerCase();
  for (const retired of ['pro plus', 'proplus', 'pro+']) {
    assert.ok(!lower.includes(retired), `sentence names a retired plan: "${retired}"`);
  }
});

test('the recorded package reading names its version and date', () => {
  // Without these a reader cannot tell whether the values above are a week old
  // or a year old, and freeYearPackage.test.ts prints the version in its own
  // failure message so the two can be compared.
  assert.match(FREE_YEAR_SOURCE.packageVersion, /^\d+\.\d+\.\d+$/);
  assert.match(FREE_YEAR_SOURCE.readOn, /^\d{4}-\d{2}-\d{2}$/);
});

test('the page claims no per-result entitlement', () => {
  // A stranger has no tier, no subscription and no prior order, so the four
  // conditions cannot be evaluated. Every phrasing below would assert one.
  const all = Object.values(DOMAIN_SEARCH_COPY).join(' ').toLowerCase();
  for (const claim of [
    'your plan',
    'your first year is free',
    'this one is free',
    'you qualify',
    'covered',
  ]) {
    assert.ok(!all.includes(claim), `copy must not claim entitlement: "${claim}"`);
  }
});

// ─── Voice ───────────────────────────────────────────────────────────────
//
// Same shape as frozenGate.test.ts. This page is the first thing a stranger
// reads, so it gets the check the frozen page gets.

test('copy obeys brand/voice.md: zero em dashes and zero en dashes', () => {
  const values = Object.values(DOMAIN_SEARCH_COPY);
  assert.ok(values.length > 0, 'copy map is empty, so this test would pass vacuously');
  for (const value of values) {
    assert.equal(value.includes('—'), false, `em dash found in: ${value}`);
    assert.equal(value.includes('–'), false, `en dash found in: ${value}`);
  }
});

test('copy is owner-visible language, with none of the words the brand guide bans', () => {
  const all = Object.values(DOMAIN_SEARCH_COPY).join(' ').toLowerCase();
  assert.ok(all.length > 0, 'copy map is empty, so this test would pass vacuously');
  for (const jargon of [
    'pwa',
    'dns',
    'tld',
    'api',
    'registrar',
    'nameserver',
    'schema',
    'render',
    'endpoint',
    'domain registration',
  ]) {
    assert.ok(!all.includes(jargon), `jargon in customer copy: "${jargon}"`);
  }
});

test('the copy says address, which is the word the rename settled on', () => {
  assert.match(DOMAIN_SEARCH_COPY.heading, /web address/);
  assert.match(DOMAIN_SEARCH_COPY.inputLabel, /address/);
  assert.match(DOMAIN_SEARCH_COPY.choose, /address/);
});


// ─── The guide (what a search engine reads) ──────────────────────────────

test('the guide is not empty, so every guide test below is reading something', () => {
  const strings = domainGuideStrings();
  assert.ok(strings.length >= 20, `expected the guide to carry real content, got ${strings.length} strings`);
  assert.ok(DOMAIN_GUIDE.faq.length >= 5, 'the FAQ is the part people search for');
  assert.equal(DOMAIN_GUIDE.ways.length, 3, 'the portal offers exactly three ways');
});

test('guide copy obeys brand/voice.md: zero em dashes and zero en dashes', () => {
  for (const value of domainGuideStrings()) {
    assert.equal(value.includes('—'), false, `em dash found in: ${value}`);
    assert.equal(value.includes('–'), false, `en dash found in: ${value}`);
  }
});

test('guide copy carries none of the words the brand guide bans', () => {
  const all = domainGuideStrings().join(' ').toLowerCase();
  for (const jargon of ['pwa', 'dns', 'tld', 'api', 'registrar', 'nameserver', 'schema', 'render', 'endpoint', 'domain registration']) {
    assert.ok(!all.includes(jargon), `jargon in customer copy: "${jargon}"`);
  }
});

test('the guide names the three ways exactly as the portal labels them', () => {
  // Vivreal_Portal_Mobile/src/components/Domains/AddDomain/index.tsx
  assert.deepEqual(
    DOMAIN_GUIDE.ways.map((w) => w.label),
    ['Buy a new address', 'Use one you already own', 'Move one over to us'],
  );
});

test('the free year appears in the guide only as the canonical sentence', () => {
  const freeAnswer = DOMAIN_GUIDE.faq.find((f) => /free/i.test(f.question));
  assert.ok(freeAnswer, 'the "is it free" question is what people search for');
  assert.ok(freeAnswer.answer.startsWith(FREE_YEAR_OFFER), 'the offer must be stated whole, first');
  const all = domainGuideStrings().join(' ').toLowerCase();
  for (const claim of ['free domain', 'annual', 'your plan', 'you qualify', 'covered', 'pro alone']) {
    assert.ok(!all.includes(claim), `guide must not paraphrase or narrow the offer: "${claim}"`);
  }
});

test('nothing on the page promises to hold or reserve the address', () => {
  // domain_claim only remembers the name across signup; nothing reserves it.
  const all = [...Object.values(DOMAIN_SEARCH_COPY), ...domainGuideStrings()].join(' ').toLowerCase();
  for (const promise of ['hold it', 'we hold', 'holding', 'reserve', 'reserved']) {
    assert.ok(!all.includes(promise), `copy promises a reservation that does not exist: "${promise}"`);
  }
});

test('the search result title carries both phrasings people search for', () => {
  assert.match(DOMAIN_SEARCH_COPY.metaTitle, /web address/i);
  assert.match(DOMAIN_SEARCH_COPY.metaTitle, /domain name/i);
  assert.ok(DOMAIN_SEARCH_COPY.metaTitle.length <= 65, 'titles past ~65 characters get cut in results');
  assert.ok(DOMAIN_SEARCH_COPY.metaDescription.length <= 160, 'descriptions past ~160 characters get cut');
});

test('the FAQ structured data says exactly what the page shows, and nothing else', () => {
  const schema = domainFaqSchema() as { '@type': string; mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> };
  assert.equal(schema['@type'], 'FAQPage');
  assert.equal(schema.mainEntity.length, DOMAIN_GUIDE.faq.length);
  schema.mainEntity.forEach((entry, i) => {
    assert.equal(entry.name, DOMAIN_GUIDE.faq[i].question);
    assert.equal(entry.acceptedAnswer.text, DOMAIN_GUIDE.faq[i].answer);
  });
});

// ─── The sitemap entry ───────────────────────────────────────────────────

const build = (url: string) => ({ url, changeFrequency: 'monthly' as const, priority: 0.8 });

test('the sitemap gains /domains on the marketing site, on the sitemap own origin', () => {
  const map = [{ url: 'https://vivreal.io' }, { url: 'https://vivreal.io/pricing' }];
  const out = withDomainsSitemapEntry(map, VIVREAL_MARKETING_SITE_ID, build);
  assert.equal(out.length, 3);
  assert.equal(out[2].url, 'https://vivreal.io/domains');
});

test('no other site in the fleet ever gains the entry', () => {
  const map = [{ url: 'https://wavesofgrain.com' }];
  for (const other of ['68adda65762dfc328d91382d', '', undefined, null]) {
    assert.deepEqual(withDomainsSitemapEntry(map, other as string | null | undefined, build), map);
  }
});

test('an empty sitemap stays empty, and an unreadable origin changes nothing', () => {
  assert.deepEqual(withDomainsSitemapEntry([], VIVREAL_MARKETING_SITE_ID, build), []);
  const bad = [{ url: 'not a url' }];
  assert.deepEqual(withDomainsSitemapEntry(bad, VIVREAL_MARKETING_SITE_ID, build), bad);
});

test('the entry is never added twice', () => {
  const map = [{ url: 'https://vivreal.io' }, { url: 'https://vivreal.io/domains' }];
  assert.equal(withDomainsSitemapEntry(map, VIVREAL_MARKETING_SITE_ID, build).length, 2);
});

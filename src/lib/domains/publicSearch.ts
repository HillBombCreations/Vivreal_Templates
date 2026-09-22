/**
 * The public domain search on vivreal.io: everything about it that is not React.
 *
 * ── WHY ALL OF IT IS HERE AND NOT IN THE COMPONENT ───────────────────────
 *
 * Same rule `SiteConsent` states for itself: the component is a rendering
 * shell, and every decision lives in a module that imports neither React nor
 * `next/server`, so `node --test` can execute it. Templates' test runner is
 * `node --experimental-strip-types --test`, which cannot load either one. Logic
 * that accumulates in the component is logic this repo cannot test at all.
 *
 * ── WHAT THIS PAGE IS FOR ────────────────────────────────────────────────
 *
 * A stranger who wants a web address has had no way to start. `vivreal.io`
 * never mentioned buying one, `/domains` was a 404, and the working search sat
 * behind a login. Everything DOWNSTREAM of this page already exists and works:
 * `/app/register?domain=` writes a `domain_claim` cookie, signing in spends it,
 * and the hub opens with the address prefilled and the search already run. This
 * page is the missing front door, and its whole job is to hand that machinery a
 * name.
 *
 * ── THE CALL GOES STRAIGHT FROM THE BROWSER, AND MUST ────────────────────
 *
 * `domains-api.vivreal.io` limits per IP, reads the address from
 * `X-Forwarded-For`, and FAILS CLOSED. Its origin request policy forwards no
 * viewer headers, so a same-origin proxy in this repo could not pass the real
 * visitor address through even if it wanted to: the limiter would see one
 * Amplify egress address for the entire internet and start refusing everybody
 * at 30 requests a minute. A proxy would also bypass that service's own
 * CloudFront cache, which is the reason it has a distribution of its own. So
 * the fetch is cross-origin, and `vivreal-domain-search`'s CORS policy is what
 * makes it readable.
 *
 * THE FETCH MUST STAY A SIMPLE REQUEST. That distribution allows GET and HEAD
 * and answers OPTIONS with a 403 of its own, verified live 2026-09-08. Add a
 * custom header, a `Content-Type`, or credentials and the browser preflights,
 * the preflight dies at the edge, and the failure surfaces as a CORS error that
 * names nothing. `buildSearchRequest` exists so there is one place that can go
 * wrong and one test that pins it.
 */

/**
 * The site this page is allowed to render on.
 *
 * Vivreal_Templates is the FLEET app: one codebase renders vivreal.io and every
 * customer site, and it ships fleet-wide on a single `promote-stable`. A page
 * file under `src/app/` is a STATIC route, and Next matches static routes ahead
 * of `[slug]`, so `/domains` would otherwise exist on every customer site in
 * the fleet, selling Vivreal addresses from a bakery's own domain. That is the
 * same failure class `lib/vivrealApex.ts` was written to prevent, one layer up.
 *
 * `SITE_ID` rather than the hostname, because the hostname is only knowable in
 * the browser: `onVivrealApex()` says so in its own docblock, and reading the
 * request host on the server would opt the route out of static rendering. This
 * value is injected per Amplify app at deploy time, so the gate is decided
 * before a request exists and costs the render nothing.
 *
 * Verified 2026-09-08 against the live Amplify app `d1gukor54gwnrj` ("vivreal",
 * the app CloudFront E39DUKXYGXCX8Q sends vivreal.io to) and against the site
 * document of the same id in `general_shared.sites`, key `vivreal`.
 *
 * Overridable by env so a re-created site is a config change rather than a
 * fleet deploy. Same shape as `NEXT_PUBLIC_CLIENT_API`: a real default, and the
 * variable is for the exception.
 */
export const VIVREAL_MARKETING_SITE_ID = '6a8d1146a4e1b46a9083e668';

/** Public host of the domain service. Its own CloudFront distribution. */
export const DEFAULT_DOMAIN_SEARCH_API = 'https://domains-api.vivreal.io';

/**
 * Whether THIS deployment is the Vivreal marketing site.
 *
 * Fails closed on anything it does not recognise, which for a fleet app means
 * an unset or unexpected `SITE_ID` renders no page rather than the wrong one.
 */
export function servesPublicDomainSearch(
  siteId?: string | null,
  expected: string = process.env.VIVREAL_MARKETING_SITE_ID || VIVREAL_MARKETING_SITE_ID,
): boolean {
  if (typeof siteId !== 'string') return false;
  const trimmed = siteId.trim();
  if (!trimmed) return false;
  return trimmed === expected;
}

/** Base URL of the domain service, env-overridable with a live default. */
export function domainSearchApiBase(
  raw: string | undefined = process.env.NEXT_PUBLIC_DOMAINS_API,
): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  // A trailing slash would produce `//public/availability`, which the service's
  // route table does not normalise (it strips ONE trailing slash from the path,
  // not a doubled leading one) and which would 404.
  return (value || DEFAULT_DOMAIN_SEARCH_API).replace(/\/+$/, '');
}

export type QueryValidity = { ok: true; hint: null } | { ok: false; hint: string | null };

/**
 * Is what the visitor has typed worth spending a request on.
 *
 * Ported deliberately unchanged in BEHAVIOUR from the portal's
 * `evaluateQuery` (`Vivreal_Portal_Mobile/src/components/Domains/AddDomain/
 * BuyDomain.tsx`), so a name accepted here is a name the hub accepts after
 * signup. A stranger who gets "yes" on this page and then a validation error
 * two screens later has been lied to by us, not by the registrar.
 *
 * The hints are the portal's, word for word, for the same reason.
 */
export function evaluateQuery(raw: string): QueryValidity {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return { ok: false, hint: null };
  if (!trimmed.includes('.')) {
    return { ok: false, hint: 'Add an ending like .com, for example mybusiness.com' };
  }
  const [name, ...rest] = trimmed.split('.');
  const tld = rest[rest.length - 1] ?? '';
  if (name.length === 0) {
    return { ok: false, hint: 'Put a name before the ending, for example mybusiness.com' };
  }
  if (tld.length < 2) {
    return { ok: false, hint: 'The ending needs at least two letters, like .com' };
  }
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(trimmed)) {
    return { ok: false, hint: 'Use letters, numbers and dashes only' };
  }
  return { ok: true, hint: null };
}

export function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * The two request URLs, and the init that keeps them simple requests.
 *
 * `init` is deliberately almost empty. Every field a caller might reach for
 * here (`headers`, `credentials`, `mode: 'cors'` with a `Content-Type`) turns
 * the call into a preflighted one, and the preflight gets a 403 from the edge
 * before the CORS policy is ever consulted. See the file header.
 */
export const SIMPLE_GET_INIT: RequestInit = Object.freeze({ method: 'GET' });

export function availabilityUrl(domain: string, base: string = domainSearchApiBase()): string {
  return `${base}/public/availability?domain=${encodeURIComponent(domain)}`;
}

export function suggestionsUrl(domain: string, base: string = domainSearchApiBase()): string {
  return `${base}/public/suggestions?domain=${encodeURIComponent(domain)}`;
}

/**
 * Where a chosen address goes.
 *
 * RELATIVE, and that is the whole contract with the portal. CloudFront
 * distribution E39DUKXYGXCX8Q routes `/app` and `/app/*` on this same host to
 * the portal's Amplify app, so a relative link crosses repos without crossing
 * origins. An absolute URL built here would also force a redirect between the
 * apex and www for half of visitors and drop the address on the way.
 *
 * The portal's register page reads `?domain=` on mount and writes the
 * `domain_claim` cookie itself. THE LINK IS THE ENTIRE HANDOFF: this page never
 * writes that cookie, because the cookie is host-only and the portal is the
 * side that owns clearing it after it is spent.
 */
export function registerHref(domain: string): string {
  return `/app/register?domain=${encodeURIComponent(domain)}`;
}

export type AvailabilityStatus = 'available' | 'taken' | 'unsupported' | 'unknown';

export interface DomainPrice {
  tld: string;
  priceId: string;
  unitAmount: number;
  currency: string;
  displayPrice: string;
}

export interface AvailabilityAnswer {
  domain: string;
  status: AvailabilityStatus;
  price: DomainPrice | null;
}

export interface Suggestion {
  domain: string;
  price: DomainPrice;
}

const STATUSES: ReadonlySet<string> = new Set([
  'available',
  'taken',
  'unsupported',
  'unknown',
]);

function parsePrice(raw: unknown): DomainPrice | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.displayPrice !== 'string') return null;
  if (typeof p.unitAmount !== 'number' || !Number.isFinite(p.unitAmount)) return null;
  return {
    tld: typeof p.tld === 'string' ? p.tld : '',
    priceId: typeof p.priceId === 'string' ? p.priceId : '',
    unitAmount: p.unitAmount,
    currency: typeof p.currency === 'string' ? p.currency : 'usd',
    displayPrice: p.displayPrice,
  };
}

/**
 * Read an availability answer, or refuse it.
 *
 * Returns null rather than guessing. A malformed body is the one case where
 * inventing a status would put a wrong word next to a price on the page a
 * stranger reads first, and "we could not tell" is always available as an
 * answer. Note the service's own rule, which this preserves: `price` is
 * non-null only for `available`, so nothing downstream can render a price
 * beside an address it cannot sell.
 */
export function parseAvailability(raw: unknown): AvailabilityAnswer | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (typeof body.domain !== 'string' || !body.domain) return null;
  if (typeof body.status !== 'string' || !STATUSES.has(body.status)) return null;
  const status = body.status as AvailabilityStatus;
  const price = status === 'available' ? parsePrice(body.price) : null;
  return { domain: body.domain, status, price };
}

/**
 * Read the alternatives list.
 *
 * An empty array is a real answer (the service says so: a heavily-taken name
 * with nothing close in the thirteen sellable endings genuinely has nothing to
 * offer), so an empty list and a failure must not look the same. Failure is
 * null; nothing to offer is `[]`. Any entry missing a price is dropped, because
 * an alternative without one is an offer we cannot honour.
 */
export function parseSuggestions(raw: unknown): Suggestion[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.suggestions)) return null;
  const out: Suggestion[] = [];
  for (const entry of body.suggestions) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.domain !== 'string' || !row.domain) continue;
    const price = parsePrice(row.price);
    if (!price) continue;
    out.push({ domain: row.domain, price });
  }
  return out;
}

/**
 * What to say when the service does not give an answer.
 *
 * THIS IS THE EXCEPTION BRANCH, which is what it was always for.
 *
 * It used to say the opposite, in the present tense: that both public
 * endpoints had answered 503 to every request since Wave 4 because
 * `STRIPE_RESTRICTED_KEY` was the empty string on the live function, and that
 * this was THE ONLY BRANCH THAT RUNS. That was true when it was written.
 * `vivreal-domain-search` fixed it in `2d82702` ("carry the Stripe key into
 * the stack, and refuse the deploy without it") and `57e35c2`, both merged
 * before that repo's `origin/main`, and the docblock stayed behind. An
 * engineer reading it would have concluded the whole page was dead.
 *
 * VERIFIED LIVE 2026-09-21, with the browser's own `Origin` header:
 * `/public/availability` returns 200 with a real price object and
 * `/public/suggestions` returns 200 with priced alternatives. Controls, so a
 * 200 is not just a host that answers 200 to anything: a bogus path on the
 * same host returns 404, `Access-Control-Allow-Origin` comes back as
 * `https://vivreal.io` for that origin, and is absent for an unrelated one.
 *
 * The wording still matters more than it looks, because this branch is what a
 * visitor sees on a bad day. "Not answering right now" is true and says
 * nothing about the address. Anything that reads as an answer, "unavailable"
 * most of all, would tell a stranger their name is taken when nobody has
 * checked.
 */
export function messageForFailure(status: number | null): string {
  if (status === 429) {
    return 'That is a lot of searches at once. Give it a minute and try again.';
  }
  if (status === 400) {
    return 'That does not look like a web address. Try something like mybusiness.com';
  }
  return 'We cannot check addresses right now. Nothing is wrong with the name you typed. Try again in a few minutes.';
}

/**
 * The package values the offer sentence below is made of.
 *
 * ── D14-20: THE SENTENCE USED TO BE PINNED TO NOTHING ────────────────────
 *
 * `FREE_YEAR_OFFER` is a hand-copied duplicate of a value that lives in
 * `DOMAIN_BUNDLE` in `@hillbombcreations/tier-quotas`. The portal DERIVES its
 * copy from the package (`Vivreal_Portal_Mobile/src/lib/domains/freeYear.ts`
 * imports `DOMAIN_BUNDLE` and builds `FREE_YEAR_CAP` from
 * `maxCatalogPriceCents`). This page could not, and still cannot: a second
 * private GitHub Packages dependency in the fleet app's `npm ci` is a known
 * way to brick every customer site's build, and this page needs one sentence,
 * not a package. That reason is still good.
 *
 * What was NOT good is that nothing failed when the package moved. If the cap
 * changed, vivreal.io would go on quoting the old number to strangers while
 * the portal quoted the new one, silently and indefinitely.
 *
 * So the four fields the sentence is made of are recorded HERE, as data, with
 * the version and date they were read from the real package:
 *
 *   - `eligibleTiers`           -> which plan the sentence may name
 *   - `eligibleBillingPeriods`  -> the word "yearly"
 *   - `maxCatalogPriceCents`    -> the "$25"
 *   - `perGroupLimit`           -> "One per account."
 *
 * Two things check them, and neither can pass by doing nothing:
 *
 *   1. `publicSearch.test.ts` asserts the SENTENCE and these VALUES agree, so
 *      editing either one alone is red. Hermetic, no network.
 *   2. `freeYearPackage.test.ts` reads the REAL package from the registry into
 *      a throwaway directory, touching neither `package.json` nor
 *      `package-lock.json`, and asserts it still says this. That is the one
 *      that catches the package moving, and a network read is unavoidable for
 *      that: Templates does not depend on the package, so the registry is the
 *      only thing that knows.
 *
 * IF EITHER GOES RED, read the package and change the sentence, this block and
 * the portal's copy together. Do not change only the number.
 */
export interface FreeYearSource {
  /** `@hillbombcreations/tier-quotas` version these values were read from. */
  readonly packageVersion: string;
  /** ISO date of that reading. */
  readonly readOn: string;
  readonly eligibleTiers: readonly string[];
  readonly eligibleBillingPeriods: readonly string[];
  readonly maxCatalogPriceCents: number;
  readonly perGroupLimit: number;
}

export const FREE_YEAR_SOURCE: FreeYearSource = Object.freeze({
  packageVersion: '5.2.0',
  readOn: '2026-09-21',
  eligibleTiers: Object.freeze(['pro']),
  eligibleBillingPeriods: Object.freeze(['annual']),
  maxCatalogPriceCents: 2500,
  perGroupLimit: 1,
});

/**
 * Cents to the money string the sentence uses.
 *
 * Whole dollars when the cap is whole, which it has always been. The fraction
 * branch exists so a cap of 2550 renders as `$25.50` rather than `$25.5`, not
 * because anyone expects one.
 */
export function formatCapUsd(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/**
 * The offer, quoted rather than computed.
 *
 * A PLAIN STRING LITERAL, DELIBERATELY, and not a template literal built from
 * `FREE_YEAR_SOURCE`. `eslint-rules/owner-visible-copy.mjs` visits `Literal`
 * and `JSXText` nodes and nothing else, so composing this sentence would take
 * it out of the dash and jargon checks entirely. The tests above are what keep
 * it in step with `FREE_YEAR_SOURCE`; the literal is what keeps it linted.
 *
 * BYTE-FOR-BYTE THE PORTAL'S `FREE_YEAR_OFFER`
 * (`Vivreal_Portal_Mobile/src/lib/domains/freeYear.ts`), which derives the same
 * sentence from `DOMAIN_BUNDLE`.
 *
 * NO PER-RESULT ELIGIBILITY IS SHOWN HERE, AND THAT IS THE POINT. Whether a
 * given customer's first year is free depends on their tier, their Stripe
 * subscription being annual, the catalogue price, and whether they have used
 * the offer before. A stranger has none of those. The hub answers it per
 * result once they do. Saying the sentence and stopping is the only thing this
 * page can say that cannot turn out to be wrong.
 *
 * IT NAMES ONE PLAN SINCE tier-quotas 4.0.0, and that is not an omission.
 * Pro Plus folded into Pro, `DOMAIN_BUNDLE.eligibleTiers` reads `['pro']`, and
 * `normalizeTier` resolves a stored `proPlus` onto `pro`, so a group that was
 * on it keeps the offer. Naming Pro Plus here would point a stranger at a plan
 * they cannot buy.
 */
export const FREE_YEAR_HEADING = 'The first year can be free';
export const FREE_YEAR_OFFER =
  'Free for the first year on yearly Pro, on addresses up to $25. One per account.';

/** Every visible string on the page, in one place, so one test can read them all. */
export const DOMAIN_SEARCH_COPY = Object.freeze({
  title: 'Get a web address',
  // What a search result shows. Carries both phrasings people actually type
  // ("web address", "domain name") because the page exists to be found by
  // someone who has not heard of Vivreal yet. The heading below stays in the
  // owner's word.
  metaTitle: 'Get a Web Address (Domain Name) for Your Business | Vivreal',
  metaDescription:
    'Search for the web address you want and see what it costs each year. Buy a new domain name, use one you already own, or move one over to Vivreal.',
  heading: 'Get the web address for your business',
  intro:
    'Type the name you want and we will tell you whether it is free and what it costs. You do not need an account to look.',
  inputLabel: 'What address do you want?',
  placeholder: 'mybusiness.com',
  submit: 'Check',
  checking: 'Checking',
  availableSuffix: 'is free to take.',
  takenSuffix: 'is already taken.',
  unknownSuffix: 'could not be checked just now. Try it again in a moment.',
  unsupportedPrefix: 'We do not sell addresses ending in',
  unsupportedSuffix: 'Try a different ending, like .com',
  perYear: 'a year',
  choose: 'Get this address',
  alternativesHeading: 'Or one of these',
  noAlternatives: 'We could not find a close one we can sell. Try another name.',
  freeYearHeading: FREE_YEAR_HEADING,
  freeYearOffer: FREE_YEAR_OFFER,
  // NOT "we hold it for you". Nothing reserves the address with anyone: the
  // portal's `domain_claim` cookie only remembers the NAME across signup
  // (`Vivreal_Portal_Mobile/src/lib/domains/claimIntent.ts`), so someone else
  // can still buy it in the meantime. Promising a hold is the kind of claim a
  // stranger acts on and then finds was never true.
  nextStepNote:
    'Choosing an address takes you to sign up, and the name comes with you, so it is waiting in your search once your account is ready.',
} as const);

/**
 * The guide under the search box: what a web address is, the three ways to get
 * one, what it costs, and the questions people type into a search engine.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 *
 * The page's job is to be FOUND by someone searching "how do I get a web
 * address for my business" or "custom domain for my website", and a heading,
 * one sentence and a search box give a search engine nothing to rank. The
 * domains plan (task 4.3) asked for this shape: a one-paragraph direct answer,
 * then a comparison, then detail.
 *
 * ── EVERY CLAIM IS THE PORTAL'S ──────────────────────────────────────────
 *
 * Checked on 2026-09-16 against Vivreal_Portal_Mobile `stable` (v0.21.1):
 * - the three ways and their one-line summaries: `Domains/AddDomain/index.tsx`
 * - "a few minutes to a day", and a site must be published first:
 *   `AddDomain/ConnectOwnDomain.tsx`
 * - 5 to 10 days, site and email keep working, confirm within 5 days, adds a
 *   year, billed once a year: `AddDomain/TransferDomain.tsx`
 * - every site starts on a free `<name>.vivreal.io` address: help.vivreal.io,
 *   Creating a site
 * - the free year: FREE_YEAR_OFFER, byte for byte, never paraphrased
 *
 * If the portal changes any of these, this copy is now wrong. No time is given
 * for buying, because the portal gives none.
 */
export const DOMAIN_GUIDE = Object.freeze({
  answerHeading: 'What a web address is',
  answer:
    'A web address, also called a domain name or a custom domain, is the name people type to find your business online, like yourbusiness.com. It is yours for as long as you renew it, once a year. In Vivreal you can buy a new one, use one you already own, or move one over to us, and it opens your Vivreal site.',
  waysHeading: 'Three ways to get your address',
  waysColumns: Object.freeze(['', 'Good for', 'What happens', 'Who bills you'] as const),
  ways: Object.freeze([
    Object.freeze({
      label: 'Buy a new address',
      goodFor: 'A new business, or a name you do not own yet',
      what: 'Search for the name you want and buy it in Vivreal. We set it up for you, so there is nothing to copy or change.',
      billing: 'Vivreal, once a year',
    }),
    Object.freeze({
      label: 'Use one you already own',
      goodFor: 'An address you bought somewhere else and want to keep there',
      what: 'Keep it where you bought it. Vivreal shows you a few lines to copy there, and it starts opening your site within a few minutes to a day. Your site needs to be published first.',
      billing: 'Wherever you bought it',
    }),
    Object.freeze({
      label: 'Move one over to us',
      goodFor: 'An address you own and want to manage and pay for in one place',
      what: 'Bring the address and its yearly bill to Vivreal. Your site and your email keep working the whole time. It usually takes 5 to 10 days, and moving adds a year to how long you own it.',
      billing: 'Vivreal, once a year',
    }),
  ]),
  costHeading: 'What it costs',
  cost: 'The yearly price depends on the ending you choose, so one ending can cost more than another. Search for the address you want above and the price shows next to it.',
  faqHeading: 'Questions people ask',
  faq: Object.freeze([
    Object.freeze({
      question: 'How do I get a web address for my business?',
      answer:
        'Search for the name you want on this page. If it is free, choose it, make your Vivreal account, and finish buying it in Addresses. We set it up for you, so there is nothing technical to do.',
    }),
    Object.freeze({
      question: 'Can I use a domain name I already own?',
      answer:
        'Yes. Keep it where you bought it and connect it from Addresses in Vivreal. We show you a few lines to copy into the place you bought it, and it can take from a few minutes to a day to start working. Your site needs to be published first.',
    }),
    Object.freeze({
      question: 'Can I move my domain name to Vivreal?',
      answer:
        'Yes. Moving brings the address and its yearly bill to Vivreal, so you look after everything in one place. It usually takes 5 to 10 days, and your site and your email keep working the whole time. We email you a link to confirm the move, and you have 5 days to open it. Moving adds a year to how long you own the address.',
    }),
    Object.freeze({
      question: 'Is the web address free?',
      answer: `${FREE_YEAR_OFFER} Otherwise you pay the yearly price shown next to each address.`,
    }),
    Object.freeze({
      question: 'What is the difference between a website and a web address?',
      answer:
        'Your website is the pages people see. Your web address is the name that takes them there. Every Vivreal site starts with a free address made from its name, like yourbusiness.vivreal.io, and you can add your own custom domain whenever you are ready.',
    }),
    Object.freeze({
      question: 'Do I need to know anything technical?',
      answer:
        'No. When you buy an address in Vivreal, we set everything up for you. If you connect one you already own, Vivreal shows you exactly what to copy and tells you when it is live.',
    }),
  ]),
  pricingLinkLabel: 'See plans and prices',
} as const);

/** Every visible string in DOMAIN_GUIDE, flattened, so one test can read them all. */
export function domainGuideStrings(guide: typeof DOMAIN_GUIDE = DOMAIN_GUIDE): string[] {
  const out: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === 'string') {
      if (value) out.push(value);
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  };
  walk(guide);
  return out;
}

/**
 * The FAQPage structured data for the guide's questions.
 *
 * Built from the SAME array the page prints, so the markup can never claim a
 * question or answer a visitor cannot see, which is Google's rule for FAQ rich
 * results and the only honest way to do it.
 */
export function domainFaqSchema(
  faq: ReadonlyArray<{ question: string; answer: string }> = DOMAIN_GUIDE.faq,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

/**
 * Add `/domains` to the sitemap on the one deployment that serves it.
 *
 * The sitemap is built from CMS pages, and this page is a route rather than a
 * CMS page, so without this it is invisible to the crawler that is the page's
 * whole audience. The origin is read from the sitemap's own first entry, so the
 * URL can never disagree with the canonical the rest of the sitemap already
 * resolved. Same fleet gate as the page: no other site ever gains the entry.
 * An empty sitemap stays empty (a demo, or a refused degraded read).
 */
export function withDomainsSitemapEntry<T extends { url: string }>(
  siteMap: T[],
  siteId: string | null | undefined,
  build: (url: string) => T,
): T[] {
  if (!servesPublicDomainSearch(siteId) || siteMap.length === 0) return siteMap;
  let origin: string;
  try {
    origin = new URL(siteMap[0].url).origin;
  } catch {
    return siteMap;
  }
  const url = `${origin}/domains`;
  if (siteMap.some((entry) => entry.url === url)) return siteMap;
  return [...siteMap, build(url)];
}

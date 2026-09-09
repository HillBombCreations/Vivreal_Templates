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
 * TODAY THIS IS THE ONLY BRANCH THAT RUNS. `/public/availability` and
 * `/public/suggestions` have answered 503 to every request since Wave 4,
 * because `STRIPE_RESTRICTED_KEY` is the empty string on the live function, so
 * the price catalogue cannot be built. Until the key is created and the stack
 * redeployed, every search on this page ends here.
 *
 * That is why the wording matters more than it looks. "Not answering right now"
 * is true and says nothing about the address. Anything that reads as an answer,
 * "unavailable" most of all, would tell a stranger their name is taken when
 * nobody has checked.
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
 * The offer, quoted rather than computed.
 *
 * BYTE-FOR-BYTE THE PORTAL'S `FREE_YEAR_OFFER`
 * (`Vivreal_Portal_Mobile/src/lib/domains/freeYear.ts`), which is itself
 * generated from `DOMAIN_BUNDLE` in `@hillbombcreations/tier-quotas`. Copied as
 * a literal instead of imported on purpose: pulling a second private
 * GitHub Packages dependency into Templates is a known way to break the fleet's
 * `npm ci`, and this page needs one sentence, not a package.
 *
 * NO PER-RESULT ELIGIBILITY IS SHOWN HERE, AND THAT IS THE POINT. Whether a
 * given customer's first year is free depends on their tier, their Stripe
 * subscription being annual, the catalogue price, and whether they have used
 * the offer before. A stranger has none of those. The hub answers it per
 * result once they do. Saying the sentence and stopping is the only thing this
 * page can say that cannot turn out to be wrong.
 */
export const FREE_YEAR_HEADING = 'The first year can be free';
export const FREE_YEAR_OFFER =
  'Free for the first year on yearly Pro or Pro Plus, on addresses up to $25. One per account.';

/** Every visible string on the page, in one place, so one test can read them all. */
export const DOMAIN_SEARCH_COPY = Object.freeze({
  title: 'Get a web address',
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
  nextStepNote:
    'Choosing an address takes you to sign up. We hold it for you while you make your account.',
} as const);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Explicit .ts extensions: runs under `node --experimental-strip-types --test`
// (see package.json "test"), which has no tsconfig `paths` resolution.
import { readOrDegrade } from '../api/degradedRead.ts';
import { decideDetailItemMiss, type DetailItemRead } from './itemMiss.ts';

/**
 * A DEGRADED READ MUST NOT 404 A REAL DETAIL ITEM.
 *
 * The sibling of `../api/composition/degradedCollectionRead.test.ts`, on the
 * route that was left out of that change, and worse in the way that counts.
 *
 * Every read behind `app/[slug]/[itemId]/page.tsx` resolves to an empty list
 * when VR_Client_API wobbles, because the fetch helpers swallow the error and
 * return the caller's fallback. Every arm of that route then asks "is the item
 * in this list?", misses, and answers `redirectOrNotFound()`.
 *
 * The generic-page version of this defect could only swap the body under an
 * already-flushed 200: its guard runs inside a page-authored Suspense boundary.
 * This route has no boundary at all (there is no `loading.tsx` anywhere in
 * `src/app`, and `DynamicItemPage` awaits every read before returning JSX),
 * which cuts both ways:
 *
 *   - the 404 was REAL. A crawler was told a live, published item is gone,
 *     which is the strongest removal signal this app can emit;
 *   - and the refusal can therefore set a real 5xx, which is "come back later".
 *     That is the outcome the generic-page fix wanted and structurally could
 *     not have. It is the same property `assertUpstreamHealthy()` already
 *     relies on at the top of that component.
 *
 * Both directions are pinned. The 404 exists for real reasons (a mistyped id, a
 * genuinely deleted item, the doorway-page guard), and weakening it would trade
 * this bug for indexable junk URLs.
 */

const COLLECTION_READ: DetailItemRead = { source: 'collection', degraded: false };
const FAILED_READ: DetailItemRead = { source: 'collection', degraded: true };

// ---------------------------------------------------------------------------
// The two directions the fix is FOR
// ---------------------------------------------------------------------------

test('a DEGRADED read on a real item does not answer "missing"', () => {
  // The defect, stated as a test. The item exists in the collection; the
  // collection could not be read; the route used to call this a 404.
  const verdict = decideDetailItemMiss({ found: undefined, reads: [FAILED_READ] });
  assert.deepEqual(verdict, { isMissing: false, existenceUnknown: true });
});

test('a GENUINELY MISSING item still answers "missing"', () => {
  // The other direction, and the one that is easy to break while fixing the
  // first. A mistyped or deleted id on a healthy read must still 404, or every
  // junk URL under every detail page becomes an indexable 200.
  const verdict = decideDetailItemMiss({ found: undefined, reads: [COLLECTION_READ] });
  assert.deepEqual(verdict, { isMissing: true, existenceUnknown: false });
});

test('an item that WAS found is neither missing nor unknown', () => {
  const verdict = decideDetailItemMiss({
    found: { id: 'abc', title: 'Sourdough Loaf' },
    reads: [COLLECTION_READ],
  });
  assert.deepEqual(verdict, { isMissing: false, existenceUnknown: false });
});

// ---------------------------------------------------------------------------
// The ordering trap the generic-page fix shipped in its first cut
// ---------------------------------------------------------------------------

test('PARTIAL DEGRADE: an item in hand is served, whatever another read did', () => {
  // The failure mode that must not be repeated here, and the reason the flags
  // are consulted only AFTER the item.
  //
  // This route resolves an item across more than one pool by design. A menu
  // page reads its items binding and then walks every sibling binding until one
  // hits; a page carrying a storefront reads the products list first and falls
  // through to its collection arm on a miss. So "one read failed AND the item
  // is in hand" is an ordinary state, not an edge case, and it gets MORE likely
  // the more bindings a page carries.
  //
  // Refusing on the flag first would turn a partial wobble into a hard error on
  // a page that demonstrably exists.
  const combos: DetailItemRead[][] = [
    [{ source: 'menu-items', degraded: true }, { source: 'menu-sibling', degraded: false }],
    [{ source: 'products', degraded: true }, { source: 'collection', degraded: false }],
    [{ source: 'products', degraded: true }, { source: 'menu-items', degraded: true }],
  ];
  for (const reads of combos) {
    assert.deepEqual(
      decideDetailItemMiss({ found: { id: 'abc' }, reads }),
      { isMissing: false, existenceUnknown: false },
      `an item in hand must render, whatever ${JSON.stringify(reads)} did`,
    );
  }
});

test('one failed read poisons the verdict even when a sibling answered empty', () => {
  // Nothing matched anywhere, one pool answered and one did not. The item may
  // or may not exist and there is no way to find out, so the only honest answer
  // is to refuse.
  const verdict = decideDetailItemMiss({
    found: undefined,
    reads: [
      { source: 'menu-items', degraded: false },
      { source: 'menu-sibling', degraded: true },
    ],
  });
  assert.deepEqual(verdict, { isMissing: false, existenceUnknown: true });
});

test('a products read that failed still counts on the arm it falls through to', () => {
  // A non-`products` page carrying a storefront binding reads the product list
  // first and, on a miss, falls through to its collection arm. If the products
  // read failed, the id may well have been a real product, so the collection
  // arm's own miss is not the whole story. This is why the route accumulates
  // the flags across arms rather than reading one at a time.
  const verdict = decideDetailItemMiss({
    found: undefined,
    reads: [
      { source: 'products', degraded: true },
      { source: 'collection', degraded: false },
    ],
  });
  assert.deepEqual(verdict, { isMissing: false, existenceUnknown: true });
});

test('a misconfigured page with NO reads at all is a genuine miss', () => {
  // The `!lookup` and "menu page with no items binding" branches: nothing was
  // fetched, so nothing failed. The page addresses no items and a 404 there is
  // an answer, not a guess.
  assert.deepEqual(decideDetailItemMiss({ found: undefined, reads: [] }), {
    isMissing: true,
    existenceUnknown: false,
  });
});

test('INVARIANT: isMissing and existenceUnknown are never both true', () => {
  const combos: DetailItemRead[][] = [
    [],
    [COLLECTION_READ],
    [FAILED_READ],
    [FAILED_READ, COLLECTION_READ],
    [FAILED_READ, FAILED_READ],
  ];
  for (const found of [undefined, null, false, { id: 'a' }]) {
    for (const reads of combos) {
      const verdict = decideDetailItemMiss({ found, reads });
      assert.ok(
        !(verdict.isMissing && verdict.existenceUnknown),
        `both true for ${JSON.stringify({ found, reads })}, which would let the caller's branch order decide the answer`,
      );
    }
  }
});

test('PARITY SWEEP: whatever was served before is still served, for every read combination', () => {
  // The refusal is only ever allowed to replace a 404 or a 308, never a page.
  // This replays the old behaviour ("served iff an item was found", which is
  // what every arm did before this change) across the whole combination space
  // of three reads and fails if anything that used to render now does not.
  const flags = [false, true];
  for (const found of [undefined, { id: 'abc' }]) {
    for (const d1 of flags) {
      for (const d2 of flags) {
        for (const d3 of flags) {
          const reads: DetailItemRead[] = [
            { source: 'products', degraded: d1 },
            { source: 'menu-items', degraded: d2 },
            { source: 'menu-sibling', degraded: d3 },
          ];
          const servedBefore = Boolean(found);
          const verdict = decideDetailItemMiss({ found, reads });
          const servedNow = !verdict.isMissing && !verdict.existenceUnknown;
          if (servedBefore) {
            assert.equal(
              servedNow,
              true,
              `regression: ${JSON.stringify({ found, reads })} rendered before this change and does not now`,
            );
          }
          // And the mirror: nothing that was refused-or-404'd before may now
          // silently render an item it does not have.
          if (!servedBefore) {
            assert.equal(servedNow, false, 'a miss must never resolve to "serve"');
          }
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------
// The detection itself, end to end through the real helper
// ---------------------------------------------------------------------------

test('the flag the route branches on comes from provenance, not from an empty list', async () => {
  // The crux, restated on this route: a collection that is genuinely empty
  // returns a value deep-equal to the fallback, so no inspection of the payload
  // could tell the two apart. If the detection were structural, the second half
  // of this test would fail and every genuine 404 on the route would be gone.
  interface Envelope {
    items: Record<string, unknown>[];
    totalCount: number;
  }
  const empty = (): Envelope => ({ items: [], totalCount: 0 });

  const swallowed = await readOrDegrade<Envelope>(empty, async (fallback) => fallback);
  assert.equal(swallowed.degraded, true);
  assert.deepEqual(
    decideDetailItemMiss({ found: undefined, reads: [{ source: 'collection', degraded: swallowed.degraded }] }),
    { isMissing: false, existenceUnknown: true },
  );

  const genuinelyEmpty = await readOrDegrade<Envelope>(empty, async () => ({
    items: [],
    totalCount: 0,
  }));
  assert.equal(genuinelyEmpty.degraded, false);
  assert.deepEqual(
    decideDetailItemMiss({
      found: undefined,
      reads: [{ source: 'collection', degraded: genuinelyEmpty.degraded }],
    }),
    { isMissing: true, existenceUnknown: false },
    'an empty collection is a real answer and its detail URLs must still 404',
  );
});

// ---------------------------------------------------------------------------
// Source pins for the call sites a plain-Node test cannot execute
// ---------------------------------------------------------------------------
//
// Same convention and the same motivation as `degradedCollectionRead.test.ts`:
// every module below imports `server-only` or carries JSX, so this suite cannot
// call it, and mutation testing has already proved once in this codebase that
// deleting an SEO gate leaves the whole suite green (review-templates-106.md
// B2). Each pin is anchored to CODE rather than prose, and sliced to a function
// body where the file's comments are dense enough to satisfy a whole-file
// substring on their own. One of #150's pins was found to be vacuous for
// exactly that reason.

const source = (relative: string): string =>
  readFileSync(new URL(relative, import.meta.url), 'utf8');

/** The body of `export default async function DynamicItemPage`, alone. */
function detailRouteComponent(): string {
  const whole = source('../../app/[slug]/[itemId]/page.tsx');
  const start = whole.indexOf('export default async function DynamicItemPage');
  assert.ok(start > 0, 'sanity: the detail route component was not found, this pin read nothing');
  const end = whole.indexOf('\nfunction resolveMenuDetailCollections');
  assert.ok(end > start, 'sanity: the component end marker moved, this pin read the wrong slice');
  return whole.slice(start, end);
}

test('SOURCE PIN: the detail route answers "missing" through ONE guarded helper', () => {
  const code = detailRouteComponent();
  assert.ok(
    code.includes('decideDetailItemMiss({ found, reads })'),
    'the verdict must come from the pure, tested decision in ./itemMiss.ts',
  );
  assert.ok(
    code.includes('refuseUnknownItemExistence(pageConfig.format)'),
    'and an unknowable verdict must refuse rather than fall through',
  );
  // The whole point of the helper: the six arms may no longer answer for
  // themselves. Exactly one `redirectOrNotFound()` CALL survives in the
  // component, the one inside `answerItemMissing`. Counting the call (with its
  // `siteData` argument) rather than the bare name keeps the file's many
  // mentions of it in prose out of the count.
  const calls = code.split('redirectOrNotFound(siteData').length - 1;
  assert.equal(
    calls,
    1,
    'every arm must route its miss through answerItemMissing(), or a degraded read 404s a live item again',
  );
});

test('SOURCE PIN: the refusal is evaluated BEFORE the redirect, not after', () => {
  // A 308 is the MORE durable of the two wrong answers: it tells a crawler this
  // URL moved permanently. Resolving an authored redirect first and refusing
  // only on the 404 path would leave that half of the bug shipping.
  const code = detailRouteComponent();
  const refusalAt = code.indexOf('refuseUnknownItemExistence(');
  const redirectAt = code.indexOf('return redirectOrNotFound(siteData');
  assert.ok(refusalAt > 0 && redirectAt > 0, 'sanity: this pin read nothing');
  assert.ok(
    refusalAt < redirectAt,
    'refuse first, or an unknowable verdict is answered with a permanent redirect',
  );
});

test('SOURCE PIN: every read on the route reports whether it happened', () => {
  // A single arm left on the value-only helper is a single arm still 404ing
  // live items, and it would be invisible: the route compiles and the suite
  // stays green either way.
  const code = detailRouteComponent();
  for (const call of [
    'await getShowByIdRead(',
    'await getTeamMembersRead(',
    'await getProductByIdRead(',
    'await lookupDetailItem(',
    'await getCollectionItems(',
  ]) {
    assert.ok(code.includes(call), `the route must read through ${call}...) to see a failed read`);
  }
  // Six pools can hold the addressed item: shows, team, products, the scoped
  // collection, the menu items binding, and the menu sibling bindings.
  for (const source of ['"shows"', '"team"', '"products"', '"collection"', '"menu-items"', '"menu-sibling"']) {
    assert.ok(
      code.includes(`reads.push({ source: ${source}`) ||
        code.includes(`reads.push({ source: ${source},`),
      `the ${source} read must be accounted for at the miss, or its failure answers 404`,
    );
  }
});

test('SOURCE PIN: the four read paths carry the flag out of the fetch helper', () => {
  for (const [relative, fn] of [
    ['../api/shows/index.tsx', 'getShowsRead'],
    ['../api/team/index.tsx', 'getTeamMembersRead'],
    ['../api/products/index.ts', 'getProductByIdRead'],
  ] as const) {
    const code = source(relative);
    const start = code.indexOf('export ' + (relative.endsWith('.ts') ? 'async function ' : 'async function ') + fn);
    const at = start > 0 ? start : code.indexOf(fn);
    assert.ok(at > 0, `sanity: ${fn} not found in ${relative}, this assertion read nothing`);
    const nextExport = code.indexOf('\nexport ', at + 1);
    const body = code.slice(at, nextExport === -1 ? undefined : nextExport);
    assert.ok(
      body.includes('degraded'),
      `${fn} must report whether the read happened, not swallow it into an empty list`,
    );
  }
  // The two that go through `readOrDegrade` directly rather than delegating.
  for (const relative of ['../api/shows/index.tsx', '../api/team/index.tsx']) {
    assert.ok(
      source(relative).includes('readOrDegrade'),
      `${relative} must catch the swallowed failure where it is still visible`,
    );
  }
  assert.ok(
    source('./lookupItem.ts').includes('degraded,'),
    'the shared detail lookup must return the flag it obtained from getCollectionItems',
  );
});

test('SOURCE PIN: the refusal is CAPTURED, because a throw reaches Sentry from nowhere here', () => {
  // `src/instrumentation.ts` exports no `onRequestError` hook, so a server
  // component's throw reaches Sentry only through `error.tsx` on the client,
  // where Next has already replaced the message with an opaque digest. Without
  // the explicit capture the refusal is invisible, and "fail visibly" is the
  // whole argument for preferring it to a silent 404.
  const helper = source('../degradedPageRefusal.ts');
  const at = helper.indexOf('export function refuseUnknownItemExistence');
  assert.ok(at > 0, 'sanity: the detail refusal helper was not found');
  const body = helper.slice(at);
  assert.ok(body.includes('Sentry.captureException('), 'the refusal must be captured explicitly');
  assert.ok(
    body.includes('DEGRADED_DETAIL_REFUSAL_FINGERPRINT'),
    'and under its own fingerprint: a real 5xx and a body swap under a 200 are not the same incident',
  );
});

test('SOURCE PIN: the sitemap refuses a short detail-item list rather than publishing it', () => {
  // Third of the three consumers #150 reported. A degraded detail-item read
  // drops those URLs from the sitemap as a perfectly successful render of a
  // legitimately short list, on site data that is completely healthy, so
  // #149's degraded-siteData guard never sees it.
  const code = source('../api/siteData/index.tsx');
  const at = code.indexOf('sitemapPages.map(async (page)');
  assert.ok(at > 0, 'sanity: the detail-item sitemap read was not found, this pin read nothing');
  const body = code.slice(at, code.indexOf('buildSiteMapForSite(', at));
  assert.ok(
    body.includes('await getCollectionItems(') && body.includes('degraded'),
    'the sitemap read must see whether it happened',
  );
  assert.ok(
    body.includes('refuseDegradedClaim('),
    'and must refuse rather than emit a silently short sitemap',
  );
});

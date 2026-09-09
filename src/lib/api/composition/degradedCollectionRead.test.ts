import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Explicit .ts extensions: runs under `node --experimental-strip-types --test`
// (see package.json "test"), which has no tsconfig `paths` resolution.
import { readOrDegrade } from '../degradedRead.ts';
import { decidePageEmptiness, type PageDataRead } from './pageEmptiness.ts';

/**
 * A DEGRADED COLLECTION READ MUST NOT 404 A REAL PUBLISHED PAGE.
 *
 * `clientFetchCached` swallows every upstream failure and returns the caller's
 * fallback, and `getCollectionItems` passes `{ items: [], totalCount: 0 }` as
 * that fallback. So a collection read that FAILS is, from one line later on,
 * indistinguishable from a collection that is EMPTY.
 *
 * `buildPageContext` then computed `isEmpty` by counting those arrays, and
 * `renderComposedPage.tsx` turned `isEmpty` into `notFound()`. Put end to end:
 * a transient VR_Client_API wobble removed real, published pages from the site
 * and told every crawler they were gone.
 *
 * It is the same shape as the degraded SITE-data path pinned in
 * `src/lib/seo/degradedRender.test.ts` (a specific claim manufactured out of an
 * absence of data), with three differences that make it worse:
 *
 *   - it fires on HEALTHY `siteData`, so the `assertUpstreamHealthy` guard the
 *     routes run above the Suspense boundary never sees it;
 *   - it degrades from a different root, so nothing about `FALLBACK_SITE_DATA`
 *     bears on it;
 *   - it runs INSIDE the Suspense boundary, where the 200 has already been
 *     flushed, so the 404 it produced was a soft 404 that no monitoring sees.
 *
 * The suite pins BOTH directions. The emptiness 404 exists for real reasons
 * (the A Bakeshop Weddings and Tea-Time pages are named in
 * `pageEmptiness.ts`'s own docblocks), and weakening it would trade this bug
 * for blank pages served at 200.
 */

/** The shape both fetch helpers hand to `clientFetchCached` as their fallback. */
interface Envelope {
  items: Record<string, unknown>[];
  totalCount: number;
}
const emptyEnvelope = (): Envelope => ({ items: [], totalCount: 0 });

// ---------------------------------------------------------------------------
// Telling a failed read apart from an empty one
// ---------------------------------------------------------------------------

test('a swallowed upstream failure is reported as degraded', async () => {
  // Exactly what `clientFetchCached` does on any non-402 error: return the
  // fallback it was handed, with the error already captured and gone.
  const { value, degraded } = await readOrDegrade<Envelope>(
    emptyEnvelope,
    async (fallback) => fallback,
  );
  assert.equal(degraded, true);
  assert.deepEqual(value, { items: [], totalCount: 0 });
});

test('a GENUINELY EMPTY upstream response is NOT degraded', async () => {
  // The crux of the whole fix. This response is deep-equal to the fallback,
  // byte for byte, so no inspection of the value could ever tell them apart.
  // Only provenance can, which is why the check is reference identity.
  const { degraded } = await readOrDegrade<Envelope>(emptyEnvelope, async () => ({
    items: [],
    totalCount: 0,
  }));
  assert.equal(
    degraded,
    false,
    'an empty collection is a real answer and must still be allowed to 404 its page',
  );
});

test('a populated response is not degraded', async () => {
  const { value, degraded } = await readOrDegrade<Envelope>(emptyEnvelope, async () => ({
    items: [{ _id: 'a' }],
    totalCount: 1,
  }));
  assert.equal(degraded, false);
  assert.equal(value.items.length, 1);
});

test('two reads never share a sentinel, so one failing cannot mark the other', async () => {
  const seen: Envelope[] = [];
  const capture = async (fallback: Envelope) => {
    seen.push(fallback);
    return fallback;
  };
  await readOrDegrade<Envelope>(emptyEnvelope, capture);
  await readOrDegrade<Envelope>(emptyEnvelope, capture);
  assert.equal(seen.length, 2);
  assert.ok(
    seen[0] !== seen[1],
    'a shared sentinel would make two independent reads indistinguishable',
  );
});

// ---------------------------------------------------------------------------
// The defect: a failed read must not read as "this page does not exist"
// ---------------------------------------------------------------------------

const COLLECTION_ONLY_PAGE = {
  isHome: false,
  format: 'list',
  // A real published page whose body IS its collection: a section-header block
  // plus a collection block, nothing authored inline.
  blocks: [
    { id: 'c', type: { kind: 'collection', dispatchId: 'collection' }, enabled: true },
  ],
};

test('THE DEFECT: a degraded read on a real page does NOT report empty', () => {
  const reads: PageDataRead[] = [{ count: 0, degraded: true }];
  const verdict = decidePageEmptiness({ ...COLLECTION_ONLY_PAGE, reads });
  assert.equal(
    verdict.isEmpty,
    false,
    'count === 0 is exactly what a FAILED read looks like, and must never 404 a page',
  );
  assert.equal(
    verdict.emptinessUnknown,
    true,
    'the caller has to be told to refuse, not merely told not to 404',
  );
});

test('a GENUINELY empty generic page still reports empty, so it still 404s', () => {
  const reads: PageDataRead[] = [{ count: 0, degraded: false }];
  const verdict = decidePageEmptiness({ ...COLLECTION_ONLY_PAGE, reads });
  assert.equal(verdict.isEmpty, true, 'the emptiness 404 exists for a reason and is kept');
  assert.equal(verdict.emptinessUnknown, false);
});

test('a page with items is neither empty nor unknown', () => {
  const verdict = decidePageEmptiness({
    ...COLLECTION_ONLY_PAGE,
    reads: [{ count: 3, degraded: false }],
  });
  assert.deepEqual(verdict, { isEmpty: false, emptinessUnknown: false });
});

test('one degraded read poisons the verdict even when a sibling read succeeded empty', () => {
  // Two bindings, one read failed and one legitimately returned nothing. The
  // page may or may not be empty and there is no way to find out, so the only
  // honest answer is to refuse.
  const verdict = decidePageEmptiness({
    ...COLLECTION_ONLY_PAGE,
    reads: [
      { count: 0, degraded: true },
      { count: 0, degraded: false },
    ],
  });
  assert.deepEqual(verdict, { isEmpty: false, emptinessUnknown: true });
});

test('INVARIANT: isEmpty and emptinessUnknown are never both true', () => {
  const combos: PageDataRead[][] = [
    [],
    [{ count: 0, degraded: false }],
    [{ count: 0, degraded: true }],
    [{ count: 2, degraded: true }],
    [
      { count: 0, degraded: true },
      { count: 5, degraded: false },
    ],
  ];
  for (const reads of combos) {
    const verdict = decidePageEmptiness({ ...COLLECTION_ONLY_PAGE, reads });
    assert.ok(
      !(verdict.isEmpty && verdict.emptinessUnknown),
      `both true for ${JSON.stringify(reads)}, which would make the caller's branch order decide the answer`,
    );
  }
});

// ---------------------------------------------------------------------------
// The refusal must not spread to pages that render fine without the collection
// ---------------------------------------------------------------------------

test('WEDDINGS/TEA-TIME: an authored static page is neither empty nor unknown, degraded or not', () => {
  // These two pages are named in `pageEmptiness.ts` because they 404'd
  // mid-stream on the live site once already. Their whole body is authored
  // prose, so the collection read is irrelevant to them in BOTH directions:
  // they must not 404 when it is empty, and they must not be refused when it
  // fails. Refusing them would swap this bug for an error page on real content.
  const page = {
    isHome: false,
    format: 'standard',
    blocks: [
      {
        id: 'story',
        type: { kind: 'static', dispatchId: 'about' },
        enabled: true,
        config: { labels: { body: '<p>Congratulations, you are getting married!</p>' } },
      },
    ],
  };
  assert.deepEqual(decidePageEmptiness({ ...page, reads: [{ count: 0, degraded: false }] }), {
    isEmpty: false,
    emptinessUnknown: false,
  });
  assert.deepEqual(decidePageEmptiness({ ...page, reads: [{ count: 0, degraded: true }] }), {
    isEmpty: false,
    emptinessUnknown: false,
  });
});

test('a form page is neither empty nor unknown, degraded or not', () => {
  const page = {
    isHome: false,
    format: 'standard',
    blocks: [{ id: 'f', type: { kind: 'page-template', dispatchId: 'form' }, enabled: true }],
  };
  assert.deepEqual(decidePageEmptiness({ ...page, reads: [{ count: 0, degraded: false }] }), {
    isEmpty: false,
    emptinessUnknown: false,
  });
  assert.deepEqual(decidePageEmptiness({ ...page, reads: [{ count: 0, degraded: true }] }), {
    isEmpty: false,
    emptinessUnknown: false,
  });
});

// ---------------------------------------------------------------------------
// Byte-parity with the expression this replaced, on healthy data
// ---------------------------------------------------------------------------

test('PARITY: a page with no bindings at all is still empty', () => {
  // The old expression ended in `.every((a) => a.length === 0)` over two empty
  // maps, and `[].every(...)` is `true`. A page that binds nothing has nothing
  // to render, and that verdict is unchanged.
  assert.equal(decidePageEmptiness({ ...COLLECTION_ONLY_PAGE, reads: [] }).isEmpty, true);
});

test('PARITY: home, static and the two checkout formats are never empty', () => {
  const reads: PageDataRead[] = [{ count: 0, degraded: false }];
  assert.equal(
    decidePageEmptiness({ isHome: true, format: 'list', blocks: [], reads }).isEmpty,
    false,
  );
  for (const format of ['static', 'checkout-success', 'checkout-cancel']) {
    assert.equal(
      decidePageEmptiness({ isHome: false, format, blocks: [], reads }).isEmpty,
      false,
      `${format} must never be reported empty`,
    );
  }
});

// ---------------------------------------------------------------------------
// Source pins for the call sites a plain-Node test cannot execute
// ---------------------------------------------------------------------------
//
// Same convention, and the same motivation, as `degradedRender.test.ts`:
// mutation testing has already proved once in this codebase that deleting an
// SEO gate leaves the whole suite green (review-templates-106.md B2). Every
// module below imports `server-only` or carries JSX, so this suite cannot call
// it.

const source = (relative: string): string =>
  readFileSync(new URL(relative, import.meta.url), 'utf8');

test('SOURCE PIN: buildPageContext no longer infers emptiness from raw array lengths', () => {
  const code = source('./buildPageContext.ts');
  assert.ok(
    !code.includes('.every((a) => a.length === 0)'),
    'the inline count over the item maps is the defect: it cannot see a failed read',
  );
  assert.ok(
    code.includes('decidePageEmptiness('),
    'the verdict must come from the pure, tested decision in ./pageEmptiness.ts',
  );
  assert.ok(
    code.includes('emptinessUnknown'),
    'buildPageContext must report an unknowable verdict, not just suppress the empty one',
  );
});

test('SOURCE PIN: both collection reads report whether the read happened', () => {
  const code = source('../collections/index.ts');
  assert.ok(code.includes('readOrDegrade'), 'the swallowed failure has to be caught where it is still visible');
  // Two fetchers, `getCollectionItems` and `getIntegrationItems`. Both feed the
  // emptiness verdict, so a fix to only one leaves half the bug shipping.
  assert.equal(
    code.split('readOrDegrade<PaginatedResponse>').length - 1,
    2,
    'both getCollectionItems and getIntegrationItems must report a failed read',
  );
  assert.ok(
    code.includes('degraded: boolean'),
    'the flag is non-optional so an un-updated caller cannot silently read false',
  );
});

test('SOURCE PIN: the products bridge carries the flag too', () => {
  // A storefront group composes onto ordinary `grid` and `list` pages under the
  // universal page model, so a degraded PRODUCTS read reaches the same 404 that
  // a degraded collection read does.
  const code = source('./productBridge.ts');
  assert.ok(code.includes('getProductsRead'), 'the bridge must use the read that reports degradation');
  assert.ok(code.includes('degraded'), 'and it must pass the flag on to buildPageContext');
});

test('SOURCE PIN: the LIVE generic-format guard refuses BEFORE it can notFound()', () => {
  // `src/lib/renderComposedPage.tsx` is where standard/list/grid actually land:
  // `[slug]/page.tsx` returns early into it for every generic format.
  const code = source('../../renderComposedPage.tsx');
  const refusalAt = code.indexOf('refuseDegradedClaim(');
  const notFoundAt = code.indexOf('return notFound()');
  assert.ok(refusalAt > 0, 'the guard must refuse a degraded read rather than 404 it');
  assert.ok(notFoundAt > 0, 'sanity: the genuine-empty 404 is still here');
  assert.ok(
    refusalAt < notFoundAt,
    'refuse first, or an unknowable verdict falls through to the 404 this fix exists to prevent',
  );
  assert.ok(
    code.includes('GENERIC_FORMATS.has(composedPage.format)'),
    'the refusal stays scoped to the same formats the 404 was scoped to',
  );
});

test('SOURCE PIN: the [slug] mirror of the guard refuses first as well', () => {
  // Kept in lockstep by this file's own "Mirrors the guard" contract. It is
  // currently unreachable for standard/list/grid (they return early into
  // renderComposedPage), which is exactly why a test has to hold it correct:
  // nothing else exercises it, and the transitional title band already drifted
  // once under the same conditions.
  const whole = source('../../../app/[slug]/page.tsx');
  const bodyAt = whole.indexOf('async function ComposedFormatBody');
  assert.ok(bodyAt > 0, 'sanity: this test read nothing');
  const body = whole.slice(bodyAt);

  const refusalAt = body.indexOf('refuseDegradedClaim(');
  const notFoundAt = body.indexOf('return notFound()');
  assert.ok(refusalAt > 0, 'the mirrored guard must refuse a degraded read too');
  assert.ok(notFoundAt > 0, 'sanity: the genuine-empty 404 is still here');
  assert.ok(refusalAt < notFoundAt, 'refuse first, same order as the live copy');
});

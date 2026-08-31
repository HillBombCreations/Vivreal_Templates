import { test } from 'node:test';
import assert from 'node:assert/strict';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`.
import {
  isSkippablePath,
  firstPathSegment,
  isLiveContentPath,
  isSelfRedirectLoop,
  getEdgeSiteMap,
  isSiteFrozen,
  TTL_MS,
  __resetEdgeSiteMapCacheForTests,
  __setCacheFetchedAtForTests,
  __setFrozenObservedAtForTests,
  __setLastFailureAtForTests,
} from './edgeSiteMap.ts';

// docs/bugs/templates-soft-404-and-301-status, Change 1a — the SWR module
// cache middleware.ts consults before resolving an authored redirect to a
// real 301. Every case here must FAIL against the un-implemented module.

// getEdgeSiteMap() tests below drive the network layer via a mocked global
// `fetch`. fetchSiteMap() reads API_KEY/SITE_ID call-time and short-circuits
// before ever calling fetch when either is unset (review pass 1 hardening
// note, "guard the env before fetching") — set them here once so those tests
// exercise the mocked fetch, not the guard. The guard itself gets its own
// dedicated test below, which temporarily clears them.
process.env.API_KEY = 'test-api-key';
process.env.SITE_ID = 'test-site-id';

test('isSkippablePath: /_next/* is skipped', () => {
  assert.equal(isSkippablePath(new URL('https://example.com/_next/static/chunk.js')), true);
});

test('isSkippablePath: /api/* is skipped', () => {
  assert.equal(isSkippablePath(new URL('https://example.com/api/contact')), true);
});

test('isSkippablePath: an extension-bearing path is skipped', () => {
  assert.equal(isSkippablePath(new URL('https://example.com/robots.txt')), true);
  assert.equal(isSkippablePath(new URL('https://example.com/favicon.ico')), true);
});

test('isSkippablePath: the vivreal_preview search param is skipped, regardless of path', () => {
  assert.equal(
    isSkippablePath(new URL('https://example.com/pages/contact-us?vivreal_preview=abc123')),
    true,
  );
  // Even an EMPTY preview value must skip -- presence of the param is what
  // matters (matches `URLSearchParams#has`, not a truthy-value check).
  assert.equal(
    isSkippablePath(new URL('https://example.com/pages/contact-us?vivreal_preview=')),
    true,
  );
});

test('isSkippablePath: an ordinary document path is NOT skipped', () => {
  assert.equal(isSkippablePath(new URL('https://example.com/pages/contact-us')), false);
  assert.equal(isSkippablePath(new URL('https://example.com/')), false);
});

test('firstPathSegment: extracts the first non-empty segment', () => {
  assert.equal(firstPathSegment('/pages/contact-us'), 'pages');
  assert.equal(firstPathSegment('/shop'), 'shop');
  assert.equal(firstPathSegment('/'), '');
});

test('isLiveContentPath: the root path is always live', () => {
  assert.equal(isLiveContentPath('/', new Set()), true);
});

test('isLiveContentPath: privacy/terms are always live even when absent from slugs', () => {
  assert.equal(isLiveContentPath('/privacy', new Set()), true);
  assert.equal(isLiveContentPath('/terms', new Set()), true);
});

test('isLiveContentPath: first-segment-matches-a-live-slug ⇒ live (never shadow live content)', () => {
  const slugs = new Set(['shop', 'contact']);
  assert.equal(isLiveContentPath('/shop', slugs), true);
  assert.equal(isLiveContentPath('/shop/some-product', slugs), true);
});

test('isLiveContentPath: a path with no matching slug is NOT live', () => {
  const slugs = new Set(['shop', 'contact']);
  assert.equal(isLiveContentPath('/pages/contact-us', slugs), false);
});

test('isSelfRedirectLoop: target normalises equal to the request path ⇒ loop', () => {
  assert.equal(isSelfRedirectLoop('/old-page', '/old-page'), true);
  // Trailing-slash-insensitive.
  assert.equal(isSelfRedirectLoop('/old-page/', '/old-page'), true);
  assert.equal(isSelfRedirectLoop('/old-page', '/old-page/'), true);
});

test('isSelfRedirectLoop: a genuinely different target is NOT a loop', () => {
  assert.equal(isSelfRedirectLoop('/pages/contact-us', '/contact'), false);
});

test('isSelfRedirectLoop: an absolute-URL target pointing at the same path IS a loop (resolved-pathname compare, not raw-string)', () => {
  assert.equal(isSelfRedirectLoop('/contact', 'https://thissite.com/contact'), true);
});

// isSameOriginRedirectTarget's own decision-table tests moved to
// `redirects.test.ts` (docs/bugs/templates-soft-404-and-301-status, Change A)
// when the predicate relocated to `@/lib/redirects` — it is now shared by
// `middleware.ts` AND `src/app/[slug]/[itemId]/page.tsx`'s
// `redirectOrNotFound()`, not an edge-only concern.

test('getEdgeSiteMap: empty/absent redirect map ⇒ no redirect resolvable (redirects is [])', async () => {
  __resetEdgeSiteMapCacheForTests();
  const originalFetch = globalThis.fetch;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
  (globalThis as any).fetch = async () =>
    new Response(
      JSON.stringify({
        success: true,
        data: { pages: [{ slug: 'shop' }], siteDetails: { values: {} } },
        error: null,
      }),
      { status: 200 },
    );
  try {
    const map = await getEdgeSiteMap();
    assert.ok(map);
    assert.deepEqual(map!.redirects, []);
    assert.ok(map!.slugs.has('shop'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getEdgeSiteMap: dual-source read prefers raw.redirects, falls back to siteDetails.values.redirects', async () => {
  __resetEdgeSiteMapCacheForTests();
  const originalFetch = globalThis.fetch;
  const topLevelRedirects = [{ from: '/a', to: '/a2', status: 301 }];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
  (globalThis as any).fetch = async () =>
    new Response(
      JSON.stringify({
        success: true,
        data: {
          pages: [],
          redirects: topLevelRedirects,
          siteDetails: { values: { redirects: [{ from: '/b', to: '/b2', status: 301 }] } },
        },
        error: null,
      }),
      { status: 200 },
    );
  try {
    const map = await getEdgeSiteMap();
    assert.ok(map);
    assert.deepEqual(map!.redirects, topLevelRedirects);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getEdgeSiteMap: values-only redirects are read when the top-level field is absent', async () => {
  __resetEdgeSiteMapCacheForTests();
  const originalFetch = globalThis.fetch;
  const valuesRedirects = [{ from: '/pages/contact-us', to: '/contact', status: 301 }];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
  (globalThis as any).fetch = async () =>
    new Response(
      JSON.stringify({
        success: true,
        data: { pages: [], siteDetails: { values: { redirects: valuesRedirects } } },
        error: null,
      }),
      { status: 200 },
    );
  try {
    const map = await getEdgeSiteMap();
    assert.ok(map);
    assert.deepEqual(map!.redirects, valuesRedirects);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getEdgeSiteMap: fail-open on a non-2xx upstream response returns null when there is no prior cache', async () => {
  __resetEdgeSiteMapCacheForTests();
  const originalFetch = globalThis.fetch;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
  (globalThis as any).fetch = async () => new Response('boom', { status: 500 });
  try {
    const map = await getEdgeSiteMap();
    assert.equal(map, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getEdgeSiteMap: fail-open on a thrown network error returns null when there is no prior cache', async () => {
  __resetEdgeSiteMapCacheForTests();
  const originalFetch = globalThis.fetch;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
  (globalThis as any).fetch = async () => {
    throw new Error('network unreachable');
  };
  try {
    const map = await getEdgeSiteMap();
    assert.equal(map, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getEdgeSiteMap: a FRESH cache returns the cached value without ever calling fetch', async () => {
  __resetEdgeSiteMapCacheForTests();
  const originalFetch = globalThis.fetch;
  const goodRedirects = [{ from: '/old', to: '/new', status: 301 }];
  try {
    // First call populates the module-scope cache with a good value.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
    (globalThis as any).fetch = async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: { pages: [], redirects: goodRedirects, siteDetails: { values: {} } },
          error: null,
        }),
        { status: 200 },
      );
    const first = await getEdgeSiteMap();
    assert.ok(first);
    assert.deepEqual(first!.redirects, goodRedirects);

    // Second call: cache is fresh (TTL 300s, untouched), so this must return
    // the SAME cached value without even attempting the network -- proven by
    // pointing fetch at a failing implementation and asserting no throw +
    // same data. This is the fresh-cache short-circuit at edgeSiteMap.ts:191,
    // a distinct property from the STALE-cache fail-open path below.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
    (globalThis as any).fetch = async () => new Response('boom', { status: 500 });
    const second = await getEdgeSiteMap();
    assert.ok(second);
    assert.deepEqual(second!.redirects, goodRedirects);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// review pass 1, Item 3a -- the prior version of this test (renamed above)
// claimed to test fail-open but never exercised it: with a FRESH cache,
// getEdgeSiteMap() returns at edgeSiteMap.ts:191 before any network call, so
// the test passed identically with the last-known fallback deleted entirely.
// This test forces the cache STALE via __setCacheFetchedAtForTests (rather
// than waiting out the real 300s TTL) so the refresh path actually runs, then
// makes that refresh fail, and asserts the real fail-open property: a stale
// cache + a failing refresh still serves the last-known value. Confirmed to
// FAIL (assert.ok(second) throws) if the `if (value) cache = ...` fallback in
// getEdgeSiteMap's `.then` is replaced with an unconditional overwrite.
test('getEdgeSiteMap: STALE cache + a failing refresh still serves the last-known value (fail-open)', async () => {
  __resetEdgeSiteMapCacheForTests();
  const originalFetch = globalThis.fetch;
  const goodRedirects = [{ from: '/old', to: '/new', status: 301 }];
  try {
    // First call populates the module-scope cache with a good value.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
    (globalThis as any).fetch = async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: { pages: [], redirects: goodRedirects, siteDetails: { values: {} } },
          error: null,
        }),
        { status: 200 },
      );
    const first = await getEdgeSiteMap();
    assert.ok(first);
    assert.deepEqual(first!.redirects, goodRedirects);

    // Force staleness without waiting 300s of real time.
    __setCacheFetchedAtForTests(Date.now() - TTL_MS - 1);

    // The background refresh this triggers must fail.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
    (globalThis as any).fetch = async () => new Response('boom', { status: 500 });

    const second = await getEdgeSiteMap();
    assert.ok(second, 'stale cache + failing refresh must still return the last-known value');
    assert.deepEqual(second!.redirects, goodRedirects);

    // Let the (failing) background refresh settle before restoring fetch, so
    // it never observes the finally block's original fetch mid-flight.
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// review pass 1 hardening note -- "guard the env before fetching."
test('getEdgeSiteMap: missing API_KEY/SITE_ID short-circuits before any network call', async () => {
  __resetEdgeSiteMapCacheForTests();
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.API_KEY;
  const originalSiteId = process.env.SITE_ID;
  let fetchCalled = false;
  process.env.API_KEY = '';
  process.env.SITE_ID = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
  (globalThis as any).fetch = async () => {
    fetchCalled = true;
    throw new Error('fetch must never be called when API_KEY/SITE_ID are unconfigured');
  };
  try {
    const map = await getEdgeSiteMap();
    assert.equal(map, null);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.API_KEY = originalApiKey;
    process.env.SITE_ID = originalSiteId;
  }
});

// review pass 1 hardening note -- "negative caching."
test('getEdgeSiteMap: negative cache -- a second call within the failure window skips the network entirely', async () => {
  __resetEdgeSiteMapCacheForTests();
  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
  (globalThis as any).fetch = async () => {
    fetchCallCount += 1;
    return new Response('boom', { status: 500 });
  };
  try {
    const first = await getEdgeSiteMap();
    assert.equal(first, null);
    assert.equal(fetchCallCount, 1);

    // Second call, still within NEGATIVE_CACHE_MS of the first failure (real
    // elapsed time here is milliseconds) -- must not re-attempt the network.
    const second = await getEdgeSiteMap();
    assert.equal(second, null);
    assert.equal(fetchCallCount, 1, 'negative cache should have skipped this network call');
  } finally {
    globalThis.fetch = originalFetch;
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// Billing-freeze verdict
//
// The gate this feeds takes a customer's site off the internet, so the tests
// that matter most here are the FAIL-OPEN ones. A false positive shows a
// paying customer's visitors an "unavailable" page, which is far worse than a
// frozen site serving for another minute.
// ─────────────────────────────────────────────────────────────────────────────

/** Drive one getEdgeSiteMap() call against a stubbed upstream response. */
async function withUpstream(makeResponse: () => Response, run: () => void | Promise<void>) {
  const originalFetch = globalThis.fetch;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
  (globalThis as any).fetch = async () => makeResponse();
  try {
    await getEdgeSiteMap();
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const frozenBody = JSON.stringify({
  success: false,
  data: null,
  error: 'The group is frozen please resume go to portal to activate',
  code: 'GroupFrozen',
});

const okBody = JSON.stringify({
  success: true,
  data: { pages: [{ slug: 'shop' }], siteDetails: { values: {} } },
  error: null,
});

test('isSiteFrozen: false before anything has been observed', () => {
  __resetEdgeSiteMapCacheForTests();
  assert.equal(isSiteFrozen(), false);
});

test('isSiteFrozen: a 400 carrying code GroupFrozen is a freeze', async () => {
  __resetEdgeSiteMapCacheForTests();
  await withUpstream(
    () => new Response(frozenBody, { status: 400 }),
    () => {
      assert.equal(isSiteFrozen(), true);
    },
  );
});

test('isSiteFrozen: gates on the CODE, not on the human sentence', async () => {
  // Rewording the message must never un-freeze a site, so the code alone
  // decides. Same status, same shape, only the sentence differs.
  __resetEdgeSiteMapCacheForTests();
  await withUpstream(
    () =>
      new Response(
        JSON.stringify({ success: false, data: null, error: 'totally different wording', code: 'GroupFrozen' }),
        { status: 400 },
      ),
    () => {
      assert.equal(isSiteFrozen(), true);
    },
  );
});

test('isSiteFrozen: an ordinary validation 400 is NOT a freeze', async () => {
  // The reason a code was added upstream at all: GroupFrozen and
  // IntegrationNotActive are BOTH 400, so status cannot discriminate.
  __resetEdgeSiteMapCacheForTests();
  await withUpstream(
    () =>
      new Response(
        JSON.stringify({ success: false, data: null, error: 'siteId is required' }),
        { status: 400 },
      ),
    () => {
      assert.equal(isSiteFrozen(), false);
    },
  );
});

test('isSiteFrozen: a DIFFERENT CustomError code at 400 is NOT a freeze', async () => {
  __resetEdgeSiteMapCacheForTests();
  await withUpstream(
    () =>
      new Response(
        JSON.stringify({
          success: false,
          data: null,
          error: "That integration isn't active",
          code: 'IntegrationNotActive',
        }),
        { status: 400 },
      ),
    () => {
      assert.equal(isSiteFrozen(), false);
    },
  );
});

test('isSiteFrozen: a 402 quota denial is NOT a freeze', async () => {
  // 402 is the quota / spending-cap path, a different state with different
  // copy. Only 400 + GroupFrozen freezes.
  __resetEdgeSiteMapCacheForTests();
  await withUpstream(
    () =>
      new Response(
        JSON.stringify({ success: false, data: null, error: 'Monthly API usage quota reached.' }),
        { status: 402 },
      ),
    () => {
      assert.equal(isSiteFrozen(), false);
    },
  );
});

test('isSiteFrozen: a 500 is NOT a freeze', async () => {
  __resetEdgeSiteMapCacheForTests();
  await withUpstream(
    () => new Response('upstream exploded', { status: 500 }),
    () => {
      assert.equal(isSiteFrozen(), false);
    },
  );
});

test('isSiteFrozen: an unreadable 400 body fails OPEN', async () => {
  // Cannot confirm a freeze, so must not claim one.
  __resetEdgeSiteMapCacheForTests();
  await withUpstream(
    () => new Response('<html>gateway error</html>', { status: 400 }),
    () => {
      assert.equal(isSiteFrozen(), false);
    },
  );
});

test('isSiteFrozen: a successful read clears a previous freeze immediately', async () => {
  // This is what makes UNFREEZING fast. The customer paid and is waiting; the
  // first good read on this instance must bring the site back with no
  // separate signal and no webhook.
  __resetEdgeSiteMapCacheForTests();
  await withUpstream(
    () => new Response(frozenBody, { status: 400 }),
    () => {
      assert.equal(isSiteFrozen(), true);
    },
  );
  // Cross the negative-cache window WITHOUT resetting the module, so the live
  // freeze verdict is still in place when the good read lands.
  __setLastFailureAtForTests(null);
  await withUpstream(
    () => new Response(okBody, { status: 200 }),
    () => {
      assert.equal(isSiteFrozen(), false);
    },
  );
});

test('isSiteFrozen: a stale verdict fails OPEN', async () => {
  // If the upstream becomes unreachable while a site is frozen, the verdict
  // ages out and the site serves again. Never take a paying customer down
  // because the API blinked.
  __resetEdgeSiteMapCacheForTests();
  await withUpstream(
    () => new Response(frozenBody, { status: 400 }),
    () => {
      assert.equal(isSiteFrozen(), true);
    },
  );
  __setFrozenObservedAtForTests(Date.now() - 90_001);
  assert.equal(isSiteFrozen(), false, 'a verdict older than the TTL must not hold a site down');
});

test('isSiteFrozen: a transient error does NOT clear a live freeze', async () => {
  // Only a definitive answer moves the verdict. A 500 in the middle of a real
  // freeze must not un-freeze the site.
  __resetEdgeSiteMapCacheForTests();
  await withUpstream(
    () => new Response(frozenBody, { status: 400 }),
    () => {
      assert.equal(isSiteFrozen(), true);
    },
  );
  await withUpstream(
    () => new Response('boom', { status: 500 }),
    () => {
      assert.equal(isSiteFrozen(), true);
    },
  );
});

test('isSiteFrozen: reading it never issues a network call', () => {
  // middleware.ts consults this on every document request of every site. It
  // must be a pure read of the verdict getEdgeSiteMap() already refreshed.
  __resetEdgeSiteMapCacheForTests();
  const originalFetch = globalThis.fetch;
  let called = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
  (globalThis as any).fetch = async () => {
    called += 1;
    return new Response(okBody, { status: 200 });
  };
  try {
    isSiteFrozen();
    isSiteFrozen();
    assert.equal(called, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

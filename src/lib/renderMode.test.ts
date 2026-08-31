import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ISR_RENDER_MODE,
  ISR_REVALIDATE_SECONDS,
  SITE_RENDER_MODE_ENV,
  isIsrRenderMode,
  optOutOfCachingDegradedRender,
  optOutOfPrerenderUnlessIsr,
  shouldOptOutOfPrerender,
} from './renderMode.ts';

/**
 * Three layers, in increasing strength.
 *
 *  1. The decision function, called directly.
 *  2. `enforceDynamicUnlessIsr()` run inside NEXT'S REAL prerender work store,
 *     asserting on NEXT'S OWN bookkeeping — the same method
 *     `previewToken.test.ts` uses, and the only way to prove "the gate really
 *     does what `force-dynamic` did" rather than "the gate calls a function
 *     named connection".
 *  3. The literal contract between `ISR_REVALIDATE_SECONDS` and the
 *     `export const revalidate = 300` in each gated route file.
 *
 * Layer 3 reads source on purpose, and it is the one case where that is the
 * CORRECT tool rather than a weaker substitute: Next 16 resolves route segment
 * config by parsing the route file's source, and rejects anything that is not a
 * literal with a hard build failure (measured on both bundlers, see
 * `renderMode.ts`). So the value genuinely is a source token, it genuinely
 * cannot be imported, and the only failure mode left — someone edits 300 in one
 * file and not the others — is exactly what a source comparison catches.
 */

/* ------------------------------------------------------------------ */
/*  Layer 1: the decision                                              */
/* ------------------------------------------------------------------ */

test('unset is OFF — this is the property that makes the change mergeable', () => {
  assert.equal(isIsrRenderMode({}), false);
  assert.equal(isIsrRenderMode({ [SITE_RENDER_MODE_ENV]: undefined }), false);
});

test('the exact opt-in value is ON, case and whitespace insensitive', () => {
  assert.equal(isIsrRenderMode({ [SITE_RENDER_MODE_ENV]: ISR_RENDER_MODE }), true);
  assert.equal(isIsrRenderMode({ [SITE_RENDER_MODE_ENV]: 'ISR' }), true);
  assert.equal(isIsrRenderMode({ [SITE_RENDER_MODE_ENV]: '  Isr  ' }), true);
});

test('every other value is OFF — a typo must not flip a customer site', () => {
  // The dangerous alternative implementation is "any non-empty value is on".
  // Under it, `SITE_RENDER_MODE=false` would enable ISR.
  for (const value of ['', ' ', 'true', 'false', '1', '0', 'on', 'dynamic', 'isr-mode', 'israel']) {
    assert.equal(
      isIsrRenderMode({ [SITE_RENDER_MODE_ENV]: value }),
      false,
      `${JSON.stringify(value)} must not enable ISR`,
    );
  }
});

test('an unrelated env var never enables it', () => {
  assert.equal(isIsrRenderMode({ SITE_CACHE_TTL_SECONDS: '300', NODE_ENV: 'production' }), false);
});

test('opting out of prerender is the exact complement of ISR mode', () => {
  for (const value of [undefined, '', 'isr', 'ISR', 'false', 'x']) {
    const env = value === undefined ? {} : { [SITE_RENDER_MODE_ENV]: value };
    assert.equal(shouldOptOutOfPrerender(env), !isIsrRenderMode(env));
  }
});

/* ------------------------------------------------------------------ */
/*  Layer 2: the gate inside Next's real prerender store               */
/* ------------------------------------------------------------------ */

/*
 * Same bootstrap as `previewToken.test.ts`, and for the same reason: Next's
 * storage modules capture `globalThis.AsyncLocalStorage` at load time and fall
 * back to a fake whose `run()` throws when it is absent, which it is in plain
 * Node. The dynamic imports below must therefore run AFTER the assignment, so
 * they cannot be static `import` statements (those hoist).
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { WorkStore } from 'next/dist/server/app-render/work-async-storage.external';

// `as unknown as`: `globalThis` has no declared `AsyncLocalStorage` in a Node
// lib, which is the whole point — Next puts it there at runtime.
const globalWithAls = globalThis as unknown as {
  AsyncLocalStorage?: typeof AsyncLocalStorage;
};
globalWithAls.AsyncLocalStorage ??= AsyncLocalStorage;

const { workAsyncStorage } = await import(
  'next/dist/server/app-render/work-async-storage.external.js'
);
const { workUnitAsyncStorage } = await import(
  'next/dist/server/app-render/work-unit-async-storage.external.js'
);
/*
 * The REAL `connection`, from the module `next/server` re-exports
 * (`node_modules/next/server.js` line 15). Reached by its deep path because the
 * bare specifier `next/server` has no ESM resolution outside a bundler — the
 * same `next/headers` vs `next/headers.js` gotcha previewToken.test.ts records.
 * That resolution boundary is exactly why the gate takes `connection` as a
 * parameter instead of importing it.
 */
const { connection } = await import('next/dist/server/request/connection.js');

/**
 * Next's REAL response-header composer, the single function that turns a
 * collected `revalidate` into the string a CDN acts on
 * (`next/dist/server/lib/cache-control.js`). Layer 2b below asserts on its
 * output rather than on the internal number, because "no `s-maxage`" is the
 * property CloudFront actually obeys and an internal 0 is only a proxy for it.
 */
const { getCacheControlHeader } = await import('next/dist/server/lib/cache-control.js');

/** The gate, wired the way `renderGate.ts` wires it. */
const enforceDynamicUnlessIsr = () => optOutOfPrerenderUnlessIsr(connection);

/** The degraded-render bail, wired the way `renderGate.ts` wires it. */
const bailOutOfCachingDegradedRender = () => optOutOfCachingDegradedRender(connection);

type TestWorkStore = WorkStore & { dynamicUsageDescription?: string };

function makeWorkStore(): TestWorkStore {
  // `as unknown as`: WorkStore declares ~30 fields a real render populates;
  // `connection()` reads only these. Same tradeoff as previewToken.test.ts.
  return {
    route: '/',
    forceStatic: false,
    forceDynamic: false,
    dynamicShouldError: false,
  } as unknown as TestWorkStore;
}

/**
 * Run `fn` the way Next runs a build-time prerender of a non-force-dynamic
 * route, or the way it re-renders an ISR route at runtime when the cached entry
 * has expired or been tag-purged. Both are the SAME work unit store type: for a
 * route Next classified SSG, `base-server` sets `supportsDynamicResponse = false`
 * (`!isSSG`), which makes `isStaticGeneration` true and selects
 * `prerender-legacy`. That equivalence is why this store is the right subject —
 * the 2026-08-31 incident render was a runtime revalidation, not a build.
 *
 * `initialRevalidate` seeds the store the way the route's `export const
 * revalidate = 300` literal does, so the collected value is the real one.
 */
async function underPrerender<T>(
  fn: () => Promise<T>,
  initialRevalidate: number | false = false,
): Promise<{ store: TestWorkStore; prerenderRevalidate: unknown; error?: unknown }> {
  const store = makeWorkStore();
  // `as unknown as`: the prerender store union is not exported.
  const prerenderStore = {
    type: 'prerender-legacy',
    phase: 'render',
    rootParams: {},
    implicitTags: undefined,
    revalidate: initialRevalidate,
  } as unknown as Parameters<typeof workUnitAsyncStorage.run>[0] & { revalidate: unknown };

  return workAsyncStorage.run(store, () =>
    workUnitAsyncStorage.run(prerenderStore, async () => {
      try {
        await fn();
        return { store, prerenderRevalidate: prerenderStore.revalidate };
      } catch (error) {
        return { store, prerenderRevalidate: prerenderStore.revalidate, error };
      }
    }),
  );
}

/** Run `fn` the way Next runs a live request render. */
async function underRequest<T>(fn: () => Promise<T>): Promise<{ error?: unknown }> {
  const store = makeWorkStore();
  // `as unknown as`: the request store type is not exported either.
  const requestStore = {
    type: 'request',
    phase: 'render',
    implicitTags: undefined,
  } as unknown as Parameters<typeof workUnitAsyncStorage.run>[0];

  return workAsyncStorage.run(store, () =>
    workUnitAsyncStorage.run(requestStore, async () => {
      try {
        await fn();
        return {};
      } catch (error) {
        return { error };
      }
    }),
  );
}

/**
 * Run `fn` inside an arbitrary work unit store type. Used for the two build-time
 * scopes where `connection()` is ILLEGAL and throws a plain `Error` rather than
 * a `DynamicServerError`: `generate-static-params` (E1125) and `unstable-cache`
 * (E840). `src/app/[slug]/page.tsx`'s `generateStaticParams()` calls
 * `getSiteData()`, so the first of those is on the real fleet build path the
 * moment the upstream is down during a build.
 */
async function underWorkUnitStore<T>(
  type: 'generate-static-params' | 'unstable-cache',
  fn: () => Promise<T>,
): Promise<{ error?: unknown }> {
  const store = makeWorkStore();
  // `as unknown as`: none of the work unit store variants are exported.
  const unitStore = {
    type,
    phase: 'render',
    implicitTags: undefined,
  } as unknown as Parameters<typeof workUnitAsyncStorage.run>[0];

  return workAsyncStorage.run(store, () =>
    workUnitAsyncStorage.run(unitStore, async () => {
      try {
        await fn();
        return {};
      } catch (error) {
        return { error };
      }
    }),
  );
}

/**
 * Reproduce Next's own collected-revalidate → response-header pipeline, using
 * the real header composer at the end of it.
 *
 * The middle step is `applyMetadataFromPrerenderResult`
 * (`next/dist/server/app-render/app-render.js`): a collected revalidate of 0
 * becomes `{ revalidate: 0, expire: undefined }`, anything else becomes
 * `{ revalidate, expire }`. `base-server.pipeImpl` then fills an undefined
 * `expire` from `nextConfig.expireTime` before `getCacheControlHeader` runs.
 */
function emittedCacheControl(collectedRevalidate: unknown, expireTime: number): string {
  const cacheControl =
    collectedRevalidate === 0
      ? { revalidate: 0, expire: expireTime }
      : { revalidate: collectedRevalidate as number | false, expire: expireTime };
  return getCacheControlHeader(cacheControl);
}

/**
 * Mutate `process.env` around a single call. Restores the previous value,
 * including "absent" — assigning `undefined` would leave the string
 * `"undefined"` behind and silently break every later test.
 */
async function withRenderMode<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const had = Object.prototype.hasOwnProperty.call(process.env, SITE_RENDER_MODE_ENV);
  const previous = process.env[SITE_RENDER_MODE_ENV];
  if (value === undefined) delete process.env[SITE_RENDER_MODE_ENV];
  else process.env[SITE_RENDER_MODE_ENV] = value;
  try {
    return await fn();
  } finally {
    if (had) process.env[SITE_RENDER_MODE_ENV] = previous;
    else delete process.env[SITE_RENDER_MODE_ENV];
  }
}

test('CONTROL: connection() DOES abort Next static generation', async () => {
  // Without this control the next test would be vacuous — it would pass even if
  // `connection()` were a no-op in this store.
  const { store, prerenderRevalidate, error } = await underPrerender(() => connection());
  assert.ok(error, 'connection() must throw during a prerender');
  assert.equal(store.dynamicUsageDescription, 'connection');
  assert.equal(prerenderRevalidate, 0);
});

test('gate OFF aborts static generation, which is what force-dynamic did', async () => {
  const { store, prerenderRevalidate, error } = await withRenderMode(undefined, () =>
    underPrerender(() => enforceDynamicUnlessIsr()),
  );
  assert.ok(error, 'with SITE_RENDER_MODE unset the route must not prerender');
  assert.equal(store.dynamicUsageDescription, 'connection');
  assert.equal(prerenderRevalidate, 0);
});

test('gate ON leaves the route prerenderable', async () => {
  const { store, prerenderRevalidate, error } = await withRenderMode(ISR_RENDER_MODE, () =>
    underPrerender(() => enforceDynamicUnlessIsr()),
  );
  assert.equal(error, undefined);
  assert.equal(store.dynamicUsageDescription, undefined);
  assert.equal(prerenderRevalidate, false, 'the prerender store must be left untouched');
});

test('a typo in the env value leaves the route dynamic, it does not half-enable ISR', async () => {
  const { store, error } = await withRenderMode('isr ', () =>
    underPrerender(() => enforceDynamicUnlessIsr()),
  );
  // ' isr ' trims to the opt-in value, so this one is ON. The interesting case
  // is a value that is NOT the opt-in value at all.
  assert.equal(error, undefined);
  assert.equal(store.dynamicUsageDescription, undefined);

  const typo = await withRenderMode('irs', () =>
    underPrerender(() => enforceDynamicUnlessIsr()),
  );
  assert.ok(typo.error, 'a misspelled value must fall back to dynamic');
});

test('gate OFF does not throw on a real request — it only blocks prerendering', async () => {
  // The failure this guards against is a gate that 500s every live page view.
  const { error } = await withRenderMode(undefined, () =>
    underRequest(() => enforceDynamicUnlessIsr()),
  );
  assert.equal(error, undefined);
});

/* ------------------------------------------------------------------ */
/*  Layer 2b: a degraded render must not be cacheable (Phase 4, B1)    */
/* ------------------------------------------------------------------ */

/**
 * The property under test is NOT "the bail function was called". It is the
 * value Next collects for the render, and the `Cache-Control` string that value
 * produces, so the assertions end at Next's real `getCacheControlHeader`.
 *
 * READ THIS BEFORE CHANGING THE FIRST TEST. A collected revalidate of 0 does
 * NOT mean the page answers with `private, no-cache, no-store`. That is what an
 * app ROUTE (`robots.txt`, `icon`, `sitemap.xml`) does. For an app PAGE that
 * Next classified SSG, `build/templates/app-page-runtime.js` instead throws
 * `E132` ("Page changed from static to dynamic at runtime"), which
 * `ResponseCache.revalidate` catches and answers by re-setting the PREVIOUS
 * GOOD entry with a 3..30s revalidate. Either way the degraded render is not
 * stored, which is the property. Measured both ways in
 * `docs/projects/isr-migration/phase4-blockers-result.md` (vivreal-hq).
 */
const CONFIGURED_EXPIRE_TIME = 3600;

test('a FALLBACK_SITE_DATA render collects revalidate 0, which is Next\'s "do not store"', async () => {
  // Seeded the way the route's `export const revalidate = 300` literal seeds it,
  // so this is the healthy value being taken AWAY, not an absent one.
  const { store, prerenderRevalidate, error } = await underPrerender(
    () => bailOutOfCachingDegradedRender(),
    ISR_REVALIDATE_SECONDS,
  );

  assert.equal(error, undefined, 'the bail itself must not surface as the render error');
  assert.equal(store.dynamicUsageDescription, 'connection', 'Next must have recorded the bail');
  assert.equal(prerenderRevalidate, 0, 'the collected revalidate must be 0, i.e. do not store');

  // What that value becomes on the wire for the app ROUTES that share this path.
  const header = emittedCacheControl(prerenderRevalidate, CONFIGURED_EXPIRE_TIME);
  assert.equal(header, 'private, no-cache, no-store, max-age=0, must-revalidate');
  assert.doesNotMatch(header, /s-maxage/, 'CloudFront stores anything carrying s-maxage');
  assert.doesNotMatch(header, /stale-while-revalidate/);
});

test('a HEALTHY render is still cacheable, so the fix does not cost the ISR win', async () => {
  // The healthy branch of `getSiteData()` never reaches the bail, so the store
  // keeps the route literal. Without this test the fix could be "make
  // everything uncacheable" and still pass the one above.
  const { store, prerenderRevalidate, error } = await underPrerender(
    async () => undefined,
    ISR_REVALIDATE_SECONDS,
  );

  assert.equal(error, undefined);
  assert.equal(store.dynamicUsageDescription, undefined, 'nothing may mark a healthy render dynamic');
  assert.equal(prerenderRevalidate, ISR_REVALIDATE_SECONDS);

  assert.equal(
    emittedCacheControl(prerenderRevalidate, CONFIGURED_EXPIRE_TIME),
    `s-maxage=${ISR_REVALIDATE_SECONDS}, stale-while-revalidate=${CONFIGURED_EXPIRE_TIME - ISR_REVALIDATE_SECONDS}`,
  );
});

test('the bail is inert on a live request, so it can never 500 a page view', async () => {
  // On a site that has NOT opted into ISR every affected route is dynamic, so
  // this is the store the bail lands in on the whole rest of the fleet.
  const { error } = await underRequest(() => bailOutOfCachingDegradedRender());
  assert.equal(error, undefined);
});

test('CONTROL: connection() DOES throw inside generateStaticParams and unstable_cache', async () => {
  // Without this control the two build-safety tests below would pass against a
  // bail that had quietly stopped calling `connection()` at all.
  for (const type of ['generate-static-params', 'unstable-cache'] as const) {
    const { error } = await underWorkUnitStore(type, () => connection());
    assert.ok(error, `connection() must throw in a ${type} store`);
  }
});

test('the bail does NOT fail a build that runs during an upstream outage', async () => {
  // `src/app/[slug]/page.tsx` calls `getSiteData()` from `generateStaticParams`.
  // With the upstream down at build time that reaches the fallback branch, and a
  // re-throwing implementation would hard-fail `next build` for every site in
  // the fleet — in exactly the conditions this fix exists to survive. Nothing is
  // lost by absorbing it: a `generate-static-params` scope produces no page
  // response, so there is no cache entry to opt out of.
  for (const type of ['generate-static-params', 'unstable-cache'] as const) {
    const { error } = await underWorkUnitStore(type, () => bailOutOfCachingDegradedRender());
    assert.equal(error, undefined, `the bail must be absorbed in a ${type} store`);
  }
});

/* ------------------------------------------------------------------ */
/*  Layer 3: the literal contract with the route files                 */
/* ------------------------------------------------------------------ */

/** Every route file the ISR gate touches. */
const GATED_ROUTES = [
  '../app/page.tsx',
  '../app/[slug]/page.tsx',
  '../app/[slug]/[itemId]/page.tsx',
  '../app/robots.tsx',
  '../app/sitemap.tsx',
  '../app/icon.tsx',
  '../app/apple-icon.tsx',
] as const;

const sourceOf = (rel: string) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');

test('every gated route exports the revalidate literal this module defines', () => {
  for (const rel of GATED_ROUTES) {
    assert.match(
      sourceOf(rel),
      // Trailing semicolon optional: icon.tsx / apple-icon.tsx are semicolon-free.
      new RegExp(`^export const revalidate = ${ISR_REVALIDATE_SECONDS};?$`, 'm'),
      `${rel} must export \`revalidate = ${ISR_REVALIDATE_SECONDS}\` as a literal`,
    );
  }
});

test('no gated route still exports `dynamic` — that would pin it, gate or no gate', () => {
  for (const rel of GATED_ROUTES) {
    assert.doesNotMatch(
      sourceOf(rel),
      /^export const dynamic\s*=/m,
      `${rel} must not export \`dynamic\``,
    );
  }
});

test('every gated route actually calls the gate', () => {
  for (const rel of GATED_ROUTES) {
    assert.match(
      sourceOf(rel),
      /await enforceDynamicUnlessIsr\(\);?/,
      `${rel} imports the gate but never awaits it`,
    );
  }
});

test('generateStaticParams is NOT gated on the env — an empty list 500s the fleet', () => {
  // The single most dangerous edit anyone could make to this phase. An
  // `if (gate off) return []` makes Next classify /[slug] as fully static, so
  // every request becomes an on-demand prerender and the render gate's
  // `connection()` throws inside it: measured, 45 DYNAMIC_SERVER_USAGE errors
  // and HTTP 500 on every /[slug] URL with SITE_RENDER_MODE unset.
  const slugRoute = sourceOf('../app/[slug]/page.tsx');
  const start = slugRoute.indexOf('export async function generateStaticParams');
  assert.ok(start >= 0, '[slug] must still export generateStaticParams');
  // The function body ends at the first closing brace in column 0.
  const body = slugRoute.slice(start).split(/^\}$/m)[0];
  assert.doesNotMatch(
    body,
    /return \[\]/,
    'generateStaticParams must never short-circuit to an empty list',
  );
});

test('renderGate passes the REAL connection to the gate', () => {
  // The one claim this suite cannot execute: `renderGate.ts` imports
  // `next/server`, which plain Node cannot resolve. Everything else about the
  // gate is driven for real above, against the same `connection` this pins.
  const gateSource = sourceOf('./renderGate.ts');
  assert.match(gateSource, /import \{ connection \} from 'next\/server';/);
  assert.match(gateSource, /return optOutOfPrerenderUnlessIsr\(connection\);/);
  assert.match(gateSource, /return optOutOfCachingDegradedRender\(connection\);/);
});

test('EVERY return of FALLBACK_SITE_DATA bails out of caching first', () => {
  // Structural, not a spot check: the regression this catches is a SECOND
  // fallback return being added later without the bail, which is how the
  // 2026-08-31 incident would come back. `src/lib/api/siteData/index.tsx` is
  // `server-only` and carries JSX, so the plain-Node runner cannot import it;
  // the mechanism it wires is driven for real in layer 2b.
  const siteDataSource = sourceOf('./api/siteData/index.tsx');
  const returns = [...siteDataSource.matchAll(/return FALLBACK_SITE_DATA;/g)];
  assert.ok(returns.length > 0, 'getSiteData must still have a fallback branch');
  for (const match of returns) {
    const before = siteDataSource.slice(0, match.index);
    assert.match(
      before,
      /await bailOutOfCachingDegradedRender\(\);\s*$/,
      'every `return FALLBACK_SITE_DATA` must be immediately preceded by the cache bail',
    );
  }
  assert.match(
    siteDataSource,
    /import \{ bailOutOfCachingDegradedRender \} from '@\/lib\/renderGate';/,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// getSiteMap()'s degraded branch — the reader blocker 1 left behind
//
// `src/lib/api/siteData/index.tsx` imports `server-only`, so `node --test`
// cannot load it and these claims are source-pinned, exactly as this suite
// already pins the route literals and next.config.ts above.
// ─────────────────────────────────────────────────────────────────────────────

const SITE_DATA_SOURCE = '../lib/api/siteData/index.tsx';

/** The body of `getSiteMap`, from its declaration to the end of the file. */
function getSiteMapBody(): string {
  const src = sourceOf(SITE_DATA_SOURCE);
  const start = src.indexOf('export const getSiteMap');
  assert.notEqual(start, -1, 'getSiteMap declaration not found — this pin is vacuous');
  return src.slice(start);
}

test('getSiteMap bails out of caching on the DEGRADED branch', () => {
  // Blocker 1 covered getSiteData() and was scoped to "these two only", which
  // left this reader behind. A metadata route is still PRERENDERED: in the
  // outage build sitemap.xml was the one route that stayed `○ 5m 1h` while
  // every other route correctly reclassified to `ƒ`. So a fleet build during
  // an Atlas episode bakes an EMPTY sitemap into the deployment and nothing
  // expires it, because it is a successful render of a legitimately-empty list.
  const body = getSiteMapBody();
  assert.match(
    body,
    /if \(!raw\?\.siteDetails\?\.values\) \{[\s\S]*?await bailOutOfCachingDegradedRender\(\);[\s\S]*?return \[\];[\s\S]*?\}/,
    'the !raw?.siteDetails?.values branch must bail before returning []',
  );
});

test('getSiteMap does NOT bail on the isDemoSite branch', () => {
  // The `[]` return is OVERLOADED and the bail must not be. A demo site's
  // empty sitemap is correct, cacheable, and must stay prerendered; bailing
  // there would drag every demo build dynamic for no reason.
  const body = getSiteMapBody();
  const demoIndex = body.indexOf('if (isDemoSite(siteData))');
  assert.notEqual(demoIndex, -1, 'isDemoSite branch not found — this pin is vacuous');
  // Everything from the demo guard to the end of that statement.
  const demoBranch = body.slice(demoIndex, demoIndex + 200);
  assert.doesNotMatch(
    demoBranch,
    /bailOutOfCachingDegradedRender/,
    'a legitimate demo must stay prerendered',
  );
});

test('getSiteMap imports the bail from the one place it is bound to real Next', () => {
  assert.match(
    sourceOf(SITE_DATA_SOURCE),
    /^import \{ bailOutOfCachingDegradedRender \} from '@\/lib\/renderGate';$/m,
    'must use the shared binding, never a local connection() call',
  );
});

test('next.config.ts pins expireTime, so nobody inherits Next\'s one-year default', () => {
  // Phase 4 blocker 2. Next's default `expireTime` is 31536000, and
  // `getCacheControlHeader` emits `expire - revalidate`, which is where the
  // fleet's `stale-while-revalidate=31535700` came from. CloudFront honours it:
  // an `s-maxage=300` object was measured being served at `Age: 599`.
  const configSource = fs.readFileSync(new URL('../../next.config.ts', import.meta.url), 'utf8');
  assert.match(
    configSource,
    new RegExp(`^\\s*expireTime: ${CONFIGURED_EXPIRE_TIME},$`, 'm'),
    'next.config.ts must set expireTime explicitly',
  );

  // The value is only meaningful through the header it produces.
  assert.equal(
    getCacheControlHeader({ revalidate: ISR_REVALIDATE_SECONDS, expire: CONFIGURED_EXPIRE_TIME }),
    's-maxage=300, stale-while-revalidate=3300',
  );
  assert.notEqual(
    getCacheControlHeader({ revalidate: ISR_REVALIDATE_SECONDS, expire: CONFIGURED_EXPIRE_TIME }),
    's-maxage=300, stale-while-revalidate=31535700',
  );
});

test('the revalidate literal stays under the 300s signed media-URL TTL', () => {
  // VR_Client_API signs media URLs with CLOUDFRONT_SIGNED_URL_TTL_SECONDS=300.
  // HTML cached longer than that can embed an already-expired link.
  assert.ok(ISR_REVALIDATE_SECONDS <= 300, 'raising this needs the signed-URL TTL raised first');
});

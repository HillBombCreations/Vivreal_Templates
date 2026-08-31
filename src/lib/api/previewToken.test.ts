import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PREVIEW_ENABLE_PATH,
  PREVIEW_QUERY_PARAM,
  PREVIEW_TOKEN_COOKIE,
  buildPreviewEnableUrl,
  isWellFormedPreviewToken,
  resolvePreviewRedirectTarget,
  resolvePreviewToken,
} from './previewToken.ts';

/**
 * The eligibility half of these tests drives NEXT'S REAL request APIs inside
 * NEXT'S REAL work stores:
 *
 *   draftMode() / cookies()            -- the actual next/headers exports
 *     -> workAsyncStorage + workUnitAsyncStorage  -- the actual stores a render runs in
 *       -> throwToInterruptStaticGeneration()      -- Next's actual bail-out
 *
 * That last one is the whole point. During a non-PPR prerender (work unit type
 * `prerender-legacy`), `cookies()` throws a `DynamicServerError` and stamps
 * `workStore.dynamicUsageDescription` — that IS how Next decides a route
 * cannot be prerendered. So "the public path is prerender-eligible" is not an
 * assertion here, it is an observation of Next's own bookkeeping: run the real
 * function in the real store and check that Next did not mark it dynamic.
 *
 * A source regex could not have caught the failure mode this guards against
 * (swapping the two lines in `resolvePreviewToken`), because both orders look
 * equally reasonable and nothing else in the app would break.
 *
 * These import Next internals on purpose, exactly as
 * `src/lib/cacheInvalidation.test.ts` does: the property under test is a fact
 * about Next 16, not about how our call site is spelled. `next` is pinned
 * `~16.3.0`; if an upgrade moves these modules the suite fails loudly, which
 * is the correct signal.
 *
 * `next/headers.js` (not `next/headers`) because Next's package.json has no
 * ESM export map entry for the bare specifier — the bundler resolves it, plain
 * Node does not. Same module either way.
 *
 * The Next imports below are DYNAMIC and ordered on purpose. Next's storage
 * modules capture `globalThis.AsyncLocalStorage` at load time and fall back to
 * a `FakeAsyncLocalStorage` whose `run()` throws when it is absent — which it
 * is in plain Node, where `AsyncLocalStorage` lives in `node:async_hooks` and
 * not on the global. Next's server bootstrap installs it
 * (`next/dist/server/node-environment-baseline.js`, "This file should be
 * imported before any others"); that module is side-effect-only and ships a
 * `.d.ts` with no exports, so its two relevant lines are reproduced below
 * rather than imported. Static `import` statements are hoisted above all of
 * this and would defeat the ordering.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { RequestCookies } from 'next/dist/server/web/spec-extension/cookies.js';
import type { WorkStore } from 'next/dist/server/app-render/work-async-storage.external';

// `as unknown as`: `globalThis` has no declared `AsyncLocalStorage` in a Node
// lib, which is the whole point — Next puts it there at runtime.
const globalWithAls = globalThis as unknown as {
  AsyncLocalStorage?: typeof AsyncLocalStorage;
};
globalWithAls.AsyncLocalStorage ??= AsyncLocalStorage;

const { cookies, draftMode } = await import('next/headers.js');
const { workAsyncStorage } = await import(
  'next/dist/server/app-render/work-async-storage.external.js'
);
const { workUnitAsyncStorage } = await import(
  'next/dist/server/app-render/work-unit-async-storage.external.js'
);

const TOKEN = 'Njg3OTM2YmVhZTQwZjk2MTFhMGM0NTlhOjE3NTYwMDAwMDAwMDA.'
  + '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

type TestWorkStore = WorkStore & {
  dynamicUsageDescription?: string;
};

/** A work store shaped like the one a real static generation pass creates. */
function makeWorkStore(): TestWorkStore {
  // `as unknown as`: WorkStore declares ~30 fields a real render populates.
  // `cookies()` and `draftMode()` read only these; building the rest would
  // test nothing extra. Same tradeoff as cacheInvalidation.test.ts.
  return {
    route: '/[slug]',
    forceStatic: false,
    forceDynamic: false,
    dynamicShouldError: false,
  } as unknown as TestWorkStore;
}

/**
 * Run `fn` the way Next runs a build-time prerender of a route with no
 * `force-dynamic`: work unit type `prerender-legacy`. In this store `cookies()`
 * aborts static generation and `draftMode()` reports disabled.
 */
async function underPrerender<T>(
  fn: () => Promise<T>,
): Promise<{ store: TestWorkStore; result?: T; error?: unknown }> {
  const store = makeWorkStore();
  // `as unknown as`: the prerender store union is not exported.
  const prerenderStore = {
    type: 'prerender-legacy',
    phase: 'render',
    rootParams: {},
    implicitTags: undefined,
    revalidate: false,
  } as unknown as Parameters<typeof workUnitAsyncStorage.run>[0];

  return workAsyncStorage.run(store, () =>
    workUnitAsyncStorage.run(prerenderStore, async () => {
      try {
        return { store, result: await fn() };
      } catch (error) {
        return { store, error };
      }
    }),
  );
}

/** Run `fn` the way Next runs a live request render, with the given cookies. */
async function underRequest<T>(
  cookieHeader: string,
  draftModeEnabled: boolean,
  fn: () => Promise<T>,
): Promise<T> {
  const store = makeWorkStore();
  const requestCookies = new RequestCookies(new Headers({ cookie: cookieHeader }));
  // `as unknown as`: the request store type is not exported either. `cookies()`
  // reads `.cookies`, `.phase` and (via areCookiesMutableInCurrentPhase)
  // `.type`; `draftMode()` reads `.draftMode`.
  const requestStore = {
    type: 'request',
    phase: 'render',
    cookies: requestCookies,
    draftMode: { isEnabled: draftModeEnabled },
    implicitTags: undefined,
  } as unknown as Parameters<typeof workUnitAsyncStorage.run>[0];

  return workAsyncStorage.run(store, () => workUnitAsyncStorage.run(requestStore, fn));
}

/* ------------------------------------------------------------------ */
/*  Prerender eligibility — the Phase 1 unlock                         */
/* ------------------------------------------------------------------ */

test('CONTROL: an unconditional cookies() read DOES abort Next static generation', async () => {
  // Without this control the test below would be vacuous: it proves the
  // harness can actually observe the ineligible pattern.
  const { store, error } = await underPrerender(async () => {
    await cookies();
    return null;
  });

  assert.ok(error, 'cookies() must throw during a prerender');
  assert.equal(
    store.dynamicUsageDescription,
    'cookies',
    'Next must have recorded the dynamic usage that makes a route unprerenderable',
  );
});

test('the public path reads no request data, so the route stays prerenderable', async () => {
  const { store, result, error } = await underPrerender(() =>
    resolvePreviewToken(draftMode, cookies),
  );

  assert.equal(error, undefined, 'the public path must not abort static generation');
  assert.equal(result, null, 'no draft mode means no preview token');
  assert.equal(
    store.dynamicUsageDescription,
    undefined,
    'Next must NOT have marked the render dynamic — this is prerender/ISR eligibility',
  );
});

/* ------------------------------------------------------------------ */
/*  The quota bypass — the hard constraint                             */
/* ------------------------------------------------------------------ */

test('a preview render resolves the token so it can be relayed to VR_Client_API', async () => {
  const token = await underRequest(`${PREVIEW_TOKEN_COOKIE}=${TOKEN}`, true, () =>
    resolvePreviewToken(draftMode, cookies),
  );

  assert.equal(
    token,
    TOKEN,
    'losing this loses previewBypass in VR_Client_API and bills the customer for their own preview',
  );
});

test('the token cookie alone, without draft mode, is NOT a preview', async () => {
  const token = await underRequest(`${PREVIEW_TOKEN_COOKIE}=${TOKEN}`, false, () =>
    resolvePreviewToken(draftMode, cookies),
  );

  assert.equal(token, null, 'a stray cookie must never bypass the cache on its own');
});

test('draft mode with an expired/absent token cookie degrades to a metered render', async () => {
  const token = await underRequest('other=1', true, () =>
    resolvePreviewToken(draftMode, cookies),
  );

  assert.equal(token, null, 'no token means no bypass claim — never a fabricated one');
});

test('a malformed cookie value is not forwarded as a token', async () => {
  const token = await underRequest(`${PREVIEW_TOKEN_COOKIE}=not-a-token`, true, () =>
    resolvePreviewToken(draftMode, cookies),
  );

  assert.equal(token, null);
});

/* ------------------------------------------------------------------ */
/*  Token shape filter                                                 */
/* ------------------------------------------------------------------ */

test('accepts the shape VR_Secure_API actually mints', () => {
  assert.equal(isWellFormedPreviewToken(TOKEN), true);
});

test('rejects shapes VR_Client_API could never verify', () => {
  for (const bad of [
    null,
    undefined,
    '',
    'nodot',
    '.onlysig',
    'onlypayload.',
    'payload.NOTHEX',
    'pay load.abc123',
    'payload.abc123; Path=/; Domain=evil.com',
    'payload.abc123\r\nSet-Cookie: x=1',
    `${'a'.repeat(600)}.abc123`,
  ]) {
    assert.equal(
      isWellFormedPreviewToken(bad as string | null | undefined),
      false,
      `must reject ${JSON.stringify(bad)}`,
    );
  }
});

/* ------------------------------------------------------------------ */
/*  Redirect target — open-redirect surface                            */
/* ------------------------------------------------------------------ */

test('keeps a same-origin path, query and hash', () => {
  assert.equal(resolvePreviewRedirectTarget('/shop/mugs?sort=price#top'), '/shop/mugs?sort=price#top');
});

test('strips the preview param so the redirect cannot loop', () => {
  assert.equal(
    resolvePreviewRedirectTarget(`/about?${PREVIEW_QUERY_PARAM}=${TOKEN}&x=1`),
    '/about?x=1',
  );
});

test('refuses every off-origin shape, including the WHATWG-parser bypasses', () => {
  for (const hostile of [
    'https://evil.com/',
    '//evil.com/',
    '/\\evil.com',
    '/\tevil.com',
    '/\nevil.com',
    '/\revil.com',
    'javascript:alert(1)',
    'about:/blank',
    '',
    null,
    undefined,
    'relative/no/leading/slash',
  ]) {
    assert.equal(
      resolvePreviewRedirectTarget(hostile as string | null | undefined),
      '/',
      `must refuse ${JSON.stringify(hostile)}`,
    );
  }
});

test('the enable URL is site-relative and carries a sanitised target', () => {
  const url = buildPreviewEnableUrl(TOKEN, 'https://evil.com/steal');
  assert.ok(url.startsWith(`${PREVIEW_ENABLE_PATH}?`), 'must be site-relative');
  const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
  assert.equal(params.get('token'), TOKEN);
  assert.equal(params.get('redirect'), '/');
});

/* ------------------------------------------------------------------ */
/*  Wiring pins                                                        */
/* ------------------------------------------------------------------ */

/**
 * `client.ts` imports `server-only` and `middleware.ts` imports `next/server`,
 * so `node --test` cannot load either. These pin only that each still reaches
 * the behaviour proven above — same tradeoff, for the same reason, as
 * src/app/[slug]/page.test.ts. Matched on names, never on formatting.
 */
const clientSource = fs.readFileSync(new URL('./client.ts', import.meta.url), 'utf8');
const middlewareSource = fs.readFileSync(
  new URL('../../middleware.ts', import.meta.url),
  'utf8',
);

test('client.ts resolves the preview token through the tested guarded read', () => {
  assert.match(clientSource, /resolvePreviewToken\(draftMode, cookies\)/);
});

test('client.ts no longer reads a preview HEADER — that was the ISR blocker', () => {
  assert.doesNotMatch(
    clientSource,
    /x-vivreal-preview-token/,
    'the middleware-injected header forced headers() on every public render',
  );
});

test('middleware.ts no longer injects the preview header', () => {
  // Matched on the constant, not on the literal header name: the file still
  // NAMES the retired header in the comment that explains why it went away,
  // and that explanation is worth more than the convenience of grepping a
  // string.
  assert.doesNotMatch(middlewareSource, /PREVIEW_REQUEST_HEADER/);
});

test('middleware.ts upgrades the legacy preview param into a draft-mode session', () => {
  assert.match(middlewareSource, /buildPreviewEnableUrl\(/);
});

const enableRouteSource = fs.readFileSync(
  new URL('../../app/api/preview/enable/route.ts', import.meta.url),
  'utf8',
);

test('the enable route starts a draft-mode session and stores the token', () => {
  assert.match(enableRouteSource, /\(await draftMode\(\)\)\.enable\(\)/);
  assert.match(enableRouteSource, /name: PREVIEW_TOKEN_COOKIE/);
});

test('the enable route redirects to a site-RELATIVE Location, never one built from request.url', () => {
  // The Amplify trap: inside SSR compute, the URL Next hands a ROUTE HANDLER
  // carries host localhost:3000, which is how every customer site briefly
  // 301'd to localhost in the 2026-08-29 .well-known/llms.txt regression.
  // (Middleware is different — Next's adapter relativizes a middleware
  // Location whose host matches the request, which is why the redirect in
  // middleware.ts may keep using NextResponse.redirect.)
  assert.match(enableRouteSource, /Location: target/);
  assert.doesNotMatch(
    enableRouteSource,
    /new URL\([^)]*request\.url/,
    'a Location resolved against request.url points at the compute host',
  );
});

test('the enable route validates both the token and the redirect target', () => {
  assert.match(enableRouteSource, /isWellFormedPreviewToken\(rawToken\)/);
  assert.match(enableRouteSource, /resolvePreviewRedirectTarget\(/);
});

test('the token cookie is httpOnly, site-wide, and bounded', () => {
  assert.match(enableRouteSource, /httpOnly: true/);
  assert.match(enableRouteSource, /path: '\/'/);
  assert.match(enableRouteSource, /maxAge: PREVIEW_TOKEN_MAX_AGE_SECONDS/);
});

test('the preview redirect is never stored by a shared cache', () => {
  // It carries a Set-Cookie and is per-visitor.
  assert.match(enableRouteSource, /'Cache-Control': 'no-store'/);
});

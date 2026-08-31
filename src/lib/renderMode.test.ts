import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ISR_RENDER_MODE,
  ISR_REVALIDATE_SECONDS,
  SITE_RENDER_MODE_ENV,
  isIsrRenderMode,
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

/** The gate, wired the way `renderGate.ts` wires it. */
const enforceDynamicUnlessIsr = () => optOutOfPrerenderUnlessIsr(connection);

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

/** Run `fn` the way Next runs a build-time prerender of a non-force-dynamic route. */
async function underPrerender<T>(
  fn: () => Promise<T>,
): Promise<{ store: TestWorkStore; prerenderRevalidate: unknown; error?: unknown }> {
  const store = makeWorkStore();
  // `as unknown as`: the prerender store union is not exported.
  const prerenderStore = {
    type: 'prerender-legacy',
    phase: 'render',
    rootParams: {},
    implicitTags: undefined,
    revalidate: false,
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
});

test('the revalidate literal stays under the 300s signed media-URL TTL', () => {
  // VR_Client_API signs media URLs with CLOUDFRONT_SIGNED_URL_TTL_SECONDS=300.
  // HTML cached longer than that can embed an already-expired link.
  assert.ok(ISR_REVALIDATE_SECONDS <= 300, 'raising this needs the signed-URL TTL raised first');
});

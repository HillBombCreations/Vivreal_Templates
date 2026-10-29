/**
 * Review B2 (owner ideas PR 11): a prerendered page never reads the address
 * query at runtime, so an owner adding a storefront to a cached page cannot
 * turn it into a 500. The runtime proof is the build check's
 * "cached page gains a storefront" case (scripts/isr-build-check.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { queryReadAllowed } from './queryReadDecision.ts';

const require = createRequire(import.meta.url);

test('ALLOW: a dynamic request render and the build prerender read the query', () => {
  assert.equal(queryReadAllowed({ type: 'request' }, { isBuildTimePrerendering: false }), true);
  assert.equal(queryReadAllowed({ type: 'prerender-legacy' }, { isBuildTimePrerendering: true }), true);
});

test('REFUSE: a runtime regeneration of a prerendered path never reads it; no store at all never reads it', () => {
  assert.equal(queryReadAllowed({ type: 'prerender-legacy' }, { isBuildTimePrerendering: false }), false);
  assert.equal(queryReadAllowed({ type: 'prerender-legacy' }, {}), false);
  assert.equal(queryReadAllowed(undefined, undefined), false);
  assert.equal(queryReadAllowed({ type: 'cache' }, { isBuildTimePrerendering: 'yes' }), false);
});

test('the Next internals the gate reads still exist (a Next bump that moves them fails here)', () => {
  const work = require('next/dist/server/app-render/work-async-storage.external.js');
  const unit = require('next/dist/server/app-render/work-unit-async-storage.external.js');
  assert.equal(typeof work.workAsyncStorage?.getStore, 'function');
  assert.equal(typeof unit.workUnitAsyncStorage?.getStore, 'function');
  const store = fs.readFileSync(require.resolve('next/dist/server/async-storage/work-store.js'), 'utf8');
  assert.match(store, /isBuildTimePrerendering: renderOpts\.isBuildTimePrerendering/, 'the build flag is still set on the work store');
  const types = fs.readFileSync(require.resolve('next/dist/server/app-render/work-unit-async-storage.external.d.ts'), 'utf8');
  assert.match(types, /readonly type: 'request';/);
});

test('REFUSE: every searchParams read in both routes is behind pageReadsQuery AND mayReadQuery', () => {
  for (const rel of ['../app/[slug]/page.tsx', '../app/[slug]/[itemId]/page.tsx']) {
    const src = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
    const gated = src.match(/pageReadsQuery\((composedPage|pageConfig|nestedPage)\) && mayReadQuery\(\) \? \(\(await searchParams\) \?\? \{\}\) : \{\}/g) ?? [];
    const plain = (src.match(/await searchParams/g) ?? []).length;
    const redirects = (src.match(/readableRedirectTarget\(slug, [a-zA-Z.]+, \(await searchParams\) \?\? \{\}\)/g) ?? []).length;
    assert.ok(gated.length > 0, rel);
    assert.equal(gated.length + redirects, plain, `${rel}: an ungated read`);
  }
});

test('the gate wrapper reads both stores through the pure decision and fails closed', () => {
  const src = fs.readFileSync(new URL('./queryReadGate.ts', import.meta.url), 'utf8');
  assert.match(src, /return queryReadAllowed\(workUnitAsyncStorage\.getStore\(\), workAsyncStorage\.getStore\(\)\);\s*\} catch \{\s*return false;/);
});

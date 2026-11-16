/**
 * TP-2 (release B, F270): the base path build setting. SW-B-H6's one input
 * table, checked against this repo's `readSiteBasePath` AND the renderer's
 * `normalizeBasePath`, so the two repos can never disagree on what a base path
 * is; then the SHIPPED `next.config.ts`, evaluated with the setting unset,
 * valid, and invalid.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as bindings from '@hillbombcreations/site-renderer/bindings';

/**
 * The two validators, read per test: at a base without TP-2 (or with a
 * renderer before 1.100.0) each row then fails on its own assertion, and the
 * config rows below still run, rather than the whole file failing to load.
 */
async function validators(): Promise<{ readSiteBasePath: (raw: string | undefined) => string; normalizeBasePath: (value: unknown) => string }> {
  const ns = (await import('./siteBasePath.ts').catch((err: unknown) => ({ loadError: String(err) }))) as Record<string, unknown>; // checked just below
  const renderer = bindings as unknown as Record<string, unknown>; // checked just below
  assert.equal(typeof ns.readSiteBasePath, 'function', `siteBasePath.ts exports readSiteBasePath ${String(ns.loadError ?? '')}`);
  assert.equal(typeof renderer.normalizeBasePath, 'function', 'the renderer exports normalizeBasePath (1.100.0)');
  return {
    readSiteBasePath: ns.readSiteBasePath as (raw: string | undefined) => string,
    normalizeBasePath: renderer.normalizeBasePath as (value: unknown) => string,
  };
}

const VALID = ['/help', '/a-b', '/x9', '/help-centre'];
const INVALID = ['/Help', '/HELP', '/help/', '/a/b', '/app', '/api', '/_next', '/docs', '/mcp', 'help', '/a--b', '//x', '/', '/ help', '/help ', '/-a', '/a-'];

test('[TP-2 ALLOW] unset or empty is no base path', async () => {
  const { readSiteBasePath } = await validators();
  assert.equal(readSiteBasePath(undefined), '');
  assert.equal(readSiteBasePath(''), '');
});

test('[TP-2 ALLOW] one lowercase segment is the base path, as the renderer reads it', async () => {
  const { readSiteBasePath, normalizeBasePath } = await validators();
  for (const value of VALID) {
    assert.equal(readSiteBasePath(value), value);
    assert.equal(normalizeBasePath(value), value, `renderer agrees on ${value}`);
  }
});

test('[TP-2 REFUSE] anything else throws with the SW-B text, and the renderer refuses it too', async () => {
  const { readSiteBasePath, normalizeBasePath } = await validators();
  for (const value of INVALID) {
    assert.throws(
      () => readSiteBasePath(value),
      { message: `SITE_BASE_PATH must be one lowercase path segment such as /help, got ${value}` },
      value,
    );
    assert.throws(() => normalizeBasePath(value), RangeError, `renderer refuses ${value}`);
  }
});

/** The SHIPPED config evaluated with `SITE_BASE_PATH` as given; a fresh module instance each time. */
async function shippedConfigWith(value: string | undefined): Promise<{ basePath?: unknown; env?: Record<string, unknown> }> {
  const prior = process.env.SITE_BASE_PATH;
  if (value === undefined) delete process.env.SITE_BASE_PATH;
  else process.env.SITE_BASE_PATH = value;
  try {
    // A template-literal import is typed as a module of unknown shape; the
    // fields read are checked by the assertions.
    const fresh: { default: { basePath?: unknown; env?: Record<string, unknown> } } = await import(
      `../../next.config.ts?base=${encodeURIComponent(value ?? 'unset')}`
    );
    return fresh.default;
  } finally {
    if (prior === undefined) delete process.env.SITE_BASE_PATH;
    else process.env.SITE_BASE_PATH = prior;
  }
}

test('[TP-2 ALLOW] unset: the config has no basePath key and inlines an empty base', async () => {
  const config = await shippedConfigWith(undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(config, 'basePath'), false);
  assert.equal(config.env?.VIVREAL_SITE_BASE_PATH, '');
});

test('[TP-2 ALLOW] /help: basePath /help, inlined as /help', async () => {
  const config = await shippedConfigWith('/help');
  assert.equal(config.basePath, '/help');
  assert.equal(config.env?.VIVREAL_SITE_BASE_PATH, '/help');
});

test('[TP-2 REFUSE] /help/, /HELP, /a/b, /app: evaluating the config throws with the SW-B text', async () => {
  for (const value of ['/help/', '/HELP', '/a/b', '/app']) {
    await assert.rejects(shippedConfigWith(value), {
      message: `SITE_BASE_PATH must be one lowercase path segment such as /help, got ${value}`,
    });
  }
});

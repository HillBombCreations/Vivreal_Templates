/**
 * TP-3 (release B, F270): the inlined base path and `sitePath`. Each case
 * evaluates a fresh instance of the module with `VIVREAL_SITE_BASE_PATH` as
 * `next.config.ts` would inline it, so the constant is read the way the build
 * reads it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

async function sitePathModuleWith(value: string | undefined): Promise<typeof import('./sitePath.ts')> {
  const prior = process.env.VIVREAL_SITE_BASE_PATH;
  if (value === undefined) delete process.env.VIVREAL_SITE_BASE_PATH;
  else process.env.VIVREAL_SITE_BASE_PATH = value;
  try {
    // A fresh instance per value; the shape is this module's own.
    return (await import(`./sitePath.ts?base=${encodeURIComponent(value ?? 'unset')}`)) as typeof import('./sitePath.ts');
  } finally {
    if (prior === undefined) delete process.env.VIVREAL_SITE_BASE_PATH;
    else process.env.VIVREAL_SITE_BASE_PATH = prior;
  }
}

const INPUTS = ['/', '/x', '/x?q=1#a', '/?q', '/#a', '//evil.com', '/\\evil.com', '/ x', '#a', '?q', 'x', 'https://vivreal.io/pricing', 'mailto:a@b.c', 'tel:1'];

test('[TP-3 ALLOW] unset and empty: SITE_BASE_PATH is "" and sitePath is the identity', async () => {
  for (const value of [undefined, '']) {
    const mod = await sitePathModuleWith(value);
    assert.equal(mod.SITE_BASE_PATH, '');
    for (const input of INPUTS) assert.equal(mod.sitePath(input), input, input);
  }
});

test('[TP-3 ALLOW] /help: site paths gain the base (SW-B-H7)', async () => {
  const mod = await sitePathModuleWith('/help');
  assert.equal(mod.SITE_BASE_PATH, '/help');
  assert.equal(mod.sitePath('/'), '/help');
  assert.equal(mod.sitePath('/api/contact'), '/help/api/contact');
  assert.equal(mod.sitePath('/x?q=1#a'), '/help/x?q=1#a');
  assert.equal(mod.sitePath('/?q'), '/help?q');
  assert.equal(mod.sitePath('/#a'), '/help#a');
});

test('[TP-3 REFUSE] /help: anything that is not a site path is never prefixed', async () => {
  const mod = await sitePathModuleWith('/help');
  for (const input of ['//evil.com', '/\\evil.com', '/ x', '#a', '?q', 'x', 'https://vivreal.io/pricing', 'mailto:a@b.c', 'tel:1']) {
    assert.equal(mod.sitePath(input), input, input);
  }
});

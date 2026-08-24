import { test } from 'node:test';
import assert from 'node:assert/strict';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`.
// Imports from siteOrigin.ts directly (not the ogImage.ts re-export), because
// ogImage.ts carries `import 'server-only'` — a Next.js build-time sentinel,
// not a real npm package, so it can't be resolved under plain `node --test`.
import { resolveOrigin, buildDetailUrl } from './siteOrigin.ts';

// resolveOrigin backs BOTH the indexed, crawler-cached surfaces (JSON-LD
// `url`, robots.txt `Sitemap:`, sitemap `<loc>` — `{ prefer: 'durable' }`)
// and OG/canonical metadata (`{ prefer: 'deployed' }`), via one function with
// a required discriminant instead of two identically-shaped functions a
// caller could swap without any compiler or lint signal.
//
// `durable` prefers a custom `domainName` over `domainInformation.live_url`:
// `live_url` is written by Vivreal_EventHandler's site-deploy pipeline and
// can durably hold the raw `*.amplifyapp.com` host (not just briefly — see
// the doc comment on `resolveOrigin` for the conditional-overwrite proof),
// while `domainName` is the durable, customer-authored value and is never
// written as an amplifyapp host. `deployed` reverses that order because
// `live_url` is populated for every deployed site (including subdomain-only
// sites, which never get a `domainName`).

test('durable: a custom domainName wins over live_url', () => {
  const origin = resolveOrigin(
    {
      domainName: 'wavesofgrainco.com',
      domainInformation: { live_url: 'https://main.d1234abcd.amplifyapp.com' },
    },
    { prefer: 'durable' },
  );
  assert.strictEqual(origin, 'https://wavesofgrainco.com');
});

test('durable: a .vivreal.io subdomain site (no domainName) falls back to live_url', () => {
  const origin = resolveOrigin(
    {
      domainName: undefined,
      domainInformation: { live_url: 'https://classichousephx.vivreal.io' },
    },
    { prefer: 'durable' },
  );
  assert.strictEqual(origin, 'https://classichousephx.vivreal.io');
});

test('durable: a bare amplifyapp live_url with no domainName is refused, not emitted', () => {
  // Fixture E from the origin-unification review: no domainName, and
  // live_url durably holds an amplifyapp host (the `$.domain === ""` deploy
  // state-machine path). Refusing this is the defensive floor for a gap the
  // domainName-first precedence alone can't close — see the doc comment.
  const origin = resolveOrigin(
    {
      domainName: undefined,
      domainInformation: { live_url: 'https://stable.d1a2b3c4d5.amplifyapp.com' },
    },
    { prefer: 'durable' },
  );
  assert.strictEqual(origin, '');
});

test('deployed: live_url wins over domainName, including a durable amplifyapp host', () => {
  // OG/canonical metadata accepted an amplifyapp live_url before this
  // resolver existed (short-lived per-request rendering, not crawler-cached
  // for days) — 'deployed' mode is unchanged by the amplifyapp guard, which
  // is scoped to 'durable' only.
  const origin = resolveOrigin(
    {
      domainName: 'wavesofgrainco.com',
      domainInformation: { live_url: 'https://stable.d1a2b3c4d5.amplifyapp.com' },
    },
    { prefer: 'deployed' },
  );
  assert.strictEqual(origin, 'https://stable.d1a2b3c4d5.amplifyapp.com');
});

test('deployed: falls back to domainName when live_url is absent', () => {
  const origin = resolveOrigin(
    { domainName: 'wavesofgrainco.com', domainInformation: undefined },
    { prefer: 'deployed' },
  );
  assert.strictEqual(origin, 'https://wavesofgrainco.com');
});

test('neither domainName nor live_url ⇒ empty string, either mode', () => {
  assert.strictEqual(
    resolveOrigin({ domainName: undefined, domainInformation: undefined }, { prefer: 'durable' }),
    '',
  );
  assert.strictEqual(resolveOrigin(null, { prefer: 'durable' }), '');
  assert.strictEqual(resolveOrigin(undefined, { prefer: 'deployed' }), '');
});

test('NEXT_PUBLIC_SITE_URL env override wins over both, either mode', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://override.test/';
  try {
    const durable = resolveOrigin(
      { domainName: 'wavesofgrainco.com', domainInformation: { live_url: 'https://classichousephx.vivreal.io' } },
      { prefer: 'durable' },
    );
    const deployed = resolveOrigin(
      { domainName: 'wavesofgrainco.com', domainInformation: { live_url: 'https://classichousephx.vivreal.io' } },
      { prefer: 'deployed' },
    );
    assert.strictEqual(durable, 'https://override.test');
    assert.strictEqual(deployed, 'https://override.test');
  } finally {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  }
});

test('trailing slashes are stripped from both domainName and live_url sources', () => {
  assert.strictEqual(
    resolveOrigin({ domainName: 'acme.test/', domainInformation: undefined }, { prefer: 'durable' }),
    'https://acme.test',
  );
  assert.strictEqual(
    resolveOrigin(
      { domainName: undefined, domainInformation: { live_url: 'https://sub.vivreal.io/' } },
      { prefer: 'durable' },
    ),
    'https://sub.vivreal.io',
  );
});

test('buildDetailUrl composes the resolved (durable) origin with slug/itemId', () => {
  const url = buildDetailUrl(
    { domainName: 'wavesofgrainco.com', domainInformation: undefined },
    'menu',
    'abc123',
  );
  assert.strictEqual(url, 'https://wavesofgrainco.com/menu/abc123');
});

test('buildDetailUrl returns undefined when no origin is known', () => {
  const url = buildDetailUrl({ domainName: undefined, domainInformation: undefined }, 'menu', 'abc123');
  assert.strictEqual(url, undefined);
});

test('buildDetailUrl returns undefined when the only known origin is a bare amplifyapp live_url', () => {
  const url = buildDetailUrl(
    { domainName: undefined, domainInformation: { live_url: 'https://stable.d1a2b3c4d5.amplifyapp.com' } },
    'menu',
    'abc123',
  );
  assert.strictEqual(url, undefined);
});

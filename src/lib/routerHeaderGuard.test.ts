import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import nextConfig from '../../next.config.ts';

/**
 * Router-header refusal (design-templates-router-header-strip-2026-10-18.md,
 * Option B). The matrix runs the rules the SHIPPED config returns (the
 * default export, after `withSentryConfig`) through Next's OWN `matchHas`
 * from the installed `next`, so the `^1$` anchoring and the `missing`
 * semantics are the framework's, not a reimplementation of them.
 */

interface HeaderCondition {
  type: string;
  key: string;
  value?: string;
}
interface Rule {
  source: string;
  has?: HeaderCondition[];
  missing?: HeaderCondition[];
  destination: string;
}
type MatchHas = (
  req: { headers: Record<string, string> },
  query: Record<string, string>,
  has?: HeaderCondition[],
  missing?: HeaderCondition[],
) => false | Record<string, string>;

const require = createRequire(import.meta.url);
// cast: createRequire returns `any`; this is the 16.3.8 signature of the
// function `resolve-routes.js` calls for every config rewrite.
const { matchHas } = require('next/dist/shared/lib/router/utils/prepare-destination') as {
  matchHas: MatchHas;
};

const REFUSED_PATH = '/api/router-header-refused';
const FIVE_ROUTER_HEADERS = [
  'next-router-prefetch',
  'next-router-segment-prefetch',
  'next-router-state-tree',
  'next-url',
  'next-hmr-refresh',
];

async function configRewrites(): Promise<{ beforeFiles: Rule[]; afterFiles: Rule[] }> {
  const rewrites = await nextConfig.rewrites?.();
  if (!rewrites) return { beforeFiles: [], afterFiles: [] };
  // cast: NextConfig types rules loosely (`Rewrite`); only the fields read here matter.
  if (Array.isArray(rewrites)) return { beforeFiles: [], afterFiles: rewrites as Rule[] };
  return {
    beforeFiles: (rewrites.beforeFiles ?? []) as Rule[], // cast: as above
    afterFiles: (rewrites.afterFiles ?? []) as Rule[], // cast: as above
  };
}

function refusedBy(rules: Rule[], headers: Record<string, string>): boolean {
  return rules.some(
    (r) => r.destination === REFUSED_PATH && matchHas({ headers }, {}, r.has, r.missing) !== false,
  );
}

async function refused(headers: Record<string, string>): Promise<boolean> {
  return refusedBy((await configRewrites()).beforeFiles, headers);
}

const PAIR = {
  'next-router-prefetch': '1',
  'next-router-segment-prefetch': '/_tree',
};
const ALL_FIVE = {
  'next-router-prefetch': '1',
  'next-router-segment-prefetch': '/_tree',
  'next-router-state-tree': '%5B%22%22%5D',
  'next-url': '/about',
  'next-hmr-refresh': '1',
};

test('REFUSE R1: the prefetch pair without RSC', async () => {
  assert.equal(await refused({ ...PAIR }), true);
});

test('REFUSE R2: the pair with RSC: 0', async () => {
  assert.equal(await refused({ ...PAIR, rsc: '0' }), true);
});

test("REFUSE R3: the pair with a repeated RSC (Node joins it as '1, 1')", async () => {
  assert.equal(await refused({ ...PAIR, rsc: '1, 1' }), true);
});

for (const header of FIVE_ROUTER_HEADERS) {
  test(`REFUSE R4: ${header} alone, no RSC`, async () => {
    assert.equal(await refused({ [header]: '1' }), true);
  });
}

test('REFUSE R5: the pair with an empty RSC', async () => {
  assert.equal(await refused({ ...PAIR, rsc: '' }), true);
});

// PR #197 review pass 7, B1: Next treats `Next-Action` as a server action
// only on POST, so on a GET it must not switch the prefetch rules off.
test('REFUSE R6: the pair plus Next-Action, no RSC', async () => {
  assert.equal(await refused({ ...PAIR, 'next-action': '7f3a' }), true);
});

test('REFUSE R7: next-router-prefetch plus Next-Action, no RSC', async () => {
  assert.equal(await refused({ 'next-router-prefetch': '1', 'next-action': '7f3a' }), true);
});

for (const header of ['next-router-segment-prefetch', 'next-hmr-refresh']) {
  test(`REFUSE R8: ${header} plus Next-Action, no RSC`, async () => {
    assert.equal(await refused({ [header]: '1', 'next-action': '7f3a' }), true);
  });
}

test('ALLOW A1: a plain document request', async () => {
  assert.equal(await refused({ accept: 'text/html' }), false);
});

test('ALLOW A2: RSC: 1 with all five router headers (a real segment prefetch)', async () => {
  assert.equal(await refused({ ...ALL_FIVE, rsc: '1' }), false);
});

test('ALLOW A3: RSC: 1 alone (a real navigation)', async () => {
  assert.equal(await refused({ rsc: '1' }), false);
});

test('ALLOW A4: the server action shape (Next-Action, state tree, Next-Url, no RSC)', async () => {
  assert.equal(
    await refused({
      'next-action': '7f3a',
      'next-router-state-tree': '%5B%22%22%5D',
      'next-url': '/about',
    }),
    false,
  );
});

test('ALLOW A5: browser link prefetch (Purpose / Sec-Purpose)', async () => {
  assert.equal(await refused({ purpose: 'prefetch', 'sec-purpose': 'prefetch' }), false);
});

test('ALLOW A6: a plain request that only carries ?_rsc is not refused (owner decision 2026-10-18)', async () => {
  // Rules match on headers only, so the query string cannot trigger one.
  assert.equal(await refused({ accept: 'text/html' }), false);
  for (const rule of (await configRewrites()).beforeFiles) {
    for (const cond of [...(rule.has ?? []), ...(rule.missing ?? [])]) {
      assert.equal(cond.type, 'header', `rule ${JSON.stringify(rule)} conditions on headers only`);
    }
  }
});

test('W1: the shipped config wires exactly these rules as beforeFiles, and HSTS survives', async () => {
  const { routerHeaderRefusalRewrites, ROUTER_HEADER_REFUSED_PATH, ROUTER_HEADERS } = await import(
    './routerHeaderGuard.ts'
  );
  const { KEY_FILE_REWRITE } = await import('./indexnow/keyFileRewrite.ts');
  const { beforeFiles, afterFiles } = await configRewrites();
  // Discovery batch 2.2 appends the IndexNow key file rewrite AFTER the five
  // refusals, so a router-header request to /<key>.txt is still refused first.
  assert.deepEqual(beforeFiles, [...routerHeaderRefusalRewrites(), KEY_FILE_REWRITE]);
  assert.equal(beforeFiles.length, 6);
  assert.deepEqual(afterFiles, []);
  assert.equal(ROUTER_HEADER_REFUSED_PATH, REFUSED_PATH);
  assert.deepEqual([...ROUTER_HEADERS], FIVE_ROUTER_HEADERS);
  for (const rule of beforeFiles.slice(0, 5)) assert.equal(rule.source, '/:path*');

  const headers = (await nextConfig.headers?.()) ?? [];
  assert.ok(
    headers.some((h) =>
      h.headers.some((x) => x.key === 'Strict-Transport-Security' && x.value === 'max-age=31536000'),
    ),
    'HSTS still on the default export',
  );
});

// Controls: each mutation the design names must flip a case above, evaluated
// against a mutated COPY of the rules, never by editing the source.
test('CONTROL: dropping the rsc missing item would refuse A2 and A3', async () => {
  const rules = (await configRewrites()).beforeFiles.map((r) => ({
    ...r,
    missing: (r.missing ?? []).filter((m) => m.key !== 'rsc'),
  }));
  assert.equal(refusedBy(rules, { ...ALL_FIVE, rsc: '1' }), true);
  assert.equal(refusedBy(rules, { ...PAIR, rsc: '1' }), true);
});

test('CONTROL: dropping one header rule lets that header through alone', async () => {
  const rules = (await configRewrites()).beforeFiles.filter(
    (r) => !(r.has ?? []).some((h) => h.key === 'next-url'),
  );
  assert.equal(refusedBy(rules, { 'next-url': '/about' }), false);
});

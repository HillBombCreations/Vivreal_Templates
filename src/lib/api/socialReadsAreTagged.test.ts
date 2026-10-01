import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * B1.6 (docs/projects/isr-and-social-pass/plan.md) — A TRIPWIRE, NOT A BUILD.
 *
 * The tagged, cached read a social band needs ALREADY EXISTS. It is
 * `getIntegrationItems()` in `./collections/index.ts`, which calls
 * `clientFetchCached(..., integrationTags(SITE_ID, type))`, so both the tag
 * half and the webhook-invalidation half are already wired. Nothing here
 * builds a read path.
 *
 * What this file exists to stop is the shape that WAS in the tree until B1.1:
 * `src/lib/api/social/index.tsx` read `/tenant/integrationObjects` through
 * `clientFetchSafe`, which takes no tags. `/api/revalidate`'s `tagsForEvent`
 * only ever emits `site:<id>` and `integration:<type>`, so NO webhook could
 * ever have cleared that entry. On a dynamic site that is invisible; the
 * moment Part A flips a site to `SITE_RENDER_MODE=isr` it freezes the band at
 * the build artifact and a stale band is indistinguishable from a stale page.
 *
 * Deleting the reader removed the problem. This keeps it removed.
 *
 * WHY A SOURCE SCAN RATHER THAN A UNIT TEST. Every module under `src/lib/api`
 * is `server-only` and imports `next/*`, so `node --test` cannot load any of
 * them. `./cacheTags.test.ts` already takes this tradeoff for the same reason.
 *
 * TEST FILES ARE EXCLUDED FROM THE SCAN, deliberately and narrowly: this file
 * has to be able to WRITE the forbidden shape to prove the checker catches it,
 * and a test is not a render path. A violation hidden inside a `.test.ts` is
 * out of scope here by construction.
 */

const API_DIR = fileURLToPath(new URL('.', import.meta.url));

/** The path every integration-object read goes to, social or otherwise. */
const INTEGRATION_OBJECTS_PATH = '/tenant/integrationObjects';

/**
 * Callers that CANNOT carry a cache tag. `clientFetchCached` is deliberately
 * absent: it is the only one that takes a `tags` argument, and it is the
 * answer rather than the defect. The alternation is ordered longest-first so
 * `clientFetchSafe` is never half-matched as `clientFetch`, and it is
 * case-sensitive so `clientFetchCached` cannot match the bare `fetch` arm.
 */
const UNTAGGED_CALLER = /\b(clientFetchSafe|clientFetch|fetch)\s*(?:<[^>]*>)?\s*\(/g;

/**
 * The first argument of the call that starts at `openParen`, as written.
 *
 * Reads to the first top-level comma (or the closing paren), tracking bracket
 * depth and skipping over string / template-literal bodies, so a path built
 * with `${params}` or a call nested in the argument cannot end the scan early.
 * A fixed-width window would also work most days and would silently read the
 * NEXT call's path on a tightly packed file, which is the kind of near-miss
 * this file is supposed to be immune to.
 */
function firstArgument(source: string, openParen: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openParen; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth += 1; continue; }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openParen + 1, i);
      continue;
    }
    if (ch === ',' && depth === 1) return source.slice(openParen + 1, i);
  }
  return source.slice(openParen + 1);
}

interface Violation {
  file: string;
  caller: string;
}

/** Every `.ts` / `.tsx` file under `dir`, recursively, tests excluded. */
function collectSources(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
    const full = path.join(entry.parentPath ?? dir, entry.name);
    out.set(path.relative(dir, full).split(path.sep).join('/'), fs.readFileSync(full, 'utf8'));
  }
  return out;
}

/** Every read of `/tenant/integrationObjects` through a caller that takes no tags. */
function findUntaggedIntegrationReads(sources: Map<string, string>): Violation[] {
  const violations: Violation[] = [];
  for (const [file, source] of sources) {
    for (const match of source.matchAll(UNTAGGED_CALLER)) {
      const openParen = match.index + match[0].length - 1;
      if (firstArgument(source, openParen).includes(INTEGRATION_OBJECTS_PATH)) {
        violations.push({ file, caller: match[1] });
      }
    }
  }
  return violations;
}

/* ------------------------------------------------------------------ */
/*  B1.6-G — the gate                                                  */
/* ------------------------------------------------------------------ */

test('[B1.6-G] no integration-object read goes through an untagged fetch', () => {
  const sources = collectSources(API_DIR);

  // The scan path itself, asserted before the result is trusted. A walk that
  // found nothing reports zero violations and looks identical to a clean tree.
  assert.ok(
    sources.has('collections/index.ts'),
    'the scan did not reach src/lib/api/collections/index.ts, so its zero means nothing',
  );
  assert.match(
    sources.get('collections/index.ts')!,
    /clientFetchCached<[\s\S]*?integrationTags\(SITE_ID, storedType\)/,
    'getIntegrationItems() must still be the cached+tagged read this gate assumes exists',
  );

  const violations = findUntaggedIntegrationReads(sources);
  assert.deepEqual(
    violations,
    [],
    `untagged integration-object read(s): ${violations.map((v) => `${v.file} (${v.caller})`).join(', ')}`,
  );
});

/* ------------------------------------------------------------------ */
/*  B1.6-C — the control, which proves the gate can go red             */
/* ------------------------------------------------------------------ */

test('[B1.6-C] the checker reports a poisoned file written into a scanned tree', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-social-tag-scan-'));
  try {
    fs.mkdirSync(path.join(dir, 'nested'), { recursive: true });
    // Written to DISK and found by the same walk, not handed to the predicate
    // directly: the failure this control has to be able to see is a walk that
    // reaches no files, and an in-memory fixture would pass through a broken
    // walk untouched.
    fs.writeFileSync(
      path.join(dir, 'nested', 'poisoned.ts'),
      [
        "import { clientFetchSafe } from '../client';",
        'export async function readPosts() {',
        '  return clientFetchSafe<{ items: unknown[] }>(',
        '    `/tenant/integrationObjects?type=instagram`,',
        '    { items: [] },',
        '  );',
        '}',
      ].join('\n'),
    );

    const violations = findUntaggedIntegrationReads(collectSources(dir));
    assert.deepEqual(violations, [{ file: 'nested/poisoned.ts', caller: 'clientFetchSafe' }]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('[B1.6-C] the cached+tagged caller is NOT reported, so the gate is not vacuous', () => {
  // The other half of the control. A checker that flagged everything would
  // also pass the poisoned-fixture test above while making the real gate
  // unpassable, so the allow case has to be asserted beside the refuse case.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-social-tag-scan-ok-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'allowed.ts'),
      [
        'export async function readPosts() {',
        '  return clientFetchCached<{ items: unknown[] }>(',
        '    `/tenant/integrationObjects?${params}`,',
        '    { items: [] },',
        '    SITE_CACHE_TTL_SECONDS,',
        '    undefined,',
        '    integrationTags(SITE_ID, type),',
        '  );',
        '}',
      ].join('\n'),
    );
    assert.deepEqual(findUntaggedIntegrationReads(collectSources(dir)), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------ */
/*  B1.1 — the deletion stays deleted                                  */
/* ------------------------------------------------------------------ */

/**
 * The Templates half of the renderer's `DetailPage/noSocialEmbeds.test.tsx`.
 * B1.1 deleted the whole `tiktokHandle` branch on `[slug]/[itemId]`, the
 * `src/lib/api/social` module behind it and the orphaned `TikTokFeed`
 * component that rendered its oEmbed HTML. Nothing in this app calls a social
 * platform while a page renders, on any surface, for any platform
 * (plan §6b.1), and these are the strings that would say otherwise.
 */
const SRC_DIR = fileURLToPath(new URL('../..', import.meta.url));

/**
 * THE HOST SET, not the TikTok set.
 *
 * This list used to be four `tiktok` tokens, because TikTok is what B1.1
 * happened to delete. The rule it enforces has never been about TikTok: it is
 * "nothing in this app calls a social platform while a page renders, on any
 * surface, FOR ANY PLATFORM" (plan section 6b.1). Keyed on one platform's
 * spellings, `instagram.com/oembed`, `graph.facebook.com` or an
 * `api.linkedin.com` call would have passed clean, and the next embed anyone
 * adds is likelier to be the Instagram one, because Instagram is the platform
 * owners ask for.
 *
 * HOSTS rather than function names, with the two deleted helper names kept
 * beside them. A host is what a render-time call has to contain and cannot
 * rename its way out of; a helper name only ever catches the exact code that
 * was removed once.
 *
 * `oembed` appears bare, which is the broadest entry here. It is safe TODAY
 * and that was measured rather than assumed: 2026-10-01, zero non-test files
 * under `src/` contain it, or any of the hosts below. If a legitimate mention
 * ever lands (a comment explaining why we do NOT embed, which is exactly the
 * shape that trips a text scan), narrow that one entry rather than deleting
 * the gate.
 */
const OUTBOUND_AT_RENDER = [
  // oEmbed and embed-script endpoints, by host.
  'tiktok.com/oembed',
  'tiktok.com/embed',
  'instagram.com/oembed',
  'instagram.com/embed',
  'facebook.com/plugins',
  'connect.facebook.net',
  'platform.twitter.com',
  'linkedin.com/oembed',
  'oembed',
  // Platform read APIs. A page render must never reach one: the synced copy
  // in our own store is the only social data a site may draw.
  'graph.facebook.com',
  'graph.instagram.com',
  'open.tiktokapis.com',
  'api.linkedin.com',
  // The two helpers B1.1 deleted, kept so the exact shape stays named.
  'getTikTokOEmbed',
  'getTikTokPosts',
];

/** Every forbidden token this source set contains, as `file: token`. */
function findOutboundCalls(sources: Map<string, string>): string[] {
  const found: string[] = [];
  for (const [file, source] of sources) {
    for (const token of OUTBOUND_AT_RENDER) {
      if (source.includes(token)) found.push(`${file}: ${token}`);
    }
  }
  return found;
}

test('[B1.1] no outbound social call survives anywhere under src/', () => {
  const sources = collectSources(SRC_DIR);

  // Positive control for the walk, paired with the token search below: a
  // string KNOWN to be in the tree must be found by the same scan, or a zero
  // on the forbidden tokens is a fact about the walk and not about the tree.
  const control = [...sources.values()].filter((s) => s.includes('getIntegrationItems')).length;
  assert.ok(control > 0, 'the src/ walk found no file mentioning getIntegrationItems');

  const found = findOutboundCalls(sources);
  assert.deepEqual(found, [], `outbound social call(s) back in the tree: ${found.join(', ')}`);
});

test('[B1.1-C] the widened token set catches a NON-TikTok embed planted in a scanned tree', () => {
  // The must-pass control for the widening itself. The gate above was green
  // the whole time it could see only TikTok, so "it reports nothing" is worth
  // exactly as much as proof that it CAN report something, per platform the
  // rule names.
  //
  // Written to DISK and found by the same walk, for the same reason the tag
  // control is: an in-memory fixture passes straight through a broken walk.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-social-outbound-'));
  try {
    const planted: Record<string, string> = {
      'ig.ts': "const html = await fetch('https://graph.facebook.com/v25.0/instagram_oembed?url=' + u);",
      'igEmbed.ts': "const src = 'https://www.instagram.com/embed.js';",
      'li.ts': "await fetch('https://api.linkedin.com/v2/posts');",
      'tt.ts': "await fetch('https://open.tiktokapis.com/v2/video/query/');",
      'fb.ts': "const sdk = 'https://connect.facebook.net/en_US/sdk.js';",
    };
    for (const [name, body] of Object.entries(planted)) {
      fs.writeFileSync(path.join(dir, name), body);
    }

    const found = findOutboundCalls(collectSources(dir));
    assert.deepEqual(
      [...new Set(found.map((f) => f.split(':')[0]))].sort(),
      Object.keys(planted).sort(),
      'every planted platform must be reported, not just the TikTok one',
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('[B1.1-C] an ordinary source file is NOT reported, so the widened set is not a blanket', () => {
  // The other half. A token list broad enough to match everything would pass
  // the plant test above while making the real gate unpassable, and the
  // broadest entry here is a bare `oembed`.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-social-outbound-ok-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'fine.ts'),
      [
        "import { getIntegrationItems } from './collections';",
        'export async function readPosts() {',
        "  const { items } = await getIntegrationItems('instagram', { limit: 100 });",
        '  return items;',
        '}',
      ].join('\n'),
    );
    assert.deepEqual(findOutboundCalls(collectSources(dir)), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------ */
/*  The wire crossing: the read must query the STORED spelling         */
/* ------------------------------------------------------------------ */

test('[wire] the integration read puts the canonical platform spelling on the query', () => {
  // A source pin for the reason every other pin in this file is one:
  // `collections/index.ts` imports `server-only`, so no test can call it.
  //
  // What it protects: `platform` is matched EXACTLY upstream and LinkedIn is
  // stored camelCase, so `type=linkedin` on the wire matches nothing, forever,
  // with nothing red anywhere. The canonicalisation is one line, and deleting
  // it is invisible in behaviour until an owner ticks LinkedIn.
  const code = collectSources(API_DIR).get('collections/index.ts');
  assert.ok(code, 'the scan did not reach collections/index.ts, so its silence means nothing');
  assert.match(
    code,
    /const storedType = canonicalIntegrationType\(type\);/,
    'the read must canonicalise the type before it goes anywhere',
  );
  assert.match(
    code,
    /params\.set\('type', storedType\)/,
    'and the QUERY must carry the canonical spelling, not the lower-cased key',
  );
});

test('[B1.1] the untagged social read module stays deleted', () => {
  assert.equal(
    fs.existsSync(path.join(API_DIR, 'social')),
    false,
    'src/lib/api/social is back — it is the untagged reader B1.1 deleted',
  );
});

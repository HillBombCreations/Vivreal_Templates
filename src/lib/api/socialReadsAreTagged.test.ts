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
    /clientFetchCached<[\s\S]*?integrationTags\(SITE_ID, type\)/,
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

const OUTBOUND_AT_RENDER = [
  'tiktok.com/oembed',
  'tiktok.com/embed.js',
  'getTikTokOEmbed',
  'getTikTokPosts',
];

test('[B1.1] no outbound social call survives anywhere under src/', () => {
  const sources = collectSources(SRC_DIR);

  // Positive control for the walk, paired with the token search below: a
  // string KNOWN to be in the tree must be found by the same scan, or a zero
  // on the forbidden tokens is a fact about the walk and not about the tree.
  const control = [...sources.values()].filter((s) => s.includes('getIntegrationItems')).length;
  assert.ok(control > 0, 'the src/ walk found no file mentioning getIntegrationItems');

  const found: string[] = [];
  for (const [file, source] of sources) {
    for (const token of OUTBOUND_AT_RENDER) {
      if (source.includes(token)) found.push(`${file}: ${token}`);
    }
  }
  assert.deepEqual(found, [], `outbound social call(s) back in the tree: ${found.join(', ')}`);
});

test('[B1.1] the untagged social read module stays deleted', () => {
  assert.equal(
    fs.existsSync(path.join(API_DIR, 'social')),
    false,
    'src/lib/api/social is back — it is the untagged reader B1.1 deleted',
  );
});

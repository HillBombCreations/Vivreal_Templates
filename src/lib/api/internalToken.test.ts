/**
 * Next release 2026-11, plan 3.F0, T4: WHERE the internal-meter token may be
 * minted. `client.ts` and `internalToken.ts` import `server-only` and
 * `next/*`, which `node --test` cannot load, so this pins the source shape;
 * the minting itself is driven for real in `internalTokenCore.test.ts` and the
 * header slot in `clientFetchCore.test.ts`.
 *
 * Rule (design section 5.3, review-t-pr224 note 1): a cached read mints
 * whichever route triggers the fill; the uncached readers never do.
 *  - `clientFetchCached` mints per upstream call (its `unstable_cache` closure,
 *    and the fresh shell read of RW-4), with no condition on the caller. A
 *    page render, the sitemap, an OG image, the
 *    icons and `/api/indexnow/urls` all reach it through `getSiteData` and the
 *    collection readers, and each fill is shared, by path, with page renders.
 *  - `clientFetch` / `clientFetchSafe` never mint, so a route that reads
 *    uncached is metered: `/api/shows` reads `/tenant/collectionObjects`
 *    through `clientFetchSafe` (`getShowsPaginated`), which Client would
 *    otherwise count as a render read.
 *  - No file under `src/app/api`, `src/app/mcp`, `src/app/.well-known` or
 *    `src/app/feeds` imports the minter or sets the header itself, and
 *    `buildClientFetchHeaders` drops one a caller sets.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../..');
/** Read lazily, so a missing file fails its own assertion rather than the whole file's load. */
const read = (rel: string) => {
  const file = path.join(here, rel);
  assert.ok(fs.existsSync(file), `${rel} exists`);
  return fs.readFileSync(file, 'utf8');
};
const client = read('client.ts');

/** The body of `export async function <name>` up to the next top-level `export`. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, `positive control: client.ts defines ${name}`);
  const next = source.indexOf('\nexport ', start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(ts|tsx|mjs)$/.test(e.name) ? [p] : [];
  });
}

test('ALLOW: clientFetchCached mints inside its data-cache closure, once', () => {
  const cached = functionBody(client, 'clientFetchCached');
  // Re-pointed for RW-4: the mint moved into `renderRead`, which the data-cache
  // closure and the fresh shell read (also a render read) both call, so there
  // is still one minter and it is still inside clientFetchCached.
  assert.match(
    cached,
    /const renderRead = async \(readPath: string\) =>\s*doClientFetch<T>\(CLIENT_API, readPath, null, init, await internalTokenFor\(readPath, init\)\);/,
  );
  assert.match(cached, /unstable_cache\(\s*async \(\) => renderRead\(path\),/);
  assert.match(cached, /const fresh = \(\) => renderRead\(versionedPath\(path, new Date\(\)\.toISOString\(\)\)\);/);
  assert.equal((client.match(/internalTokenFor\(/g) ?? []).length, 1, 'one call site in client.ts');
  assert.match(client, /import \{ internalTokenFor \} from '\.\/internalToken';/);
});

test('REFUSE: the uncached clientFetch and clientFetchSafe never mint', () => {
  for (const name of ['clientFetch', 'clientFetchSafe']) {
    const body = functionBody(client, name);
    assert.doesNotMatch(body, /internalTokenFor|INTERNAL_METER|x-vivreal-internal/, `${name} mints nothing`);
  }
  // clientFetch passes exactly four arguments, so the token slot stays null.
  assert.match(functionBody(client, 'clientFetch'), /return doClientFetch<T>\(CLIENT_API, path, await readPreviewToken\(\), init\);/);
});

test('REFUSE: only client.ts imports the minter; no route handler, MCP, .well-known or feed file imports it or sets the header', () => {
  const files = walk(src).filter((f) => !/\.test\.(ts|tsx|mjs)$/.test(f));
  assert.ok(files.length > 100, 'positive control: the walk found the source tree');
  const importers = files
    .filter((f) => /from ['"][^'"]*internalToken(Core)?(\.ts)?['"]/.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(src, f).split(path.sep).join('/'))
    .sort();
  assert.deepEqual(importers, ['lib/api/client.ts', 'lib/api/clientFetchCore.ts', 'lib/api/internalToken.ts']);
  for (const dir of ['app/api', 'app/mcp', 'app/.well-known', 'app/feeds']) {
    const routeFiles = walk(path.join(src, dir));
    assert.ok(routeFiles.length > 0, `positive control: ${dir} has files`);
    for (const f of routeFiles) {
      assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /internalToken|INTERNAL_METER|x-vivreal-internal/i, path.relative(src, f));
    }
  }
});

test('REFUSE: the minter is server-only and reads no NEXT_PUBLIC_ name', () => {
  const minter = read('internalToken.ts');
  assert.match(minter, /^import 'server-only';/, 'first line imports server-only');
  assert.match(minter, /readInternalMeterConfig\(process\.env\)/);
  for (const source of [minter, read('internalTokenCore.ts')]) {
    assert.doesNotMatch(source, /NEXT_PUBLIC_INTERNAL/);
  }
  // A minting failure never fails the read: the call is wrapped and returns null.
  assert.match(minter, /try \{\s*return await internalTokenForRequest\(CONFIG, path, init\?\.method, Date\.now\(\)\);\s*\} catch/);
});

test('ALLOW (review note 1): the cached read mints with no condition on its caller, so a route that fills the cache mints', () => {
  const cached = functionBody(client, 'clientFetchCached');
  // The only inputs to the mint are the path read and the init: nothing about which route is rendering.
  assert.match(cached, /await internalTokenFor\(readPath, init\)/);
  assert.doesNotMatch(cached, /internalTokenFor\([^)]*(route|caller|segment|pathname)/i);
  // Positive control that route handlers DO reach it: these routes read site data through
  // getSiteData, which reads through clientFetchCached.
  const siteData = read('siteData/index.tsx');
  assert.match(siteData, /clientFetchCached</, 'getSiteData reads through clientFetchCached');
  for (const rel of ['app/sitemap.xml/route.ts', 'app/api/indexnow/urls/route.ts', 'app/og/[slug]/route.tsx']) {
    assert.match(fs.readFileSync(path.join(src, rel), 'utf8'), /getSiteData/, `${rel} reads cached site data, so its fill mints`);
  }
});

test('REFUSE (review note 1): a route that reads uncached stays metered (/api/shows through clientFetchSafe)', () => {
  const shows = read('shows/index.tsx');
  const start = shows.indexOf('export async function getShowsPaginated');
  assert.ok(start >= 0, 'positive control: getShowsPaginated exists');
  const body = shows.slice(start, shows.indexOf('\nexport ', start + 1));
  assert.match(body, /clientFetchSafe</, 'the /api/shows reader is uncached');
  assert.doesNotMatch(body, /clientFetchCached</);
  assert.match(fs.readFileSync(path.join(src, 'app/api/shows/route.tsx'), 'utf8'), /getShowsPaginated/);
});

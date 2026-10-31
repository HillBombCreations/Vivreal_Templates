/**
 * Next release 2026-11, plan 3.F0, T4: WHERE the internal-meter token may be
 * minted. `client.ts` and `internalToken.ts` import `server-only` and
 * `next/*`, which `node --test` cannot load, so this pins the source shape;
 * the minting itself is driven for real in `internalTokenCore.test.ts` and the
 * header slot in `clientFetchCore.test.ts`.
 *
 * Rule (design section 5.3): minted only on the cached render read
 * (`clientFetchCached`), never on the uncached `clientFetch` / `clientFetchSafe`
 * that route handlers use (`/api/shows` reads `/tenant/collectionObjects`
 * through `clientFetchSafe`, which Client would otherwise count as a render
 * read), and never by anything under `src/app/api`, `src/app/mcp`,
 * `src/app/.well-known` or `src/app/feeds`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../..');
const read = (rel: string) => fs.readFileSync(path.join(here, rel), 'utf8');
const client = read('client.ts');
const minter = read('internalToken.ts');

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
  assert.match(
    cached,
    /unstable_cache\(\s*async \(\) => doClientFetch<T>\(CLIENT_API, path, null, init, await internalTokenFor\(path, init\)\),/,
  );
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

test('REFUSE: only client.ts imports the minter; no route handler, MCP, .well-known or feed file touches it', () => {
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
  assert.match(minter, /^import 'server-only';/, 'first line imports server-only');
  assert.match(minter, /readInternalMeterConfig\(process\.env\)/);
  for (const source of [minter, read('internalTokenCore.ts')]) {
    assert.doesNotMatch(source, /NEXT_PUBLIC_INTERNAL/);
  }
  // A minting failure never fails the read: the call is wrapped and returns null.
  assert.match(minter, /try \{\s*return await internalTokenForRequest\(CONFIG, path, init\?\.method, Date\.now\(\)\);\s*\} catch/);
});

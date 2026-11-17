/**
 * T-123 item 3 (F123, release B): no page reads reviews outside the snapshot
 * floor.
 *
 * The floor plan left "the reviews read" unfloored (site-first-read-fallback
 * plan 5.2 row 9: `getReviews` through the uncached `clientFetchSafe`). That
 * read had no caller since 3e51cc6 (2026-08-30); review sections render
 * through composePage's collection bindings, `getCollectionItems`, which reads
 * through `clientFetchCached` and so through the floor. The dead reader is
 * removed, so an unfloored reviews read cannot come back by a new call to it,
 * and the one uncached read left in src is pinned by name.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Source with block and line comments removed, so prose never counts as a call. */
function code(file: string): string {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'testSupport') out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

test('[T-123 item 3 REFUSE] the reviews module makes no uncached read', () => {
  const review = code(path.join(SRC, 'lib/api/review/index.tsx'));
  assert.doesNotMatch(review, /clientFetchSafe/);
  assert.doesNotMatch(review, /getReviews/);
});

test('[T-123 item 3 REFUSE] the only uncached clientFetchSafe read left in src is getShowsPaginated (the /api/shows route)', () => {
  const callers = sourceFiles(SRC)
    .filter((file) => !file.endsWith(path.join('lib', 'api', 'client.ts')))
    .filter((file) => /\bclientFetchSafe\s*[<(]/.test(code(file)))
    .map((file) => path.relative(SRC, file).split(path.sep).join('/'));
  assert.deepEqual(callers, ['lib/api/shows/index.tsx']);
});

test('[T-123 item 3 ALLOW] the review form still writes through createReview, and review sections read through the floored collection reader', () => {
  assert.match(code(path.join(SRC, 'app/api/review/route.tsx')), /createReview\(/);
  assert.match(code(path.join(SRC, 'lib/api/review/index.tsx')), /export async function createReview\(/);
  assert.match(code(path.join(SRC, 'lib/api/collections/index.ts')), /clientFetchCached<PaginatedResponse>\(/);
});

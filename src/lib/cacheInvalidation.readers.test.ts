import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FULL_READERS, KNOWN_READERS, readerClassFor } from './cacheInvalidation.ts';

/**
 * Every shell reader under `src/app` is declared (design section 6, review
 * pass 6 N4). `readerClassFor` gives FULL to a short allowlist and KNOWN to
 * everything else, so a page or route added later that reads the shell takes
 * KNOWN by default and nobody decides. This sweep walks `src/app` for every
 * file that reads the shell (`getSiteData`, `getSiteMap`,
 * `loadSitemapEntries`), derives the name Next gives its render
 * (`workStore.page`), and requires it in `FULL_READERS` or `KNOWN_READERS`.
 * The other direction too: a name in either list must still be a file that
 * reads the shell, so a rename cannot leave a stale entry that pins nothing.
 */

const APP_DIR = fileURLToPath(new URL('../app/', import.meta.url));
const SHELL_READ = /\b(getSiteData|getSiteMap|loadSitemapEntries)\b/;

/** Every `.ts` and `.tsx` source under `src/app`, as `src/app`-relative POSIX paths; tests excluded. */
function appSources(dir = APP_DIR, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) appSources(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(path.relative(APP_DIR, full).split(path.sep).join('/'));
  }
  return out;
}

/**
 * Next's name for the render a `src/app` file is (`workStore.page`), the
 * same names `FULL_READERS` holds: `[slug]/page.tsx` is `/[slug]/page`,
 * `og/[slug]/route.tsx` is `/og/[slug]/route`, the metadata files are routes
 * (`icon.tsx` is `/icon/route`, `robots.tsx` is `/robots.txt/route`). The
 * root `not-found.tsx` is `/_not-found/page` when an unknown address is asked
 * for directly. A layout, a nested not-found and any helper module render
 * inside another file's request and share its one resolution: `same-request`.
 */
function readerNameFor(relative: string): string | 'same-request' {
  const parts = relative.split('/');
  const base = (parts.pop() ?? '').replace(/\.tsx?$/, '');
  const dir = parts.length ? `/${parts.join('/')}` : '';
  if (base === 'page') return `${dir}/page`;
  if (base === 'route') return `${dir}/route`;
  if (base === 'not-found') return dir === '' ? '/_not-found/page' : 'same-request';
  if (base === 'icon' || base === 'apple-icon') return `${dir}/${base}/route`;
  if (base === 'robots') return `${dir}/robots.txt/route`;
  if (base === 'sitemap') return `${dir}/sitemap.xml/route`;
  return 'same-request';
}

test('control: the name derivation matches the names the fence uses, and the read pattern sees a call', () => {
  assert.equal(readerNameFor('[slug]/page.tsx'), '/[slug]/page');
  assert.equal(readerNameFor('og/[slug]/[itemId]/route.tsx'), '/og/[slug]/[itemId]/route');
  assert.equal(readerNameFor('page.tsx'), '/page');
  assert.equal(readerNameFor('icon.tsx'), '/icon/route');
  assert.equal(readerNameFor('robots.tsx'), '/robots.txt/route');
  assert.equal(readerNameFor('not-found.tsx'), '/_not-found/page');
  assert.equal(readerNameFor('layout.tsx'), 'same-request');
  assert.equal(readerNameFor('[slug]/not-found.tsx'), 'same-request');
  assert.ok(SHELL_READ.test('const siteData = await getSiteData();'));
  assert.ok(!SHELL_READ.test('getSiteDataFixture()'), 'a longer name is not a read');
});

test('REFUSE (section 6, N4): every src/app render that reads the shell is in FULL_READERS or KNOWN_READERS', () => {
  const readers = appSources().filter((relative) => SHELL_READ.test(fs.readFileSync(path.join(APP_DIR, relative), 'utf8')));
  assert.ok(readers.length >= 15, `the sweep found ${readers.length} shell readers; a sweep that finds few proves little`);
  assert.ok(readers.includes('[slug]/page.tsx'), 'control: the ordinary page reads the shell');
  const undeclared = readers
    .map((relative) => ({ relative, name: readerNameFor(relative) }))
    .filter(({ name }) => name !== 'same-request' && !FULL_READERS.has(name) && !KNOWN_READERS.has(name));
  assert.deepEqual(undeclared, [], 'a shell reader with no declared class: add it to FULL_READERS or KNOWN_READERS in cacheInvalidation.ts, with its reason');
});

test('REFUSE (N4): every declared reader is still a src/app render that reads the shell, and the two lists are disjoint', () => {
  const names = new Set(
    appSources()
      .filter((relative) => SHELL_READ.test(fs.readFileSync(path.join(APP_DIR, relative), 'utf8')))
      .map(readerNameFor),
  );
  for (const name of [...FULL_READERS, ...KNOWN_READERS]) {
    assert.ok(names.has(name), `${name} is declared but no src/app file renders it and reads the shell (renamed or removed?)`);
  }
  for (const name of FULL_READERS) assert.ok(!KNOWN_READERS.has(name), `${name} is in both lists`);
});

test('ALLOW (I6): the lists and the classifier agree', () => {
  for (const page of FULL_READERS) assert.equal(readerClassFor({ type: 'request' }, { page }), 'full', page);
  for (const page of KNOWN_READERS) assert.equal(readerClassFor({ type: 'request' }, { page }), 'known', page);
});

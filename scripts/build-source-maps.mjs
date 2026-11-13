/**
 * build-source-maps: remove the source maps `next build` leaves in the deploy
 * artifact (W-TPL-SIZE, open-backlog release 2026-11).
 *
 * WHY. Amplify counts every byte under `.next` except `.next/cache` against
 * its 230,686,720-byte output cap. Turbopack writes a `.map` beside every
 * server and edge chunk: on 37104dbf that was 452 files and about 92 MB of a
 * 210 MB artifact, the largest single share, and nothing reads them once the
 * build is over:
 *  - the server Amplify runs is `.next/standalone`, and Next's standalone copy
 *    already leaves the chunk maps out (0 of 309 there, 309 of 309 under
 *    `.next/server/chunks`, measured on 37104dbf);
 *  - nothing uploads them: `withSentryConfig` in next.config.ts sets
 *    `sourcemaps.disable: true`.
 * They stay for the whole of `next build`, so whatever reads them during the
 * build still can (Next's prerender error mapping, `enablePrerenderSourceMaps`,
 * is on by default in 16.4.1). That is why this is a sweep after the build
 * rather than turning source maps off in next.config.ts.
 *
 * ORDER. `build-with-snapshot.mjs` calls this only after `next build` has
 * exited 0, so anything that reads the maps inside the build (a source map
 * upload, if one is ever turned on) has finished first. A failed build is left
 * as it is.
 *
 * Plain JavaScript, no dependency: it runs inside `npm run build` on the build
 * image, which cannot import TypeScript.
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Delete every regular file whose name ends in `.map` under `<root>/.next`,
 * except under `<root>/.next/cache`, which is not part of the artifact.
 * Symbolic links are neither followed nor removed. A missing `.next` removes
 * nothing. Any other failure throws, so the build fails rather than shipping a
 * half-swept artifact. Returns the count and bytes removed.
 */
export function removeSourceMaps(root) {
  const nextDir = path.join(root, '.next');
  const cacheDir = path.join(nextDir, 'cache');
  let files = 0;
  let bytes = 0;
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      if (err?.code === 'ENOENT') return;
      throw err;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (full !== cacheDir) walk(full);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.map')) continue;
      bytes += fs.statSync(full).size;
      fs.unlinkSync(full);
      files += 1;
    }
  };
  walk(nextDir);
  return { files, bytes };
}

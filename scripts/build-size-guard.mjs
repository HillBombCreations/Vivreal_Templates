/**
 * build-size-guard: fail a Templates build BEFORE Amplify's output cap, and
 * say why (owner ideas fix-forward, 2026-10-30).
 *
 * WHY. Amplify refuses a build whose output passes 230,686,720 bytes with a
 * single line and no breakdown, after the build has already run. On
 * 2026-10-30 (promote run 41089220307) six sites failed it at 231 to 625 MB
 * because owner ideas T10 and T11 prerendered every inner page and up to 300
 * item pages. `src/lib/pages/prerenderBudget.ts` now limits what is listed;
 * this measures what the build actually wrote, so a wrong estimate there fails
 * here, by name, instead of at the cap.
 *
 * WHAT IS MEASURED. The parts of the artifact that depend on the site's
 * content: the prerendered page output under `.next/server/app` (`.html`,
 * `.rsc`, `.meta` and `.body` files and everything under a `.segments`
 * directory), plus BOTH copies of `site-snapshot.json` that
 * `build-with-snapshot.mjs` writes (`.next/server/app/` and
 * `.next/standalone/.next/server/app/`, up to 25 MiB each; review B1, #223).
 * The rest of the artifact (server code, `public/`, traced modules, Amplify's
 * own share) is the same on every site, `SITE_BASE_BYTES`. Counting only
 * content keeps the guard free of platform-specific constants: it reads the
 * same on Windows and on the Linux build image.
 *
 * Plain JavaScript, no dependency: it runs inside `npm run build` on the build
 * image, which cannot import TypeScript.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Amplify's limit on the build output, from its own error message. */
export const AMPLIFY_OUTPUT_CAP_BYTES = 230_686_720;

/**
 * The content-independent part of every site's artifact, measured 2026-10-30:
 * the 194 MB fitted on help.vivreal.io less its two snapshot copies
 * (2 x 1,804,385 bytes), which are now measured instead (review B1, #223).
 */
export const SITE_BASE_BYTES = 194_000_000 - 2 * 1_804_385;

/** The file `build-with-snapshot.mjs` writes, twin of `SNAPSHOT_FILE_NAME`. */
export const SNAPSHOT_FILE = 'site-snapshot.json';

/**
 * Content bytes past which the build fails. Base plus this is 221.9 MB,
 * 8.8 MB under the cap; the page budget plans for at most 20 MiB of pages.
 */
export const PRERENDER_FAIL_BYTES = 30 * 1024 * 1024;

/** Past this the build still succeeds but says it is close. */
export const PRERENDER_WARN_BYTES = 24 * 1024 * 1024;

const PRERENDER_FILE = /\.(?:html|rsc|meta|body)$/;

/**
 * Sum the content output: the prerender files under `<root>/.next/server/app`
 * and both snapshot copies. Returns the total (snapshot included), the page
 * count (one per `.html` or `.body`), the snapshot's share, and the largest
 * top-level entries so a failure names where the bytes went. A missing
 * directory or snapshot measures 0.
 */
export function measurePrerenderOutput(root) {
  const appDir = path.join(root, '.next', 'server', 'app');
  const byTop = new Map();
  let bytes = 0;
  let pages = 0;
  const walk = (dir, inSegments, top) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      if (err?.code === 'ENOENT') return;
      throw err;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const nextTop = top ?? entry.name.replace(/\.(?:html|rsc|meta|body|segments)$/, '');
      if (entry.isDirectory()) {
        walk(full, inSegments || entry.name.endsWith('.segments'), nextTop);
        continue;
      }
      if (!entry.isFile() || !(inSegments || PRERENDER_FILE.test(entry.name))) continue;
      const size = fs.statSync(full).size;
      bytes += size;
      if (!inSegments && /\.(?:html|body)$/.test(entry.name)) pages += 1;
      byTop.set(nextTop, (byTop.get(nextTop) ?? 0) + size);
    }
  };
  walk(appDir, false, null);
  // Not page output, so the walk above skips it: the snapshot, both copies.
  let snapshotBytes = 0;
  for (const dir of [appDir, path.join(root, '.next', 'standalone', '.next', 'server', 'app')]) {
    try {
      snapshotBytes += fs.statSync(path.join(dir, SNAPSHOT_FILE)).size;
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
    }
  }
  if (snapshotBytes > 0) {
    bytes += snapshotBytes;
    byTop.set(`${SNAPSHOT_FILE} x2`, snapshotBytes);
  }
  const largest = [...byTop.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { bytes, pages, largest, snapshotBytes };
}

/**
 * The verdict and the job-log line for one measurement. `ok: false` fails the
 * build; the line always prints, so every build log shows its headroom.
 */
export function judgePrerenderOutput({ bytes, pages, largest, snapshotBytes = 0 }) {
  const estimate = SITE_BASE_BYTES + bytes;
  const top = largest.map(([name, b]) => `/${name === 'index' ? '' : name} ${b}`).join(', ');
  const line =
    `build size: prerendered ${pages} pages, ${bytes} bytes with the snapshot's ${snapshotBytes} (fail at ${PRERENDER_FAIL_BYTES}); ` +
    `estimated output ${estimate} of Amplify's ${AMPLIFY_OUTPUT_CAP_BYTES}; largest: ${top || 'none'}`;
  if (bytes > PRERENDER_FAIL_BYTES) {
    return {
      ok: false,
      line:
        `${line}. FAILED before Amplify's output cap: this site's content output is too large. ` +
        'For pages, lower PRERENDER_PAGE_BUDGET_BYTES or raise PAGE_COST_FACTOR in src/lib/pages/prerenderBudget.ts; ' +
        'for the snapshot, lower SIZE_TRIM_BYTES in scripts/build-with-snapshot.mjs. ' +
        'The previous deployment stays live.',
    };
  }
  if (bytes > PRERENDER_WARN_BYTES) return { ok: true, line: `${line}. WARNING: close to the fail line` };
  return { ok: true, line };
}

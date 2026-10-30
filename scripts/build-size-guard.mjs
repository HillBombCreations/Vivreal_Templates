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
 * WHAT IS MEASURED. Only the prerendered page output under
 * `.next/server/app`: `.html`, `.rsc`, `.meta` and `.body` files and
 * everything under a `.segments` directory. That is the part that depends on
 * the site's content; the rest of the artifact (server code, `public/`, traced
 * modules, Amplify's own share) is the same on every site, about 194 MB
 * (measured on vivreal.io and help.vivreal.io, 2026-10-30). Counting only the
 * prerender output keeps the guard free of platform-specific constants: it
 * reads the same on Windows and on the Linux build image.
 *
 * Plain JavaScript, no dependency: it runs inside `npm run build` on the build
 * image, which cannot import TypeScript.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Amplify's limit on the build output, from its own error message. */
export const AMPLIFY_OUTPUT_CAP_BYTES = 230_686_720;

/** The content-independent part of every site's artifact, measured 2026-10-30. */
export const SITE_BASE_BYTES = 194_000_000;

/**
 * Prerendered bytes past which the build fails. Base plus this is 225.5 MB,
 * 5 MB under the cap; the page budget plans for about 23 MB.
 */
export const PRERENDER_FAIL_BYTES = 30 * 1024 * 1024;

/** Past this the build still succeeds but says it is close. */
export const PRERENDER_WARN_BYTES = 24 * 1024 * 1024;

const PRERENDER_FILE = /\.(?:html|rsc|meta|body)$/;

/**
 * Sum the prerender output under `<root>/.next/server/app`. Returns the total,
 * the page count (one per `.html` or `.body`), and the largest top-level
 * directories so a failure names where the bytes went. A missing directory
 * measures 0.
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
  const largest = [...byTop.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { bytes, pages, largest };
}

/**
 * The verdict and the job-log line for one measurement. `ok: false` fails the
 * build; the line always prints, so every build log shows its headroom.
 */
export function judgePrerenderOutput({ bytes, pages, largest }) {
  const estimate = SITE_BASE_BYTES + bytes;
  const top = largest.map(([name, b]) => `/${name === 'index' ? '' : name} ${b}`).join(', ');
  const line =
    `build size: prerendered ${pages} pages, ${bytes} bytes (fail at ${PRERENDER_FAIL_BYTES}); ` +
    `estimated output ${estimate} of Amplify's ${AMPLIFY_OUTPUT_CAP_BYTES}; largest: ${top || 'none'}`;
  if (bytes > PRERENDER_FAIL_BYTES) {
    return {
      ok: false,
      line:
        `${line}. FAILED before Amplify's output cap: this site prerenders too much. ` +
        'Lower PRERENDER_PAGE_BUDGET_BYTES or raise PAGE_COST_FACTOR in src/lib/pages/prerenderBudget.ts. ' +
        'The previous deployment stays live.',
    };
  }
  if (bytes > PRERENDER_WARN_BYTES) return { ok: true, line: `${line}. WARNING: close to the fail line` };
  return { ok: true, line };
}

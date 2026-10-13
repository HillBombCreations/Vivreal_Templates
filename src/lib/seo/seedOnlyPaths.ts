/**
 * W25 review C2 (owner decision, 2026-10-12): a page whose body is ENTIRELY
 * kit seed (a kit's privacy, terms or accessibility page whose every section
 * is "Placeholder policy text. Replace with your own before you go live.") is
 * not served. Its route answers a real 404, its links leave the Navbar and the
 * Footer (`hiddenPaths`), and the page list stops naming it, until the owner
 * writes real text.
 *
 * The verdict is the renderer's (`mayBeSeedOnlyPage`, `isSeedOnlyPage`, from
 * 1.85.8), injected here so this module stays import-free and runs under plain
 * `node --test` (the renderer's entry point cannot load there, see
 * `seedCopy.ts`). The server wrapper is `getSeedOnlyPaths.ts`.
 *
 * Cost: the renderer's pre-check needs no list data, so lists are read only
 * for the pages that pass it. On production data that is 9 of 465 pages
 * fleet-wide and at most 4 list reads on one site; most sites read none.
 *
 * Fail-closed towards SERVING the page: a page whose list read failed, or
 * whose emptiness is unknown, is never counted, so an upstream wobble can
 * never 404 a page or drop its links. The renderer already treats an empty
 * list as real content.
 */
import type { PageConfig } from '@/types/SiteData';

/** The renderer's two seed-only checks, in the shape this module calls them. */
export interface SeedOnlyRules {
  mayBeSeedOnlyPage: (page: PageConfig) => boolean;
  isSeedOnlyPage: (page: PageConfig, data: { getItems: (collectionId: string) => unknown[] }) => boolean;
}

/** What one page's list reads came back with (`buildPageContext`, narrowed). */
export interface SeedOnlyPageRead {
  getItems: (collectionId: string) => unknown[];
  listReadFailed: boolean;
  emptinessUnknown: boolean;
}

/** A site path for comparison: leading slash, no trailing slash, lower case. */
export function seedOnlyPathKey(path: string): string {
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return (trimmed.startsWith('/') ? trimmed : `/${trimmed}`).toLowerCase();
}

/** Called with what threw when a check fails open; the caller logs it. */
export type SeedOnlyErrorReport = (err: unknown, slug: string | undefined) => void;

/**
 * The `/<slug>` path of every page in `pages` that is seed-only. Lists are
 * read (through `readPage`) only for pages the pre-check cannot rule out, all
 * in parallel.
 *
 * Never throws. Every caller (the header, the footer, the page list, every
 * page route) would otherwise fail with it, so a throw from a list read or
 * from the renderer's rule fails OPEN: that page is not seed-only, and a throw
 * outside the per-page check hides nothing at all. Each failure is reported
 * through `onError`.
 */
export async function findSeedOnlyPaths(
  pages: readonly PageConfig[],
  rules: SeedOnlyRules,
  readPage: (page: PageConfig) => Promise<SeedOnlyPageRead>,
  onError: SeedOnlyErrorReport,
): Promise<string[]> {
  try {
    const candidates = pages.filter((page) => {
      if (typeof page?.slug !== 'string' || page.slug === '') return false;
      try {
        return rules.mayBeSeedOnlyPage(page);
      } catch (err) {
        onError(err, page.slug);
        return false;
      }
    });
    if (candidates.length === 0) return [];
    const verdicts = await Promise.all(
      candidates.map(async (page) => {
        try {
          const read = await readPage(page);
          if (read.listReadFailed || read.emptinessUnknown) return false;
          return rules.isSeedOnlyPage(page, { getItems: read.getItems });
        } catch (err) {
          onError(err, page.slug);
          return false;
        }
      }),
    );
    return candidates.filter((_, i) => verdicts[i]).map((page) => seedOnlyPathKey(`/${page.slug}`));
  } catch (err) {
    onError(err, undefined);
    return [];
  }
}

/** True when `slug` (a route's own slug, or a nested `a/b`) is one of `seedOnlyPaths`. */
export function isSeedOnlySlug(seedOnlyPaths: readonly string[], slug: string): boolean {
  return seedOnlyPaths.length > 0 && seedOnlyPaths.includes(seedOnlyPathKey(`/${slug}`));
}

/**
 * `entries` without any whose address is a seed-only page. The same array
 * when there are none, so every site with no seed-only page lists exactly as
 * before. An entry whose `url` does not parse is kept.
 */
export function withoutSeedOnlyEntries<T extends { url: string }>(entries: T[], seedOnlyPaths: readonly string[]): T[] {
  if (seedOnlyPaths.length === 0) return entries;
  const hidden = new Set(seedOnlyPaths.map(seedOnlyPathKey));
  return entries.filter((entry) => {
    let pathname: string;
    try {
      pathname = new URL(entry.url).pathname;
    } catch {
      // Not an absolute address, so it cannot name one of this site's pages: keep it as listed.
      return true;
    }
    return !hidden.has(seedOnlyPathKey(pathname));
  });
}

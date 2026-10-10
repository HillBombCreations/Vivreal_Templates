/**
 * The page list's XML, split past 1,000 addresses (v5 search R4, "paged
 * sitemap index past 1,000 URLs").
 *
 * WHY A ROUTE AND NOT NEXT'S `sitemap.ts`. Next's `generateSitemaps` serves
 * the parts at `/sitemap/<id>.xml` and nothing at `/sitemap.xml`, the one
 * address every live robots.txt advertises and the daily search check (R9)
 * reads. So `/sitemap.xml` is a route that answers the full list while it has
 * at most `SITEMAP_PAGE_SIZE` addresses (every site today) and an index of
 * `/sitemaps/<n>.xml` parts past that.
 *
 * The urlset is written the way Next wrote it (one element per line, ISO
 * `lastmod`), so a site under 1,000 addresses reads the same to a crawler.
 *
 * Pure, so it runs under `node --test`.
 */
import type { MetadataRoute } from 'next';

export const SITEMAP_PAGE_SIZE = 1_000;
export const SITEMAP_PART_PATH = '/sitemaps';

type Entry = MetadataRoute.Sitemap[number];

const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const xml = (value: string) => value.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);

function lastmod(value: Entry['lastModified']): string | undefined {
  if (value === undefined) return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

export function renderUrlset(entries: readonly Entry[]): string {
  const urls = entries.map((e) => {
    const mod = lastmod(e.lastModified);
    return [
      '<url>',
      `<loc>${xml(e.url)}</loc>`,
      ...(mod ? [`<lastmod>${mod}</lastmod>`] : []),
      ...(e.changeFrequency ? [`<changefreq>${e.changeFrequency}</changefreq>`] : []),
      ...(e.priority !== undefined ? [`<priority>${e.priority}</priority>`] : []),
      '</url>',
    ].join('\n');
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

export function renderSitemapIndex(origin: string, parts: number): string {
  const base = origin.replace(/\/+$/, '');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...Array.from({ length: parts }, (_, i) =>
      ['<sitemap>', `<loc>${xml(`${base}${SITEMAP_PART_PATH}/${i + 1}.xml`)}</loc>`, '</sitemap>'].join('\n'),
    ),
    '</sitemapindex>',
    '',
  ].join('\n');
}

/** How many parts a list needs past the limit (0 when it fits one file). */
export function sitemapPartCount(total: number): number {
  return total > SITEMAP_PAGE_SIZE ? Math.ceil(total / SITEMAP_PAGE_SIZE) : 0;
}

/** `/sitemap.xml`: the whole list, or the index once it is too long. */
export function rootSitemapXml(entries: readonly Entry[]): string {
  const parts = sitemapPartCount(entries.length);
  if (parts === 0) return renderUrlset(entries);
  return renderSitemapIndex(new URL(entries[0].url).origin, parts);
}

/** `/sitemaps/<n>.xml` (1-based), or `null` for a part that does not exist. */
export function partSitemapXml(entries: readonly Entry[], file: string): string | null {
  const match = /^([1-9][0-9]{0,5})\.xml$/.exec(file);
  if (!match) return null;
  const n = Number(match[1]);
  if (n > sitemapPartCount(entries.length)) return null;
  return renderUrlset(entries.slice((n - 1) * SITEMAP_PAGE_SIZE, n * SITEMAP_PAGE_SIZE));
}

/**
 * The trail a detail page's BreadcrumbList describes (search R3, seo-visibility
 * gap 11): Home, the list page, the item. Search shows it in place of the raw
 * address. The renderer's `breadcrumbListJsonLd` turns the trail into the
 * schema.org object and refuses a bad one (no origin, a nameless crumb, a path
 * off the site); this decides only WHICH crumbs, so it stays pure and
 * testable.
 */
import type { Crumb } from '@hillbombcreations/site-renderer';
import type { PageConfig, SiteData } from '@/types/SiteData';
import { isDemoSite } from './demoSafety.ts';
import { resolveSiteOrigin } from '../og/siteOrigin.ts';

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Home, then the list page under its visible name, then the item. */
export function detailCrumbs({
  page,
  slug,
  itemSegment,
  itemName,
}: {
  page: Pick<PageConfig, 'name' | 'labels'>;
  slug: string;
  itemSegment: string;
  itemName: string | undefined;
}): Crumb[] {
  const listPath = `/${slug.replace(/^\/+/, '')}`;
  return [
    { name: 'Home', path: '/' },
    { name: text(page.labels?.title) || text(page.name), path: listPath },
    { name: text(itemName), path: `${listPath}/${itemSegment}` },
  ];
}

/**
 * The durable origin the crumbs resolve against, or `''` on a prospect demo
 * (it emits no addresses at all, the same gate the site JSON-LD uses) and when
 * no origin is known. The renderer answers `null` for `''`, so no breadcrumb.
 */
export function breadcrumbOrigin(
  siteData: Pick<SiteData, 'canonicalUrl' | 'domainName' | 'domainInformation' | 'lifecycleState'>,
): string {
  if (isDemoSite(siteData)) return '';
  return resolveSiteOrigin(siteData, { surface: 'durable' });
}

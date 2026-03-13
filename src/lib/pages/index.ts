import 'server-only';
import type { PageConfig, SiteData } from '@/types/SiteData';

/**
 * Find a page config by its slug.
 */
export function getPageBySlug(siteData: SiteData, slug: string): PageConfig | undefined {
  return siteData.pageConfigs?.find((p) => p.slug === slug);
}

/**
 * Get all page configs (for generating navigation, sitemaps, etc.)
 */
export function getAllPages(siteData: SiteData): PageConfig[] {
  return siteData.pageConfigs ?? [];
}

/**
 * Get the href for linking to items within a page.
 * e.g., getItemHref(pageConfig, itemId) => "/events/abc123"
 */
export function getItemHref(page: PageConfig, itemId: string): string {
  return `/${page.slug}/${itemId}`;
}

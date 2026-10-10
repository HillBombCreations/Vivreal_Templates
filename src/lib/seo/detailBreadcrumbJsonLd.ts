import { breadcrumbListJsonLd } from '@hillbombcreations/site-renderer';
import type { PageConfig, SiteData } from '@/types/SiteData';
import { breadcrumbOrigin, detailCrumbs } from './breadcrumbs';

/**
 * A detail page's JSON-LD with its BreadcrumbList beside it (search R3), or
 * the page's JSON-LD alone when the renderer refuses the trail (a demo, no
 * origin, an item with no name). The trail is `./breadcrumbs.ts`.
 */
export function withDetailBreadcrumbs(
  schema: Record<string, unknown>,
  {
    siteData,
    page,
    slug,
    itemSegment,
    itemName,
  }: {
    siteData: SiteData;
    page: Pick<PageConfig, 'name' | 'labels'>;
    slug: string;
    itemSegment: string;
    itemName: string | undefined;
  },
): Record<string, unknown> | Array<Record<string, unknown>> {
  const crumbs = breadcrumbListJsonLd(
    breadcrumbOrigin(siteData),
    detailCrumbs({ page, slug, itemSegment, itemName }),
  );
  return crumbs ? [schema, { ...crumbs }] : schema;
}

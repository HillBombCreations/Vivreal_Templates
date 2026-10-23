import { breadcrumbListJsonLd } from '@hillbombcreations/site-renderer';
import type { PageConfig, SiteData } from '@/types/SiteData';
import { breadcrumbOrigin, detailCrumbs } from './breadcrumbs';

/**
 * A detail page's JSON-LD with its BreadcrumbList beside it (search R3), or
 * the page's JSON-LD alone when the renderer refuses the trail (a demo, no
 * origin, an item with no name). The trail is `./breadcrumbs.ts`.
 *
 * `schema` may be `null` (discovery batch 3.1/3.2: a show with no address, or
 * an item with no price and no body text, has no node of its own). The trail
 * alone is returned then, or `null` when there is no trail either, and the
 * `JsonLd` component renders nothing for `null`.
 */
export function withDetailBreadcrumbs(
  schema: Record<string, unknown> | null,
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
): Record<string, unknown> | Array<Record<string, unknown>> | null {
  const crumbs = breadcrumbListJsonLd(
    breadcrumbOrigin(siteData),
    detailCrumbs({ page, slug, itemSegment, itemName }),
  );
  if (!schema) return crumbs ? [{ ...crumbs }] : null;
  return crumbs ? [schema, { ...crumbs }] : schema;
}

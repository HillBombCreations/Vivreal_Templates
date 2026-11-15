import 'server-only';
import { eventRows, type ComposePageInput } from '@hillbombcreations/site-renderer';
import { buildListingEventsJsonLd } from '@/components/JsonLd/eventSchema';
import { siteOrganizationId } from '@/components/JsonLd/schema';
import { resolveSiteOrigin } from '@/lib/og/ogImage';
import type { SiteData } from '@/types/SiteData';

/**
 * Event JSON-LD for the rows this listing page draws (F33), or null for none.
 *
 * `input` must be the EXACT value handed to `composePage` for the page (the
 * caller's own overrides included), because `eventRows` plans the page the
 * same way and returns only the rows that composition draws: a past row the
 * list hides, a block that is off, a row past the item limit have no Event.
 * Every field of every Event comes from those rows, through the show rules
 * in `eventSchema.ts`; nothing here reads an item a second time.
 */
export function pageListingEventsJsonLd(
  siteData: SiteData,
  input: ComposePageInput,
  pagePath: string,
): Array<Record<string, unknown>> | null {
  const rows = eventRows(input.page, input.data, {
    ...input.options,
    pages: input.pages,
    ...(input.isHome !== undefined ? { isHome: input.isHome } : {}),
  });
  if (rows.length === 0) return null;
  const events = buildListingEventsJsonLd(rows, {
    origin: resolveSiteOrigin(siteData, { surface: 'durable' }) || null,
    pagePath,
    timezone: siteData.timezone,
    organizationId: siteOrganizationId(siteData),
  });
  return events.length > 0 ? events : null;
}

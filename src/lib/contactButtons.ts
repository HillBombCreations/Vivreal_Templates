/**
 * The slice of site data the renderer's `ContactButtons` reads (search R3):
 * the owner's switch, the phone and address, and the two palette tokens the
 * button is painted from. Handed over as a slice rather than the whole site
 * record because the Templates and renderer `SiteData` mirrors differ in
 * fields the bar never reads.
 */
import type { SiteData } from '@/types/SiteData';

export interface ContactButtonsSiteData {
  contactButtons?: boolean;
  /** RT5-181: with `pageConfigs` holding the inquiry page Inquire links to (renderer 1.85.4). */
  contactButtonsInquire?: true;
  pageConfigs?: Pick<SiteData['pageConfigs'][number], 'slug' | 'format'>[];
  businessInfo?: Pick<NonNullable<SiteData['businessInfo']>, 'address' | 'contactInfo'>;
  primary?: string;
  'text-inverse'?: string;
}

/**
 * Does the site mount another control fixed to the bottom of a phone screen?
 * Each clause is the mount condition `src/app/layout.tsx` uses for it:
 *   - an authored `utilityDock` (`fixed bottom-0`), already a bar with the
 *     phone and address;
 *   - a `fulfillmentStrip` with content (`fixed bottom-4`, the renderer's
 *     `fulfillmentStripHasContent`, mirrored because its entry point loads
 *     React): on Butter & Bloom it covered Call and Directions on every page
 *     (W25-6cb);
 *   - a FloatingCta (`fixed bottom-4` on phones): an authored `floatingCta`
 *     with a label and a link, or the restaurant template's own.
 * NOT the EdgeDock: it is hidden on phones, so the bar is the only Call there.
 */
function hasFixedBottomControl(siteData: SiteData): boolean {
  if (siteData.utilityDock) return true;
  const strip = siteData.fulfillmentStrip;
  if (strip && strip.enabled !== false && (strip.links ?? []).some((l) => l?.label?.trim() && l?.href?.trim())) {
    return true;
  }
  if (siteData.floatingCta?.label && siteData.floatingCta?.link) return true;
  return siteData.siteInfo?.templateType === 'restaurant';
}

/**
 * The slice, or `null` when the bar must not mount at all: another control
 * already sits at the bottom of the phone screen, and the bar would cover it
 * or be covered (`hasFixedBottomControl`). Whether the bar then draws (a phone
 * or an address, and the owner's switch not off) is the renderer's
 * `resolveContactButtons`.
 */
/**
 * The Inquire switch and the one page it reads, only for a site that turned it
 * on, so every other slice is exactly what it was. The renderer takes the first
 * `inquiry` page; the slice carries that page's slug and format and nothing else.
 */
function inquireSlice(siteData: SiteData): Pick<ContactButtonsSiteData, 'contactButtonsInquire' | 'pageConfigs'> {
  if (siteData.contactButtonsInquire !== true) return {};
  const page = (siteData.pageConfigs ?? []).find((p) => p?.format === 'inquiry');
  if (!page) return {};
  return { contactButtonsInquire: true, pageConfigs: [{ slug: page.slug, format: page.format }] };
}

export function contactButtonsSiteData(siteData: SiteData): ContactButtonsSiteData | null {
  if (hasFixedBottomControl(siteData)) return null;
  return {
    ...(siteData.contactButtons === undefined ? {} : { contactButtons: siteData.contactButtons }),
    ...inquireSlice(siteData),
    ...(siteData.businessInfo
      ? { businessInfo: { address: siteData.businessInfo.address, contactInfo: siteData.businessInfo.contactInfo } }
      : {}),
    ...(siteData.primary ? { primary: siteData.primary } : {}),
    ...(siteData['text-inverse'] ? { 'text-inverse': siteData['text-inverse'] } : {}),
  };
}

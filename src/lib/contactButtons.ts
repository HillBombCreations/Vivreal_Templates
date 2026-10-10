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
  businessInfo?: Pick<NonNullable<SiteData['businessInfo']>, 'address' | 'contactInfo'>;
  primary?: string;
  'text-inverse'?: string;
}

/**
 * The slice, or `null` when the bar must not mount at all: an authored
 * `utilityDock` already is a bottom bar with the phone and address, and two
 * bars would stack. Whether the bar then draws (a phone or an address, and the
 * owner's switch not off) is the renderer's `resolveContactButtons`.
 */
export function contactButtonsSiteData(siteData: SiteData): ContactButtonsSiteData | null {
  if (siteData.utilityDock) return null;
  return {
    ...(siteData.contactButtons === undefined ? {} : { contactButtons: siteData.contactButtons }),
    ...(siteData.businessInfo
      ? { businessInfo: { address: siteData.businessInfo.address, contactInfo: siteData.businessInfo.contactInfo } }
      : {}),
    ...(siteData.primary ? { primary: siteData.primary } : {}),
    ...(siteData['text-inverse'] ? { 'text-inverse': siteData['text-inverse'] } : {}),
  };
}

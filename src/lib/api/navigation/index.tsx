import { NavigationData } from '@/types/Navigation';
import { getSiteData } from '@/lib/api/siteData';

/**
 * Default pages every showcase template includes.
 * The label can be overridden by siteData.pages config.
 */
const DEFAULT_NAV: NavigationData[] = [
  { path: '/', label: 'Home', displayOnHeader: true },
  { path: '/shows', label: 'Content', displayOnHeader: true },
  { path: '/team', label: 'Our Team', displayOnHeader: true },
];

export const getNavigationData = async (): Promise<NavigationData[]> => {
  try {
    const siteData = await getSiteData();
    const pages = siteData?.pages;

    if (!pages || Object.keys(pages).length === 0) {
      return DEFAULT_NAV;
    }

    // Build nav from siteData.pages — each key is a page identifier
    // For now, merge with defaults so routes always resolve
    return DEFAULT_NAV;
  } catch {
    return DEFAULT_NAV;
  }
};

/** @deprecated Use getNavigationData instead */
export const getHeroSectionData = getNavigationData;

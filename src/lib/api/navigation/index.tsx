import { NavigationData } from '@/types/Navigation';
import { getSiteData } from '@/lib/api/siteData';

export const getNavigationData = async (): Promise<NavigationData[]> => {
  try {
    const siteData = await getSiteData();
    const pageConfigs = siteData?.pageConfigs;

    // Always start with Home
    const nav: NavigationData[] = [
      { path: '/', label: 'Home', displayOnHeader: true },
    ];

    if (pageConfigs && pageConfigs.length > 0) {
      for (const page of pageConfigs) {
        if (page.displayOnHeader === false) continue;
        // Skip static pages (privacy/terms) from main nav — they go in footer
        if (page.format === 'static') continue;
        // Skip root page — already hardcoded as "Home" above
        if (!page.slug || page.slug === '/') continue;
        nav.push({
          path: `/${page.slug}`,
          label: page.labels?.navLabel || page.labels?.title || page.name,
          displayOnHeader: true,
        });
      }
    }

    return nav;
  } catch {
    return [
      { path: '/', label: 'Home', displayOnHeader: true },
    ];
  }
};

/** @deprecated Use getNavigationData instead */
export const getHeroSectionData = getNavigationData;

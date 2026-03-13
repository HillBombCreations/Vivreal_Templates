import 'server-only';
import type { MetadataRoute } from 'next';
import type { PageConfig, SiteData } from '@/types/SiteData';
import { clientFetchSafe } from '@/lib/api/client';

const SITE_ID = process.env.SITE_ID || '';

const FALLBACK_SITE_DATA: SiteData = {
  primary: '#000000',
  secondary: '#333333',
  hover: '#555555',
  surface: '#ffffff',
  'surface-alt': '#f5f5f5',
  'text-primary': '#000000',
  'text-secondary': '#666666',
  'text-inverse': '#ffffff',
  border: '#e0e0e0',
  pages: {},
  pageConfigs: [],
  siteMap: [],
  logo: {
    name: '',
    key: '',
    type: '',
    currentFile: { source: '' },
  },
};

interface SiteDetailsResponse {
  siteDetails: {
    schema: object;
    values: SiteData;
  };
  name: string;
  domainName: string;
  domainInformation?: object;
  businessInfo?: SiteData['businessInfo'];
  aboutSection?: SiteData['aboutSection'];
  socialLinks?: SiteData['socialLinks'];
  pages?: PageConfig[];
}

export const getSiteData = async (): Promise<SiteData> => {
  const raw = await clientFetchSafe<SiteDetailsResponse | null>(
    `/tenant/siteDetails?siteId=${encodeURIComponent(SITE_ID)}`,
    null
  );

  if (!raw?.siteDetails?.values) return FALLBACK_SITE_DATA;

  return {
    ...raw.siteDetails.values,
    domainName: raw.domainName,
    name: raw.name,
    businessInfo: raw.businessInfo ?? raw.siteDetails.values.businessInfo,
    aboutSection: raw.aboutSection,
    socialLinks: raw.socialLinks ?? [],
    pageConfigs: raw.pages ?? [],
  };
};

/**
 * Helper to find a page config by name and read a label with a fallback.
 */
export const getPageLabel = (
  siteData: SiteData,
  pageName: string,
  labelKey: string,
  fallback: string
): string => {
  const page = siteData.pageConfigs?.find((p) => p.name === pageName);
  return page?.labels?.[labelKey] || fallback;
};

/**
 * Helper to get a collection ID from page config, falling back to env var.
 */
export const getPageCollectionId = (
  siteData: SiteData,
  pageName: string,
  envFallback: string
): string => {
  const page = siteData.pageConfigs?.find((p) => p.name === pageName);
  return page?.collectionId || envFallback;
};

export const getSiteMap = async (): Promise<MetadataRoute.Sitemap> => {
  const raw = await clientFetchSafe<SiteDetailsResponse | null>(
    `/tenant/siteDetails?siteId=${encodeURIComponent(SITE_ID)}`,
    null
  );

  if (!raw) return [];

  const domainName = raw.domainName ?? '';
  if (!domainName) return [];

  const pages = raw.siteDetails?.values?.pages ?? {};
  const pageKeys = Object.keys(pages);

  const siteMap: MetadataRoute.Sitemap = [
    {
      url: `https://${domainName}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1.0,
    },
  ];

  pageKeys.forEach((slug, idx) => {
    const page = slug.replace(/^\/+/, '');
    const priority = Math.max(0.1, 1.0 - (idx + 1) * (0.9 / pageKeys.length));
    siteMap.push({
      url: `https://${domainName}/${page}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: Number(priority.toFixed(2)),
    });
  });

  return siteMap;
};

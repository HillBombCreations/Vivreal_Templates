import 'server-only';
import { clientFetchSafe } from '@/lib/api/client';
import { getSignedUrl } from '@/lib/api/media';

const PARTNERS_ID = process.env.PARTNERS_ID || '';

interface CMSPartnerData {
  objectValue: {
    _id: string;
    name: string;
    logo?: {
      key: string;
      currentFile: { source: string };
    };
  };
}

interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
}

export interface PartnerData {
  name: string;
  logoUrl: string;
}

export async function getPartners(collectionId?: string): Promise<PartnerData[]> {
  const id = collectionId || PARTNERS_ID;
  if (!id) return [];

  const res = await clientFetchSafe<PaginatedResponse<CMSPartnerData>>(
    `/tenant/collectionObjects?collectionId=${encodeURIComponent(id)}`,
    { items: [], totalCount: 0 }
  );

  return res.items.map((item) => ({
    name: item.objectValue.name,
    logoUrl: getSignedUrl(item.objectValue.logo),
  }));
}

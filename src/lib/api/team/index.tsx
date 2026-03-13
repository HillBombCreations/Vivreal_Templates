import 'server-only';
import type { TeamData, CMSTeamData } from '@/types/Team';
import { clientFetchSafe } from '@/lib/api/client';
import { getSignedUrl } from '@/lib/api/media';

const TEAMMEMBERS_ID = process.env.TEAMMEMBERS_ID || '';

interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
}

export async function getTeamMembers(collectionId?: string): Promise<TeamData[]> {
  const id = collectionId || TEAMMEMBERS_ID;
  if (!id) return [];
  const res = await clientFetchSafe<PaginatedResponse<CMSTeamData>>(
    `/tenant/collectionObjects?collectionId=${encodeURIComponent(id)}`,
    { items: [], totalCount: 0 }
  );

  return res.items.map((item) => ({
    name: item.objectValue.name,
    description: item.objectValue.description,
    id: item.objectValue._id,
    image: getSignedUrl(item.objectValue.headshot),
    imageUrl: getSignedUrl(item.objectValue.headshot),
    socialLinks: item.objectValue.socialLinks,
  }));
}

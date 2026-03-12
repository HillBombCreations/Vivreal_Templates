import 'server-only';
import type { TeamData, CMSTeamData } from '@/types/Team';
import { clientFetchSafe } from '@/lib/api/client';
import { getSignedUrl } from '@/lib/api/media';

const TEAMMEMBERS_ID = process.env.TEAMMEMBERS_ID || '';

interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
}

export async function getTeamMembers(): Promise<TeamData[]> {
  const res = await clientFetchSafe<PaginatedResponse<CMSTeamData>>(
    `/tenant/collectionObjects?collectionId=${encodeURIComponent(TEAMMEMBERS_ID)}`,
    { items: [], totalCount: 0 }
  );

  return res.items.map((item) => ({
    name: item.objectValue.name,
    description: item.objectValue.description,
    id: item.objectValue._id,
    image: getSignedUrl(item.objectValue.headshot),
    imageUrl: getSignedUrl(item.objectValue.headshot),
  }));
}

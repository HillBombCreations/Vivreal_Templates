import 'server-only';
import type { TeamData, CMSTeamData } from '@/types/Team';
import { clientFetchSafe } from '@/lib/api/client';
import { getSignedUrl, getSrcSet } from '@/lib/api/media';

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
    // Use the collection-object document _id (canonical) so detail links match
    // the list. The list (composePage → toContentItem) keys items by the document
    // _id; shows + products do the same. Previously this used objectValue._id (a
    // Mongoose-injected subdoc id), which mismatched the migrated list links → 404.
    id: item._id,
    image: getSignedUrl(item.objectValue.headshot),
    imageUrl: getSignedUrl(item.objectValue.headshot),
    imageSrcSet: getSrcSet(item.objectValue.headshot) || undefined,
    socialLinks: item.objectValue.socialLinks,
  }));
}

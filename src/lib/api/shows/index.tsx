import 'server-only';
import type { ShowData, CMSShowData } from '@/types/Shows';
import { clientFetchSafe } from '@/lib/api/client';
import { getSignedUrl } from '@/lib/api/media';

const SHOWS_ID = process.env.SHOWS_ID || '';

interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
}

export interface ShowsResult {
  shows: ShowData[];
  totalCount: number;
}

function mapShow(item: CMSShowData): ShowData {
  return {
    title: item.objectValue.title,
    description: item.objectValue.description,
    id: item._id,
    date: item.objectValue.date,
    time: item.objectValue.time,
    location: item.objectValue.location,
    ticketsUrl: item.objectValue.tickets_url,
    image: getSignedUrl(item.objectValue.poster),
    imageUrl: getSignedUrl(item.objectValue.poster),
  };
}

export async function getShows(collectionId?: string): Promise<ShowData[]> {
  const result = await getShowsPaginated({ collectionId, limit: 100 });
  return result.shows;
}

export async function getShowsPaginated({
  collectionId,
  limit = 20,
  skip = 0,
}: {
  collectionId?: string;
  limit?: number;
  skip?: number;
} = {}): Promise<ShowsResult> {
  const id = collectionId || SHOWS_ID;
  if (!id) return { shows: [], totalCount: 0 };

  const res = await clientFetchSafe<PaginatedResponse<CMSShowData>>(
    `/tenant/collectionObjects?collectionId=${encodeURIComponent(id)}&limit=${limit}&skip=${skip}&sort=publishDate:desc`,
    { items: [], totalCount: 0 }
  );

  const shows = res.items.map(mapShow);
  shows.sort(
    (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()
  );

  return { shows, totalCount: res.totalCount };
}

export const getShowById = async (id: string, collectionId?: string): Promise<ShowData | null> => {
  const allShows = await getShows(collectionId);
  return allShows.find((show) => show.id === id) || null;
};

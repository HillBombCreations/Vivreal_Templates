import 'server-only';
import type { ShowData, CMSShowData } from '@/types/Shows';
import { clientFetchSafe } from '@/lib/api/client';
import { mediaCdnUrl } from '@/lib/api/media';

const SHOWS_ID = process.env.SHOWS_ID || '';

interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
}

export async function getShows(): Promise<ShowData[]> {
  const res = await clientFetchSafe<PaginatedResponse<CMSShowData>>(
    `/tenant/collectionObjects?collectionId=${encodeURIComponent(SHOWS_ID)}`,
    { items: [], totalCount: 0 }
  );

  const shows: ShowData[] = res.items.map((item) => ({
    title: item.objectValue.title,
    description: item.objectValue.description,
    id: item.objectValue._id,
    date: item.objectValue.date,
    time: item.objectValue.time,
    location: item.objectValue.location,
    ticketsUrl: item.objectValue.tickets_url,
    image: item.objectValue.poster?.currentFile?.source,
    imageUrl: item.objectValue.poster?.currentFile?.source || mediaCdnUrl(item.objectValue.poster?.key),
  }));

  shows.sort(
    (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()
  );

  return shows;
}

export const getShowById = async (id: string): Promise<ShowData | null> => {
  const allShows = await getShows();
  return allShows.find((show) => show.id === id) || null;
};

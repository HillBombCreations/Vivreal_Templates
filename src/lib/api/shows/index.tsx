// lib/api/shows.ts
import "server-only";
import type { ShowData, CMSShowData } from "@/types/Shows";

const API_URL = process.env.CLIENT_API!;
const SHOWS_ID = process.env.SHOWS_ID!;
const CMS_API_KEY = process.env.API_KEY!;
const BUCKET_NAME = process.env.BUCKET_NAME!;
export async function getShows(): Promise<ShowData[]> {
  console.log('====================GET SHOWS - API_URL:', API_URL);
  console.log('====================GET SHOWS - SHOWS_ID:', SHOWS_ID);
  console.log('====================GET SHOWS - CMS_API_KEY:', CMS_API_KEY);
  console.log('====================GET SHOWS - BUCKET_NAME:', BUCKET_NAME);
  const res = await fetch(
    `${API_URL}/tenant/collectionObjects?collectionId=${encodeURIComponent(SHOWS_ID)}`,
    {
      headers: {
        Authorization: CMS_API_KEY,
        "Content-Type": "application/json",
      },
      // Choose one strategy:
      // cache: "no-store",
      next: { revalidate: 60 }, // ISR: revalidate every 60s
    }
  );

  if (!res.ok) {
    console.error("[getShows] upstream error:", res.status, res.statusText);
    return [];
  }

  const data: CMSShowData[] = await res.json();

  const shows: ShowData[] = data.map((item) => ({
    title: item.objectValue.title,
    description: item.objectValue.description,
    id: item.objectValue._id,
    date: item.objectValue.date,
    time: item.objectValue.time,
    location: item.objectValue.location,
    ticketsUrl: item.objectValue.tickets_url,
    image: item.objectValue.poster?.currentFile.source,
    imageUrl: item.objectValue.poster ? `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${item.objectValue.poster.key}` : undefined,
  }));

  shows.sort(
    (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()
  );

  return shows;
}

export const getShowById = async(id: string): Promise<ShowData | null> => {
  const allShows = (await getShows());
  return allShows.find(show => show.id === id) || null;
};
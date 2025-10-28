import { ShowData, CMSShowData } from "@/types/Shows"
import { cache } from "react";
import axios from 'axios';
const API_URL = process.env.NEXT_PUBLIC_CLIENT_API;
const SHOWS_ID = process.env.NEXT_PUBLIC_SHOWS_ID;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const BUCKET_NAME = process.env.NEXT_PUBLIC_BUCKET_NAME;

export const getShows = async (): Promise<ShowData[]> => {
  try {
    const { data } = await axios.get(`${API_URL}/tenant/collectionObjects`, {
        params: { collectionId: SHOWS_ID },
        headers: {
            Authorization: API_KEY,
            "Content-Type": "application/json",
        },
    });

    const showData: ShowData[] = data.map((item: CMSShowData) => (
      {
        title: item.objectValue.title,
        description: item.objectValue.description,
        id: item.objectValue._id,
        date: item.objectValue.date,
        time: item.objectValue.time,
        location: item.objectValue.location,
        ticketsUrl: item.objectValue.tickets_url,
        image: item.objectValue.poster?.currentFile.source,
        imageUrl: item.objectValue.poster ? `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${item.objectValue.poster.key}` : undefined,
      }
    ));

    showData.sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
    return showData;
  } catch (error) {
    console.error("Error fetching shows:", error);
    return [];
  }
};

export const getShowById = cache(async(id: string): Promise<ShowData | null> => {
  const allShows = (await getShows());
  return allShows.find(show => show.id === id) || null;
});
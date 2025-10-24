import { TeamData } from "@/types/Team"
import axios from 'axios';
const API_URL = 'https://client.vivreal.io';
const TEAMMEMBERS_ID = process.env.NEXT_PUBLIC_TEAMMEMBERS_ID;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const BUCKET_NAME = process.env.NEXT_PUBLIC_BUCKET_NAME;

export const getTeamMembers = async (): Promise<TeamData[]> => {
  try {
    const { data } = await axios.get(`${API_URL}/tenant/collectionObjects`, {
        params: { collectionId: TEAMMEMBERS_ID },
        headers: {
            Authorization: API_KEY,
            "Content-Type": "application/json",
        },
    });

    const teamData: TeamData[] = data.map((item: TeamData) => (
      {
        name: item.objectValue.name,
        description: item.objectValue.description,
        id: item.objectValue._id,
        image: item.objectValue.headshot?.currentFile.source,
        imageUrl: item.objectValue.headshot ? `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${item.objectValue.headshot.key}` : undefined,
      }
    ));

    return teamData;
  } catch (error) {
    console.error("Error fetching shows:", error);
    return [];
  }
};
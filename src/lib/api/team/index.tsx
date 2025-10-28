/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import type { TeamData } from "@/types/Team";

const API_URL = process.env.NEXT_PUBLIC_CLIENT_API;
const TEAMMEMBERS_ID = process.env.TEAMMEMBERS_ID;
const API_KEY = process.env.API_KEY;
const BUCKET_NAME = process.env.BUCKET_NAME!;


/** Fetch team members directly from CMS (server-side only) */
export async function getTeamMembers(): Promise<TeamData[]> {
  console.log('====================GET TEAM MEMBERS - API_URL:', API_URL);
  console.log('====================GET TEAM MEMBERS - TEAMMEMBERS_ID:', TEAMMEMBERS_ID);
  console.log('====================GET TEAM MEMBERS - API_KEY:', API_KEY);
  console.log('====================GET TEAM MEMBERS - BUCKET_NAME:', BUCKET_NAME);
  try {
    const res = await fetch(
      `${API_URL}/tenant/collectionObjects?collectionId=${encodeURIComponent(
        TEAMMEMBERS_ID!
      )}`,
      {
        headers: {
          Authorization: API_KEY!,
          "Content-Type": "application/json",
        },
        // caching strategy
        next: { revalidate: 60 }, // ISR revalidate every 60s
        // or use cache: "no-store" for always-fresh data
      }
    );

    if (!res.ok) {
      console.error("[fetchTeamMembersFromCMS] Error:", res.status, res.statusText);
      return [];
    }

    const data = await res.json();

    const teamData: TeamData[] = data.map((item: any) => ({
      name: item.objectValue.name,
      description: item.objectValue.description,
      id: item.objectValue._id,
      image: item.objectValue.headshot?.currentFile.source,
      imageUrl: item.objectValue.headshot ? `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${item.objectValue.headshot.key}` : undefined,
    }));

    return teamData;
  } catch (error) {
    console.error("[fetchTeamMembersFromCMS] Exception:", error);
    return [];
  }
}

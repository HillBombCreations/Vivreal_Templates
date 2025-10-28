import "server-only";
import type { ReviewData } from "@/types/Reviews";

const API_URL = process.env.NEXT_PUBLIC_CLIENT_API!;
const CMS_API_KEY = process.env.API_KEY!;

export async function createReview(data: ReviewData): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/tenant/definedCollectionObject`, {
      method: "POST",
      headers: {
        Authorization: CMS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: data.email,
        name: data.name,
        review: data.review,
        rating: data.rating,
        type: "createReview",
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[createReviewOnCMS] CMS error:", res.status, res.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[createReviewOnCMS] Exception:", error);
    return false;
  }
}
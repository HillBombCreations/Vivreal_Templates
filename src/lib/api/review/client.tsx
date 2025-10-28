import type { ReviewData } from "@/types/Reviews";

export async function createReview(data: ReviewData): Promise<boolean> {
  try {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) return false;

    const json = await res.json();
    return json.success;
  } catch (error) {
    console.error("[createReview] Error:", error);
    return false;
  }
}
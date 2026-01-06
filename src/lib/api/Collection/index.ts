import { unstable_cache } from "next/cache";
import { Filter } from "@/types/Products";

export const getCollection = unstable_cache(
  async (url: string) => {
    const res = await fetch(url, {
      next: { revalidate: 30 * 60 },
    });
    if (!res.ok) return [];
    const data = await res.json() as Filter[];

    return data;
  },
  ["filters"],
  { revalidate: 30 * 60 }
);

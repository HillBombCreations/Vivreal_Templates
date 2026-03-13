import 'server-only';
import type { TikTokPost, TikTokOEmbed } from '@/types/Social';
import { clientFetchSafe } from '@/lib/api/client';

interface RawIntegrationObject {
  _id: string;
  objectValue: {
    _id: string;
    caption?: string;
  };
  permalink?: string;
  externalPostId?: string;
  publishDate?: string;
  status?: string;
  platform?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
}

/**
 * Fetch TikTok posts from VR_Client_API integration objects.
 */
export async function getTikTokPosts(): Promise<TikTokPost[]> {
  const res = await clientFetchSafe<PaginatedResponse<RawIntegrationObject>>(
    `/tenant/integrationObjects?type=tiktok`,
    { items: [], totalCount: 0 }
  );

  return res.items
    .filter((item) => item.status === 'published')
    .map((item) => ({
      id: item._id,
      caption: (item.objectValue?.caption || '').replace(/<[^>]*>/g, ''),
      permalink: item.permalink || null,
      publishDate: item.publishDate || '',
      status: item.status || '',
    }))
    .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());
}

/**
 * Fetch oEmbed data for a TikTok video URL.
 * Public endpoint — no API key required.
 */
export async function getTikTokOEmbed(videoUrl: string): Promise<TikTokOEmbed | null> {
  try {
    const res = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`,
      { next: { revalidate: 3600 } } // cache for 1 hour
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

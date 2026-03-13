import 'server-only';
import type { ReviewData, ReviewDisplay } from '@/types/Reviews';
import { clientFetch, clientFetchSafe } from '@/lib/api/client';

interface CMSReviewObject {
  _id: string;
  objectValue: {
    _id: string;
    name: string;
    review: string;
    rating: number;
    email?: string;
  };
  publishDate: string;
}

interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
}

export async function getReviews(collectionId?: string): Promise<ReviewDisplay[]> {
  if (!collectionId) return [];

  const res = await clientFetchSafe<PaginatedResponse<CMSReviewObject>>(
    `/tenant/collectionObjects?collectionId=${encodeURIComponent(collectionId)}`,
    { items: [], totalCount: 0 }
  );

  return res.items
    .filter((item) => item.objectValue?.review && item.objectValue?.rating)
    .map((item) => ({
      id: item.objectValue._id || item._id,
      name: item.objectValue.name || 'Anonymous',
      review: item.objectValue.review,
      rating: item.objectValue.rating,
      date: item.publishDate,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function createReview(data: ReviewData): Promise<boolean> {
  try {
    await clientFetch<unknown>('/tenant/definedCollectionObject', {
      method: 'POST',
      body: JSON.stringify({
        collectionId: data.collectionId,
        type: 'createReview',
        objectValue: {
          email: data.email,
          name: data.name,
          review: data.review,
          rating: data.rating,
        },
      }),
    });
    return true;
  } catch (error) {
    console.error('[createReview] error:', error);
    return false;
  }
}

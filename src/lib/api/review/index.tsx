import 'server-only';
import type { ReviewData, ReviewDisplay } from '@/types/Reviews';
import { ApiError, clientFetch, clientFetchSafe } from '@/lib/api/client';

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

/**
 * `status` is the upstream HTTP status when VR_Client_API answered, absent
 * when no answer came back (a network failure). The caller reports it; this
 * function must not swallow it, or a failing write loses every review with
 * nothing in Sentry (review-templates204-delta-2026-10-21.md).
 */
export type CreateReviewResult = { ok: true } | { ok: false; status?: number };

export async function createReview(data: ReviewData): Promise<CreateReviewResult> {
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
          // Numeric (decimal) — the backend stores rating as a number; the
          // renderer/contract send 4.5 etc. Do not stringify.
          rating: data.rating,
          // Honeypot rides inside objectValue (the backend validator only
          // accepts collectionId/type/objectValue). The service reads
          // objectValue.company_website, rejects if non-empty, and strips it
          // before persisting.
          company_website: data.company_website ?? '',
        },
      }),
    });
    return { ok: true };
  } catch (error) {
    console.error('[createReview] error:', error);
    return error instanceof ApiError ? { ok: false, status: error.status } : { ok: false };
  }
}

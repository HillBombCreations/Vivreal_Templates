import 'server-only';
import type { ReviewData } from '@/types/Reviews';
import { clientFetch } from '@/lib/api/client';

export async function createReview(data: ReviewData): Promise<boolean> {
  try {
    await clientFetch<unknown>('/tenant/definedCollectionObject', {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        name: data.name,
        review: data.review,
        rating: data.rating,
        type: 'createReview',
      }),
    });
    return true;
  } catch (error) {
    console.error('[createReview] error:', error);
    return false;
  }
}

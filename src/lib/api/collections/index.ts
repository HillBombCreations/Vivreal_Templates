/**
 * Generic collection & integration item fetchers.
 *
 * Converts raw API objects into the unified ContentItem format
 * so any layout component can render them without knowing the source.
 */
import 'server-only';

import { clientFetchCached, SITE_CACHE_TTL_SECONDS } from '../client';
import { collectionTags, integrationTags } from '../cacheTags';
import { readOrDegrade } from '../degradedRead';
import { toContentItem } from './mapItem';
import type { ContentItem } from '@/types/ContentItem';

const SITE_ID = process.env.SITE_ID || '';

/* ------------------------------------------------------------------ */
/*  Shared types                                                       */
/* ------------------------------------------------------------------ */

interface PaginatedResponse {
  items: Record<string, unknown>[];
  totalCount: number;
}

interface FetchOpts {
  limit?: number;
  skip?: number;
  sort?: string;
  search?: string;
  filters?: Record<string, string>;
}

interface FetchResult {
  items: ContentItem[];
  totalCount: number;
  /**
   * True when VR_Client_API could not be read and `items` is a placeholder
   * rather than an answer.
   *
   * The two states are IDENTICAL in the value (`[]` either way), so a caller
   * that draws a conclusion from emptiness (a "this page does not exist"
   * verdict, most of all) has to read this instead of counting. See
   * `../degradedRead.ts` for why the distinction cannot be recovered from the
   * payload, and `../composition/pageEmptiness.ts` for the one consumer whose
   * verdict depends on it.
   *
   * Always present, never optional: an optional flag reads as `false` on a
   * result built by a caller that has not been updated, which is exactly the
   * fail-open this exists to prevent.
   */
  degraded: boolean;
}

/** A fresh, private empty envelope for one read's degraded sentinel. */
const emptyPage = (): PaginatedResponse => ({ items: [], totalCount: 0 });

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Handle both envelope shapes the API may return:
 *   { items: [...], totalCount: N }   — paginated
 *   [...]                             — bare array (legacy)
 */
function unwrap(raw: PaginatedResponse | Record<string, unknown>[]): {
  items: Record<string, unknown>[];
  totalCount: number;
} {
  if (Array.isArray(raw)) {
    return { items: raw, totalCount: raw.length };
  }
  return {
    items: raw?.items ?? [],
    totalCount: raw?.totalCount ?? 0,
  };
}

/** Build common URLSearchParams from FetchOpts. */
function buildParams(opts: FetchOpts | undefined): URLSearchParams {
  const params = new URLSearchParams();
  if (opts?.limit != null) params.set('limit', String(opts.limit));
  if (opts?.skip != null) params.set('skip', String(opts.skip));
  if (opts?.sort) params.set('sort', opts.sort);
  if (opts?.search) params.set('search', opts.search);
  if (opts?.filters) {
    for (const [key, val] of Object.entries(opts.filters)) {
      if (key && val) params.set(`filters[${key}]`, val);
    }
  }
  return params;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Fetch collection objects and return them as ContentItems.
 *
 * @param collectionId - The MongoDB _id of the collection group
 * @param opts         - Pagination, sort, search, and filter options
 */
export async function getCollectionItems(
  collectionId: string,
  opts?: FetchOpts
): Promise<FetchResult> {
  const params = buildParams(opts);
  params.set('collectionId', collectionId);

  const { value: raw, degraded } = await readOrDegrade<PaginatedResponse>(
    emptyPage,
    (fallback) =>
      clientFetchCached<PaginatedResponse>(
        `/tenant/collectionObjects?${params}`,
        fallback,
        SITE_CACHE_TTL_SECONDS,
        undefined,
        collectionTags(SITE_ID, collectionId)
      )
  );

  const { items, totalCount } = unwrap(raw);
  return {
    items: items.map((item) => toContentItem(item, 'collection')),
    totalCount,
    degraded,
  };
}

/**
 * Fetch integration objects and return them as ContentItems.
 *
 * @param type - Integration type (e.g. "stripe", "tiktok")
 * @param opts - Pagination, sort, search, and filter options
 */
export async function getIntegrationItems(
  type: string,
  opts?: FetchOpts
): Promise<FetchResult> {
  const params = buildParams(opts);
  params.set('type', type);

  const { value: raw, degraded } = await readOrDegrade<PaginatedResponse>(
    emptyPage,
    (fallback) =>
      clientFetchCached<PaginatedResponse>(
        `/tenant/integrationObjects?${params}`,
        fallback,
        SITE_CACHE_TTL_SECONDS,
        undefined,
        integrationTags(SITE_ID, type)
      )
  );

  const { items, totalCount } = unwrap(raw);
  return {
    items: items.map((item) => toContentItem(item, 'integration', type)),
    totalCount,
    degraded,
  };
}

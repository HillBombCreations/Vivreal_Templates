/**
 * Generic collection & integration item fetchers.
 *
 * Converts raw API objects into the unified ContentItem format
 * so any layout component can render them without knowing the source.
 */
import 'server-only';

import { clientFetchCached, SITE_CACHE_TTL_SECONDS } from '../client';
import { toContentItem } from './mapItem';
import type { ContentItem } from '@/types/ContentItem';

const SITE_ID = process.env.SITE_ID || '';

/**
 * Build the cache tags for a collection-content read. Always carries the
 * `collection:<id>` tag so a single collection edit invalidates exactly that
 * read; also carries `site:<id>` so a site-wide invalidation (e.g. a chrome
 * change that affects nav labels) clears it too. Tags map 1:1 to the events
 * decoded in /api/revalidate.
 */
function collectionTags(collectionId: string): string[] {
  const tags: string[] = [];
  if (SITE_ID) tags.push(`site:${SITE_ID}`);
  if (collectionId) tags.push(`collection:${collectionId}`);
  return tags;
}

/** Build the cache tags for an integration-content read. */
function integrationTags(type: string): string[] {
  const tags: string[] = [];
  if (SITE_ID) tags.push(`site:${SITE_ID}`);
  if (type) tags.push(`integration:${type}`);
  return tags;
}

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
}

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

  const raw = await clientFetchCached<PaginatedResponse>(
    `/tenant/collectionObjects?${params}`,
    { items: [], totalCount: 0 },
    SITE_CACHE_TTL_SECONDS,
    undefined,
    collectionTags(collectionId)
  );

  const { items, totalCount } = unwrap(raw);
  return {
    items: items.map((item) => toContentItem(item, 'collection')),
    totalCount,
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

  const raw = await clientFetchCached<PaginatedResponse>(
    `/tenant/integrationObjects?${params}`,
    { items: [], totalCount: 0 },
    SITE_CACHE_TTL_SECONDS,
    undefined,
    integrationTags(type)
  );

  const { items, totalCount } = unwrap(raw);
  return {
    items: items.map((item) => toContentItem(item, 'integration', type)),
    totalCount,
  };
}

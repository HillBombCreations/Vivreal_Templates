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
import { readRichTextImageUrls } from '../richTextImageUrls';
import { toContentItem } from './mapItem';
import type { ContentItem } from '@/types/ContentItem';

const SITE_ID = process.env.SITE_ID || '';

/* ------------------------------------------------------------------ */
/*  Shared types                                                       */
/* ------------------------------------------------------------------ */

interface PaginatedResponse {
  items: Record<string, unknown>[];
  totalCount: number;
  /**
   * H177 - inline rich-text image keys to signed media URLs for the rich text
   * carried by THESE items. Unconditional from VR_Client_API v2.10.16 (`{}`
   * when the items carry no inline images), so no presence check is needed on
   * a live response. Optional here because the legacy bare-array envelope
   * below has no place to put it.
   */
  richTextImageUrls?: Record<string, string>;
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
  /**
   * H177 - the inline rich-text image map for `items`, key to signed URL.
   * Always an object. A caller merges it with the maps from every other read
   * on the page and hands the result to the renderer's resolver.
   */
  richTextImageUrls: Record<string, string>;
}

/** A fresh, private empty envelope for one read's degraded sentinel. */
const emptyPage = (): PaginatedResponse => ({ items: [], totalCount: 0, richTextImageUrls: {} });

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
  richTextImageUrls: Record<string, string>;
} {
  if (Array.isArray(raw)) {
    // The legacy bare-array shape has nowhere to carry a map. An empty one is
    // the correct answer: it resolves no keys, so inline images stay dropped
    // exactly as they were before H177 rather than half-rendering.
    return { items: raw, totalCount: raw.length, richTextImageUrls: {} };
  }
  return {
    items: raw?.items ?? [],
    totalCount: raw?.totalCount ?? 0,
    // H177. This is the line whose ABSENCE was the whole live-site defect: the
    // map arrived on every response and was discarded here, one layer below
    // everything that could have used it.
    richTextImageUrls: readRichTextImageUrls(raw),
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

  const { items, totalCount, richTextImageUrls } = unwrap(raw);
  return {
    items: items.map((item) => toContentItem(item, 'collection')),
    totalCount,
    degraded,
    richTextImageUrls,
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

  const { items, totalCount, richTextImageUrls } = unwrap(raw);
  return {
    items: items.map((item) => toContentItem(item, 'integration', type)),
    totalCount,
    degraded,
    richTextImageUrls,
  };
}

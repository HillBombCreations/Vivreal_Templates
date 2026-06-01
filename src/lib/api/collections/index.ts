/**
 * Generic collection & integration item fetchers.
 *
 * Converts raw API objects into the unified ContentItem format
 * so any layout component can render them without knowing the source.
 */
import 'server-only';

import { clientFetchSafe } from '../client';
import { getSignedUrl } from '../media';
import type { ContentItem } from '@/types/ContentItem';

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
 * Field names checked FIRST when resolving an object's image. This is only a
 * priority hint for disambiguation (when an object carries several media
 * fields) — NOT an allowlist. It exists to preserve the exact image currently
 * picked for the blueprint schemas; the type-based scan below resolves images
 * regardless of field name.
 */
const PREFERRED_IMAGE_FIELDS = ['image', 'productImage', 'photo', 'avatar', 'thumbnail'] as const;

/**
 * Resolve the signed image URL for an object by the field's TYPE, not its name.
 *
 * Users define their own schemas, so an image can live under any key
 * (`coverArt`, `poster`, `headshot`, `mugshot`, …). VR_Client_API only
 * populates `currentFile.source` on actual media fields, so `getSignedUrl(v)`
 * returning a non-empty string is a reliable structural signal that `v` is a
 * media descriptor — independent of what the field is called.
 *
 * Order: try the preferred fields first (deterministic, back-compatible pick
 * for the blueprint schemas), then scan every field and return the first whose
 * value is a media descriptor.
 */
function resolveImage(objectValue: Record<string, unknown>): string {
  // 1. Priority hint — keeps the existing pick for known blueprint fields.
  for (const field of PREFERRED_IMAGE_FIELDS) {
    const url = getSignedUrl(objectValue[field]);
    if (url) return url;
  }
  // 2. Type-based fallback — any field whose value is a media descriptor,
  //    covering arbitrary user-defined schema keys.
  for (const value of Object.values(objectValue)) {
    const url = getSignedUrl(value);
    if (url) return url;
  }
  return '';
}

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

/**
 * Map a raw API object to the unified ContentItem shape.
 */
function toContentItem(
  raw: Record<string, unknown>,
  source: ContentItem['source'],
  integrationType?: string
): ContentItem {
  const objectValue = (raw.objectValue ?? {}) as Record<string, unknown>;

  const title = String(objectValue.title ?? objectValue.name ?? '');
  const description = objectValue.description ?? objectValue.bio ?? objectValue.review;
  const price = objectValue.price;
  const date = objectValue.date ?? raw.publishDate;
  const tags = Array.isArray(objectValue.tags) ? objectValue.tags.map(String) : undefined;
  const imageUrl = resolveImage(objectValue);

  return {
    id: String(raw._id ?? ''),
    title,
    description: description != null ? String(description) : undefined,
    imageUrl: imageUrl || undefined,
    price: price != null ? String(price) : undefined,
    date: date != null ? String(date) : undefined,
    tags,
    source,
    integrationType,
    raw: objectValue as Record<string, unknown>,
  };
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

  const raw = await clientFetchSafe<PaginatedResponse>(
    `/tenant/collectionObjects?${params}`,
    { items: [], totalCount: 0 }
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

  const raw = await clientFetchSafe<PaginatedResponse>(
    `/tenant/integrationObjects?${params}`,
    { items: [], totalCount: 0 }
  );

  const { items, totalCount } = unwrap(raw);
  return {
    items: items.map((item) => toContentItem(item, 'integration', type)),
    totalCount,
  };
}

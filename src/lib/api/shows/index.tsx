import 'server-only';
import type { ShowData, CMSShowData } from '@/types/Shows';
import { clientFetchCached, clientFetchSafe, SITE_CACHE_TTL_SECONDS } from '@/lib/api/client';
import { collectionTags } from '@/lib/api/cacheTags';
import { readOrDegrade } from '@/lib/api/degradedRead';
import { getSignedUrl, getSrcSet } from '@/lib/api/media';

const SHOWS_ID = process.env.SHOWS_ID || '';
const SITE_ID = process.env.SITE_ID || '';

/**
 * Window `getShows()` reads. Unchanged from the value it has always passed
 * through `getShowsPaginated`; named because it is now also half of a cache
 * key and must stay constant for that key to be reused across renders.
 */
const SHOWS_DETAIL_LIMIT = 100;

interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
}

export interface ShowsResult {
  shows: ShowData[];
  totalCount: number;
}

function showsPath(collectionId: string, limit: number, skip: number): string {
  return `/tenant/collectionObjects?collectionId=${encodeURIComponent(collectionId)}&limit=${limit}&skip=${skip}&sort=publishDate:desc`;
}

function mapShow(item: CMSShowData): ShowData {
  return {
    title: item.objectValue.title,
    description: item.objectValue.description,
    id: item._id,
    date: item.objectValue.date,
    time: item.objectValue.time,
    location: item.objectValue.location,
    ticketsUrl: item.objectValue.tickets_url,
    image: getSignedUrl(item.objectValue.poster),
    imageUrl: getSignedUrl(item.objectValue.poster),
    imageSrcSet: getSrcSet(item.objectValue.poster) || undefined,
  };
}

/** Newest first. The API sorts by publishDate; the UI sorts by event date. */
function byEventDateDesc(shows: ShowData[]): ShowData[] {
  return shows.sort(
    (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()
  );
}

/**
 * The whole show list, CACHED and TAGGED.
 *
 * ISR migration Phase 2 (plan.md, Blocker 5): this read backs `getShowById`
 * and therefore every show DETAIL page. It used to go through the uncached
 * `clientFetchSafe`, which meant a show detail page re-hit VR_Client_API on
 * every render (billing the customer's quota for crawler traffic) AND carried
 * no cache tag, so a Studio edit to that show had nothing to invalidate. It
 * now shares the `collection:<id>` + `site:<id>` tags every other collection
 * read uses, so `POST /api/revalidate` drops it on `content.*`/`collection.*`.
 *
 * The fixed `limit`/`skip` matter: they keep the cache key constant, which is
 * what lets the entry actually be reused. `getShowsPaginated` below stays
 * uncached deliberately — its limit/skip come straight off the public
 * `/api/shows` query string, so caching it would let any caller mint
 * unbounded Data Cache entries.
 */
export async function getShowsRead(
  collectionId?: string
): Promise<{ shows: ShowData[]; degraded: boolean }> {
  const id = collectionId || SHOWS_ID;
  // No shows collection configured at all. That is an answer, not a silence:
  // the page is misconfigured and its detail URLs genuinely address nothing.
  if (!id) return { shows: [], degraded: false };

  const { value: res, degraded } = await readOrDegrade<PaginatedResponse<CMSShowData>>(
    () => ({ items: [], totalCount: 0 }),
    (fallback) =>
      clientFetchCached<PaginatedResponse<CMSShowData>>(
        showsPath(id, SHOWS_DETAIL_LIMIT, 0),
        fallback,
        SITE_CACHE_TTL_SECONDS,
        undefined,
        collectionTags(SITE_ID, id)
      )
  );

  return { shows: byEventDateDesc(res.items.map(mapShow)), degraded };
}

/**
 * Shows only. The value-only view of `getShowsRead`, for the callers that only
 * render what came back. Anything that turns "not in this list" into a verdict
 * must use the read above: `getShowById` returning `null` from a degraded read
 * is how the detail route 404'd a live show.
 */
export async function getShows(collectionId?: string): Promise<ShowData[]> {
  return (await getShowsRead(collectionId)).shows;
}

export async function getShowsPaginated({
  collectionId,
  limit = 20,
  skip = 0,
}: {
  collectionId?: string;
  limit?: number;
  skip?: number;
} = {}): Promise<ShowsResult> {
  const id = collectionId || SHOWS_ID;
  if (!id) return { shows: [], totalCount: 0 };

  const res = await clientFetchSafe<PaginatedResponse<CMSShowData>>(
    showsPath(id, limit, skip),
    { items: [], totalCount: 0 }
  );

  return { shows: byEventDateDesc(res.items.map(mapShow)), totalCount: res.totalCount };
}

/**
 * One show, WITH whether the list it was looked up in was actually read.
 *
 * There is no by-id read on VR_Client_API, so this is a `.find()` over the
 * window `getShowsRead` asks for. A degraded read makes that window empty,
 * which is indistinguishable from a show that is not there (see
 * `../degradedRead.ts`). The detail route turns the second into a real 404, so
 * it has to be able to tell them apart.
 */
export const getShowByIdRead = async (
  id: string,
  collectionId?: string
): Promise<{ show: ShowData | null; degraded: boolean }> => {
  const { shows, degraded } = await getShowsRead(collectionId);
  return { show: shows.find((show) => show.id === id) || null, degraded };
};

export const getShowById = async (id: string, collectionId?: string): Promise<ShowData | null> => {
  return (await getShowByIdRead(id, collectionId)).show;
};

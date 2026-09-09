import 'server-only';
import type { TeamData, CMSTeamData } from '@/types/Team';
import { clientFetchCached, SITE_CACHE_TTL_SECONDS } from '@/lib/api/client';
import { collectionTags } from '@/lib/api/cacheTags';
import { readOrDegrade } from '@/lib/api/degradedRead';
import { getSignedUrl, getSrcSet } from '@/lib/api/media';

const TEAMMEMBERS_ID = process.env.TEAMMEMBERS_ID || '';
const SITE_ID = process.env.SITE_ID || '';

interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
}

/**
 * ISR migration Phase 2 (plan.md, Blocker 5): CACHED and TAGGED.
 *
 * This read backs every team DETAIL page. It used to go through the uncached
 * `clientFetchSafe`, so a detail render always re-hit VR_Client_API (billing
 * the customer's quota for crawler traffic) and carried no cache tag, leaving
 * a Studio edit to a team member with nothing to invalidate. It now shares the
 * `collection:<id>` + `site:<id>` tags every other collection read uses, so
 * `POST /api/revalidate` drops it on `content.*`/`collection.*`.
 *
 * `collectionId` comes from the page's Studio binding (`getPageCollectionId`),
 * not from a query string, so the cache key space is bounded by site config.
 */
export async function getTeamMembersRead(
  collectionId?: string
): Promise<{ members: TeamData[]; degraded: boolean }> {
  const id = collectionId || TEAMMEMBERS_ID;
  // No roster collection configured. An answer, not a silence: this page's
  // member URLs genuinely address nothing.
  if (!id) return { members: [], degraded: false };
  const { value: res, degraded } = await readOrDegrade<PaginatedResponse<CMSTeamData>>(
    () => ({ items: [], totalCount: 0 }),
    (fallback) =>
      clientFetchCached<PaginatedResponse<CMSTeamData>>(
        `/tenant/collectionObjects?collectionId=${encodeURIComponent(id)}`,
        fallback,
        SITE_CACHE_TTL_SECONDS,
        undefined,
        collectionTags(SITE_ID, id)
      )
  );

  const members = res.items.map((item) => ({
    name: item.objectValue.name,
    description: item.objectValue.description,
    // Use the collection-object document _id (canonical) so detail links match
    // the list. The list (composePage → toContentItem) keys items by the document
    // _id; shows + products do the same. Previously this used objectValue._id (a
    // Mongoose-injected subdoc id), which mismatched the migrated list links → 404.
    id: item._id,
    image: getSignedUrl(item.objectValue.headshot),
    imageUrl: getSignedUrl(item.objectValue.headshot),
    imageSrcSet: getSrcSet(item.objectValue.headshot) || undefined,
    socialLinks: item.objectValue.socialLinks,
  }));

  return { members, degraded };
}

/**
 * The roster only. The value-only view of `getTeamMembersRead`, for the callers
 * that render whatever came back. The detail route uses the read above instead:
 * a degraded roster read made `teamMembers.find(...)` miss, and that miss was a
 * real 404 on a live member.
 */
export async function getTeamMembers(collectionId?: string): Promise<TeamData[]> {
  return (await getTeamMembersRead(collectionId)).members;
}

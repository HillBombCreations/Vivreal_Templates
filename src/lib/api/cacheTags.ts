/**
 * Cache tags for VR_Client_API reads.
 *
 * These strings are one half of a contract whose other half lives in
 * `src/app/api/revalidate/route.ts` (`tagsForEvent`). A read is only
 * invalidatable if the tag it was cached under is byte-identical to the tag
 * the webhook computes. When they drift, nothing fails, throws or logs — the
 * customer's edit is simply invisible until the time TTL expires, which is
 * exactly the failure mode the 2026-08-30 investigation had to reconstruct
 * from access-log byte counts (vivreal-hq site-cache-invalidation/findings.md
 * §3). That is why they are built by shared, unit-tested functions instead of
 * being re-spelled at each call site.
 *
 * Pure and dependency-free (no `server-only`, no env read of its own) so
 * `cacheTags.test.ts` can call it directly under `node --test`.
 */

/**
 * Tags for a collection-content read. Always carries `collection:<id>` so a
 * single collection edit invalidates exactly that read, plus `site:<id>` so a
 * site-wide invalidation (a chrome change that affects nav labels, say)
 * clears it too.
 *
 * Either id may be absent in practice — `SITE_ID` is unset in local dev and a
 * page can be missing its collection binding — and an empty tag would be a
 * tag that matches nothing while looking like it matches everything, so
 * blanks are dropped rather than emitted.
 */
export function collectionTags(siteId: string, collectionId: string): string[] {
  const tags: string[] = [];
  if (siteId) tags.push(`site:${siteId}`);
  if (collectionId) tags.push(`collection:${collectionId}`);
  return tags;
}

/** Tags for an integration-content read. Same shape, `integration:<type>`. */
export function integrationTags(siteId: string, type: string): string[] {
  const tags: string[] = [];
  if (siteId) tags.push(`site:${siteId}`);
  if (type) tags.push(`integration:${type}`);
  return tags;
}

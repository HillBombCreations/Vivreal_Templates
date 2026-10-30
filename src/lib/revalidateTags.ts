/**
 * The cache tags a signed webhook event drops, moved out of
 * `src/app/api/revalidate/route.ts` unchanged (owner ideas T10) so a test can
 * call it: the route imports `next/server`, which `node --test` cannot load.
 *
 * A per-page save (VR_Secure_API S16, `PUT /api/site/pages/:pageSlug`) sends
 * `site.updated` with the page's `slug`. Every page render reads its page
 * through `getSiteData()`, whose read carries `site:<SITE_ID>`, so dropping
 * that one tag refreshes the saved page whatever its address; no per-path
 * purge is needed. `revalidateTags.test.ts` pins both halves.
 */
/**
 * Derive the cache tags to invalidate from a webhook event. Returns the set of
 * tags whose cached entries should be dropped. Always includes the site-chrome
 * tag for site-level events; content/collection events also drop the specific
 * collection tag so a single edit invalidates exactly the affected reads.
 */
export function tagsForEvent(event: string, data: Record<string, unknown> | undefined, siteId: string): string[] {
  const tags = new Set<string>();
  const siteTag = siteId ? `site:${siteId}` : null;

  if (event.startsWith("site.")) {
    if (siteTag) tags.add(siteTag);
  }

  if (event.startsWith("collection.") || event.startsWith("content.")) {
    // collectionObj.refID is the collection group id the object belongs to.
    const refID =
      (data?.collectionObj as Record<string, unknown> | undefined)?.refID ??
      data?.refID ??
      data?.collectionId ??
      (data?._id as unknown);
    if (typeof refID === "string" && refID) tags.add(`collection:${refID}`);
    // Collection structure changes can affect nav/labels shown in chrome.
    if (event.startsWith("collection.") && siteTag) tags.add(siteTag);
  }

  if (event.startsWith("integration.")) {
    const type = data?.type;
    if (typeof type === "string" && type) tags.add(`integration:${type}`);
  }

  return [...tags];
}

/**
 * Whether an event also purges every page of the site by PATH (owner ideas
 * PR 11, found while proving review B2). Measured on two production builds,
 * the base of this PR included: some prerendered pages are written WITHOUT
 * the data tags their reads carry (`/about` with no `site:<id>`, an item page
 * with neither `site:` nor `collection:`), so a Save that drops those tags
 * left them serving the old copy until their 300 s timer. Every page carries
 * Next's implicit path tags, so `revalidatePath('/', 'layout')` reaches them
 * all. Same scope as the tag purge (the receiving instance, D43, D47), and
 * only for an event that drops at least one tag.
 */
export function purgesWholeSite(tags: readonly string[]): boolean {
  return tags.length > 0;
}

/**
 * Cache-invalidation profile used by the Studio-edit webhook
 * (`POST /api/revalidate`).
 *
 * Next 16's `revalidateTag(tag, profile)` takes either a named `cacheLife`
 * profile or an inline `{ expire }` object, and the two behave very
 * differently against the tag manifest:
 *
 *   'max'         -> writes { stale: now, expired: now + 365d }. The read-side
 *                    predicate `areTagsExpired()` requires `expired <= now`, so
 *                    the entry is NEVER dropped: it is served stale one more
 *                    time and repaired by a best-effort background refetch.
 *   { expire: 0 } -> writes { stale: now, expired: now }, which DOES satisfy
 *                    `areTagsExpired()`. The entry is dropped and the very next
 *                    render refetches.
 *
 * A customer who just saved an edit must not be served the pre-edit bytes even
 * once, so this site uses the hard form.
 *
 * This lives in its own module, rather than inline in the route, so the
 * behaviour can be proven by CALLING Next's real revalidation path in
 * cacheInvalidation.test.ts. `route.ts` imports `next/server` and cannot be
 * loaded by `node --experimental-strip-types`, and a source-regex assertion on
 * the literal `{ expire: 0 }` would prove nothing about what Next does with it.
 *
 * SCOPE: this repairs the invalidation on the Amplify compute instance that
 * receives the webhook. It cannot reach the OTHER instances serving the same
 * site, because the tag manifest is a per-process Map. That residual window is
 * bounded by SITE_CACHE_TTL_SECONDS; closing it properly is the ISR migration
 * (docs/projects/isr-migration/plan.md).
 */
export const HARD_INVALIDATION = { expire: 0 } as const;

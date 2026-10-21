/**
 * The one parse of `SITE_CACHE_TTL_SECONDS`, the per-site TTL (seconds) for
 * cached public reads.
 *
 * Kept free of Next and Sentry imports on purpose: `next.config.ts` imports it
 * to clamp `expireTime`, and `src/lib/api/client.ts` imports it for the data
 * reads, so both see the same number. If they parsed differently, a page's
 * effective `revalidate` (the lowest of the route literal and every cached
 * read) and `expireTime` could disagree, and that gap is the background
 * regeneration window Amplify starves (see `next.config.ts`).
 *
 * Default 60 stays well under VR_Client_API's signed media-URL lifetime, so no
 * cached payload can carry an expired CDN link at the default. Do not raise it
 * here: the provisioner sets 300 per site, and a longer TTL is an ops step
 * taken together with the signed-URL TTL in VR_Client_API.
 *
 * Invalid, absent, or below-one values fall back to 60: never crash a render
 * (or a build) on a bad env value, never silently disable caching. The floor
 * is taken before the positivity check, so `0.5` falls back instead of
 * becoming 0.
 */
export const DEFAULT_SITE_CACHE_TTL_SECONDS = 60;

export function parseSiteCacheTtlSeconds(raw: string | undefined): number {
  if (!raw) return DEFAULT_SITE_CACHE_TTL_SECONDS;
  const floored = Math.floor(Number(raw));
  return Number.isFinite(floored) && floored > 0 ? floored : DEFAULT_SITE_CACHE_TTL_SECONDS;
}

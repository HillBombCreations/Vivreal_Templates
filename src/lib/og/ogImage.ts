import 'server-only';
export {
  resolveSiteOrigin,
  resolveSiteOriginResult,
  resolveCanonicalUrl,
  buildDetailUrl,
  isRefusedOrigin,
} from './siteOrigin';
export type {
  OriginSurface,
  OriginSiteData,
  OriginResolution,
  RefusedOriginCandidate,
} from './siteOrigin';

/**
 * The OG-image URL builders. They live in `./ogCard.ts` (pure, no
 * `server-only`) so `node --experimental-strip-types --test` can import and
 * CALL them; this module re-exports them so every existing
 * `@/lib/og/ogImage` import is unchanged, and so a server component still
 * reaches them through the server-only barrel.
 */
export { buildOgImageUrl, buildOgItemImageUrl } from './ogCard';

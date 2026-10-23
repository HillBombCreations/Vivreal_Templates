/**
 * Stable, public image addresses on the site's own host (discovery batch 3.10
 * item 15, 2026-10-22).
 *
 * WHY. Every image a page names is a CloudFront URL signed to expire, so the
 * JSON-LD `logo` and `image` a crawler stores stop working days later (or the
 * unsigned form, which this distribution refuses outright). Two routes give
 * each picture an address that never expires:
 *   - `/brand/logo`: the site's logo;
 *   - `/img/<slug>/<itemId>`: the primary image of one item on one page.
 * Each re-signs and fetches the picture server side on every edge miss and
 * streams the bytes back with a long public cache.
 *
 * NOT A PROXY. Both routes are keyed by THIS site's own data: the picture is
 * found from the site record (logo) or from the page and item the route names,
 * read from this site's own content. Nothing a caller sends becomes a URL that
 * is fetched, so the routes cannot be pointed at another tenant's media or at
 * anywhere else. As a second fence, only an https URL on Vivreal's media hosts
 * is ever fetched, and only an image content type is ever returned.
 *
 * Pure apart from the injectable `fetch`, so it runs under `node --test`.
 */
import type { SiteData } from '@/types/SiteData';
import { isDemoSite } from '../seo/demoSafety.ts';
import { resolveSiteOrigin } from '../og/siteOrigin.ts';
import { unsignMediaUrl } from '../../components/JsonLd/unsignMediaUrl.ts';

export const STABLE_IMAGE_CACHE_CONTROL = 'public, max-age=86400, s-maxage=604800';

/** The hosts VR_Client_API signs media on. Anything else is never fetched. */
const MEDIA_HOSTS: ReadonlySet<string> = new Set(['media.vivreal.io', 'client.vivreal.io']);

export function brandLogoUrl(origin: string): string {
  return `${origin}/brand/logo`;
}

export function itemImageUrl(origin: string, slug: string, itemId: string): string {
  return `${origin}/img/${encodeURIComponent(slug)}/${encodeURIComponent(itemId)}`;
}

/**
 * The origin stable image URLs are published on: the durable public origin of
 * a live site, never an Amplify build host, and none for a demo (which is not
 * indexed and keeps today's URLs).
 */
export function stableImageOrigin(siteData: Parameters<typeof resolveSiteOrigin>[0] & Pick<SiteData, 'degraded'>): string {
  if (isDemoSite(siteData)) return '';
  return resolveSiteOrigin(siteData, { surface: 'durable' });
}

/**
 * The JSON-LD image for a signed picture: the stable route when there is a
 * picture and a durable origin, else exactly what was emitted before
 * (`unsignMediaUrl`), so a site with no public origin changes nothing.
 */
export function jsonLdImage(origin: string, stableUrl: string, signedUrl: string | undefined): string | undefined {
  if (!signedUrl) return undefined;
  return origin ? stableUrl : unsignMediaUrl(signedUrl);
}

/** An https URL on Vivreal's media hosts, or `false`. */
export function isMediaUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && MEDIA_HOSTS.has(url.hostname);
  } catch {
    // Not a URL: nothing to fetch.
    return false;
  }
}

/**
 * Fetch a signed picture and answer with its bytes under the stable cache, or
 * a 404 when there is no picture, it is not on a media host, the fetch fails,
 * or what came back is not an image.
 */
export async function stableImageResponse(
  signedUrl: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const missing = () =>
    new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
  if (!isMediaUrl(signedUrl)) return missing();
  try {
    const upstream = await fetchImpl(signedUrl, { cache: 'no-store', redirect: 'follow' });
    const contentType = upstream.headers.get('content-type') ?? '';
    if (!upstream.ok || !contentType.startsWith('image/')) return missing();
    return new Response(await upstream.arrayBuffer(), {
      status: 200,
      headers: { 'Content-Type': contentType, 'Cache-Control': STABLE_IMAGE_CACHE_CONTROL },
    });
  } catch {
    // Upstream unreachable: no picture to give, the same answer as none.
    return missing();
  }
}

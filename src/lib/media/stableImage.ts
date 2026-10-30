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
  // Only a picture on Vivreal's media hosts can be served from the stable
  // route (review 2026-10-23); any other link (an owner-pasted URL, say) would
  // 404 there, so it keeps the link it had.
  return origin && isMediaUrl(signedUrl) ? stableUrl : unsignMediaUrl(signedUrl);
}

/**
 * Sent with every proxied picture, on all three image routes (`/brand/logo`,
 * `/img/...` and the OG card proxy), review 2026-10-23. An SVG served from the
 * site's own origin could otherwise run script there: `nosniff` stops a
 * browser guessing a type, and the sandboxing policy disables script, plugins
 * and every fetch while letting the SVG's own inline styles draw it.
 */
export const IMAGE_SAFETY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
});

/**
 * Above this many bytes an original is NOT proxied: the route answers a 302 to
 * the signed URL instead (review 2026-10-23). Chosen over streaming because the
 * limit that bites is the hosting compute's response payload cap (a Lambda
 * response, about 6 MB, binary bodies counted after base64), which a streamed
 * body still has to fit under on a host that buffers the response. 4 MB leaves
 * room for that encoding. The redirect is `private, no-store`, so no cache
 * keeps a signature that expires; the stable URL stays what crawlers store.
 */
export const MAX_PROXIED_IMAGE_BYTES = 4 * 1024 * 1024;

function oversizeRedirect(signedUrl: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: signedUrl, 'Cache-Control': 'private, no-store', ...IMAGE_SAFETY_HEADERS },
  });
}

/**
 * Fetch a picture and answer with it, or `null` when there is nothing to
 * give (the callers decide what "nothing" means: a 404 here, the generated
 * card for OG). `mediaOnly` adds the two fences the stable routes need: only a
 * Vivreal media URL is fetched and only an `image/*` answer is passed on.
 */
export async function proxyImage(
  signedUrl: string | undefined,
  {
    cacheControl,
    mediaOnly,
    oversize,
    fetchImpl = fetch,
  }: {
    cacheControl: string;
    mediaOnly: boolean;
    /**
     * An original over `MAX_PROXIED_IMAGE_BYTES`: `'redirect'` answers the
     * 302 (the stable routes); `'none'` answers `null`, so the OG route draws
     * its generated card and keeps its rule that a share card never hands a
     * crawler the expiring signed URL.
     */
    oversize: 'redirect' | 'none';
    fetchImpl?: typeof fetch;
  },
): Promise<Response | null> {
  const tooLarge = () => (oversize === 'redirect' ? oversizeRedirect(signedUrl as string) : null);
  if (!signedUrl || (mediaOnly && !isMediaUrl(signedUrl))) return null;
  try {
    const upstream = await fetchImpl(signedUrl, { cache: 'no-store', redirect: 'follow' });
    if (!upstream.ok) return null;
    const declared = upstream.headers.get('content-type');
    if (mediaOnly && !declared?.startsWith('image/')) return null;
    const contentType = declared || 'image/jpeg';
    const length = Number(upstream.headers.get('content-length'));
    if (Number.isFinite(length) && length > MAX_PROXIED_IMAGE_BYTES) return tooLarge();
    const body = await upstream.arrayBuffer();
    // No (or a wrong) Content-Length: measured after reading instead.
    if (body.byteLength > MAX_PROXIED_IMAGE_BYTES) return tooLarge();
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': contentType, 'Cache-Control': cacheControl, ...IMAGE_SAFETY_HEADERS },
    });
  } catch {
    // Upstream unreachable: no picture to give, the same answer as none.
    return null;
  }
}

/** An https URL on Vivreal's media hosts, or `false`. */
export function isMediaUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    // `port === ''`: the same host on another port is another service (#223 review N2).
    return url.protocol === 'https:' && url.port === '' && MEDIA_HOSTS.has(url.hostname);
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
  const proxied = await proxyImage(signedUrl, { cacheControl: STABLE_IMAGE_CACHE_CONTROL, mediaOnly: true, oversize: 'redirect', fetchImpl });
  return (
    proxied ??
    new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' } })
  );
}

/** What an image route learned from its item read (both `/img` routes). */
export interface ItemImageRead {
  /** The picture's signed URL, when the item and its picture were found. */
  signedUrl?: string;
  /** The read behind the lookup failed or came back degraded. */
  degraded: boolean;
  /** The item itself was found (with or without the picture asked for). */
  itemFound: boolean;
}

/**
 * The answer for one item read (review of #212/#213). A degraded read that
 * found no item cannot say whether the picture exists, so it is a 503
 * `no-store` (an edge must not keep a 404 after the read recovers). Otherwise
 * exactly `stableImageResponse`: the picture, or the cacheable 404 for a real
 * miss on a healthy read, or for an item that has no such picture.
 */
export async function itemImageResponse(read: ItemImageRead, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (read.degraded && !read.itemFound) {
    return new Response('Try again shortly', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  return stableImageResponse(read.signedUrl, fetchImpl);
}

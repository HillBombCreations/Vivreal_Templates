/**
 * Pure decisions behind the two `/og/*` routes: which URL points at a card,
 * and what goes on it.
 *
 * Both routes are `.tsx` (they build an `ImageResponse`), which
 * `node --experimental-strip-types` cannot load at all, so everything here is
 * kept out of them and dependency-free — the same split
 * `src/components/JsonLd/schema.ts` and `src/lib/api/collections/mapItem.ts`
 * already use. The rendering half lives in `./ogCardRender.tsx`.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;

/**
 * Cache the generated card / proxied image at the CDN so repeated crawler hits
 * don't regenerate or re-proxy on every request.
 */
export const OG_CACHE_CONTROL =
  'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';

/**
 * Perceived-lightness check so card text stays legible on any brand color.
 * Standard luma weights; > 0.6 ⇒ treat as light (use dark text). Non-hex or
 * malformed input ⇒ treated as dark (white text), the safer default.
 */
export function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length < 6) return false;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

/**
 * Build the Open Graph image URL for a PAGE. Always points at the dynamic
 * `/og/[slug]` route (a stable, non-expiring URL crawlers can cache). That
 * route proxies the page's Studio-uploaded image (`labels.ogImage`) when
 * present and otherwise generates a branded card — so the emitted `og:image`
 * never carries a short-lived signed media URL.
 */
export function buildOgImageUrl(origin: string, slug: string): string {
  return `${origin}/og/${encodeURIComponent(slug)}`;
}

/**
 * Build the Open Graph image URL for ONE ITEM under a page.
 *
 * Detail items used to inherit the parent page's card, because the only
 * builder took the page slug. Every recipe under `/recipes` therefore shared
 * one image (and, where the author had set a page-level SEO title, one title
 * too) — which defeats the entire point of pasting a recipe link into a
 * caption. The item id is in the path, so two items can never collide.
 *
 * The reason this is a route and not the item's own media URL is unchanged and
 * load-bearing: item media is a CloudFront-SIGNED URL with a finite TTL, and a
 * crawler re-fetches an `og:image` hours or days after it first saw it. The
 * route re-resolves and re-signs on every request, so ITS url never expires.
 */
export function buildOgItemImageUrl(
  origin: string,
  slug: string,
  itemId: string,
): string {
  return `${buildOgImageUrl(origin, slug)}/${encodeURIComponent(itemId)}`;
}

/** The minimum a page config has to carry for a card heading. */
export interface OgHeadingPage {
  name?: string;
  labels?: Record<string, string>;
  seo?: { metaTitle?: string };
}

/** Satori has no overflow handling worth relying on; cap the heading instead. */
const MAX_HEADING_LENGTH = 100;

/**
 * The heading a PAGE's generated card carries. Shared by both routes so the
 * per-item route's fallback card is identical to the one the page-level route
 * would have produced.
 */
export function resolvePageOgHeading(
  page: OgHeadingPage | undefined,
  fallbacks: { staticTitle?: string; siteName?: string; slug: string },
): string {
  return (
    page?.seo?.metaTitle ||
    page?.labels?.title ||
    page?.name ||
    fallbacks.staticTitle ||
    fallbacks.siteName ||
    fallbacks.slug
  ).slice(0, MAX_HEADING_LENGTH);
}

/** The shape `planOgItemCard` reads. A `ContentItem` satisfies it. */
export interface OgCardItem {
  title?: string;
  /** Already-signed CDN URL, as `toContentItem` resolves it. */
  imageUrl?: string;
}

/**
 * What the per-item OG route should return.
 *
 * `photo` — the item has its own picture; proxy those bytes.
 * `card`  — generate the branded card under `heading`.
 *
 * `heading` is carried on BOTH so a failed photo fetch still falls back to a
 * card naming the right item rather than the right page.
 */
export type OgItemCardPlan =
  | { kind: 'photo'; signedUrl: string; heading: string }
  | { kind: 'card'; heading: string };

/**
 * Decide the per-item card from the ITEM, falling back to the page only when
 * there is no item at all.
 *
 * The page fallback is deliberately narrow. An item with no photo still gets
 * its OWN generated card under its OWN title, because two photo-less recipes
 * sharing one card is the same defect this route exists to fix, just quieter.
 * The site-wide default share image (which the page-level route falls back to)
 * is skipped here for the same reason: it would put one image back on every
 * item.
 */
export function planOgItemCard(
  item: OgCardItem | undefined | null,
  pageHeading: string,
): OgItemCardPlan {
  const itemHeading = item?.title?.trim();
  const heading = (itemHeading || pageHeading).slice(0, MAX_HEADING_LENGTH);
  const imageUrl = item?.imageUrl?.trim();
  // `startsWith('http')` is the same reachability test the page-level route
  // applies before proxying: `getSignedUrl` returns '' for a non-media value.
  if (imageUrl && imageUrl.startsWith('http')) {
    return { kind: 'photo', signedUrl: imageUrl, heading };
  }
  return { kind: 'card', heading };
}

/**
 * What the generated card's top slot shows.
 *
 * `image` carries a `data:` URI built from bytes already fetched, so the card
 * renderer never fetches the logo a second time. `name` carries no source at
 * all: the card draws the site name as its own text instead.
 */
export type OgLogoPlan = { kind: 'image'; src: string } | { kind: 'name' };

/**
 * Same ceiling the stable logo proxy applies (`MAX_PROXIED_IMAGE_BYTES` in
 * `@/lib/media/stableImage`, not imported so this file stays loadable by
 * `node --test`; `ogCard.test.ts` pins the two equal). A logo past it is drawn
 * as the site name rather than base64 encoded into the render.
 */
export const MAX_OG_LOGO_BYTES = 4 * 1024 * 1024;

/** A hung media fetch must not hang the whole card. */
const OG_LOGO_FETCH_TIMEOUT_MS = 5000;

/**
 * How many redirects a logo fetch may follow. Every image logo VR_Client_API
 * serves is a stable `https://client.vivreal.io/media?bucket=..&key=..` link
 * that answers a 302 to a freshly signed `media.vivreal.io` URL
 * (`buildMediaUrl.js`, P0C). One hop is that redirect; a second is never
 * needed and is refused.
 */
const OG_LOGO_MAX_REDIRECTS = 1;

/** Any element named `text`, namespaced or not, in any case. */
const SVG_TEXT_ELEMENT = /<(?:[a-z][\w.-]*:)?text[\s/>]/i;

/**
 * Leading whitespace (JS `\s` includes the BOM), then any XML prolog, doctype
 * or comments, then `<svg`. Catches an SVG served without an SVG content type.
 */
const SVG_SNIFF = /^\s*(?:<\?xml[\s\S]*?\?>\s*|<!--[\s\S]*?-->\s*|<!DOCTYPE[\s\S]*?>\s*)*<svg[\s>]/i;

function looksLikeSvg(contentType: string | null, body: string): boolean {
  return /svg/i.test(contentType ?? '') || SVG_SNIFF.test(body.slice(0, 2048));
}

/**
 * True when a logo is an SVG that draws text.
 *
 * VR_Secure_API mints kit wordmarks as an SVG holding one `<text>` element
 * (`kitIdentity.js`). The OG renderer (Satori, then resvg) rasterises an
 * embedded SVG's text with whatever fonts the HOST has, and the hosting
 * compute has none of the wordmark families, so every glyph came out as a
 * missing-glyph box. Windows has the fonts, which is why it only showed in
 * production. Any `<text>` at all, mixed with paths or not, decides true: that
 * text would be boxes too.
 */
export function isTextWordmarkSvg(contentType: string | null, body: string): boolean {
  return looksLikeSvg(contentType, body) && SVG_TEXT_ELEMENT.test(body);
}

/**
 * Raster types Satori can embed, by magic bytes. Sniffed rather than read
 * from `content-type` because Satori parses the MIME out of a `data:` URI and
 * an unknown one (for example `application/octet-stream`) throws mid-render.
 */
function sniffRasterMime(bytes: Uint8Array): string | null {
  const starts = (sig: readonly number[], at = 0) => sig.every((b, i) => bytes[at + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (starts([0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}

/**
 * Satori sizes an embedded SVG from its root `viewBox`, else from its root
 * `width` and `height`, and throws mid-render when it has neither.
 */
function svgIsSizable(body: string): boolean {
  const root = /<svg[\s>][^>]*>?/i.exec(body)?.[0] ?? '';
  return /\sviewBox\s*=/i.test(root) || (/\swidth\s*=/i.test(root) && /\sheight\s*=/i.test(root));
}

/**
 * The hosts VR_Client_API signs media on: the same fence `/brand/logo` puts
 * on this same logo (`MEDIA_HOSTS` in `@/lib/media/stableImage`, restated so
 * this file stays loadable by `node --test`; `ogCard.test.ts` pins the two
 * equal). Before this fetch moved out of Satori, Satori refused loopback,
 * private and link-local addresses itself; the host fence replaces that.
 */
export const OG_LOGO_MEDIA_HOSTS: ReadonlySet<string> = new Set(['media.vivreal.io', 'client.vivreal.io']);

function isOgLogoMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    // `port === ''`: the same host on another port is another service (#223 review N2).
    return url.protocol === 'https:' && url.port === '' && OG_LOGO_MEDIA_HOSTS.has(url.hostname);
  } catch {
    // Not a URL: nothing to fetch.
    return false;
  }
}

/**
 * One line per fallback that is a failure (not a plain wordmark), so a fleet
 * of names or initials after a promote is diagnosable. Host only: the full
 * URL carries a CloudFront signature and is never logged.
 */
function logLogoFallback(logoSrc: string, reason: string): void {
  let host = 'invalid-url';
  try {
    host = new URL(logoSrc).hostname;
  } catch {
    // Keep 'invalid-url': the reason line is still worth having.
  }
  console.warn(`[og-logo] drawing the name instead of the logo: host=${host} reason=${reason}`);
}

/**
 * Decide the card's top slot from the logo's own bytes.
 *
 * Fail-closed: anything that is not a verified drawable image (no URL, a URL
 * off the media hosts, a redirect off the media hosts or past the one hop
 * allowed, a failed, slow or broken fetch or body read, an oversized body, an
 * unknown format, an SVG Satori cannot size, a text wordmark) plans `name`, so
 * an SVG is only ever handed to the image element after it has been read and
 * found to hold no text. This never throws.
 */
export async function resolveOgLogo(
  logoSrc: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OgLogoPlan> {
  if (!logoSrc.startsWith('http')) return { kind: 'name' };
  if (!isOgLogoMediaUrl(logoSrc)) {
    logLogoFallback(logoSrc, 'not-a-media-host');
    return { kind: 'name' };
  }

  try {
    // One timeout across every hop and the body read.
    const signal = AbortSignal.timeout(OG_LOGO_FETCH_TIMEOUT_MS);
    // `redirect: 'manual'` and the host check on each `Location`, not
    // `'follow'`: a redirect could otherwise leave the media hosts. It was
    // `'error'` until 2026-10-30, which threw on the 302 every image logo
    // answers, so every image-logo site drew its name (promote 41089220307).
    let url = logoSrc;
    let res = await fetchImpl(url, { redirect: 'manual', signal });
    for (let hops = 0; res.status >= 300 && res.status < 400; hops += 1) {
      // The redirect's own body is never read: release it, and its socket,
      // before the next hop or the fallback (#223 review N3). A failed cancel
      // only means the connection closes on its own, so it is not a failure.
      await res.body?.cancel().catch(() => undefined);
      const location = res.headers.get('location');
      const next = location ? new URL(location, url).href : '';
      if (hops >= OG_LOGO_MAX_REDIRECTS || !isOgLogoMediaUrl(next)) {
        logLogoFallback(logoSrc, hops >= OG_LOGO_MAX_REDIRECTS ? 'too-many-redirects' : 'redirect-off-media-host');
        return { kind: 'name' };
      }
      url = next;
      res = await fetchImpl(url, { redirect: 'manual', signal });
    }
    if (!res.ok) {
      logLogoFallback(logoSrc, `status-${res.status}`);
      return { kind: 'name' };
    }

    const length = Number(res.headers.get('content-length'));
    if (Number.isFinite(length) && length > MAX_OG_LOGO_BYTES) {
      logLogoFallback(logoSrc, 'too-large');
      return { kind: 'name' };
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_OG_LOGO_BYTES) {
      logLogoFallback(logoSrc, bytes.byteLength === 0 ? 'empty' : 'too-large');
      return { kind: 'name' };
    }

    const contentType = res.headers.get('content-type');
    const raster = sniffRasterMime(bytes);
    if (raster) return { kind: 'image', src: `data:${raster};base64,${Buffer.from(bytes).toString('base64')}` };

    const text = new TextDecoder().decode(bytes);
    if (!looksLikeSvg(contentType, text)) {
      logLogoFallback(logoSrc, 'unknown-format');
      return { kind: 'name' };
    }
    // A wordmark is the expected case for kit sites, not a failure: no log.
    if (isTextWordmarkSvg(contentType, text)) return { kind: 'name' };
    if (!svgIsSizable(text)) {
      logLogoFallback(logoSrc, 'svg-without-size');
      return { kind: 'name' };
    }
    return { kind: 'image', src: `data:image/svg+xml;base64,${Buffer.from(bytes).toString('base64')}` };
  } catch (err) {
    // Network error, timeout, refused redirect, or a body that broke mid-read.
    // The card still renders, with the site name in the top slot.
    logLogoFallback(logoSrc, err instanceof Error ? err.name : 'fetch-failed');
    return { kind: 'name' };
  }
}

/**
 * Render an image, and if the render fails, render once more from a fallback
 * plan. Satori throws on a logo it cannot parse (for example a truncated
 * PNG), and since the logo is passed as a `data:` URI that throw is no longer
 * swallowed by Satori's own image loader. The body is buffered so the throw
 * happens here, not halfway down a 200 the CDN would keep for an hour. The
 * first render's status and headers are kept.
 */
export async function renderWithFallback<P>(
  render: (plan: P) => Response | Promise<Response>,
  plan: P,
  fallback: P,
): Promise<Response> {
  try {
    const first = await render(plan);
    const body = await first.arrayBuffer();
    return new Response(body, { status: first.status, headers: first.headers });
  } catch (err) {
    console.warn(`[og-logo] render failed, drawing the fallback: ${err instanceof Error ? err.message : 'unknown'}`);
    const second = await render(fallback);
    const body = await second.arrayBuffer();
    return new Response(body, { status: second.status, headers: second.headers });
  }
}

/**
 * What the favicon and Apple touch icon (`src/app/icon.tsx`,
 * `src/app/apple-icon.tsx`) draw inside their brand-colour tile.
 *
 * `image`       a drawable logo, as `resolveOgLogo` decided it.
 * `initial`     the logo is a text wordmark or could not be read: the site's
 *               first letter or digit, drawn as Satori text in Outfit. A name
 *               will not fit in 32px, so the icons use the initial, not the name.
 * `placeholder` no logo configured, or no usable initial: the plain disc the
 *               icons have always drawn for a logo-less site.
 */
export type OgIconMarkPlan =
  | { kind: 'image'; src: string }
  | { kind: 'initial'; initial: string }
  | { kind: 'placeholder' };

/** The first letter or digit of a name, upper-cased; '' when there is none. */
export function siteInitial(name: string | undefined | null): string {
  const first = Array.from(name ?? '').find((ch) => /[\p{L}\p{N}]/u.test(ch));
  return first ? first.toLocaleUpperCase() : '';
}

/** Decide an icon's mark. Same logo decision as the share card, one place. */
export async function planIconMark(
  logoSrc: string,
  siteName: string | undefined | null,
  fetchImpl: typeof fetch = fetch,
): Promise<OgIconMarkPlan> {
  // No logo at all keeps the existing disc rather than switching every
  // logo-less site's favicon to a letter.
  if (!logoSrc.startsWith('http')) return { kind: 'placeholder' };
  const logo = await resolveOgLogo(logoSrc, fetchImpl);
  if (logo.kind === 'image') return logo;
  return iconFallbackMark(siteName);
}

/**
 * The icon mark when the logo cannot be drawn: also what an icon re-renders
 * with when its logo made the render itself fail (`renderWithFallback`).
 */
export function iconFallbackMark(siteName: string | undefined | null): OgIconMarkPlan {
  const initial = siteInitial(siteName);
  return initial ? { kind: 'initial', initial } : { kind: 'placeholder' };
}

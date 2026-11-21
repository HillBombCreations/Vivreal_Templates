/**
 * F608 (release C; F165-G1-11, SW-C8): the frame rule and its header set, on
 * every route of every site (customer sites, vivreal.io and the help site all
 * build this app).
 *
 * - `frame-ancestors 'self'` in an ENFORCED `Content-Security-Policy`: no other
 *   website can show a customer's pages, checkout or forms inside a frame. A
 *   site may still frame itself. QR-13 (vivreal-hq
 *   docs/projects/next-release-C/research-qr-bundle-2.md, 2026-11-20) found no
 *   live page, no vivreal.io page and no stored content that frames a Vivreal
 *   site, and Vivreal's own frames (Studio's preview, the admin review) point
 *   at the portal, not at a site. Until the script policy enforces, this
 *   directive is the whole enforced header; when it does, the script policy
 *   carries it in its one header. Either way `scriptPolicyHeaders`
 *   (`scriptPolicy.ts`, SP-3) writes the one enforced entry, because Next keeps
 *   only the last rule per header name.
 * - `X-Content-Type-Options: nosniff`: a browser never reads a response as a
 *   type other than the one it was sent as.
 * - `Referrer-Policy: strict-origin-when-cross-origin`: another site sees only
 *   this site's origin, never the page path or its query (a shop search, a
 *   checkout result id). It is what browsers already default to, written down
 *   so an old browser or a changed default cannot leak more.
 *
 * Pure (no `next/*`), so `next.config.ts` and the plain-Node runner both load it.
 */

export const STRICT_TRANSPORT_SECURITY = Object.freeze({ key: 'Strict-Transport-Security', value: 'max-age=31536000' });

/** The one frame directive every site sends (SW-C8). */
export const FRAME_ANCESTORS_DIRECTIVE = "frame-ancestors 'self'";

export const CONTENT_TYPE_OPTIONS = Object.freeze({ key: 'X-Content-Type-Options', value: 'nosniff' });

export const REFERRER_POLICY = Object.freeze({ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' });

/** The headers every route carries before the script policy: HSTS, then F608's two headers. */
export function baseSecurityHeaders(): Array<{ key: string; value: string }> {
  return [{ ...STRICT_TRANSPORT_SECURITY }, { ...CONTENT_TYPE_OPTIONS }, { ...REFERRER_POLICY }];
}

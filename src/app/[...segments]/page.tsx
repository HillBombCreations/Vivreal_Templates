import { notFound, permanentRedirect } from "next/navigation";
import { getSiteData } from "@/lib/api/siteData";
import { resolveMissingItemRedirect } from "@/lib/redirects";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Phase-0 gap, closed (two-axis detail-route design §5.1/§7.2 step 10 —
 * `docs/projects/industry-example-site-templates/two-axis-detail-route-design.md`).
 *
 * `[slug]/page.tsx` and `[slug]/[itemId]/page.tsx` each consult
 * `siteData.redirects` on their own not-found path, but BOTH are fixed-depth
 * routes (1 and 2 segments respectively) — Next.js never even invokes them
 * for a 3+-segment URL. A donor-exact redirect `from` of
 * `/santa-monica/injectables-fillers/botox` (the entire §15.1 decision: the
 * OLD 3-segment donor URL 301s to the NEW 2-segment `/santa-monica/botox`)
 * therefore fell through to Next's global `not-found.tsx` before ever
 * reaching a redirect check — found while wiring T0/T1.
 *
 * This catch-all is the narrowest fix that doesn't touch `MAX_SLUG_DEPTH` or
 * either existing route's contract:
 *
 *   - It is a REGULAR catch-all (`[...segments]`, not `[[...segments]]`), so
 *     it never matches the empty (root `/`) path — that stays the home
 *     route's alone.
 *   - Next.js route matching is by SPECIFICITY, not declaration order: a
 *     fixed-depth dynamic route (`[slug]`, `[slug]/[itemId]`) always wins
 *     over a catch-all at the same path depth (regular `[param]` segments
 *     have higher specificity than `[...catchAll]` — verified against the
 *     framework's own route-sorting contract, not assumed). So this file
 *     structurally can NEVER shadow the 1- or 2-segment routes; it only ever
 *     receives requests of 3+ segments, which had no other candidate route
 *     at all before this file existed.
 *   - It does exactly one thing: consult `siteData.redirects` and either
 *     301 or 404. No page rendering, no upstream calls beyond the single
 *     `getSiteData()` fetch every route already makes per request (deduped
 *     by `SITE_CACHE_TTL_SECONDS` — the same cache window every other route
 *     shares, so a site with an empty `redirects` array pays no NEW distinct
 *     upstream traffic, only the existing cached fetch).
 *
 * docs/bugs/page-layer-unvalidated-redirect-target: this route only exists
 * for a path with NO other matching route (see the specificity note above),
 * so an authored `to` here can never shadow live content — the same
 * missing-path invariant `resolveMissingItemRedirect()`'s doc comment
 * documents. Resolves via that shared helper (composes `resolveRedirect()`
 * with the same-origin guard `isSameOriginRedirectTarget()`) rather than a
 * hand-rolled resolve so this call site cannot drift from the other three
 * that decide the same class of redirect.
 */
export default async function DeepRedirectCatchAll({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments } = await params;
  const siteData = await getSiteData();
  const path = `/${segments.join("/")}`;
  const redirectTarget = resolveMissingItemRedirect(siteData.redirects, path);
  if (redirectTarget) permanentRedirect(redirectTarget);
  return notFound();
}

export async function generateMetadata() {
  const siteData = await getSiteData();
  const siteName = siteData?.businessInfo?.name || siteData?.name || "";
  return { title: `Not Found | ${siteName}` };
}

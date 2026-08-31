/**
 * The build-time render-mode gate for the ISR migration (Phase 3).
 *
 * WHY THIS EXISTS
 * ---------------
 * Pushing `Vivreal_Templates` main auto-syncs to every customer site branch, so
 * a rendering change reaches all 16 live sites on their next deploy. There is
 * no way to pilot one site by code alone. `SITE_RENDER_MODE` is the only thing
 * that keeps the ISR flip inert: unset (the fleet default) reproduces today's
 * `force-dynamic` rendering, and the pilot site opts in with one Amplify branch
 * env var. Reverting a site is unsetting it again.
 *
 * WHY THE GATE IS NOT `export const dynamic = <computed>`
 * ------------------------------------------------------
 * The plan assumed the gate could be expressed as route segment config derived
 * from this env var. It cannot. Next 16.3.3 parses `dynamic` / `revalidate`
 * out of the route file's SOURCE, and rejects anything that is not a literal
 * with a hard build failure on BOTH bundlers. Measured, not assumed:
 *
 *   Turbopack (`next build --turbopack`, the fleet's build command)
 *     "Next.js can't recognize the exported `dynamic` field in route.
 *      It needs to be a static string."   -> exit 1
 *   webpack (`next build --webpack`)
 *     "Unsupported node type \"ConditionalExpression\" at \"dynamic\"."
 *     "Invalid segment configuration export detected."   -> exit 1
 *
 * All three shapes fail identically: an imported const, an inline
 * `process.env.SITE_RENDER_MODE === 'isr' ? ... : ...`, and the same ternary on
 * a `NEXT_PUBLIC_`-prefixed name. The failures are recorded in
 * `docs/projects/isr-migration/phase-3-result.md`.
 *
 * So the route config is a LITERAL in every route file (`revalidate = 300`, no
 * `dynamic` export, i.e. `'auto'`), and the gate moved one layer in, to the
 * render itself: `enforceDynamicUnlessIsr()` below calls Next's documented
 * `connection()` when the env is unset, which opts that render out of
 * prerendering exactly the way `force-dynamic` does. Off state, measured: the
 * build route table is identical to the pre-change build, and no gated route
 * makes a single VR_Client_API call during the build.
 *
 * WHY `'auto'` AND NOT `'force-static'`
 * -------------------------------------
 * Under `'auto'` a page that reaches a request API falls back to dynamic
 * rendering for that page, per site, with no build failure. That is the whole
 * answer to "a product block can appear on any site's home page": Next decides
 * per site, from the site's own content, at build time. `'force-static'` would
 * instead make `headers()` return empty values and silently serve a wrong
 * render; `'error'` would fail the build for exactly the sites whose content
 * happens to reach one. Neither is survivable on a fleet whose page content
 * differs per customer.
 */

/** The env var name. Server only: must NEVER be prefixed `NEXT_PUBLIC_`. */
export const SITE_RENDER_MODE_ENV = 'SITE_RENDER_MODE';

/** The one value that turns ISR on. Anything else, including unset, is off. */
export const ISR_RENDER_MODE = 'isr';

/**
 * Page cache TTL in seconds when ISR is on. Must equal the `revalidate`
 * literal exported by every gated route file; `renderMode.test.ts` pins that.
 *
 * 300 is a ceiling, not a preference: VR_Client_API signs media URLs with
 * `CLOUDFRONT_SIGNED_URL_TTL_SECONDS = 300`, so HTML cached longer than that
 * can embed a signed URL that has already expired. Raising this requires
 * raising that TTL first (plan Phase 5).
 */
export const ISR_REVALIDATE_SECONDS = 300;

type EnvLike = Record<string, string | undefined>;

/**
 * True only for the exact opt-in value, case and whitespace insensitive.
 *
 * Fail closed on anything else. An operator who typos the value gets today's
 * behaviour, which is the safe side of that mistake; the failure mode of
 * "any non-empty value means on" is a fleet-wide flip from a stray
 * `SITE_RENDER_MODE=false`.
 */
export function isIsrRenderMode(env: EnvLike): boolean {
  return (env[SITE_RENDER_MODE_ENV] ?? '').trim().toLowerCase() === ISR_RENDER_MODE;
}

/**
 * Whether a gated route should opt this render out of prerendering.
 *
 * Split from the `connection()` call so the decision is testable by plain
 * `node --test`, which cannot load a module that imports `next/server`.
 */
export function shouldOptOutOfPrerender(env: EnvLike): boolean {
  return !isIsrRenderMode(env);
}

/**
 * The gate itself. `connection` is injected rather than imported so this module
 * stays free of `next/server` and can therefore be executed by
 * `node --experimental-strip-types --test`, which cannot resolve Next's bare
 * specifiers. Same shape, and the same reason, as
 * `resolvePreviewToken(draftMode, cookies)` in `previewToken.ts`.
 *
 * Gate off (`SITE_RENDER_MODE` unset, the fleet default): `connection()` marks
 * the render as needing a real request, which aborts static generation for that
 * route and makes it server rendered per request. That is the same outcome
 * `export const dynamic = 'force-dynamic'` produced, reached by the mechanism
 * Next documents for exactly this purpose
 * (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md`,
 * stable since 15.0.0, and the successor to `unstable_noStore`).
 *
 * Gate on: returns immediately and the route prerenders, subject to whatever
 * else the page's own content reaches. A page that goes on to read `headers()`
 * (the product path) or `searchParams` (products, schedule) still bails to
 * dynamic on its own, per site, which is the point.
 */
export async function optOutOfPrerenderUnlessIsr(
  connection: () => Promise<void>,
  env: EnvLike = process.env,
): Promise<void> {
  if (!shouldOptOutOfPrerender(env)) return;
  await connection();
}

/**
 * Make the CURRENT render uncacheable, because the data behind it is
 * `FALLBACK_SITE_DATA` and not the customer's site.
 *
 * WHAT THIS FIXES (ISR migration Phase 4, blocker 1)
 * -------------------------------------------------
 * 2026-08-31 02:41:10 UTC, Waves of Grain. An upstream Atlas failure made
 * `getSiteData()` return `FALLBACK_SITE_DATA`, `page.tsx` took its
 * `!homePageConfig` branch, and the resulting placeholder (title `Home`,
 * `<h1>Welcome</h1>`, ZERO occurrences of the brand) was emitted as a
 * **cacheable 200** carrying `s-maxage=300, stale-while-revalidate=31535700`.
 * Next stored it in the page cache and CloudFront stored it at the edge. A
 * 5m41s upstream outage produced 9m46s of a broken customer home page, the last
 * ~5 minutes of it served from the edge AFTER the origin had recovered. Spike B
 * proved `revalidateTag` cannot purge an Amplify-managed edge, so there was
 * nothing to clear it with (`isr-migration/phase-4-result.md`).
 *
 * WHAT `connection()` ACTUALLY DOES HERE — MEASURED, AND NOT WHAT WAS ASSUMED
 * ---------------------------------------------------------------------------
 * The obvious reading, "`connection()` makes the response carry
 * `private, no-cache, no-store` instead of `s-maxage`", is WRONG for an app PAGE
 * that Next classified SSG, which is precisely the route this fix targets. What
 * really happens, traced and then measured end to end:
 *
 *   1. `throwToInterruptStaticGeneration` sets `prerenderStore.revalidate = 0`
 *      (`next/dist/server/app-render/dynamic-rendering.js:273-284`), which
 *      `applyMetadataFromPrerenderResult` turns into `cacheControl.revalidate = 0`.
 *   2. For an app page, `build/templates/app-page-runtime.js` then hits
 *      `if (isSSG && cacheControl?.revalidate === 0 && !isDev && !isRoutePPREnabled)`
 *      and THROWS `E132`, "Page changed from static to dynamic at runtime". There
 *      is no uncacheable-200 state for an SSG app page in 16.3.3; a render either
 *      produces a storable entry or it fails.
 *   3. That failure is caught by `ResponseCache.revalidate`
 *      (`server/response-cache/index.js`), which re-sets the PREVIOUS GOOD entry
 *      with `revalidate = clamp(previous, 3, 30)` and re-throws.
 *
 * So the degraded render is never stored, and the outcome splits:
 *
 *   - A previous entry exists (the normal case: the 300s window expired during
 *     the outage). The visitor is served the site's LAST GOOD HTML and the good
 *     entry is kept, retried every 30s. Measured over a 334-second outage: every
 *     request 200, brand present, correct title, zero placeholder bytes emitted.
 *     This is better than the pre-fix behaviour, not merely safer.
 *   - No previous entry (a `site.updated` purge landed just before the outage,
 *     which is what happened on 2026-08-31, or a cold deployment). HTTP 500,
 *     21 bytes, and NO `Cache-Control` header at all, so nothing is pinned. The
 *     first request after recovery renders correctly and restores
 *     `s-maxage=300`. Residual: CloudFront's default error-caching minimum TTL
 *     means the 500 can sit at a POP for ~10s. Against 9m46s, that is the trade.
 *
 * An app ROUTE (`robots.txt`, `icon`, `apple-icon`, `sitemap.xml`) has no E132
 * branch (`build/templates/app-route.js`), so it simply renders uncached.
 *
 * At BUILD time the same call reclassifies the route `ƒ` and the build exits 0,
 * so a fleet build that runs during an outage no longer bakes the placeholder
 * into a static asset. Measured.
 *
 * NOT gated on `SITE_RENDER_MODE`. On a site that has not opted into ISR every
 * affected route is already dynamic, so this call lands in a `request` work unit
 * store where `connection()` resolves without doing anything: inert, by the same
 * mechanism that makes the gate above inert. Measured, gate off, upstream down:
 * the placeholder still serves 200 with `private, no-cache, no-store`, exactly
 * as before this change. Gating it on the env would add a dependency that buys
 * nothing and could be got wrong.
 *
 * WHY THE THROW IS SWALLOWED, AND WHY THAT IS NOT A SILENT CATCH
 * -------------------------------------------------------------
 * `throwToInterruptStaticGeneration` sets `prerenderStore.revalidate = 0` and
 * `store.dynamicUsageDescription` BEFORE it throws
 * (`next/dist/server/app-render/dynamic-rendering.js:273-284`), so the mark that
 * drives every outcome above survives the catch.
 *
 * Swallowing is what we WANT here, for two reasons:
 *
 *  1. The mark is what matters, not the throw. Everything above keys off
 *     `prerenderStore.revalidate === 0`, which is already set. Re-throwing adds
 *     nothing and only changes WHICH error surfaces. This is the same property
 *     `readBotVerdict()` relies on in `src/lib/api/client.ts`, measured in
 *     Phase 3.
 *  2. `connection()` is illegal in some work unit stores and throws a plain
 *     `Error` there rather than a `DynamicServerError` — inside
 *     `generateStaticParams` (E1125), inside `unstable_cache` (E840), inside
 *     `"use cache"` (E841/E837). `src/app/[slug]/page.tsx`'s
 *     `generateStaticParams()` calls `getSiteData()`, so a fleet build running
 *     during an upstream outage WOULD hit the `generate-static-params` case. A
 *     propagating implementation would hard-fail `next build` for all 16 sites
 *     in exactly the conditions this fix exists to survive. There is nothing to
 *     opt out of in those stores anyway: none of them produces a page response.
 *
 * The one store type where an unresolved promise is correct rather than wrong is
 * `prerender` (cacheComponents / PPR), where `connection()` returns a promise
 * that never settles so the prerender can stall and leave a dynamic hole. That
 * is the framework's intended behaviour and `await` is the right thing to do
 * with it. Neither `cacheComponents` nor PPR is enabled in `next.config.ts`.
 */
export async function optOutOfCachingDegradedRender(
  connection: () => Promise<void>,
): Promise<void> {
  try {
    await connection();
  } catch {
    // Deliberate, and load-bearing. See the docblock: in `prerender-legacy` the
    // uncacheable mark is already set on the work unit store by the time this
    // throw arrives, and in every other store that throws there is no page
    // response to protect. Re-throwing here would fail a fleet build during the
    // outage this exists to survive.
  }
}

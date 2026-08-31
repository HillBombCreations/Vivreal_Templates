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

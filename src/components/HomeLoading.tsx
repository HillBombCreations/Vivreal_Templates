import { PageSkeleton } from "@hillbombcreations/site-renderer";

/**
 * Home skeleton — single-sourced from the renderer's `PageSkeleton`
 * (`variant="home"`) so the live site and the Studio preview-shell boot
 * identically. Used by the home page's INLINE
 * `<Suspense fallback={<HomeLoading/>}>` boundary (app/page.tsx).
 *
 * Originally moved out of `app/loading.tsx` (2026-07-13) alongside a
 * shape-neutral route-level fallback. That route-level `loading.tsx` (and
 * its sibling `NeutralPageLoading` component) were deleted in
 * docs/bugs/templates-soft-404-and-301-status (Change 1b): the implicit
 * `<Suspense>` it gave every route flushed a `200` shell before an async
 * page's `notFound()` / `permanentRedirect()` could run, turning real 404s
 * and 301s into soft `200`s. This component survives unchanged — the home
 * page's own inline boundary here is unaffected by that deletion.
 */
export default function HomeLoading() {
  return <PageSkeleton variant="home" />;
}

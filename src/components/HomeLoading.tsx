import { PageSkeleton } from "@hillbombcreations/site-renderer";

/**
 * Home skeleton — single-sourced from the renderer's `PageSkeleton`
 * (`variant="home"`) so the live site and the Studio preview-shell boot
 * identically. Used by the home page's INLINE
 * `<Suspense fallback={<HomeLoading/>}>` boundary (app/page.tsx).
 *
 * Moved out of `app/loading.tsx` (2026-07-13): the route-level fallback is
 * now shape-neutral (see NeutralPageLoading) because it fronts EVERY route,
 * not just home — a catalog page booting behind a hero-shaped skeleton was
 * the wrong shape. The home page keeps this hero shape via its own inline
 * boundary, where the target page IS known.
 */
export default function HomeLoading() {
  return <PageSkeleton variant="home" />;
}

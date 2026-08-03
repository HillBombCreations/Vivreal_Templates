/**
 * Phase 0 of the two-axis detail-route design
 * (docs/projects/industry-example-site-templates/two-axis-detail-route-design.md
 * §5.1, §7.2 step 10, §8 T0) — the WS3 301 redirect mechanism.
 *
 * `blueprint.redirects` has existed on every migrated blueprint since the WS3
 * page-ledger work (Vivreal_Site_Migrator src/blueprint/ledger.js
 * buildRedirectMap) but was never consumed anywhere — a cutover whose URL
 * shape changed (a flattened deep slug, a renamed page) lost 100% of the old
 * URL's inbound-link / search-index equity to a plain 404. The migrator now
 * persists the map onto `siteData.redirects` (siteDetailsVal, same flat
 * precedent as `utilityStrip`/`edgeDock`); this module is the read side.
 *
 * Pure and dependency-free (no `next/navigation`, no fetch, no `server-only`)
 * so it runs under plain `node --test` — callers wrap the result in
 * `permanentRedirect()`.
 */

export interface SiteRedirect {
  from: string;
  to: string;
  status?: number;
}

/**
 * Normalize a path to the migrator's own comparable form (leading slash, no
 * trailing slash, query/hash stripped) — the exact normal form
 * Vivreal_Site_Migrator's `ledger.js#normalizeRedirectPath` already emits for
 * every `from`/`to` it writes, so a straight string compare here is correct
 * without re-deriving that normalization logic in two repos.
 */
function normalizePath(path: string): string {
  if (typeof path !== 'string' || !path) return '/';
  const base = path.split(/[?#]/)[0].replace(/\/+$/, '');
  const withSlash = base.startsWith('/') ? base : `/${base}`;
  return withSlash === '' ? '/' : withSlash;
}

/**
 * Resolve a 301 target for `path` against the site's authored redirect map.
 *
 * Returns `undefined` when `redirects` is absent/empty (the fleet default —
 * every site with nothing renamed pays only this one length check on the hot
 * 404 path) or when nothing matches. Deliberately exact-match only, no fuzzy
 * normalization beyond `normalizePath` — the design doc (§10) explicitly
 * rejects fuzzy scope/path matching as a way to silently resolve the wrong
 * target.
 *
 * Callers MUST only invoke this once every real page / detail-item lookup
 * has already failed (§7.2 step 10) — a redirect must never shadow live
 * content. That ordering is the caller's responsibility; this function has
 * no notion of "does a page exist," by design (it's the two route files'
 * job, not this shared helper's).
 */
export function resolveRedirect(
  redirects: SiteRedirect[] | null | undefined,
  path: string,
): string | undefined {
  if (!redirects || redirects.length === 0) return undefined;
  const target = normalizePath(path);
  for (const r of redirects) {
    if (r && normalizePath(r.from) === target) return r.to;
  }
  return undefined;
}

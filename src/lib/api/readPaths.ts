/**
 * The request paths of the three VR_Client_API reads a site's floor holds,
 * built in ONE place.
 *
 * WHY THIS IS ITS OWN MODULE. The build-time site snapshot
 * (`./snapshot/`, vivreal-hq docs/bugs/site-first-read-fallback/plan.md) is
 * keyed by the exact path string `clientFetchCached` was called with, and a
 * runtime read finds its floor by a map lookup on that same string. A key the
 * build writes in a different parameter order from the one the runtime asks
 * for is a floor that is present and never used, and every test still passes.
 * So the runtime readers (`./collections`, `./siteData`) and the build's fill
 * pass (`./snapshot/fill.ts`) build their paths through these functions and
 * nothing else.
 *
 * The parameter ORDER is part of the contract: `limit`, then `skip`, `sort`,
 * `search`, the filters, and the subject (`collectionId` or `type`) last. That
 * is the order the live key shapes carry (`collectionObjects?limit=100&
 * collectionId=<id>`, measured over every failed read 10-16 to 10-23).
 *
 * Plain module, no `server-only`, so `node --test` can call it.
 */
import { canonicalIntegrationType } from './collections/socialBand.ts';

export interface ListReadOpts {
  limit?: number;
  skip?: number;
  sort?: string;
  search?: string;
  filters?: Record<string, string>;
}

/** The shared query string of a list read, subject excluded. */
export function listReadParams(opts: ListReadOpts | undefined): URLSearchParams {
  const params = new URLSearchParams();
  if (opts?.limit != null) params.set('limit', String(opts.limit));
  if (opts?.skip != null) params.set('skip', String(opts.skip));
  if (opts?.sort) params.set('sort', opts.sort);
  if (opts?.search) params.set('search', opts.search);
  if (opts?.filters) {
    for (const [key, val] of Object.entries(opts.filters)) {
      if (key && val) params.set(`filters[${key}]`, val);
    }
  }
  return params;
}

/** `/tenant/collectionObjects?...&collectionId=<id>`, the generic collection read. */
export function collectionObjectsPath(collectionId: string, opts?: ListReadOpts): string {
  const params = listReadParams(opts);
  params.set('collectionId', collectionId);
  return `/tenant/collectionObjects?${params}`;
}

/**
 * `/tenant/integrationObjects?...&type=<stored type>`. The type is
 * canonicalised here (LinkedIn is stored camelCase upstream, see
 * `./collections/socialBand.ts`), so no caller can build the other spelling.
 */
export function integrationObjectsPath(type: string, opts?: ListReadOpts): string {
  const params = listReadParams(opts);
  params.set('type', canonicalIntegrationType(type));
  return `/tenant/integrationObjects?${params}`;
}

/** `/tenant/siteDetails?siteId=<id>`, the site shell read. */
export function siteDetailsPath(siteId: string): string {
  return `/tenant/siteDetails?siteId=${encodeURIComponent(siteId)}`;
}

/**
 * Which read paths the build-time snapshot may hold, and answer for.
 * vivreal-hq docs/bugs/site-first-read-fallback/plan.md, section 5.2.
 *
 * ALLOWLIST, NOT A DENYLIST. A path is eligible only when its route is one of
 * the three public reads a page is built from and EVERY query parameter it
 * carries is one this module names for that route. Anything else (a search
 * term, a filter, a parameter added next year) is ineligible by default, so a
 * new read never enters the floor until someone decides it should:
 *
 * | route                          | parameters allowed               | refused                                 |
 * |--------------------------------|----------------------------------|-----------------------------------------|
 * | `/tenant/siteDetails`          | `siteId` (this site's only)      | another site's id, an empty id          |
 * | `/tenant/collectionObjects`    | `limit`, `skip`, `sort`, `collectionId` | `search`, `filters[...]`, an excluded (storefront) collection |
 * | `/tenant/integrationObjects`   | `limit`, `skip`, `sort`, `type`  | a payments provider type (products and prices, owner decision 2) |
 *
 * A repeated parameter is refused too: the upstream reads one value, and a key
 * that could mean two things is not a key to answer from.
 *
 * Plain module, no `server-only`, so `node --test` drives it (T4).
 */
import { isPaymentsProvider } from '../../payments.ts';

const ALLOWED_PARAMS: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({
  '/tenant/siteDetails': new Set(['siteId']),
  '/tenant/collectionObjects': new Set(['limit', 'skip', 'sort', 'collectionId']),
  '/tenant/integrationObjects': new Set(['limit', 'skip', 'sort', 'type']),
});

interface ParsedPath {
  readonly route: string;
  readonly params: URLSearchParams;
}

function parse(path: string): ParsedPath | null {
  if (typeof path !== 'string') return null;
  const q = path.indexOf('?');
  if (q === -1) return null;
  return { route: path.slice(0, q), params: new URLSearchParams(path.slice(q + 1)) };
}

/** The collection a `collectionObjects` path names, else undefined. */
export function collectionIdOf(path: string): string | undefined {
  const parsed = parse(path);
  if (!parsed || parsed.route !== '/tenant/collectionObjects') return undefined;
  return parsed.params.get('collectionId') ?? undefined;
}

/**
 * The shape of a key with every value removed, for log lines that must not
 * carry ids: `collectionObjects?limit&skip&collectionId`.
 */
export function keyShape(path: string): string {
  const parsed = parse(path);
  if (!parsed) return String(path).split('?')[0].replace(/^\/tenant\//, '');
  return `${parsed.route.replace(/^\/tenant\//, '')}?${[...parsed.params.keys()].join('&')}`;
}

export function isFloorEligiblePath(
  path: string,
  siteId: string,
  excludedCollectionIds: readonly string[],
): boolean {
  const parsed = parse(path);
  if (!parsed) return false;
  const allowed = ALLOWED_PARAMS[parsed.route];
  if (!allowed) return false;

  for (const key of new Set(parsed.params.keys())) {
    if (!allowed.has(key)) return false;
    if (parsed.params.getAll(key).length !== 1) return false;
  }

  switch (parsed.route) {
    case '/tenant/siteDetails': {
      const id = parsed.params.get('siteId');
      return !!siteId && id === siteId;
    }
    case '/tenant/collectionObjects': {
      const id = parsed.params.get('collectionId');
      return !!id && !excludedCollectionIds.includes(id);
    }
    case '/tenant/integrationObjects': {
      const type = parsed.params.get('type');
      return !!type && !isPaymentsProvider(type);
    }
    default:
      return false;
  }
}

/**
 * Which of a page's detail items the site actually LINKS to (review of #190,
 * B1).
 *
 * THE DEFECT. The page list named every item of a `collection-list` page's
 * collection, and the detail route answered 200 for each, while the page drew
 * none of them as links: help.vivreal.io's 8 category pages bind the articles
 * collection with `sectionConfig: { detailEligible: false, scope: ... }`, so
 * the list grew from 74 to 586 addresses, every article repeated under every
 * category, each copy self-canonical.
 *
 * THE RULE, mirrored from the renderer (1.85.0) rather than guessed, so a link
 * it draws is never a 404 here and an address listed here is a link it draws:
 *   - SELF. A block on the page whose item binding is this collection links
 *     its items to `/<page>/<id>` unless that binding says
 *     `detailEligible: false`, and only the items inside that binding's
 *     `sectionConfig.scope` (`mapLayout` and the page-template arms of
 *     `composition/blocks.js`; both apply `applyScope` to the bound items).
 *   - INBOUND. A layout on a page that owns no detail route of its own (home,
 *     a standard page) links into the FIRST page that serves the collection
 *     (`resolveDetailRouteSlug` in `composition/detailRouteOwnership.js`),
 *     which ignores that owner's own `detailEligible`. So an owner whose own
 *     list opts out can still receive real links, and they count.
 *   - A page with NO block drawing the collection (the format-independent
 *     `detailPage.itemCollectionId` opt-in, a blockless legacy page) is left
 *     exactly as it was: unrestricted. Nothing here can see what links to
 *     those, so restricting them could 404 a live link.
 *
 * Errs toward MORE links wherever the renderer is not mirrored exactly: nested
 * group children are walked (the renderer composes them too), and a layout
 * that never emits a detail link at all still counts. A miss in that direction
 * lists an unlinked address; a miss in the other would 404 a linked one.
 *
 * Pure and dependency-free (no `server-only`, no renderer import, whose root
 * barrel pulls `next/link`), so it runs under `node --test`; the parity test
 * calls the renderer's own `resolveDetailRouteSlug` from its `dist`.
 */
import { pageDetailCollectionId } from './detailCollection.ts';
import { servesCollectionDetail } from './detailFormats.ts';

interface LinkBinding {
  collectionId?: string | null;
  integrationProvider?: string | null;
  title?: string | null;
  sectionConfig?: { detailEligible?: unknown; scope?: unknown; menuRole?: unknown } | null;
}

interface LinkBlock {
  type?: { kind?: string | null; dispatchId?: string | null } | null;
  config?: { bindings?: readonly LinkBinding[] | null; children?: unknown } | null;
}

/** The page shape this rule reads. Structural, so the route's and the page list's page types both fit. */
export interface LinkPage {
  slug?: string | null;
  format?: string;
  detailPage?: { enabled?: boolean; itemCollectionId?: string } | null;
  blocks?: readonly LinkBlock[] | null;
  collectionId?: string | null;
  collections?: readonly { collectionId?: string | null }[] | null;
}

/**
 * The scopes a page's items are linked under, or `null` when every item is
 * (no restriction, today's behaviour). `[]` means nothing links to any item.
 * Each scope is the binding's raw `sectionConfig.scope`, for `applyScope`.
 */
export type LinkScopes = readonly unknown[] | null;

/** The renderer's `SELF_DETAIL_FORMATS` (`detailRouteOwnership.js`). */
const SELF_DETAIL_FORMATS: ReadonlySet<string> = new Set([
  'shows',
  'team',
  'menu',
  'products',
  'collection-list',
  'catalog',
  'recipes',
]);

function isHomePage(page: LinkPage): boolean {
  return page.slug === 'home' || page.format === 'home';
}

/** Top-level blocks and, recursively, group children. */
function allBlocks(blocks: readonly LinkBlock[] | null | undefined): LinkBlock[] {
  const out: LinkBlock[] = [];
  for (const block of blocks ?? []) {
    if (!block) continue;
    out.push(block);
    const children = block.config?.children;
    // Cast: `children` is the renderer's nested block list; only the fields
    // `LinkBlock` declares are read, each optionally.
    if (Array.isArray(children)) out.push(...allBlocks(children as LinkBlock[]));
  }
  return out;
}

/** The renderer's `pageOwnsAnyDetailRoute`. */
function ownsAnyDetailRoute(page: LinkPage): boolean {
  if (isHomePage(page) || page.detailPage?.enabled === false) return false;
  return SELF_DETAIL_FORMATS.has(page.format ?? '') || servesCollectionDetail(page);
}

/** The renderer's `resolveMenuDetailCollectionsForPage`, the collections a menu page serves. */
function menuDetailCollectionIds(page: LinkPage): string[] {
  const bindings = allBlocks(page.blocks)
    .flatMap((b) => b.config?.bindings ?? [])
    .filter((b) => !!b?.collectionId);
  const items =
    bindings.find((b) => b.sectionConfig?.menuRole === 'items') ??
    bindings.find((b) => (b.title ?? '').toLowerCase().includes('item')) ??
    bindings[bindings.length - 1];
  const categories =
    bindings.find((b) => b.sectionConfig?.menuRole === 'categories') ??
    bindings.find((b) => (b.title ?? '').toLowerCase().includes('categor'));
  const ids = bindings
    .filter(
      (b) =>
        b !== items &&
        b !== categories &&
        b.collectionId !== items?.collectionId &&
        b.collectionId !== categories?.collectionId,
    )
    .map((b) => b.collectionId as string);
  return items?.collectionId ? [items.collectionId, ...ids] : ids;
}

/** The renderer's `pageServesCollectionDetail`. */
function servesCollection(page: LinkPage, collectionId: string): boolean {
  if (isHomePage(page) || page.detailPage?.enabled === false) return false;
  if (page.format === 'shows' || page.format === 'team') return pageDetailCollectionId(page) === collectionId;
  if (page.format === 'menu') return menuDetailCollectionIds(page).includes(collectionId);
  if (servesCollectionDetail(page)) {
    return (page.detailPage?.itemCollectionId || pageDetailCollectionId(page)) === collectionId;
  }
  return false;
}

/** The binding a block draws its items from: a page template's first collection binding, a layout's first binding. */
function itemBinding(block: LinkBlock): LinkBinding | undefined {
  const bindings = block.config?.bindings ?? [];
  if (block.type?.kind === 'page-template') return bindings.find((b) => b?.collectionId);
  const first = bindings[0];
  return first && !first.integrationProvider ? first : undefined;
}

/** Push this binding's scope; `true` when it links every item (no scope), which ends the search. */
function addLink(binding: LinkBinding, scopes: unknown[]): boolean {
  if (binding.sectionConfig?.detailEligible === false) return false;
  const scope = binding.sectionConfig?.scope;
  if (scope == null) return true;
  scopes.push(scope);
  return false;
}

/**
 * The scopes under which the site links `collectionId`'s items to
 * `/<page.slug>/<id>`. `pages` is every page of the site, home included.
 */
export function linkedItemScopes(page: LinkPage, pages: readonly LinkPage[], collectionId: string): LinkScopes {
  const scopes: unknown[] = [];
  let drawnHere = false;
  for (const block of allBlocks(page.blocks)) {
    const binding = itemBinding(block);
    if (binding?.collectionId !== collectionId) continue;
    drawnHere = true;
    if (addLink(binding, scopes)) return null;
  }
  if (!drawnHere) return null;

  for (const other of pages) {
    if (!other || other.slug === page.slug || ownsAnyDetailRoute(other)) continue;
    const owner = pages.find((p) => p && p.slug !== other.slug && servesCollection(p, collectionId));
    if (owner?.slug !== page.slug) continue;
    for (const block of allBlocks(other.blocks)) {
      // A page template on a page that owns no route links to that page, not here.
      if (block.type?.kind === 'page-template') continue;
      const binding = itemBinding(block);
      if (binding?.collectionId !== collectionId) continue;
      if (addLink(binding, scopes)) return null;
    }
  }
  return scopes;
}

/**
 * `items` narrowed to the ones some link reaches: the union of `scopeFn(items,
 * scope)` over `scopes`, in `items` order. `null` returns `items` unchanged.
 * `scopeFn` is the renderer's `applyScope`, passed in so this stays pure.
 */
export function restrictToLinked<T extends { id: string }>(
  items: T[],
  scopes: LinkScopes,
  scopeFn: (items: T[], scope: unknown) => readonly { id: string }[],
): T[] {
  if (scopes === null) return items;
  const linked = new Set<string>();
  for (const scope of scopes) for (const it of scopeFn(items, scope)) linked.add(it.id);
  return items.filter((it) => linked.has(it.id));
}

/**
 * Pure block-shape predicates for the generic-format `isEmpty` → notFound()
 * guard (buildPageContext.ts). Extracted to a sibling with NO imports so they
 * run under `node --test` (server-only/next modules can't load there — house
 * lesson from the Phase T round).
 */

/**
 * A FORM binding is content with zero items BY DESIGN (its collection is a
 * write-target inquiry sink, never a read source) — a form-carrying page is
 * never empty. Without this, a standard-format contact page (statement hero
 * + form) 404s despite rendering fine.
 */
export const hasFormBlock = (blocks: unknown): boolean =>
  Array.isArray(blocks) &&
  blocks.some((b) => {
    const block = b as {
      type?: { dispatchId?: string };
      config?: { children?: unknown };
    };
    return (
      block?.type?.dispatchId === 'form' || hasFormBlock(block?.config?.children)
    );
  });

/**
 * A STATIC content block (kind:'static' — about/bio-panel/section-header/…)
 * is content with zero collection items BY DESIGN: its copy lives in
 * config.labels, not in a collection. Without this, a standard-format page
 * whose whole body is authored prose (e.g. a migrated Weddings/Tea-Time page:
 * statement hero + rich static about block) 404'd mid-stream on the live site
 * despite carrying real content — surfaced on the A Bakeshop demo 2026-07-20.
 * Only labels-bearing static blocks count: a bare static block with no
 * authored labels is still no content.
 */
export const hasStaticContentBlock = (blocks: unknown): boolean =>
  Array.isArray(blocks) &&
  blocks.some((b) => {
    const block = b as {
      enabled?: boolean;
      type?: { kind?: string };
      config?: { labels?: Record<string, unknown> };
    };
    if (block?.enabled === false || block?.type?.kind !== 'static') return false;
    const labels = block?.config?.labels;
    return (
      !!labels &&
      Object.values(labels).some(
        (v) => (typeof v === 'string' && v.trim() !== '') || (v && typeof v === 'object'),
      )
    );
  });

/** The universal hero's block ids; its copy lives on `page.hero`, not the block. */
const HERO_DISPATCH_IDS = new Set(['hero', 'hero-showcase', 'hero-ecommerce']);

const hasText = (v: unknown): boolean => typeof v === 'string' && v.trim() !== '';

/** A stored photo or video: a page media descriptor carrying a key or a signed source. */
const hasMedia = (v: unknown): boolean => {
  if (!v || typeof v !== 'object') return false;
  const media = v as { key?: unknown; currentFile?: { source?: unknown } };
  return hasText(media.key) || hasText(media.currentFile?.source);
};

/** The owner wrote something into the page hero: words, a side photo, or background media. */
const heroIsAuthored = (hero: unknown): boolean => {
  if (!hero || typeof hero !== 'object') return false;
  const h = hero as {
    eyebrow?: unknown;
    title?: unknown;
    subtitle?: unknown;
    heroImage?: unknown;
    background?: { image?: unknown; video?: unknown; slides?: unknown };
  };
  if (hasText(h.eyebrow) || hasText(h.title) || hasText(h.subtitle) || hasMedia(h.heroImage)) return true;
  const bg = h.background;
  return !!bg && typeof bg === 'object' && (hasMedia(bg.image) || hasMedia(bg.video) || (Array.isArray(bg.slides) && bg.slides.length > 0));
};

/**
 * ST3 (fix-plan 2026-10-07): an enabled HERO block, or a config-authored
 * home-section block (a Split hero, a gallery of photos), is content with zero
 * collection items BY DESIGN, exactly like the static blocks above. Without
 * this, a page made from Blank with a Split hero titled "Hello" and a Long-form
 * list that holds nothing live yet was judged empty and answered 404.
 *
 * Only AUTHORED copy counts: the hero's own words or media on `page.hero`, or
 * a home-section block's labels. A bare hero block with nothing written (the
 * renderer would paint only the site name) is still no content, and a bound
 * list (`layout`, `page-template`) with nothing live is still no content.
 */
export const hasAuthoredHeroOrSectionBlock = (blocks: unknown, hero: unknown): boolean =>
  Array.isArray(blocks) &&
  blocks.some((b) => {
    const block = b as {
      enabled?: boolean;
      type?: { kind?: string; dispatchId?: string };
      config?: { labels?: Record<string, unknown> };
    };
    if (block?.enabled === false || block?.type?.kind !== 'home-section') return false;
    if (HERO_DISPATCH_IDS.has(block.type.dispatchId ?? '')) return heroIsAuthored(hero);
    const labels = block.config?.labels;
    return (
      !!labels &&
      Object.values(labels).some(
        (v) => hasText(v) || (Array.isArray(v) ? v.length > 0 : !!v && typeof v === 'object'),
      )
    );
  });

/**
 * One collection or integration read, reduced to the two things the emptiness
 * verdict needs: how many rows came back, and whether the read happened.
 */
export interface PageDataRead {
  /**
   * How many rows the READ returned, before anything that maps a row to a
   * displayable item had a chance to drop one.
   *
   * It is named for that and not called `count`, because the obvious value to
   * put here is `items.length` and `items.length` is wrong. The social post
   * mapper drops any row with no re-hosted picture or no outbound address
   * (`../collections/socialPost.ts`), so a feed that came back with six posts
   * can map to zero items. Counted after the mapper, that read is
   * indistinguishable from an integration that holds nothing, and on a page
   * whose only body is that band the verdict below turns it into
   * `notFound()` — a 404 on a live, published URL, which tells a crawler to
   * drop it.
   *
   * A feed with nothing to show is an empty section. It is never a page that
   * does not exist, and after this rename it cannot be made into one by
   * passing the wrong number without noticing.
   */
  readonly sourceCount: number;
  /** See `../degradedRead.ts`. `[]` is the same value either way. */
  readonly degraded: boolean;
}

/**
 * The ONE place a fetch result becomes an emptiness input.
 *
 * It exists so there is a single line to point a test at. `buildPageContext`
 * imports `server-only`, so nothing can execute it under `node --test`, and
 * before this the conversion was an inline `.map()` inside that unreachable
 * module — the exact expression that has to be right was the one expression
 * no test could reach.
 *
 * The parameter type names `sourceCount`, so a caller handing it a mapped
 * `items.length` has to rename the field to do it.
 */
export function pageDataReads(
  results: readonly { readonly sourceCount: number; readonly degraded: boolean }[],
): PageDataRead[] {
  return results.map(({ sourceCount, degraded }) => ({ sourceCount, degraded }));
}

/**
 * What a page's body resolved to, once "empty" and "unknown" are separated.
 *
 * `isEmpty` and `emptinessUnknown` are mutually exclusive by construction. That
 * is the whole correction: they used to be the same boolean.
 */
export interface EmptinessVerdict {
  /**
   * The page genuinely has no content, ON DATA THAT WAS ACTUALLY READ. This is
   * the state the generic-format `notFound()` exists for, and it still 404s.
   */
  readonly isEmpty: boolean;
  /**
   * The page has no content OTHER than collection items, and at least one of
   * those reads failed. Whether the page is empty is therefore not knowable,
   * and the caller must refuse rather than answer.
   *
   * A degraded read on a page that carries a form block or authored static copy
   * does NOT land here: that page has content regardless of what the collection
   * would have returned, so it renders exactly as it always has and a wobble
   * costs it nothing.
   */
  readonly emptinessUnknown: boolean;
}

/** Formats whose pages are never empty by definition. */
const NEVER_EMPTY_FORMATS = new Set(['static', 'checkout-success', 'checkout-cancel']);

/**
 * The structural half of the verdict, from the page config alone: no read.
 *
 * QA-G1-2: `renderComposedPage` calls this BEFORE its Suspense boundary to decide
 * which pages must have their data read before the shell flushes. Only a page
 * this returns true for can ever be judged empty, so only those pages give up
 * the streaming split to earn a real 404 status; every page with authored copy
 * keeps streaming exactly as before. `decidePageEmptiness` below reads the same
 * function, so the two cannot disagree about which pages could be empty.
 */
export function pageCouldBeEmpty(args: {
  isHome: boolean;
  format?: string;
  blocks?: unknown;
  hero?: unknown;
}): boolean {
  return (
    !args.isHome &&
    !NEVER_EMPTY_FORMATS.has(args.format ?? '') &&
    !hasFormBlock(args.blocks) &&
    !hasStaticContentBlock(args.blocks) &&
    !hasAuthoredHeroOrSectionBlock(args.blocks, args.hero)
  );
}

/** The formats the empty-page 404 has always been scoped to. */
const GENERIC_FORMATS = new Set(['standard', 'list', 'grid']);

/**
 * QA-G1-2: true when this page's body could be empty, so its data must be read
 * BEFORE the Suspense boundary for a 404 to carry a real status. Generic formats
 * only, and only pages whose config holds no authored content
 * (`pageCouldBeEmpty`, the same structural test the verdict itself applies).
 * Config only, no read, and no request input: `generateMetadata` calls it
 * before touching `searchParams`, so a page this rules out (a stored privacy
 * or terms page) never reads the URL query and stays prerenderable under ISR.
 */
export function pageMustDecideEmptiness(page: {
  format?: string;
  blocks?: unknown;
  hero?: unknown;
}): boolean {
  return (
    GENERIC_FORMATS.has(page.format ?? '') &&
    pageCouldBeEmpty({ isHome: false, format: page.format, blocks: page.blocks, hero: page.hero })
  );
}

/** The storefront query, as `parseProductQuery` returns it (structurally, no import). */
interface ShopperQuery {
  readonly filters?: Readonly<Record<string, string>>;
  readonly search?: string;
  readonly sort?: string;
}

/**
 * True when the shopper's storefront query narrows the products read: a search
 * term or any `f_` facet filter. Sort only reorders, so it does not count.
 *
 * Mirrors what `buildProductsQuery` actually sends upstream (`search` only when
 * non-empty, a filter only when its value is non-empty, which
 * `parseProductQuery` already guarantees).
 */
export function shopperQueryNarrows(query?: ShopperQuery): boolean {
  if (!query) return false;
  if (query.search) return true;
  return !!query.filters && Object.keys(query.filters).length > 0;
}

/**
 * Whether the empty-page 404 may be decided for this request at all.
 *
 * Review of #188, blocker 2: the products read is filtered on the server, so
 * its `sourceCount` counts the MATCHES, not the catalogue. A storefront-only
 * page searched for `zzz` reads zero rows, and judged on that it answered 404:
 * the shopper lost the page, the toolbar, and the way back. A page with a
 * narrowing query is therefore never empty. It renders, and the storefront
 * shows its own no-matches state under a 200.
 */
export function emptinessIsDecidable(
  page: { format?: string; blocks?: unknown; hero?: unknown },
  query?: ShopperQuery,
): boolean {
  return pageMustDecideEmptiness(page) && !shopperQueryNarrows(query);
}

/**
 * Decide whether a composed page has a body, and whether we are entitled to say
 * so.
 *
 * WHAT THIS FIXES
 * ...............
 * The expression this replaces lived inline in `buildPageContext.ts` and ended
 * in `.every((a) => a.length === 0)`. A collection read that FAILS resolves to
 * `[]` (the fetch helper swallows the error and returns the caller's fallback),
 * so a transient VR_Client_API wobble made a real, published page compute as
 * empty and answer `notFound()`. A 404 tells a crawler the URL is gone and to
 * drop it, which is how a load spike turns into a deindexing.
 *
 * The structural half of the verdict is evaluated FIRST and on its own, and
 * that ordering is load-bearing rather than tidy: a page with a form block or a
 * labels-bearing static block has content whatever the collections say, so it
 * must be reported as "not empty" even when a read failed. Refusing to render
 * it would trade the old bug for a new one on exactly the pages the two
 * predicates below were added to protect (the A Bakeshop Weddings and Tea-Time
 * pages).
 *
 * Only when the page's entire body IS its collection items does a failed read
 * make the verdict unknowable, and only then does the caller refuse.
 *
 * On healthy data this is byte-for-byte the old expression, including the empty
 * `reads` case: a page with no bindings at all has nothing to render and
 * `[].every(...)` was, and still is, `true`.
 */
export function decidePageEmptiness(args: {
  isHome: boolean;
  format?: string;
  blocks?: unknown;
  /** `page.hero`: where an enabled hero block's copy lives (ST3). */
  hero?: unknown;
  reads: readonly PageDataRead[];
}): EmptinessVerdict {
  if (!pageCouldBeEmpty(args)) return { isEmpty: false, emptinessUnknown: false };

  // ROWS IN HAND SETTLE IT, and they settle it before the degraded flag is
  // consulted. `sourceCount > 0` is POSITIVE PROOF that a read succeeded: a
  // degraded read always resolves to the empty sentinel
  // (`../degradedRead.ts`), so `degraded` implies `sourceCount === 0`
  // unconditionally and a non-zero count can never be a fallback artifact.
  //
  // Checking `degraded` first instead looks safer and is not. A generic page
  // routinely carries more than one binding: a collection block's primary plus
  // its filter collection, or a collection alongside a storefront group under
  // the universal page model. When the primary returns twelve items and the
  // filter read fails, the page has content in hand, rendered fine before this
  // change, and must keep rendering. Refusing it would turn a partial upstream
  // wobble into a hard error on a page that is demonstrably not empty, and it
  // would get MORE likely the more bindings a page has, which is backwards.
  //
  // Note this is not the mirror of the defect being fixed. That defect read
  // `count === 0` as evidence of emptiness, which is exactly what a failed read
  // produces. This reads `count > 0` as evidence of a successful read, which a
  // failed read cannot produce. One direction is sound and the other is not.
  const everyReadEmpty = args.reads.every((read) => read.sourceCount === 0);
  if (!everyReadEmpty) return { isEmpty: false, emptinessUnknown: false };

  // Nothing came back from anything. Now, and only now, does it matter whether
  // that is an answer or a silence.
  if (args.reads.some((read) => read.degraded)) {
    return { isEmpty: false, emptinessUnknown: true };
  }

  return { isEmpty: true, emptinessUnknown: false };
}

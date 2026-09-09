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


/**
 * One collection or integration read, reduced to the two things the emptiness
 * verdict needs: how many items came back, and whether the read happened.
 */
export interface PageDataRead {
  readonly count: number;
  /** See `../degradedRead.ts`. `[]` is the same value either way. */
  readonly degraded: boolean;
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
  reads: readonly PageDataRead[];
}): EmptinessVerdict {
  const couldBeEmpty =
    !args.isHome &&
    !NEVER_EMPTY_FORMATS.has(args.format ?? '') &&
    !hasFormBlock(args.blocks) &&
    !hasStaticContentBlock(args.blocks);

  if (!couldBeEmpty) return { isEmpty: false, emptinessUnknown: false };

  // Ordered before the count, deliberately. Counting first and checking the
  // flag second is the same bug in a new place: `count === 0` is exactly what a
  // failed read looks like.
  if (args.reads.some((read) => read.degraded)) {
    return { isEmpty: false, emptinessUnknown: true };
  }

  return {
    isEmpty: args.reads.every((read) => read.count === 0),
    emptinessUnknown: false,
  };
}

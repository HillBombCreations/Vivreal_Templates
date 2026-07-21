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

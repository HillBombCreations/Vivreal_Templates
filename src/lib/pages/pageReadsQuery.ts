/**
 * Whether a page can use the address query (owner ideas 2026-10-29, plan 3.8,
 * T10). Config only: no read, no request API.
 *
 * WHY IT EXISTS. `[slug]/page.tsx` used to await `searchParams` for EVERY
 * composed page, "harmless for pages without a storefront" in its own words.
 * It was not harmless: reading `searchParams` bails the whole slug to dynamic
 * rendering, so every composed inner page on an ISR site was rendered per
 * request and sent `no-store` (measured 2026-10-29: home pages HIT in 0.06 s,
 * inner pages `no-store` in 0.36 to 3.25 s). The route now awaits the query
 * only when this says the page can use it, and otherwise hands composition the
 * empty query, exactly the `generateMetadata` pattern beside it.
 *
 * TRUE (the page stays dynamic, as today), when ANY of:
 *  - a checkout result slug (`CHECKOUT_RESULT_SLUGS`) or format: it reads
 *    `?session_id=`, and because those slugs are listed on every site the
 *    route always has a bailing path, so the build writes no fallback for it
 *    (plan 3.8, research 1.11);
 *  - a `products`, `lookup` or `schedule` format (the storefront toolbar, the
 *    search box and `?view=` round-trip through the address);
 *  - a storefront anywhere in the blocks, at any depth, switched on or off:
 *    a `products` or `products-grid` block, or a group coordinated as
 *    `products` (the two arms `LIVE_PRODUCTS_OVERRIDES` controls);
 *  - a block-less (legacy) page: its sections come from `getPageBindingsByRole`
 *    at render time and cannot be ruled out from config, so it keeps today's
 *    behaviour.
 *
 * Erring towards TRUE only costs caching; erring towards false would serve a
 * cached, unfiltered storefront to a shopper who filtered it. Pure.
 */
import { CHECKOUT_RESULT_SLUGS } from './builtInPages.ts';

export interface QueryPageLike {
  slug?: string;
  format?: string;
  blocks?: unknown;
}

const QUERY_FORMATS: ReadonlySet<string> = new Set(['products', 'lookup', 'schedule', 'checkout-success', 'checkout-cancel']);
const STOREFRONT_DISPATCH: ReadonlySet<string> = new Set(['products', 'products-grid']);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function hasStorefront(blocks: unknown, depth = 0): boolean {
  if (!Array.isArray(blocks) || depth > 8) return false;
  for (const block of blocks) {
    if (!isRecord(block)) continue;
    const type = isRecord(block.type) ? block.type : {};
    const config = isRecord(block.config) ? block.config : {};
    if (typeof type.dispatchId === 'string' && STOREFRONT_DISPATCH.has(type.dispatchId)) return true;
    if (config.coordinated === 'products') return true;
    if (hasStorefront(config.children, depth + 1)) return true;
  }
  return false;
}

export function pageReadsQuery(page: QueryPageLike | null | undefined): boolean {
  if (!page) return true;
  if (typeof page.slug === 'string' && CHECKOUT_RESULT_SLUGS.includes(page.slug)) return true;
  if (typeof page.format === 'string' && QUERY_FORMATS.has(page.format)) return true;
  if (!Array.isArray(page.blocks) || page.blocks.length === 0) return true;
  return hasStorefront(page.blocks);
}

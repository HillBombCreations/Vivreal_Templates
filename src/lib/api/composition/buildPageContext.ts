import 'server-only';

import type {
  ComposePageInput,
  PageDataContextValue,
  ContentItem,
  SiteData as RendererSiteData,
  PageConfig as RendererPageConfig,
} from '@hillbombcreations/site-renderer';
import type { PageConfig, SiteData } from '@/types/SiteData';
import { getCollectionItems, getIntegrationItems } from '@/lib/api/collections';
import { getProductsAsContentItems } from './productBridge';
import { collectBindingTargets } from './bindings';

export interface PageContextResult {
  /** Ready to hand straight to `composePage(input)`. */
  input: ComposePageInput;
  /**
   * True when the composed body resolves to no content — the caller decides
   * `notFound()` (generic formats only). Mirrors the live generic-page guard
   * in `app/[slug]/page.tsx`.
   */
  isEmpty: boolean;
}

interface BuildArgs {
  siteData: SiteData;
  /** The active page config (for home, pass `siteData.homePageConfig`). */
  page: PageConfig;
  /** The consumer marks home explicitly — never inferred (live home may lack format:'home'). */
  isHome: boolean;
  /** Live products controlled query (only meaningful for `format === 'products'`). */
  productQuery?: { filters?: Record<string, string>; search?: string; sort?: string };
}

/**
 * Server-side data-context builder — the live analog of the Studio preview's
 * `buildPreviewRenderMessage` (`SiteEditor/buildPreviewContext.ts`) +
 * `usePreviewData`, collapsed into one async server function.
 *
 * It scans the page's bindings for the data it needs, fetches everything in a
 * single parallel `Promise.all` against already-signed VR_Client_API data, then
 * exposes the results through SYNC getters closing over the prefetched maps —
 * exactly the shape `composePage` consumes.
 *
 * Key differences from the preview builder (and why):
 *  - Execution: server, eager `Promise.all` (preview is a client hook with lazy
 *    per-binding effects).
 *  - Media: NONE signed here — VR_Client_API pre-signs `currentFile.source`
 *    (the preview round-trips `/api/proxy/get-media` for unsigned data).
 *  - `getSignedUrl` is omitted: the ecommerce banner falls back to
 *    `siteData.logo` and reads hero media off `page.labels`.
 *  - `mode: 'live'`, `emitSectionAnchors: false`: the live DOM never carried
 *    `data-section-id` anchors — keeping it false preserves byte-parity.
 */
export async function buildPageContext(args: BuildArgs): Promise<PageContextResult> {
  const { siteData, page, isHome, productQuery } = args;

  // 1. Determine the page's data needs from its bindings (+ products filter collection).
  const { collectionIds, integrationTypes } = collectBindingTargets(page);

  // 2. Fetch everything in parallel — server-side, already-signed.
  const [collectionEntries, integrationEntries] = await Promise.all([
    Promise.all(
      collectionIds.map(
        async (id) => [id, (await getCollectionItems(id, { limit: 100 })).items] as const,
      ),
    ),
    Promise.all(
      integrationTypes.map(async (type) => {
        // Route the products integration through the bridge so the gallery /
        // variant resolution survives and the server-side filter/sort/search
        // (controlled query) applies. Other integrations use the plain fetch.
        if (type === 'stripe' || page.format === 'products') {
          return [type, await getProductsAsContentItems({ integrationType: type, ...productQuery })] as const;
        }
        return [type, (await getIntegrationItems(type, { limit: 100 })).items] as const;
      }),
    ),
  ]);

  const itemsByCollection = new Map<string, ContentItem[]>(collectionEntries);
  const itemsByIntegration = new Map<string, ContentItem[]>(integrationEntries);

  // 3. Sync getters over the prefetched maps. `getSignedUrl` omitted (see docblock).
  const data: PageDataContextValue = {
    getItems: (id) => itemsByCollection.get(id) ?? [],
    getIntegrationItems: (type) => itemsByIntegration.get((type ?? '').toLowerCase()) ?? [],
    siteData: siteData as unknown as RendererSiteData,
  };

  // 4. Assemble the composePage input. `pages` = sibling configs (composition
  //    needs them for showcase/nav detection).
  const input: ComposePageInput = {
    page: page as unknown as RendererPageConfig,
    pages: (siteData.pageConfigs ?? []) as unknown as RendererPageConfig[],
    data,
    isHome,
    options: { mode: 'live', emitSectionAnchors: false },
  };

  // 5. Emptiness check for the generic-format `notFound()` parity.
  // A FORM binding is content with zero items BY DESIGN (its collection is a
  // write-target inquiry sink, never a read source) — a form-carrying page is
  // never empty. Without this, a standard-format contact page (statement hero
  // + form, the bakery-template contact addition) 404s despite rendering fine.
  const hasFormBlock = (blocks: unknown): boolean =>
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
  const isEmpty =
    !isHome &&
    page.format !== 'static' &&
    page.format !== 'checkout-success' &&
    page.format !== 'checkout-cancel' &&
    !hasFormBlock((page as { blocks?: unknown }).blocks) &&
    [...itemsByCollection.values(), ...itemsByIntegration.values()].every((a) => a.length === 0);

  return { input, isEmpty };
}

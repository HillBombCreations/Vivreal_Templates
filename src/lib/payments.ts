/**
 * Payments-provider membership for the checkout wire.
 *
 * The cart POSTs `products[] = [{ price, quantity, name }]` to `/api/checkout`
 * and VR_Client_API resolves the payments provider SERVER-SIDE from the
 * group's single active payments integration — so the Templates only need to
 * know *which* integration types count as a payments provider (cart wiring,
 * provider-scoped product fetches), never which one handles the charge.
 *
 * Keep this set in lock-step with VR_Secure_API's `PAYMENTS_PROVIDER_TYPES`
 * (`updateIntegrations.js:28`) — the D4 payments-mutex set. This is
 * deliberately a local mirror (same pattern as the renderer's `poweredBy.ts`
 * local tier set): a second private package dependency is not an option, and
 * Templates cannot import backend code.
 *
 * Shopify is EXCLUDED on purpose — its checkout is a hosted-redirect fork
 * (Phase 5) and it is not in the backend mutex set.
 */
import { storefrontSectionConfigOf } from "./storefront/storefrontConfig.ts";

export const PAYMENTS_PROVIDER_TYPES: ReadonlySet<string> = new Set([
  "stripe",
  "square",
]);

/**
 * Case-insensitive membership check against {@link PAYMENTS_PROVIDER_TYPES}.
 * Trims + lowercases before testing; empty/undefined/null -> false.
 */
export function isPaymentsProvider(type: string | undefined | null): boolean {
  if (!type) return false;
  return PAYMENTS_PROVIDER_TYPES.has(type.trim().toLowerCase());
}

/* ------------------------------------------------------------------ */
/* CartProvider mount gate                                             */
/* ------------------------------------------------------------------ */

type BindingLike = { collectionId?: string; integrationProvider?: string | null };
type BlockLike = {
  type?: { kind?: string };
  config?: { bindings?: BindingLike[]; children?: BlockLike[] };
};
export type CartGatePage = {
  format?: string;
  integrations?: Array<{ type?: string | null; name?: string | null }>;
  blocks?: BlockLike[];
};

/** True when any binding in this block subtree names a payments provider. */
function blockHasPaymentsBinding(block: BlockLike): boolean {
  const config = block?.config;
  if (!config) return false;
  if ((config.bindings ?? []).some((bd) => isPaymentsProvider(bd?.integrationProvider))) {
    return true;
  }
  // Recurse into group children — a coordinated Products group carries its
  // payments binding on the GRID CHILD (config.children[].config.bindings),
  // exactly like collectFromBlocks (composition/bindings.ts) already walks
  // for prefetch. Scanning only top-level bindings misses it, which left the
  // cart unmounted on storefront-unit pages (first live Square E2E).
  return (config.children ?? []).some(blockHasPaymentsBinding);
}

/**
 * Storefront Phase 0.2: a products page that only takes inquiries (the venue
 * storefronts) needs no bag. True only when the page's storefront, read from
 * the SAME first binding the renderer's listing reads, says
 * `purchaseMode: 'inquiry'` exactly, and nothing on the page names a payments
 * provider. Inquiry on a later binding does not count: the listing draws Add
 * buttons from the first binding, and those need a bag.
 */
export function isInquiryOnlyPage(page: CartGatePage): boolean {
  if (storefrontSectionConfigOf(page)?.purchaseMode !== "inquiry") return false;
  if ((page.blocks ?? []).some(blockHasPaymentsBinding)) return false;
  return !(page.integrations ?? []).some((i) => isPaymentsProvider(i.type ?? i.name));
}

/**
 * The CartProvider mount gate: does any page need the cart wired?
 *
 * Three prongs, in the order they historically accreted:
 *  1. legacy `format === 'products'` pages; Storefront Phase 0.2: an
 *     inquiry-only products page does not count (prong 1).
 *  2. legacy `page.integrations[]` naming a payments provider;
 *  3. block-authored pages whose bindings (at ANY depth, incl. coordinated
 *     group children) name a payments provider (SP-4 + the child recursion).
 */
export function pagesNeedCart(pages: CartGatePage[]): boolean {
  return (
    pages.some((p) => p.format === "products" && !isInquiryOnlyPage(p)) ||
    pages.some((p) =>
      (p.integrations ?? []).some((i) => isPaymentsProvider(i.type ?? i.name)),
    ) ||
    pages.some((p) => (p.blocks ?? []).some(blockHasPaymentsBinding))
  );
}

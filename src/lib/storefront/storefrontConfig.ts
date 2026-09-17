/**
 * Storefront Phase 0.2: a plain-Node mirror of the renderer's
 * `resolveStorefrontSectionConfig` (site-renderer
 * `src/composition/storefrontConfig.ts`), for the CartProvider mount gate.
 *
 * The bag gate must read the SAME binding the listing reads, or a page whose
 * first binding sells while a later one says inquiry would mount no bag under
 * Add buttons that then do nothing. It is a mirror, not an import, because
 * `payments.ts` runs under plain `node --experimental-strip-types` in tests and
 * the package barrel pulls `next/link`. `storefrontConfig.parity.test.ts` runs
 * this and the renderer's compiled function over the same pages, so a renderer
 * change that is not mirrored here fails the Templates suite.
 *
 * Rules (renderer blocks.ts:1906, :953-955): skip `enabled: false` at any depth;
 * the first `page-template:products` block answers with its first binding; a
 * `coordinated: 'products'` group answers with its enabled `products-grid`
 * child's first binding, and without one is not a storefront; plain groups are
 * searched depth first.
 */

type Loose = Record<string, unknown>;

function isRecord(value: unknown): value is Loose {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstBindingSectionConfig(block: Loose): Loose | undefined {
  const config = block.config;
  if (!isRecord(config) || !Array.isArray(config.bindings)) return undefined;
  const first: unknown = config.bindings[0];
  if (!isRecord(first)) return undefined;
  return isRecord(first.sectionConfig) ? first.sectionConfig : undefined;
}

function orderOf(block: unknown): number {
  return isRecord(block) ? Number(block.order ?? 0) : 0;
}

function search(blocks: unknown): { found: boolean; sectionConfig?: Loose } {
  if (!Array.isArray(blocks)) return { found: false };
  // The same `order` sort composition applies (renderer blocks.ts:1874, :803-805).
  const ordered = [...blocks].sort((a, b) => orderOf(a) - orderOf(b));
  for (const block of ordered) {
    if (!isRecord(block) || block.enabled === false) continue;
    const type = isRecord(block.type) ? block.type : {};
    const config = isRecord(block.config) ? block.config : {};
    if (type.dispatchId === 'products') return { found: true, sectionConfig: firstBindingSectionConfig(block) };
    if (type.kind === 'group' && config.coordinated === 'products') {
      const children = Array.isArray(config.children) ? config.children : [];
      const grid = children.find((child): child is Loose => isRecord(child) && isRecord(child.type) && child.type.dispatchId === 'products-grid');
      if (!grid || grid.enabled === false) continue;
      return { found: true, sectionConfig: firstBindingSectionConfig(grid) };
    }
    if (type.kind === 'group') {
      const nested = search(config.children);
      if (nested.found) return nested;
    }
  }
  return { found: false };
}

export function storefrontSectionConfigOf(page: { blocks?: unknown } | null | undefined): Record<string, unknown> | undefined {
  return search(page?.blocks).sectionConfig;
}

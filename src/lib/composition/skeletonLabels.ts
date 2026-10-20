/**
 * The words the loading placeholder (the renderer's `ComposedPageSkeleton`)
 * draws in its masthead while a composed page streams in.
 *
 * Kept out of `renderComposedPage.tsx` (JSX plus `server-only`, so no test can
 * load it) so the rule runs under `node --test`.
 */

type LabelsLike = Record<string, unknown>;

type BlockLike = {
  enabled?: boolean;
  type?: { kind?: string; dispatchId?: string } | null;
  config?: { labels?: unknown; [key: string]: unknown } | null;
};

export type SkeletonLabelSource = {
  labels?: unknown;
  blocks?: ReadonlyArray<BlockLike | null | undefined> | null;
};

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * V7.104 (W8 timing check, finding 1). A section header's words are stored
 * twice, on `page.labels` and on the Section header block's `config.labels`,
 * and Studio's Section header editor writes only the block copy. The page
 * draws its header from the block (the renderer's `mapSectionHeader`), so the
 * placeholder now does too: its title and subtitle come from the first
 * enabled Section header block, exactly as stored there (an empty one stays
 * empty rather than falling back to the stale page copy). Every other page
 * label rides along untouched. A page with no enabled Section header block
 * returns its own labels object, unchanged.
 *
 * Not fixed by writing both copies from Studio: that entrenches the duplicate.
 */
export function skeletonLabelsFor(page: SkeletonLabelSource): LabelsLike | undefined {
  // Cast: `labels` is the page's label bag (`Record<string, string>` on the
  // Templates PageConfig, unknown here so a raw page fits), read as values only.
  const pageLabels = page.labels as LabelsLike | undefined;
  const header = (page.blocks ?? []).find(
    (b) =>
      b?.enabled !== false &&
      b?.type?.kind === 'static' &&
      b?.type?.dispatchId === 'section-header',
  );
  if (!header) return pageLabels;
  // Cast: a block's `config.labels` is a free-form bag; only two keys are read.
  const blockLabels = (header.config?.labels ?? {}) as LabelsLike;
  return {
    ...(pageLabels ?? {}),
    title: text(blockLabels.title),
    subtitle: text(blockLabels.subtitle),
  };
}

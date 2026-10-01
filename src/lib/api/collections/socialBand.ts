/**
 * B3.1 and B3.2 (docs/projects/isr-and-social-pass/plan.md) — the combined
 * band, and the per post skip, as the LIVE SITE reads them.
 *
 * Both decisions live in the same place and this is the module that honours
 * them: the section's own binding `sectionConfig`.
 *
 *   platforms       string[]  the per platform ticks (B3.1). Absent means
 *                             "just this binding's own provider", which is
 *                             every band authored before this shipped.
 *   skippedPostIds  string[]  posts this section does not show (B3.2).
 *
 * ── WHY THE SKIP IS STORED THERE AND NOT ON THE POST ──────────────────────
 *
 * It is a HIDE, not an edit, and the distinction is load bearing rather than
 * stylistic: an editable record of something that happened on Instagram is a
 * lie waiting to be told. Three reasons, and the third decides it:
 *
 *   1. the stored post stays byte identical, which is what the gate asserts;
 *   2. it is per section, so the same post can be on one page and not
 *      another, which an owner with two pages expects;
 *   3. a skip written onto the post itself would be WIPED BY THE NEXT SYNC.
 *      `syncIntegrationData.js` hands Mongo a whole `objectValue` and `$set`
 *      on a whole subdocument replaces it. A hide that silently un-hides
 *      itself on the next sync is worse than no hide at all.
 *
 * ── THE ONE LIMIT OF THE COMBINED BAND, STATED RATHER THAN HIDDEN ─────────
 *
 * The renderer asks for a band's items BY PROVIDER and nothing else:
 * `blocks.ts` calls `ctx.data.getIntegrationItems(b.integrationProvider)`,
 * and the signature is `(type: string)`. So the consumer's only lever is what
 * it puts under that one key, and a page carrying TWO social bands that tick
 * DIFFERENT sets for the same provider has two answers and one key.
 *
 * This resolves that by refusing to merge for that provider rather than by
 * picking a winner. A band showing a platform its owner unticked is the exact
 * failure the control for B3.1 exists to catch, and a band showing only its
 * own provider is a degrade the owner can see and undo. Recorded here because
 * the better fix is a renderer that passes the binding, which is a change in a
 * different repository.
 *
 * Dependency-free and `.ts`-extension imported so `node --test` can load it,
 * the same tradeoff `./mapItem.ts` and `../composition/bindingTargets.ts`
 * take: every caller of this module imports `server-only`.
 */
import type { ContentItem } from '@/types/ContentItem';

/** The four platforms whose integration objects are social posts (plan §6b.3). */
const SOCIAL_POST_PROVIDERS: ReadonlySet<string> = new Set([
  'instagram',
  'tiktok',
  'facebook',
  'linkedin',
]);

export interface SocialBandConfig {
  /** Every provider whose posts this band shows, lower-cased, deduped. */
  platforms: string[];
  /** Post ids this section hides. */
  skipped: Set<string>;
}

/** Minimal shapes, so this module needs no runtime import to walk a page. */
interface BindingLike {
  integrationProvider?: string;
  sectionConfig?: Record<string, unknown>;
}
interface BlockLike {
  type?: { kind?: string };
  config?: { bindings?: BindingLike[]; children?: BlockLike[] };
}

function lower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean)
    : [];
}

/**
 * Every social band on a page, keyed by the provider the renderer will ask
 * for, with the platforms it shows and the posts it hides.
 *
 * A provider with two bands that disagree about its platform set is reduced to
 * that provider alone, per the limit in this module's header. Skips are
 * UNIONED rather than reduced, because a skip is a refusal and two sections
 * refusing different posts is not a conflict: it only ever shows less.
 */
export function socialBandConfigs(blocks: readonly BlockLike[] | undefined): Map<string, SocialBandConfig> {
  const byProvider = new Map<string, SocialBandConfig>();
  const platformSetByProvider = new Map<string, string>();
  const conflicted = new Set<string>();

  const walk = (list: readonly BlockLike[] | undefined): void => {
    for (const block of list ?? []) {
      const config = block?.config;
      if (!config) continue;
      if (block.type?.kind === 'group' && Array.isArray(config.children)) walk(config.children);

      for (const binding of config.bindings ?? []) {
        const provider = lower(binding.integrationProvider);
        if (!provider || !SOCIAL_POST_PROVIDERS.has(provider)) continue;

        const ticked = stringList(binding.sectionConfig?.platforms)
          .map((p) => p.toLowerCase())
          .filter((p) => SOCIAL_POST_PROVIDERS.has(p));
        // A band always shows its own provider. An owner who unticks every
        // platform including the one the band is bound to has unticked the
        // band, and that is what `platforms: []` means; the provider is NOT
        // re-added in that case, because re-adding it would make the tick
        // unable to turn anything off.
        const platforms = [...new Set(
          binding.sectionConfig && 'platforms' in binding.sectionConfig ? ticked : [provider],
        )];

        const fingerprint = [...platforms].sort().join(',');
        const seen = platformSetByProvider.get(provider);
        if (seen !== undefined && seen !== fingerprint) conflicted.add(provider);
        else platformSetByProvider.set(provider, fingerprint);

        const existing = byProvider.get(provider);
        if (existing) {
          for (const id of stringList(binding.sectionConfig?.skippedPostIds)) existing.skipped.add(id);
        } else {
          byProvider.set(provider, {
            platforms,
            skipped: new Set(stringList(binding.sectionConfig?.skippedPostIds)),
          });
        }
      }
    }
  };
  walk(blocks);

  for (const provider of conflicted) {
    const band = byProvider.get(provider);
    if (band) band.platforms = [provider];
  }
  return byProvider;
}

/** Newest first, which is decision 15b and the only order a feed has. */
function newestFirst(a: ContentItem, b: ContentItem): number {
  const at = a.date ? Date.parse(a.date) : NaN;
  const bt = b.date ? Date.parse(b.date) : NaN;
  // An undated post sorts last rather than first. `NaN` compares false against
  // everything, so without this an unparseable date would land wherever the
  // sort happened to put it, which differs between item counts.
  if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
  if (Number.isNaN(at)) return 1;
  if (Number.isNaN(bt)) return -1;
  return bt - at;
}

/**
 * The items one social band shows: every ticked platform's posts, mixed,
 * newest first, with the skipped ones gone.
 *
 * @param band       this provider's entry from `socialBandConfigs`
 * @param itemsFor   the already-fetched items for one platform
 */
export function socialBandItems(
  band: SocialBandConfig,
  itemsFor: (platform: string) => readonly ContentItem[] | undefined,
): ContentItem[] {
  const out: ContentItem[] = [];
  for (const platform of band.platforms) {
    for (const item of itemsFor(platform) ?? []) {
      // The skip is checked by the post's OWN id, which is the stored
      // document's `_id`. Nothing about the post changes, here or anywhere.
      if (band.skipped.has(item.id)) continue;
      out.push(item);
    }
  }
  return out.sort(newestFirst);
}

/** Is this integration type one whose objects are social posts? */
export function isSocialBandProvider(type: string): boolean {
  return SOCIAL_POST_PROVIDERS.has(lower(type));
}

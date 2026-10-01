/**
 * B1.5 (docs/projects/isr-and-social-pass/plan.md) — the post → item mapper.
 *
 * A synced social post and an ordinary content object already converge on one
 * shape (`ContentItem`, carrying `source: 'collection' | 'integration'`), which
 * is the whole reason the plan picked Option A. What a post does NOT share is
 * the shape's assumptions: it has a caption rather than a title, an outbound
 * address rather than a detail page, and it may have no usable picture at all.
 * This module is the three resolutions, in one place, applied after
 * `toContentItem` has done the image work.
 *
 *   1. NO TITLE, EVER. A caption is not a title. Mapping one to the other
 *      produces exactly the text-led card an owner called "precisely what a
 *      broken website looks like". Title and description are both forced
 *      absent here so a future adapter that starts writing `objectValue.title`
 *      cannot leak one through. The caption travels in `raw.caption`.
 *   2. THE LINK IS THE POST'S OWN ADDRESS, and nothing else. Both social
 *      layouts prefer `raw.link` over `item.href`
 *      (`MediaMosaicLayout.tsx`, `SocialPanelLayout.tsx`), and the Facebook
 *      sync adapter writes `objectValue.link` as the link ATTACHED to the post
 *      — a shared article, not the post. Left alone, a Facebook tile would
 *      send a visitor to someone else's website. So `link` and `url` are both
 *      overwritten with the permalink rather than read from.
 *   3. NO PICTURE, NO POST. Dropped before the layout sees it. A dropped post
 *      is invisible; a text card is a site that looks broken.
 *
 * AND ONE RULE THE PLAN STATES AS A REQUIREMENT RATHER THAN AS A DROP, applied
 * here as a drop because this is the last place it can be: an outbound address
 * is "the one field every social tile must have" (plan §1a). `media-mosaic`'s
 * own header says every tile IS an outbound link. A tile with no address
 * renders as a `<div>` that goes nowhere, which is the live defect §1a
 * records for every Instagram post Vivreal has ever synced — the Graph query
 * asks for `permalink` and `mapToDocument` throws it away. B1.4 fixes the
 * capture; this keeps an un-backfilled row off the page until it is re-synced.
 *
 * Dependency-free and `.ts`-extension imported so `node --test` can load it
 * directly, the same tradeoff `./mapItem.ts` takes and for the same reason:
 * `./index.ts` is `server-only`.
 */
import { toContentItem } from './mapItem.ts';
import type { ContentItem } from '@/types/ContentItem';

/**
 * The four platforms this pass is designed for (plan §6b.3). `x` is NOT one of
 * them, and `stripe` / `square` / `shopify` / `mailchimp` are integrations that
 * are not social at all — routing a product through the post mapper would
 * strip its title and drop every product with no image, so the set is an
 * allowlist rather than a "not a payments provider" test.
 *
 * LinkedIn is in the set because the shape is the same; whether a LinkedIn
 * member post may be STORED at all is a different question, decided at sync by
 * the per-post expiry (plan §6b.6: 48 hours for a member post).
 */
const SOCIAL_POST_PLATFORMS = new Map<string, string>([
  ['instagram', 'Instagram'],
  ['tiktok', 'TikTok'],
  ['facebook', 'Facebook'],
  ['linkedin', 'LinkedIn'],
]);

/** Is this integration type one whose objects are social posts? */
export function isSocialPostPlatform(type: string): boolean {
  return SOCIAL_POST_PLATFORMS.has(type.trim().toLowerCase());
}

/** The owner-facing platform name, shown on a tile's hover/focus chip. */
export function socialPlatformLabel(type: string): string {
  return SOCIAL_POST_PLATFORMS.get(type.trim().toLowerCase()) ?? '';
}

/**
 * Clip or photo, as the mosaic's play glyph reads it.
 *
 * TikTok is unconditionally a clip: the platform returns no video file, only a
 * poster still and an outbound link (plan §6b.7), so every TikTok tile is a
 * still that opens a video. Instagram and Facebook both write `postType`, and
 * `reel` is the only value either one uses for a clip (`sync/instagram.js`
 * maps `VIDEO` → `reel`; `sync/facebook.js` maps an attachment `media_type` of
 * `video` → `reel`).
 *
 * The mosaic can also INFER a clip from the link host, but only for hosts it
 * knows. Stating it here means a Facebook reel is marked as one, which that
 * inference would miss.
 */
function postKind(type: string, objectValue: Record<string, unknown>): 'video' | 'photo' {
  if (type === 'tiktok') return 'video';
  const postType = typeof objectValue.postType === 'string' ? objectValue.postType.toLowerCase() : '';
  return postType === 'reel' || postType === 'video' ? 'video' : 'photo';
}

function trimmed(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

/**
 * One raw integration object → one media-led `ContentItem`, or `null` when the
 * post must not reach a layout.
 *
 * `null` for exactly two reasons, both of which are the post failing to be a
 * post rather than an error: no usable picture, or no outbound address.
 *
 * @param raw a `/tenant/integrationObjects` document, as the API returns it
 * @param type the integration type the read was made for, already lowercased
 */
export function toSocialPostItem(raw: Record<string, unknown>, type: string): ContentItem | null {
  // Normalised ONCE, here. The integration type reaches this module spelled
  // however the binding spelled it, and `linkedIn` is genuinely camelCase in
  // `VR_CMS_API/src/createAndUpdateIntegrations/services/sync/index.js`, so a
  // bare `=== 'tiktok'` comparison further down would be a silent miss on any
  // caller that did not lowercase first.
  const platformKey = type.trim().toLowerCase();
  const base = toContentItem(raw, 'integration', type);

  // The picture is whatever `toContentItem`'s type-based scan resolved from a
  // SIGNED media descriptor. It can never be `objectValue.mediaUrls`: that is
  // a bare string holding the platform's own CDN link, and `getSignedUrl()`
  // returns '' for anything that is not an object carrying `currentFile`. That
  // is the property that stops a hotlink reaching a page, so it is asserted in
  // `socialPost.test.ts` rather than left to read as an accident.
  if (!base.imageUrl) return null;

  const address = trimmed(raw.permalink);
  if (!address) return null;

  // `url` is DELETED rather than kept or overwritten, and the reason is a
  // layout rather than tidiness. The renderer's `video` and `embed` layouts
  // declare exactly one required backing field, `url`, so an item carrying
  // one reads to the Studio's layout predicate as a feed those two can draw,
  // and what they draw is a player or an iframe. That is the single thing
  // this pass forbids outright (plan §6b.1: an iframe embed is the same
  // outbound call wearing a different hat). Both social layouts read
  // `raw.link` first and never reach `raw.url`, so nothing displayable is
  // lost. See `Vivreal_Portal_Mobile/src/components/Sites/Studio/LeftRail/
  // socialDisplayAs.ts`, which is where the consequence is asserted.
  const { url: _platformUrl, ...objectValue } = (raw.objectValue ?? {}) as Record<string, unknown>;
  void _platformUrl;
  const platform = trimmed(raw.platform) || platformKey;

  return {
    ...base,
    title: '',
    description: undefined,
    href: address,
    date: trimmed(raw.publishDate) || base.date,
    raw: {
      ...objectValue,
      // Both layouts read `raw.link` FIRST. Overwritten, not defaulted — see
      // resolution 2 in this module's header.
      link: address,
      channel: socialPlatformLabel(platformKey),
      platform,
      kind: postKind(platformKey, objectValue),
    },
  };
}

/**
 * Map a page of raw integration objects to displayable social post items,
 * dropping the ones that must not render.
 *
 * Returns `[]` when every post is dropped, which is the correct input to the
 * renderer's `dropHiddenIntegrationSections` — an integration-bound section
 * with no items renders no section element at all, rather than an empty
 * `<section>` with an `<h2>` reading `instagram` (plan §3d, B1.7R).
 */
export function toSocialPostItems(
  raws: Record<string, unknown>[],
  type: string,
): ContentItem[] {
  const items: ContentItem[] = [];
  for (const raw of raws) {
    const item = toSocialPostItem(raw, type);
    if (item) items.push(item);
  }
  return items;
}

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
 *   1. THE CAPTION IS THE TITLE, AND THE DESCRIPTION STAYS ABSENT. Those two
 *      halves pull in opposite directions on purpose, and the reason the
 *      split is drawn here rather than at the mapper's convenience is that
 *      `title` is what BOTH social layouts read for a tile's accessible name:
 *      `SocialPanelLayout` puts it in `alt=` on an `<img>` that is the
 *      anchor's only child, and `MediaMosaicLayout` puts it in `alt=` beside a
 *      platform chip. Forced empty, `social-panel` emits up to six links per
 *      band with NO accessible name at all (WCAG 2.4.4, 2.4.9, 4.1.2) and
 *      `media-mosaic` emits eight that all announce "Instagram". It was also a
 *      regression for a hand-authored row carrying `objectValue.title`, which
 *      is what the Comedy Collective's TikTok rows are.
 *
 *      What the empty title was PROTECTING against is real and has not gone
 *      away: a 300-character caption promoted into an `<h3>` is the text-led
 *      card an owner called "precisely what a broken website looks like". A
 *      mapper is still the wrong place to enforce it, because it cannot see
 *      which layout the item is going to; the layout SET is the only thing
 *      that can. So the caption travels as the name, and the exclusion is
 *      owed by the renderer's `requiredItemFields` / `isSocialEligible`.
 *
 *      THAT EXCLUSION DOES NOT HOLD YET, AND IT IS STATED HERE RATHER THAN
 *      ASSUMED. Measured against the installed 1.77.0 registry, 2026-10-01:
 *      ten layouts satisfy `isSocialEligible`, and FIVE of them print the
 *      title as visible text, not only into `alt=` — `captioned-media` into
 *      an `<h3>` at `text-2xl lg:text-[2rem] font-bold`, plus `arch-tiles`,
 *      `collage-strip`, `postcard-strip` and `photo-band-pager`. Every one of
 *      the five declares `requiredItemFields: ['imageUrl']` and nothing else,
 *      because each one's title print is GUARDED (`card.title && ...`) and the
 *      generator only proposes fields it finds in UNGUARDED text positions.
 *      The predicate's own docblock says it refuses a layout that prints the
 *      title; for a guarded print it does not.
 *
 *      Carrying the caption is still right, and it is not a regression for
 *      those five: no live site can reach them with a social band, because
 *      bands and the picker that offers this set both ship on this branch.
 *      The two layouts the plan actually ships, `social-panel` and
 *      `media-mosaic`, read `title` into `alt=` ONLY, and with it empty they
 *      emit links with no accessible name at all. Closing the remaining five
 *      is a `vivreal-site-renderer` change (declare `title` on them, or teach
 *      the extractor a guarded text position), and it is not a change this
 *      repo can make.
 *
 *      `description` stays absent because neither social layout reads it, so
 *      it could only ever become body copy.
 *
 *      The caption still travels in `raw.caption` as well. Removing that
 *      would be a silent break for anything already reading it.
 *   2. THE LINK IS THE POST'S OWN ADDRESS, over https, and nothing else.
 *      Both social layouts prefer `raw.link` over `item.href`
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
 * The post's own caption, under whichever key its adapter writes it.
 *
 * TWO KEYS, BECAUSE THE FOUR ADAPTERS USE TWO. Read from
 * `VR_CMS_API/src/createAndUpdateIntegrations/services/sync/` on
 * `feat/social-display-backend`, 2026-10-01: `instagram.js:105` writes
 * `caption`, `facebook.js:92` and `linkedIn.js:43` write `postContent`, and
 * `tiktok.js:122` writes BOTH with the same value. Reading `caption` alone
 * leaves every Facebook and LinkedIn tile with no accessible name, which is
 * the defect this function exists to close rather than half-close.
 */
function postCaption(objectValue: Record<string, unknown>): string {
  return trimmed(objectValue.caption) || trimmed(objectValue.postContent);
}

/**
 * The post's outbound address, or '' when it has none that may be rendered.
 *
 * WHERE IT LIVES. On `objectValue`, which is where all three syncing adapters
 * write it (`instagram.js:112`, `facebook.js:98`, `tiktok.js:128`, same ref
 * and date as above). The document ROOT is read as a fallback only, for a row
 * a human authored by hand.
 *
 * WHY HTTPS AND NOTHING ELSE. This value is written to `href` and to
 * `raw.link`, and both social layouts put `raw.link` straight into an
 * anchor's `href`. React 19.1 renders a `javascript:` URL there with a
 * development-only warning and no refusal, and an integration object is
 * owner-writable through the CMS, so an injected one is stored cross-site
 * scripting pointed at a customer's own visitors. Unlike an ordinary
 * collection item there is no legitimate relative, `mailto:` or plain-`http:`
 * case to preserve: a permalink on any of the four platforms is an absolute
 * https address, so the guard can be the strictest one that still admits
 * every real value.
 *
 * `startsWith` on the lower-cased string, with no prior stripping, is
 * deliberate. `trimmed()` has already removed whitespace; an ASCII control
 * character a browser would skip while reading the scheme survives it, and
 * leaves the string failing this test. Refusing that row is the correct
 * answer, so the strict form needs no companion strip.
 */
function postAddress(raw: Record<string, unknown>, objectValue: Record<string, unknown>): string {
  const address = trimmed(objectValue.permalink) || trimmed(raw.permalink);
  return address.toLowerCase().startsWith('https://') ? address : '';
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
  //
  // Hoisted above the two drops because `permalink` lives on `objectValue`,
  // so the address check needs this binding to exist first.
  const { url: _platformUrl, ...objectValue } = (raw.objectValue ?? {}) as Record<string, unknown>;
  void _platformUrl;

  // The picture is whatever `toContentItem`'s type-based scan resolved from a
  // SIGNED media descriptor. It can never be `objectValue.mediaUrls`: that is
  // a bare string holding the platform's own CDN link, and `getSignedUrl()`
  // returns '' for anything that is not an object carrying `currentFile`. That
  // is the property that stops a hotlink reaching a page, so it is asserted in
  // `socialPost.test.ts` rather than left to read as an accident.
  if (!base.imageUrl) return null;

  const address = postAddress(raw, objectValue);
  if (!address) return null;

  const platform = trimmed(raw.platform) || platformKey;

  return {
    ...base,
    // The caption, which is the accessible name both social layouts give a
    // tile. Falls back to whatever `toContentItem` resolved rather than to
    // '': a hand-authored row carries `objectValue.title` and no caption, and
    // blanking it is how eight hand-made TikTok tiles lost their names. See
    // resolution 1 in this module's header for why a mapper no longer has to
    // force this empty to keep a caption out of an `<h3>`.
    title: postCaption(objectValue) || base.title,
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

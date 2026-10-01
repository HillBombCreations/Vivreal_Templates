import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isSocialPostPlatform,
  socialPlatformLabel,
  toSocialPostItem,
  toSocialPostItems,
} from './socialPost.ts';

/**
 * B1.5-G and B1.5-C (docs/projects/isr-and-social-pass/plan.md).
 *
 * Every refuse case here is paired with an allow case in the same file. A
 * mapper that returned `null` for everything would pass the three drop tests
 * on its own, and a section that renders nothing for an unrelated reason looks
 * identical to one correctly hiding a picture-less feed.
 */

/** A post as `/tenant/integrationObjects` returns it once B1.4 has run. */
function syncedPost(over: Record<string, unknown> = {}): Record<string, unknown> {
  const { objectValue: objectOver, ...docOver } = over as {
    objectValue?: Record<string, unknown>;
  } & Record<string, unknown>;
  return {
    _id: '66f0a1b2c3d4e5f607182930',
    id: '17912345678901234',
    platform: 'instagram',
    permalink: 'https://www.instagram.com/p/C9xYzAbCdEf/',
    publishDate: '2026-09-14T10:04:00.000Z',
    objectValue: {
      caption: 'Sourdough out of the oven at six',
      postType: 'feed',
      // The platform CDN link the sync adapter writes. A bare string, and the
      // whole reason B1.4 re-hosts: it rotates, and when it does the owner's
      // page fills with broken images.
      mediaUrls: 'https://scontent.cdninstagram.com/v/t51.29350-15/rotates.jpg',
      // What B1.4 writes instead: a media descriptor VR_Client_API has signed.
      image: { key: 'groupObjects/bakery/ig-17912345678901234.jpg', currentFile: { source: 'https://client.vivreal.io/media?key=groupObjects%2Fbakery%2Fig.jpg' } },
      ...objectOver,
    },
    ...docOver,
  };
}

/* ------------------------------------------------------------------ */
/*  The platform set                                                   */
/* ------------------------------------------------------------------ */

test('[B1.5] the four social platforms are recognised, however they are spelled', () => {
  for (const type of ['instagram', 'tiktok', 'facebook', 'linkedIn', 'TikTok', ' instagram ']) {
    assert.equal(isSocialPostPlatform(type), true, `${type} must be a social platform`);
  }
});

test('[B1.5-C] a non-social integration is NOT routed through the post mapper', () => {
  // The control that matters most in this file. `stripe`/`square`/`shopify`
  // objects are PRODUCTS: the post mapper would strip their titles and drop
  // every one with no image, which is a storefront outage rather than a social
  // feature. `x` is excluded too — it is not one of the plan's four.
  for (const type of ['stripe', 'square', 'shopify', 'mailchimp', 'x']) {
    assert.equal(isSocialPostPlatform(type), false, `${type} must NOT be a social platform`);
  }
});

test('[B1.5] the platform label is the owner-facing name, not the key', () => {
  assert.equal(socialPlatformLabel('tiktok'), 'TikTok');
  assert.equal(socialPlatformLabel('linkedIn'), 'LinkedIn');
  assert.equal(socialPlatformLabel('stripe'), '');
});

/* ------------------------------------------------------------------ */
/*  B1.5-G — a post with a picture maps to a media-led item            */
/* ------------------------------------------------------------------ */

test('[B1.5-G] a post with a picture maps to an item with image, link, date and platform, and NO title', () => {
  const item = toSocialPostItem(syncedPost(), 'instagram');
  assert.ok(item, 'a post with a picture and an address must map to an item');

  assert.equal(item.imageUrl, 'https://client.vivreal.io/media?key=groupObjects%2Fbakery%2Fig.jpg');
  assert.equal(item.href, 'https://www.instagram.com/p/C9xYzAbCdEf/');
  assert.equal(item.date, '2026-09-14T10:04:00.000Z');
  assert.equal(item.raw?.platform, 'instagram');
  assert.equal(item.raw?.channel, 'Instagram');
  assert.equal(item.source, 'integration');

  // The ruling, asserted rather than implied: a caption is never a title and
  // never a description, because either one renders a text-led card.
  assert.equal(item.title, '');
  assert.equal(item.description, undefined);
  assert.equal(item.raw?.caption, 'Sourdough out of the oven at six');
});

test('[B1.5-G] the picture is the re-hosted copy, NEVER the platform CDN string', () => {
  // The hotlink is right there in `objectValue.mediaUrls` on every synced row.
  // Without the re-hosted descriptor there must be NO image at all, and
  // therefore no item — not a tile pointed at a URL that rotates.
  const item = toSocialPostItem(syncedPost({ objectValue: { image: undefined } }), 'instagram');
  assert.equal(item, null);

  const rehosted = toSocialPostItem(syncedPost(), 'instagram');
  assert.ok(rehosted);
  assert.ok(
    !rehosted.imageUrl?.includes('cdninstagram.com'),
    'a platform CDN host reached the page',
  );
});

test('[B1.5-G] the link is the POST, never a link the post merely contained', () => {
  // The Facebook sync adapter writes `objectValue.link` as the article a post
  // shared, and both social layouts read `raw.link` BEFORE `item.href`. Left
  // alone, a tile would send the visitor to someone else's website.
  const item = toSocialPostItem(
    syncedPost({
      platform: 'facebook',
      permalink: 'https://www.facebook.com/bakery/posts/pfbid0abc',
      objectValue: { link: 'https://some-newspaper.example/article', postType: 'post' },
    }),
    'facebook',
  );
  assert.ok(item);
  assert.equal(item.raw?.link, 'https://www.facebook.com/bakery/posts/pfbid0abc');
  assert.equal(item.href, 'https://www.facebook.com/bakery/posts/pfbid0abc');
});

test('[B1.5-G] no post item carries a `url`, because that is what an embed feeds on', () => {
  // The renderer's `video` and `embed` layouts each declare exactly ONE
  // required backing field, `url`. An item carrying one therefore reads to
  // the Studio's layout predicate as a feed those two can draw, and what they
  // draw is a player or an iframe — the one thing this pass forbids outright.
  // So `url` is dropped from the post's raw rather than kept or overwritten,
  // and an adapter that starts writing `objectValue.url` cannot reopen it.
  const item = toSocialPostItem(
    syncedPost({ objectValue: { url: 'https://www.tiktok.com/@bakery/video/7412' } }),
    'instagram',
  );
  assert.ok(item);
  assert.equal(item.raw?.url, undefined);
  // The paired allow: the address is still there, on the key the two social
  // layouts actually read.
  assert.equal(item.raw?.link, 'https://www.instagram.com/p/C9xYzAbCdEf/');
});

test('[B1.5-G] clip or photo is marked, and TikTok is always a clip', () => {
  const photo = toSocialPostItem(syncedPost(), 'instagram');
  assert.equal(photo?.raw?.kind, 'photo');

  const reel = toSocialPostItem(syncedPost({ objectValue: { postType: 'reel' } }), 'instagram');
  assert.equal(reel?.raw?.kind, 'video');

  // TikTok returns a poster still and no video file, ever, for anyone. The
  // mosaic's host-sniffing fallback would get this one right; a Facebook reel
  // it would not, which is why the marker is stated rather than inferred.
  const clip = toSocialPostItem(
    syncedPost({ platform: 'tiktok', permalink: 'https://www.tiktok.com/@bakery/video/7412', objectValue: {} }),
    'tiktok',
  );
  assert.equal(clip?.raw?.kind, 'video');

  const fbReel = toSocialPostItem(
    syncedPost({ platform: 'facebook', objectValue: { postType: 'reel' } }),
    'facebook',
  );
  assert.equal(fbReel?.raw?.kind, 'video');
});

/* ------------------------------------------------------------------ */
/*  B1.5-C — the drops, each paired with the allow case above          */
/* ------------------------------------------------------------------ */

test('[B1.5-C] a post with no usable picture maps to nothing', () => {
  // No media descriptor at all.
  assert.equal(toSocialPostItem(syncedPost({ objectValue: { image: undefined } }), 'instagram'), null);
  // A descriptor that was never signed — `currentFile.source` is what makes a
  // value a picture, and an unsigned one would 403 on the page.
  assert.equal(
    toSocialPostItem(syncedPost({ objectValue: { image: { key: 'groupObjects/bakery/ig.jpg' } } }), 'instagram'),
    null,
  );
  // What both adapters write when the post has no picture at all: an empty
  // string. It must not read as a picture, and it must not read as an error.
  assert.equal(
    toSocialPostItem(syncedPost({ objectValue: { image: undefined, mediaUrls: '' } }), 'instagram'),
    null,
  );
});

test('[B1.5-C] a post with no outbound address maps to nothing', () => {
  // Every Instagram post Vivreal synced before B1.4 is this row: the Graph
  // query asked for `permalink` and `mapToDocument` dropped it. A tile with no
  // destination renders as a div that goes nowhere, against `media-mosaic`'s
  // own contract that every tile IS an outbound link.
  assert.equal(toSocialPostItem(syncedPost({ permalink: undefined }), 'instagram'), null);
  assert.equal(toSocialPostItem(syncedPost({ permalink: '   ' }), 'instagram'), null);
});

test('[B1.5-C] a feed of only picture-less posts yields NO items, so the section renders nothing', () => {
  const none = toSocialPostItems(
    [
      syncedPost({ objectValue: { image: undefined } }),
      syncedPost({ _id: 'b', objectValue: { image: undefined } }),
    ],
    'instagram',
  );
  assert.deepEqual(none, []);

  // The paired allow: the SAME call with one usable post returns one item.
  // Without this, "renders no section" passes for a mapper that is simply
  // broken. The renderer half (an empty integration-bound section emitting no
  // `<section>` at all) is `dropHiddenIntegrationSections`, verified against
  // the published artifact by B1.7R.
  const some = toSocialPostItems(
    [syncedPost({ objectValue: { image: undefined } }), syncedPost({ _id: 'c' })],
    'instagram',
  );
  assert.equal(some.length, 1);
  assert.equal(some[0].id, 'c');
});

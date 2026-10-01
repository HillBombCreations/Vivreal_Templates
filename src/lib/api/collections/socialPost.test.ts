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
 *
 * THE FIXTURE IS THE SHAPE THE PRODUCT WRITES, AND IT HAS NOT ALWAYS BEEN.
 *
 * This file used to hand-write an `objectValue.image` descriptor under a
 * comment reading "What B1.4 writes instead", and put `permalink` at the
 * document root. Neither is what any adapter produces, so eleven green tests
 * were asserting a state no row has ever been in, and the one defect they
 * existed to catch, a mapper reading the address from the wrong level, was
 * invisible to all of them.
 *
 * The shape below is read off the two ends rather than imagined, on their
 * checked-out refs, 2026-10-01:
 *
 *   PRODUCER, VR_CMS_API `feat/social-display-backend`
 *     `shared/syncedPostMedia.js:51` names the re-hosted field `media`, and
 *     its header records that it is a descriptor ARRAY because that is
 *     already the convention for a social post's media in that service.
 *     `mediaFields` and `mediaExpiresAt` ride beside it (`CARRIED_FIELDS`).
 *     `sync/instagram.js:105,112` writes `caption` and `permalink` INSIDE
 *     `objectValue`; `publishDate` and `platform` are at the document root.
 *
 *   CONSUMER, VR_Client_API `main`
 *     `tenant/HelpFunctions/attachBase64ToMediaFields.js:20-31` walks
 *     `mediaFields` (filename to field key), and for an ARRAY node attaches a
 *     `currentFile` to EVERY descriptor in it. That is the signature
 *     `getSignedUrl()` resolves, and resolving it through an array is why
 *     `media` not being in `PREFERRED_IMAGE_FIELDS` costs nothing: the
 *     type-based second pass finds it.
 */

/** The signed URL VR_Client_API puts on the re-hosted copy. */
const SIGNED_SOURCE = 'https://client.vivreal.io/media?key=groupObjects%2Fbakery%2Fig.jpg';

const MEDIA_NAME = 'ig-17912345678901234.jpg';
const MEDIA_KEY = 'groupObjects/66f0a1b2c3d4e5f607182930/1759300000000-ab12cd/' + MEDIA_NAME;

/**
 * One re-hosted picture, signed, in the array the CMS stores and the shape
 * the client API returns. `currentFile` is what makes it a picture; without
 * it the same descriptor is an unsigned key that would 403 on the page.
 */
function signedMedia(): Record<string, unknown>[] {
  return [
    {
      key: MEDIA_KEY,
      name: MEDIA_NAME,
      type: 'image/jpeg',
      currentFile: { source: SIGNED_SOURCE, key: MEDIA_KEY, type: 'image/jpeg', name: MEDIA_NAME },
    },
  ];
}

/** A post as `/tenant/integrationObjects` returns it once B1.4 has run. */
function syncedPost(over: Record<string, unknown> = {}): Record<string, unknown> {
  const { objectValue: objectOver, ...docOver } = over as {
    objectValue?: Record<string, unknown>;
  } & Record<string, unknown>;
  return {
    _id: '66f0a1b2c3d4e5f607182930',
    id: '17912345678901234',
    groupID: 'grp_bakery',
    // Document ROOT, both of them. `publishDateFragment()` spreads
    // `publishDate` beside `platform`, not into `objectValue`.
    platform: 'instagram',
    publishDate: '2026-09-14T10:04:00.000Z',
    objectValue: {
      caption: 'Sourdough out of the oven at six',
      postType: 'feed',
      // The platform CDN link the sync adapter writes. A bare string, and the
      // whole reason B1.4 re-hosts: it rotates, and when it does the owner's
      // page fills with broken images. LEFT IN PLACE by the re-host, which is
      // why a mapper that read it would still find it.
      mediaUrls: 'https://scontent.cdninstagram.com/v/t51.29350-15/rotates.jpg',
      // The post's own address, on `objectValue`, which is the level all three
      // syncing adapters write it at.
      permalink: 'https://www.instagram.com/p/C9xYzAbCdEf/',
      // The re-hosted copy and the map that gets it signed.
      media: signedMedia(),
      mediaFields: { [MEDIA_NAME]: 'media' },
      mediaExpiresAt: '2027-03-14T10:04:00.000Z',
      mediaKind: 'photo',
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

test('[B1.5-G] a post with a picture maps to an item with image, link, date and platform', () => {
  const item = toSocialPostItem(syncedPost(), 'instagram');
  assert.ok(item, 'a post with a picture and an address must map to an item');

  assert.equal(item.imageUrl, SIGNED_SOURCE);
  assert.equal(item.href, 'https://www.instagram.com/p/C9xYzAbCdEf/');
  assert.equal(item.date, '2026-09-14T10:04:00.000Z');
  assert.equal(item.raw?.platform, 'instagram');
  assert.equal(item.raw?.channel, 'Instagram');
  assert.equal(item.source, 'integration');
  assert.equal(item.raw?.caption, 'Sourdough out of the oven at six');
});

test('[B1.5-G] the signed picture resolves out of the `media` ARRAY, not out of a named field', () => {
  // The whole image half of the chain in one assertion. `media` is not in
  // `PREFERRED_IMAGE_FIELDS`, the stored value is an ARRAY rather than a lone
  // descriptor, and `resolveImage`'s second pass is what has to find it by
  // type. If any of those three stops being true the feed renders nothing and
  // nothing else here would say why.
  const item = toSocialPostItem(syncedPost(), 'instagram');
  assert.equal(item?.imageUrl, SIGNED_SOURCE);

  // The paired refuse: the SAME array with the signature removed is not a
  // picture. An unsigned descriptor would 403 on the page.
  const unsigned = toSocialPostItem(
    syncedPost({
      objectValue: { media: [{ key: MEDIA_KEY, name: MEDIA_NAME, type: 'image/jpeg' }] },
    }),
    'instagram',
  );
  assert.equal(unsigned, null);
});

test('[B1.5-G] the caption is the item TITLE, because that is the tile accessible name', () => {
  // Both social layouts read `item.title` and nothing else for a tile's
  // accessible name: `SocialPanelLayout` puts it in `alt=` on an `<img>` that
  // is the anchor's only child, `MediaMosaicLayout` puts it in `alt=` beside a
  // platform chip. Forced empty, a `social-panel` band emits six links with no
  // accessible name at all and a `media-mosaic` wall emits eight that all
  // announce the platform.
  const item = toSocialPostItem(syncedPost(), 'instagram');
  assert.equal(item?.title, 'Sourdough out of the oven at six');

  // It still rides in `raw.caption` as well, where it already was.
  assert.equal(item?.raw?.caption, 'Sourdough out of the oven at six');

  // The paired refuse, and the half the empty title was protecting: a caption
  // must never become BODY copy. `description` stays absent whatever the row
  // carries, because neither social layout reads it and a prose layout that
  // did would print the whole caption under the picture.
  assert.equal(item?.description, undefined);
  const withProse = toSocialPostItem(
    syncedPost({ objectValue: { description: 'ignored', bio: 'also ignored' } }),
    'instagram',
  );
  assert.equal(withProse?.description, undefined);
});

test('[B1.5-G] a Facebook or LinkedIn caption is read from `postContent`, which is where it lives', () => {
  // Two keys because the four adapters use two: `instagram.js` writes
  // `caption`, `facebook.js` and `linkedIn.js` write `postContent`, and
  // `tiktok.js` writes both. Reading `caption` alone leaves every Facebook and
  // every LinkedIn tile with no accessible name, which is the same WCAG
  // failure as the empty title and would have shipped beside its own fix.
  const fb = toSocialPostItem(
    syncedPost({
      platform: 'facebook',
      objectValue: {
        caption: undefined,
        postContent: 'Doors at seven, first set at eight',
        permalink: 'https://www.facebook.com/bakery/posts/pfbid0abc',
      },
    }),
    'facebook',
  );
  assert.equal(fb?.title, 'Doors at seven, first set at eight');

  // The paired allow for the other key, so this is not a test that passes by
  // reading `postContent` and nothing else.
  assert.equal(toSocialPostItem(syncedPost(), 'instagram')?.title, 'Sourdough out of the oven at six');
});

test('[B1.5-G] a hand-authored row keeps the title a human typed', () => {
  // The Comedy Collective's TikTok rows are hand-made: they carry
  // `objectValue.title` and no caption. Forcing the title empty blanked the
  // accessible name on every one of them, which is a regression rather than a
  // new gap.
  const handMade = toSocialPostItem(
    syncedPost({
      platform: 'tiktok',
      objectValue: {
        caption: undefined,
        postContent: undefined,
        title: 'Open mic, every Tuesday',
        permalink: 'https://www.tiktok.com/@comedy/video/7412',
      },
    }),
    'tiktok',
  );
  assert.equal(handMade?.title, 'Open mic, every Tuesday');

  // The paired refuse: a caption still WINS over a title when both exist. A
  // synced row's title, if an adapter ever writes one, is not the post.
  const both = toSocialPostItem(
    syncedPost({ objectValue: { title: 'not the post' } }),
    'instagram',
  );
  assert.equal(both?.title, 'Sourdough out of the oven at six');
});

test('[B1.5-G] the address is read from `objectValue`, which is where every adapter writes it', () => {
  // The level matters and it was wrong. All three syncing adapters write
  // `permalink` inside `objectValue` (`instagram.js:112`, `facebook.js:98`,
  // `tiktok.js:128`); a mapper reading `raw.permalink` finds `undefined` on
  // every synced row and drops 100% of them, forever, including after the
  // re-sync that was supposed to fix exactly this.
  const item = toSocialPostItem(syncedPost(), 'instagram');
  assert.equal(item?.href, 'https://www.instagram.com/p/C9xYzAbCdEf/');
  assert.equal(item?.raw?.link, 'https://www.instagram.com/p/C9xYzAbCdEf/');

  // The document root is still honoured, for a row a human authored by hand.
  const atRoot = toSocialPostItem(
    syncedPost({
      permalink: 'https://www.instagram.com/p/HandMade/',
      objectValue: { permalink: undefined },
    }),
    'instagram',
  );
  assert.equal(atRoot?.href, 'https://www.instagram.com/p/HandMade/');
});

test('[B1.5-G] the picture is the re-hosted copy, NEVER the platform CDN string', () => {
  // The hotlink is right there in `objectValue.mediaUrls` on every synced row,
  // and the re-host deliberately leaves it there. Without the re-hosted
  // descriptor there must be NO image at all, and therefore no item — not a
  // tile pointed at a URL that rotates.
  const item = toSocialPostItem(syncedPost({ objectValue: { media: undefined } }), 'instagram');
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
      objectValue: {
        link: 'https://some-newspaper.example/article',
        permalink: 'https://www.facebook.com/bakery/posts/pfbid0abc',
        postType: 'post',
      },
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
    syncedPost({
      platform: 'tiktok',
      objectValue: { permalink: 'https://www.tiktok.com/@bakery/video/7412', postType: undefined },
    }),
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
  assert.equal(toSocialPostItem(syncedPost({ objectValue: { media: undefined } }), 'instagram'), null);
  // An EMPTY array, which is what a re-host that copied nothing leaves behind.
  assert.equal(toSocialPostItem(syncedPost({ objectValue: { media: [] } }), 'instagram'), null);
  // A descriptor that was never signed — `currentFile.source` is what makes a
  // value a picture, and an unsigned one would 403 on the page.
  assert.equal(
    toSocialPostItem(syncedPost({ objectValue: { media: [{ key: MEDIA_KEY, name: MEDIA_NAME }] } }), 'instagram'),
    null,
  );
  // What both adapters write when the post has no picture at all: an empty
  // string. It must not read as a picture, and it must not read as an error.
  assert.equal(
    toSocialPostItem(syncedPost({ objectValue: { media: undefined, mediaUrls: '' } }), 'instagram'),
    null,
  );
});

test('[B1.5-C] a post with no outbound address maps to nothing', () => {
  // Every Instagram post Vivreal synced before B1.4 is this row: the Graph
  // query asked for `permalink` and `mapToDocument` dropped it. A tile with no
  // destination renders as a div that goes nowhere, against `media-mosaic`'s
  // own contract that every tile IS an outbound link.
  assert.equal(toSocialPostItem(syncedPost({ objectValue: { permalink: undefined } }), 'instagram'), null);
  assert.equal(toSocialPostItem(syncedPost({ objectValue: { permalink: '   ' } }), 'instagram'), null);
});

test('[B1.5-C] an address that is not https maps to nothing, so no scheme reaches an href', () => {
  // The address is written to `href` AND to `raw.link`, and both social
  // layouts put `raw.link` straight into an anchor. React 19.1 renders a
  // `javascript:` URL there with a development-only warning and no refusal,
  // and an integration object is owner-writable through the CMS, so this is
  // stored cross-site scripting aimed at a customer's own visitors.
  const refused = [
    'javascript:alert(document.cookie)',
    'JaVaScRiPt:alert(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox(1)',
    // Plain http is refused too. A permalink on all four platforms is https,
    // so admitting http buys nothing and costs a mixed-content warning.
    'http://www.instagram.com/p/C9xYzAbCdEf/',
    // A relative path is not an address for a third-party post.
    '/p/C9xYzAbCdEf/',
    '//www.instagram.com/p/C9xYzAbCdEf/',
  ];
  for (const permalink of refused) {
    assert.equal(
      toSocialPostItem(syncedPost({ objectValue: { permalink } }), 'instagram'),
      null,
      `${permalink} must not reach an href`,
    );
  }

  // The control that keeps the guard from being "refuse everything": the real
  // permalink shape of all four platforms still maps.
  for (const permalink of [
    'https://www.instagram.com/p/C9xYzAbCdEf/',
    'https://www.tiktok.com/@bakery/video/7412',
    'https://www.facebook.com/bakery/posts/pfbid0abc',
    'https://www.linkedin.com/feed/update/urn:li:share:7412',
    // Mixed case in the scheme is still https.
    'HTTPS://www.instagram.com/p/C9xYzAbCdEf/',
  ]) {
    const item = toSocialPostItem(syncedPost({ objectValue: { permalink } }), 'instagram');
    assert.ok(item, `${permalink} is a real permalink and must map`);
    assert.equal(item.href, permalink);
  }
});

test('[B1.5-C] a feed of only picture-less posts yields NO items, so the section renders nothing', () => {
  const none = toSocialPostItems(
    [
      syncedPost({ objectValue: { media: undefined } }),
      syncedPost({ _id: 'b', objectValue: { media: undefined } }),
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
    [syncedPost({ objectValue: { media: undefined } }), syncedPost({ _id: 'c' })],
    'instagram',
  );
  assert.equal(some.length, 1);
  assert.equal(some[0].id, 'c');
});

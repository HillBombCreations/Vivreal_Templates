import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// The renderer's real helpers (1.89.1), by relative path: the root barrel pulls
// `next/link`, which plain Node cannot load (see src/lib/detail/productOffer.test.ts).
import {
  collectRichTextImageKeys,
  signRichTextImages,
  stableRichTextImageUrl,
} from '../../../node_modules/@hillbombcreations/site-renderer/dist/lib/richTextImages.js';
import { sanitizeHtml } from '../../../node_modules/@hillbombcreations/site-renderer/dist/lib/sanitizeHtml.js';

/**
 * BLOG2 (vivreal-hq design-blog-inline-images-2026-10-23.md sections 4 and 5):
 * a picture inside a post body is served at `/img/<pageSlug>/<itemId>/<file>`,
 * an address that never expires. The route finds the picture ONLY in that
 * item's own body on this site; the caller's `file` is a lookup key, never a
 * path. The detail page resolves the stored `<img data-media-key>` to that
 * address with the renderer's `stableRichTextImageUrl`.
 *
 * Lazily imported so that, on a tree without the module, the assertions fail
 * rather than the import.
 */
const mod = (await import('./richTextImage.ts').catch(() => null)) as typeof import('./richTextImage.ts') | null;
function api(): typeof import('./richTextImage.ts') {
  assert.ok(mod, 'src/lib/media/richTextImage.ts exists');
  return mod;
}
const tools = { collect: collectRichTextImageKeys, stableUrl: stableRichTextImageUrl };

const POST_ID = '6a01f2b3c4d5e6f708192a3b';
const KEY_A = 'groups/66aa/media/portal-studio-1.png';
const KEY_B = 'groups/66aa/media/portal-studio-2.png';
const OTHER_KEY = 'groups/66aa/media/someone-elses.png';

const figure = (key: string) =>
  `<figure><img data-media-key="${key}" alt="The Studio on a phone" width="1170" height="2532"><figcaption>The Studio.</figcaption></figure>`;
const post = { title: 'Build from your phone', body: `<p>Open the Studio.</p>${figure(KEY_A)}<p>Then the pages.</p>${figure(KEY_B)}` };
const otherPost = { title: 'Another post', body: figure(OTHER_KEY) };
// What VR_Client_API hands back for the whole read: every item's keys, signed.
const signed: Record<string, string> = Object.fromEntries(
  [KEY_A, KEY_B, OTHER_KEY].map((k) => [k, `https://media.vivreal.io/${k}?Expires=1&Signature=x&Key-Pair-Id=k`]),
);

test('ALLOW: each picture in the post body gets its stable address on this page and item', () => {
  const map = api().stableRichTextImageMap('blog', POST_ID, post, tools);
  assert.deepEqual(map, {
    [KEY_A]: `/img/blog/${POST_ID}/portal-studio-1.png`,
    [KEY_B]: `/img/blog/${POST_ID}/portal-studio-2.png`,
  });
});

test('ALLOW: the route finds the stored key for a file named in the post body', () => {
  assert.equal(api().richTextKeyForFile(post, 'portal-studio-2.png', collectRichTextImageKeys), KEY_B);
});

test("REFUSE: a picture from another item's body is never served under this item, even though the read signed it", () => {
  assert.ok(signed[OTHER_KEY], 'control: the read does carry a signed URL for it');
  assert.equal(api().richTextKeyForFile(post, 'someone-elses.png', collectRichTextImageKeys), undefined);
  assert.equal(Object.hasOwn(api().stableRichTextImageMap('blog', POST_ID, post, tools), OTHER_KEY), false);
  assert.equal(api().richTextKeyForFile(otherPost, 'someone-elses.png', collectRichTextImageKeys), OTHER_KEY, 'control: its own item finds it');
});

test('REFUSE: an unknown file, an empty one, or no item at all finds nothing', () => {
  for (const raw of [post, undefined, {}]) {
    for (const file of ['nope.png', '']) assert.equal(api().richTextKeyForFile(raw, file, collectRichTextImageKeys), undefined, `${file}`);
  }
});

test('REFUSE: path tricks in the file are lookups that match nothing, never a path', () => {
  const tricks = [
    '..',
    '../portal-studio-1.png',
    '..%2Fportal-studio-1.png',
    '%2e%2e',
    KEY_A,
    'media/portal-studio-1.png',
    'portal-studio-1.png?Signature=x',
    'portal-studio-1.png#x',
    'portal-studio-1.png/',
    '.portal-studio-1.png',
    'PORTAL-STUDIO-1.PNG',
    ' portal-studio-1.png',
  ];
  for (const file of tricks) assert.equal(api().richTextKeyForFile(post, file, collectRichTextImageKeys), undefined, JSON.stringify(file));
  // A stored key whose last segment is itself a trick is never addressable.
  const sly = { body: '<img data-media-key="groups/66aa/..">' };
  assert.equal(api().richTextKeyForFile(sly, '..', collectRichTextImageKeys), undefined);
  assert.deepEqual(api().stableRichTextImageMap('blog', POST_ID, sly, tools), {});
});

test('REFUSE: two pictures with one file name: only the first gets the address the route serves; the second keeps its signed URL', () => {
  const twin = 'groups/77bb/other/portal-studio-1.png';
  const raw = { body: figure(KEY_A) + figure(twin) };
  const map = api().stableRichTextImageMap('blog', POST_ID, raw, tools);
  assert.deepEqual(Object.keys(map), [KEY_A]);
  assert.equal(api().richTextKeyForFile(raw, 'portal-studio-1.png', collectRichTextImageKeys), KEY_A, 'the route serves the first, the same one the map names');
});

test('REFUSE: a page slug or item id outside the address charset gives no stable address (the signed URL stays)', () => {
  assert.deepEqual(api().stableRichTextImageMap('Blog Posts', POST_ID, post, tools), {});
  assert.deepEqual(api().stableRichTextImageMap('blog', 'bad id/..', post, tools), {});
});

test('NEXT HOP: through the renderer sanitizer the stable address, its size and caption survive; a signed one still renders', () => {
  const merged = { ...signed, ...api().stableRichTextImageMap('blog', POST_ID, post, tools) };
  const html = sanitizeHtml(signRichTextImages(post.body + figure(OTHER_KEY), (k: string) => merged[k]));
  assert.match(html, new RegExp(`<img[^>]*src="/img/blog/${POST_ID}/portal-studio-1\\.png"`));
  assert.match(html, new RegExp(`<img[^>]*src="/img/blog/${POST_ID}/portal-studio-2\\.png"`));
  assert.match(html, /width="1170"/);
  assert.match(html, /<figcaption>The Studio\.<\/figcaption>/);
  assert.match(html, /src="https:\/\/media\.vivreal\.io\/groups\/66aa\/media\/someone-elses\.png/, 'a key outside this post keeps today\'s signed URL');
  assert.doesNotMatch(html, /src="\/img\/blog\/[^"]*someone-elses/);
});

const source = (relative: string) => {
  const url = new URL(relative, import.meta.url);
  let text = '';
  try {
    text = readFileSync(url, 'utf8');
  } catch {
    // Missing file: the assertion below names it.
  }
  assert.ok(text, `${relative} exists`);
  return text;
};

test('SOURCE PIN: the route is keyed by this site, reads nothing from the request, and answers through the stable image response', () => {
  const route = source('../../app/img/[slug]/[itemId]/[file]/route.ts');
  for (const piece of [
    'getSiteData()',
    "siteData.degraded === true",
    'getPageBySlug(siteData, slug)',
    'isPageTurnedOff(page)',
    'servesCollectionDetail(page)',
    'richTextImageSignedUrl(siteData, page, itemId, file)',
    'withDemoRobotsHeader(await stableImageResponse(signedUrl), isDemoSite(siteData))',
  ]) {
    assert.ok(route.includes(piece), `route must use ${piece}`);
  }
  assert.ok(!/searchParams|request\.url|req\.url|headers\.get/.test(route), 'the route must not read caller input');
});

test('SOURCE PIN: the post detail arm resolves its own body pictures to the stable address in both renders', () => {
  const page = source('../../app/[slug]/[itemId]/page.tsx');
  const start = page.indexOf('if (servesCollectionDetail(pageConfig)) {');
  assert.ok(start > 0, 'sanity: the collection arm was found');
  const end = page.indexOf('// Menu item detail', start);
  assert.ok(end > start, 'sanity: the arm ends before the menu arm');
  const arm = page.slice(start, end);
  assert.ok(arm.includes('stableRichTextImageMap(slug, item.id, item.raw,'), 'the map is built from the looked-up item');
  assert.equal(arm.split('<RichTextImages map={postImages}>').length - 1, 2, 'both renders in the arm use it');
});

test('NEXT HOP: middleware lets the picture address through to the route (no probe 404)', async () => {
  const { isNeverAPagePath, hasProbeExtension } = await import('../neverAPagePath.ts');
  const address = `/img/blog/${POST_ID}/portal-studio-1.png`;
  assert.equal(isNeverAPagePath(address), false);
  assert.equal(hasProbeExtension(address), false);
  assert.equal(isNeverAPagePath('/img/blog/x/.env'), true, 'control: the same check does refuse a probe');
});
